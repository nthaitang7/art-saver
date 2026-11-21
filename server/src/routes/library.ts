import { Router, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import {
  addCommentSchema,
  addItemSchema,
  createCategorySchema,
  idSchema,
  updateItemSchema,
} from "@art/shared";
import type { CategoryResponse, CreateLibraryResponse, ItemDetail, ItemResponse, LibraryState } from "@art/shared";
import { hashToken, newToken } from "../auth";
import type { PreviewFetcher } from "../preview";
import { resolvePreviewFile, savePreviewBuffer } from "../previewCache";
import { Store, toCategory, toComment, type ItemRecord, type LibraryRecord } from "../store";

function sendError(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
}

/** Require a bearer token that maps to a library. */
function requireAuth(store: Store): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
    if (!token) {
      sendError(res, 401, "Missing session");
      return;
    }
    const library = store.findLibraryByToken(hashToken(token));
    if (!library) {
      sendError(res, 401, "Invalid session");
      return;
    }
    res.locals.library = library;
    next();
  };
}

/** Resolve :id to an item owned by the caller's library, or 404. */
function loadItem(store: Store): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = idSchema.safeParse(req.params.id);
    if (!parsed.success) {
      sendError(res, 400, "Invalid item id");
      return;
    }
    const item = store.getItem(parsed.data);
    const library = res.locals.library as LibraryRecord;
    if (!item || item.library_id !== library.id) {
      sendError(res, 404, "Item not found");
      return;
    }
    res.locals.item = item;
    next();
  };
}

function ownedCategory(store: Store, libraryId: string, categoryId: string | null | undefined): boolean {
  if (categoryId === null || categoryId === undefined) return true;
  const category = store.getCategory(categoryId);
  return category !== null && category.library_id === libraryId;
}

function itemDetail(store: Store, item: ItemRecord): ItemDetail {
  const summary = store.getItemSummary(item.id);
  return {
    ...(summary as ItemDetail),
    comments: store.getComments(item.id).map(toComment),
  };
}

/**
 * Fetch a preview in the background and store the result. The item already exists as "pending",
 * so a slow or failing fetch never blocks saving the link.
 */
async function generatePreview(store: Store, fetcher: PreviewFetcher, itemId: string, url: string): Promise<void> {
  try {
    const result = await fetcher(url);
    const ready = result.imageUrl !== null;
    const previewFile = ready && result.bytes ? savePreviewBuffer(itemId, result.bytes, result.contentType) : null;

    store.setPreview(itemId, {
      imageUrl: result.imageUrl,
      previewFile,
      width: result.width,
      height: result.height,
      status: ready ? "ready" : "failed",
      error: ready ? null : (result.error ?? "No preview available"),
    });

    if (result.title) {
      const item = store.getItem(itemId);
      if (item && !item.title) store.updateItem(itemId, { title: result.title });
    }
  } catch (err) {
    store.setPreview(itemId, {
      imageUrl: null,
      previewFile: null,
      width: null,
      height: null,
      status: "failed",
      error: err instanceof Error ? err.message : "Preview failed",
    });
  }
}

export function libraryRouter(store: Store, fetcher: PreviewFetcher): Router {
  const router = Router();

  // First run. Creates a private library and hands back the only copy of its token.
  router.post("/library", (req: Request, res: Response) => {
    const token = newToken();
    const library = store.createLibrary(hashToken(token));
    const body: CreateLibraryResponse = {
      library: store.getLibraryState(library),
      session: { token },
    };
    res.status(201).json(body);
  });

  router.get("/library", requireAuth(store), (req: Request, res: Response) => {
    const library = res.locals.library as LibraryRecord;
    res.json(store.getLibraryState(library) satisfies LibraryState);
  });

  // Previews are served by unguessable item id because img tags cannot send an auth header.
  router.get("/previews/:id", (req: Request, res: Response) => {
    const parsed = idSchema.safeParse(req.params.id);
    if (!parsed.success) {
      sendError(res, 404, "Not found");
      return;
    }
    const item = store.getItem(parsed.data);
    if (!item?.preview_file) {
      sendError(res, 404, "Not found");
      return;
    }
    const file = resolvePreviewFile(item.preview_file);
    if (!file) {
      sendError(res, 404, "Not found");
      return;
    }
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.sendFile(file);
  });

  router.post("/items", requireAuth(store), (req: Request, res: Response) => {
    const library = res.locals.library as LibraryRecord;
    const parsed = addItemSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, parsed.error.issues[0]?.message ?? "Invalid link");
      return;
    }
    if (!ownedCategory(store, library.id, parsed.data.categoryId)) {
      sendError(res, 400, "Unknown category");
      return;
    }

    const item = store.createItem(library.id, {
      url: parsed.data.url,
      title: parsed.data.title ?? null,
      categoryId: parsed.data.categoryId ?? null,
    });
    void generatePreview(store, fetcher, item.id, item.url);

    const body: ItemResponse = { item: itemDetail(store, item) };
    res.status(201).json(body);
  });

  const itemScoped = [requireAuth(store), loadItem(store)];

  router.get("/items/:id", ...itemScoped, (req: Request, res: Response) => {
    const body: ItemResponse = { item: itemDetail(store, res.locals.item as ItemRecord) };
    res.json(body);
  });

  router.patch("/items/:id", ...itemScoped, (req: Request, res: Response) => {
    const library = res.locals.library as LibraryRecord;
    const item = res.locals.item as ItemRecord;
    const parsed = updateItemSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, parsed.error.issues[0]?.message ?? "Invalid update");
      return;
    }
    if (!ownedCategory(store, library.id, parsed.data.categoryId)) {
      sendError(res, 400, "Unknown category");
      return;
    }

    store.updateItem(item.id, parsed.data);
    const fresh = store.getItem(item.id) as ItemRecord;
    const body: ItemResponse = { item: itemDetail(store, fresh) };
    res.json(body);
  });

  router.delete("/items/:id", ...itemScoped, (req: Request, res: Response) => {
    store.deleteItem((res.locals.item as ItemRecord).id);
    res.status(204).end();
  });

  router.post("/items/:id/comments", ...itemScoped, (req: Request, res: Response) => {
    const item = res.locals.item as ItemRecord;
    const parsed = addCommentSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, parsed.error.issues[0]?.message ?? "Invalid comment");
      return;
    }
    store.addComment(item.id, parsed.data.author, parsed.data.body);
    const body: ItemResponse = { item: itemDetail(store, item) };
    res.status(201).json(body);
  });

  router.delete("/items/:id/comments/:commentId", ...itemScoped, (req: Request, res: Response) => {
    const item = res.locals.item as ItemRecord;
    const parsed = idSchema.safeParse(req.params.commentId);
    if (!parsed.success) {
      sendError(res, 400, "Invalid comment id");
      return;
    }
    const comment = store.getComment(parsed.data);
    if (!comment || comment.item_id !== item.id) {
      sendError(res, 404, "Comment not found");
      return;
    }
    store.deleteComment(comment.id);
    res.status(204).end();
  });

  router.post("/categories", requireAuth(store), (req: Request, res: Response) => {
    const library = res.locals.library as LibraryRecord;
    const parsed = createCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, parsed.error.issues[0]?.message ?? "Invalid category");
      return;
    }
    const category = store.createCategory(library.id, parsed.data.name);
    const body: CategoryResponse = { category: toCategory(category) };
    res.status(201).json(body);
  });

  router.delete("/categories/:id", requireAuth(store), (req: Request, res: Response) => {
    const library = res.locals.library as LibraryRecord;
    const parsed = idSchema.safeParse(req.params.id);
    if (!parsed.success) {
      sendError(res, 400, "Invalid category id");
      return;
    }
    const category = store.getCategory(parsed.data);
    if (!category || category.library_id !== library.id) {
      sendError(res, 404, "Category not found");
      return;
    }
    store.deleteCategory(category.id);
    res.status(204).end();
  });

  return router;
}