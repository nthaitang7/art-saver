import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const defaultDir = resolve(here, "../data/previews");

const EXTENSIONS: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/bmp": ".bmp",
  "image/svg+xml": ".svg",
};

export function previewDir(): string {
  return process.env.ART_PREVIEW_DIR ?? defaultDir;
}

/** Write fetched bytes into the preview cache. Returns the stored file name, or null if it failed. */
export function savePreviewBuffer(itemId: string, bytes: Buffer, contentType: string | null): string | null {
  try {
    const dir = previewDir();
    mkdirSync(dir, { recursive: true });
    const extension = (contentType && EXTENSIONS[contentType]) || ".img";
    const file = `${itemId}${extension}`;
    writeFileSync(join(dir, file), bytes);
    return file;
  } catch {
    return null;
  }
}

/** Resolve a stored preview file name to an absolute path, refusing anything outside the cache dir. */
export function resolvePreviewFile(file: string): string | null {
  if (file.includes("/") || file.includes("\\") || file.includes("..")) return null;
  return join(previewDir(), file);
}