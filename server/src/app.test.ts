import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Express } from "express";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type {
  CreateLibraryResponse,
  ItemResponse,
  LibraryState,
  PreviewStatus,
} from "@art/shared";
import { createApp } from "./app";
import { openDatabase } from "./db";
import type { PreviewFetcher, PreviewResult } from "./preview";
import { Store } from "./store";

// A 1x1 PNG so preview bytes are real image data the cache can store and serve.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const okPreview: PreviewFetcher = async (url): Promise<PreviewResult> => ({
  imageUrl: url,
  contentType: "image/png",
  title: "A nice piece",
  width: 1,
  height: 1,
  bytes: PNG,
});

const failingPreview: PreviewFetcher = async (): Promise<PreviewResult> => ({
  imageUrl: null,
  contentType: null,
  title: null,
  width: null,
  height: null,
  bytes: null,
  error: "No preview image found on that page",
});

function buildApp(preview: PreviewFetcher = okPreview): Express {
  return createApp(new Store(openDatabase(":memory:")), { preview });
}

async function createLibrary(app: Express): Promise<string> {
  const res = await request(app).post("/api/library").expect(201);
  return (res.body as CreateLibraryResponse).session.token;
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function addItem(app: Express, token: string, body: Record<string, unknown>): Promise<ItemResponse["item"]> {
  const res = await request(app).post("/api/items").set(auth(token)).send(body).expect(201);
  return (res.body as ItemResponse).item;
}

async function waitForStatus(
  app: Express,
  token: string,
  itemId: string,
  status: PreviewStatus,
): Promise<ItemResponse["item"]> {
  const start = Date.now();
  for (;;) {
    const res = await request(app).get(`/api/items/${itemId}`).set(auth(token)).expect(200);
    const item = (res.body as ItemResponse).item;
    if (item.previewStatus === status) return item;
    if (Date.now() - start > 2000) throw new Error(`item stayed ${item.previewStatus}, wanted ${status}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe("library api", () => {
  let app: Express;

  beforeAll(() => {
    process.env.ART_PREVIEW_DIR = mkdtempSync(join(tmpdir(), "art-previews-"));
  });

  beforeEach(() => {
    app = buildApp();
  });

  it("creates an empty library and hands back a token", async () => {
    const res = await request(app).post("/api/library").expect(201);
    const body = res.body as CreateLibraryResponse;
    expect(body.session.token).toHaveLength(64);
    expect(body.library.items).toEqual([]);
    expect(body.library.categories).toEqual([]);
    expect(body.library.revision).toBe(0);
  });

  it("refuses library reads without a session", async () => {
    await request(app).get("/api/library").expect(401);
    await request(app).get("/api/library").set("Authorization", "Bearer nope").expect(401);
  });

  it("saves a link and fills in a preview", async () => {
    const token = await createLibrary(app);
    const item = await addItem(app, token, { url: "https://example.com/art.png" });
    expect(item.previewStatus).toBe("pending");

    const ready = await waitForStatus(app, token, item.id, "ready");
    expect(ready.imageUrl).toBe("https://example.com/art.png");
    expect(ready.previewUrl).toBe(`/api/previews/${item.id}`);
    expect(ready.title).toBe("A nice piece");
    expect(ready.width).toBe(1);
    expect(ready.height).toBe(1);
  });

  it("serves the cached preview bytes", async () => {
    const token = await createLibrary(app);
    const item = await addItem(app, token, { url: "https://example.com/art.png" });
    await waitForStatus(app, token, item.id, "ready");

    const res = await request(app).get(`/api/previews/${item.id}`).expect(200);
    expect(res.headers["content-type"]).toContain("image/png");
    expect(res.body).toEqual(PNG);
  });

  it("records a failed preview instead of blocking the save", async () => {
    app = buildApp(failingPreview);
    const token = await createLibrary(app);
    const item = await addItem(app, token, { url: "https://example.com/no-image" });
    const failed = await waitForStatus(app, token, item.id, "failed");
    expect(failed.previewUrl).toBeNull();
    expect(failed.previewError).toContain("No preview");
  });

  it("rejects links that are not http or https", async () => {
    const token = await createLibrary(app);
    await request(app).post("/api/items").set(auth(token)).send({ url: "ftp://example.com/a.png" }).expect(400);
    await request(app).post("/api/items").set(auth(token)).send({ url: "not a link" }).expect(400);
  });

  it("bumps the revision when the library changes", async () => {
    const token = await createLibrary(app);
    const before = (await request(app).get("/api/library").set(auth(token))).body as LibraryState;
    await addItem(app, token, { url: "https://example.com/a.png" });
    const after = (await request(app).get("/api/library").set(auth(token))).body as LibraryState;
    expect(after.revision).toBeGreaterThan(before.revision);
    expect(after.items).toHaveLength(1);
  });

  it("keeps one library's items out of another's", async () => {
    const a = await createLibrary(app);
    const b = await createLibrary(app);
    const item = await addItem(app, a, { url: "https://example.com/a.png" });

    await request(app).get(`/api/items/${item.id}`).set(auth(b)).expect(404);
    const bState = (await request(app).get("/api/library").set(auth(b))).body as LibraryState;
    expect(bState.items).toEqual([]);
  });

  it("updates an item's title and category", async () => {
    const token = await createLibrary(app);
    const item = await addItem(app, token, { url: "https://example.com/a.png" });

    const catRes = await request(app).post("/api/categories").set(auth(token)).send({ name: "Portraits" }).expect(201);
    const categoryId = (catRes.body as { category: { id: string } }).category.id;

    const res = await request(app)
      .patch(`/api/items/${item.id}`)
      .set(auth(token))
      .send({ title: "Sunset study", categoryId })
      .expect(200);
    const updated = (res.body as ItemResponse).item;
    expect(updated.title).toBe("Sunset study");
    expect(updated.categoryId).toBe(categoryId);
  });

  it("rejects an unknown category", async () => {
    const token = await createLibrary(app);
    await request(app)
      .post("/api/items")
      .set(auth(token))
      .send({ url: "https://example.com/a.png", categoryId: "11111111-1111-1111-1111-111111111111" })
      .expect(400);
  });

  it("unassigns items when a category is deleted", async () => {
    const token = await createLibrary(app);
    const catRes = await request(app).post("/api/categories").set(auth(token)).send({ name: "Sketches" }).expect(201);
    const categoryId = (catRes.body as { category: { id: string } }).category.id;
    const item = await addItem(app, token, { url: "https://example.com/a.png", categoryId });

    await request(app).delete(`/api/categories/${categoryId}`).set(auth(token)).expect(204);

    const res = await request(app).get(`/api/items/${item.id}`).set(auth(token)).expect(200);
    expect((res.body as ItemResponse).item.categoryId).toBeNull();
  });

  it("adds and deletes comments", async () => {
    const token = await createLibrary(app);
    const item = await addItem(app, token, { url: "https://example.com/a.png" });

    const added = await request(app)
      .post(`/api/items/${item.id}/comments`)
      .set(auth(token))
      .send({ author: "Sam", body: "Love the colors" })
      .expect(201);
    const detail = (added.body as ItemResponse).item;
    expect(detail.comments).toHaveLength(1);
    expect(detail.commentCount).toBe(1);
    const commentId = detail.comments[0]!.id;

    await request(app).delete(`/api/items/${item.id}/comments/${commentId}`).set(auth(token)).expect(204);
    const after = await request(app).get(`/api/items/${item.id}`).set(auth(token)).expect(200);
    expect((after.body as ItemResponse).item.comments).toHaveLength(0);
  });

  it("deletes an item", async () => {
    const token = await createLibrary(app);
    const item = await addItem(app, token, { url: "https://example.com/a.png" });
    await request(app).delete(`/api/items/${item.id}`).set(auth(token)).expect(204);
    await request(app).get(`/api/items/${item.id}`).set(auth(token)).expect(404);
  });
});