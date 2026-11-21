import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { imageDimensions } from "./imageSize";

export interface PreviewResult {
  imageUrl: string | null;
  contentType: string | null;
  title: string | null;
  width: number | null;
  height: number | null;
  bytes: Buffer | null;
  error?: string;
}

/** Given a page or image URL, find a preview image and its dimensions. */
export type PreviewFetcher = (url: string) => Promise<PreviewResult>;

const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 12 * 1024 * 1024;
const TITLE_MAX = 200;

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i;

/** True for loopback, private, link-local and other addresses we refuse to fetch. */
function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const parts = address.split(".").map((part) => Number(part));
    const a = parts[0] ?? -1;
    const b = parts[1] ?? -1;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  if (version === 6) {
    const lower = address.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fe80") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("::ffff:")) return isPrivateAddress(lower.slice("::ffff:".length));
  }
  return false;
}

/** Reject anything that is not a public http(s) URL so a saved link cannot be used for SSRF. */
export async function assertPublicHttpUrl(input: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("That is not a valid link");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https links are allowed");
  }

  // Bracket-stripped so literal IPv6 hosts are checked instead of being sent to DNS.
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    throw new Error("That host is not allowed");
  }

  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new Error("That host is not allowed");
    return url;
  }

  const addresses = await lookup(host, { all: true });
  if (addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error("That host is not allowed");
  }

  return url;
}

async function fetchLimited(url: string): Promise<Response> {
  return fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      "user-agent": "ArtSaver/0.1 preview fetcher",
      accept: "text/html,image/*;q=0.9,*/*;q=0.5",
    },
  });
}

async function readBytes(res: Response): Promise<Buffer> {
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength > MAX_BYTES) throw new Error("That image is too large to preview");
  return buffer;
}

function dimensions(bytes: Buffer): { width: number | null; height: number | null } {
  try {
    return imageDimensions(bytes);
  } catch {
    return { width: null, height: null };
  }
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

function findMeta(html: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${escaped}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeEntities(match[1]);
  }
  return null;
}

function extractMeta(html: string, baseUrl: string): { image: string | null; title: string | null } {
  const rawImage =
    findMeta(html, "og:image") ?? findMeta(html, "twitter:image") ?? findMeta(html, "twitter:image:src");
  const rawTitle = findMeta(html, "og:title") ?? html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? null;

  let image: string | null = null;
  if (rawImage) {
    try {
      image = new URL(rawImage, baseUrl).toString();
    } catch {
      image = null;
    }
  }

  const title = rawTitle ? rawTitle.trim().slice(0, TITLE_MAX) : null;
  return { image, title };
}

function failed(error: string): PreviewResult {
  return { imageUrl: null, contentType: null, title: null, width: null, height: null, bytes: null, error };
}

function imageResult(url: string, contentType: string, bytes: Buffer, title: string | null = null): PreviewResult {
  return { imageUrl: url, contentType, title, ...dimensions(bytes), bytes };
}

/** Fetch a link and turn it into a preview. Never throws; failures come back as a result. */
export const fetchPreview: PreviewFetcher = async (rawUrl) => {
  try {
    const url = await assertPublicHttpUrl(rawUrl);
    const res = await fetchLimited(url.toString());
    if (!res.ok) return failed(`The link returned ${res.status}`);

    // Redirects can land somewhere we would have refused up front.
    const finalUrl = new URL(res.url || url.toString());
    await assertPublicHttpUrl(finalUrl.toString());

    const contentType = res.headers.get("content-type") ?? "";
    const mime = contentType.split(";")[0]?.trim().toLowerCase() ?? "";

    if (mime.startsWith("image/") || IMAGE_EXT.test(finalUrl.pathname)) {
      const bytes = await readBytes(res);
      return imageResult(finalUrl.toString(), mime || "image/*", bytes);
    }

    if (mime === "text/html" || mime === "application/xhtml+xml" || mime === "") {
      const html = await res.text();
      const meta = extractMeta(html, finalUrl.toString());
      if (!meta.image) return failed("No preview image found on that page");

      const imageUrl = await assertPublicHttpUrl(meta.image);
      const imageRes = await fetchLimited(imageUrl.toString());
      if (!imageRes.ok) return failed(`The preview image returned ${imageRes.status}`);
      const imageType = (imageRes.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
      const bytes = await readBytes(imageRes);
      return imageResult(imageUrl.toString(), imageType || "image/*", bytes, meta.title);
    }

    return failed("That link is neither an image nor a web page");
  } catch (err) {
    return failed(err instanceof Error ? err.message : "Could not fetch a preview");
  }
};