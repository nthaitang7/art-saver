import { randomUUID } from "node:crypto";
import type { Category, Comment, ItemSummary, LibraryState, PreviewStatus } from "@art/shared";
import type { DB } from "./db";

export interface LibraryRecord {
  id: string;
  token_hash: string;
  revision: number;
  created_at: number;
}

export interface CategoryRecord {
  id: string;
  library_id: string;
  name: string;
  created_at: number;
}

export interface ItemRecord {
  id: string;
  library_id: string;
  url: string;
  title: string | null;
  image_url: string | null;
  preview_file: string | null;
  width: number | null;
  height: number | null;
  preview_status: string;
  preview_error: string | null;
  category_id: string | null;
  created_at: number;
}

interface ItemWithCount extends ItemRecord {
  comment_count: number;
}

export interface CommentRecord {
  id: string;
  item_id: string;
  author: string;
  body: string;
  created_at: number;
}

export function toCategory(record: CategoryRecord): Category {
  return { id: record.id, name: record.name };
}

export function toComment(record: CommentRecord): Comment {
  return { id: record.id, author: record.author, body: record.body, createdAt: record.created_at };
}

/** Turn an internal item row into the shape the client renders. */
export function toItemSummary(record: ItemRecord, commentCount: number): ItemSummary {
  const hasPreview = record.preview_status === "ready" && record.preview_file !== null;

  return {
    id: record.id,
    url: record.url,
    title: record.title,
    imageUrl: record.image_url,
    previewUrl: hasPreview ? `/api/previews/${record.id}` : null,
    width: record.width,
    height: record.height,
    previewStatus: record.preview_status as PreviewStatus,
    previewError: record.preview_error,
    categoryId: record.category_id,
    commentCount,
    createdAt: record.created_at,
  };
}

export interface PreviewPatch {
  imageUrl: string | null;
  previewFile: string | null;
  width: number | null;
  height: number | null;
  status: PreviewStatus;
  error: string | null;
}

/**
 * All library state lives behind this class. Every mutation bumps the library revision inside the
 * same transaction, so pollers can skip work when nothing changed.
 */
export class Store {
  constructor(private readonly db: DB) {}

  createLibrary(tokenHash: string): LibraryRecord {
    const id = randomUUID();
    const now = Date.now();
    this.db
      .prepare("INSERT INTO libraries (id, token_hash, revision, created_at) VALUES (?, ?, 0, ?)")
      .run(id, tokenHash, now);
    return this.getLibrary(id) as LibraryRecord;
  }

  getLibrary(id: string): LibraryRecord | null {
    const row = this.db.prepare("SELECT * FROM libraries WHERE id = ?").get(id) as LibraryRecord | undefined;
    return row ?? null;
  }

  findLibraryByToken(tokenHash: string): LibraryRecord | null {
    const row = this.db.prepare("SELECT * FROM libraries WHERE token_hash = ?").get(tokenHash) as
      | LibraryRecord
      | undefined;
    return row ?? null;
  }

  getCategories(libraryId: string): CategoryRecord[] {
    return this.db
      .prepare("SELECT * FROM categories WHERE library_id = ? ORDER BY created_at ASC")
      .all(libraryId) as CategoryRecord[];
  }

  getCategory(id: string): CategoryRecord | null {
    const row = this.db.prepare("SELECT * FROM categories WHERE id = ?").get(id) as CategoryRecord | undefined;
    return row ?? null;
  }

  createCategory(libraryId: string, name: string): CategoryRecord {
    const id = randomUUID();
    const now = Date.now();
    this.db.transaction(() => {
      this.db
        .prepare("INSERT INTO categories (id, library_id, name, created_at) VALUES (?, ?, ?, ?)")
        .run(id, libraryId, name, now);
      this.touch(libraryId);
    })();
    return this.getCategory(id) as CategoryRecord;
  }

  /** Deleting a category unassigns its items so nothing is ever dropped with it. */
  deleteCategory(id: string): void {
    const category = this.getCategory(id);
    if (!category) return;
    this.db.transaction(() => {
      this.db.prepare("UPDATE items SET category_id = NULL WHERE category_id = ?").run(id);
      this.db.prepare("DELETE FROM categories WHERE id = ?").run(id);
      this.touch(category.library_id);
    })();
  }

  getItems(libraryId: string): ItemSummary[] {
    const rows = this.db
      .prepare(
        `SELECT items.*, (SELECT COUNT(*) FROM comments WHERE comments.item_id = items.id) AS comment_count
         FROM items WHERE items.library_id = ? ORDER BY items.created_at DESC`,
      )
      .all(libraryId) as ItemWithCount[];
    return rows.map((row) => toItemSummary(row, row.comment_count));
  }

  getItem(id: string): ItemRecord | null {
    const row = this.db.prepare("SELECT * FROM items WHERE id = ?").get(id) as ItemRecord | undefined;
    return row ?? null;
  }

  getItemSummary(id: string): ItemSummary | null {
    const row = this.db
      .prepare(
        `SELECT items.*, (SELECT COUNT(*) FROM comments WHERE comments.item_id = items.id) AS comment_count
         FROM items WHERE items.id = ?`,
      )
      .get(id) as ItemWithCount | undefined;
    return row ? toItemSummary(row, row.comment_count) : null;
  }

  getLibraryState(library: LibraryRecord): LibraryState {
    return {
      revision: library.revision,
      categories: this.getCategories(library.id).map(toCategory),
      items: this.getItems(library.id),
    };
  }

  createItem(libraryId: string, input: { url: string; title: string | null; categoryId: string | null }): ItemRecord {
    const id = randomUUID();
    const now = Date.now();
    this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO items (id, library_id, url, title, category_id, preview_status, created_at)
           VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
        )
        .run(id, libraryId, input.url, input.title, input.categoryId, now);
      this.touch(libraryId);
    })();
    return this.getItem(id) as ItemRecord;
  }

  updateItem(id: string, patch: { title?: string | null; categoryId?: string | null }): void {
    const item = this.getItem(id);
    if (!item) return;
    const title = patch.title !== undefined ? patch.title : item.title;
    const categoryId = patch.categoryId !== undefined ? patch.categoryId : item.category_id;
    this.db.transaction(() => {
      this.db.prepare("UPDATE items SET title = ?, category_id = ? WHERE id = ?").run(title, categoryId, id);
      this.touch(item.library_id);
    })();
  }

  deleteItem(id: string): void {
    const item = this.getItem(id);
    if (!item) return;
    this.db.transaction(() => {
      this.db.prepare("DELETE FROM items WHERE id = ?").run(id);
      this.touch(item.library_id);
    })();
  }

  setPreview(id: string, patch: PreviewPatch): void {
    const item = this.getItem(id);
    if (!item) return;
    this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE items SET image_url = ?, preview_file = ?, width = ?, height = ?, preview_status = ?, preview_error = ?
           WHERE id = ?`,
        )
        .run(patch.imageUrl, patch.previewFile, patch.width, patch.height, patch.status, patch.error, id);
      this.touch(item.library_id);
    })();
  }

  getComments(itemId: string): CommentRecord[] {
    return this.db
      .prepare("SELECT * FROM comments WHERE item_id = ? ORDER BY created_at ASC")
      .all(itemId) as CommentRecord[];
  }

  getComment(id: string): CommentRecord | null {
    const row = this.db.prepare("SELECT * FROM comments WHERE id = ?").get(id) as CommentRecord | undefined;
    return row ?? null;
  }

  addComment(itemId: string, author: string, body: string): CommentRecord | null {
    const item = this.getItem(itemId);
    if (!item) return null;
    const id = randomUUID();
    const now = Date.now();
    this.db.transaction(() => {
      this.db
        .prepare("INSERT INTO comments (id, item_id, author, body, created_at) VALUES (?, ?, ?, ?, ?)")
        .run(id, itemId, author, body, now);
      this.touch(item.library_id);
    })();
    return this.getComment(id);
  }

  deleteComment(id: string): void {
    const comment = this.getComment(id);
    if (!comment) return;
    const item = this.getItem(comment.item_id);
    if (!item) return;
    this.db.transaction(() => {
      this.db.prepare("DELETE FROM comments WHERE id = ?").run(id);
      this.touch(item.library_id);
    })();
  }

  private touch(libraryId: string): void {
    this.db.prepare("UPDATE libraries SET revision = revision + 1 WHERE id = ?").run(libraryId);
  }
}