import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

export type DB = Database.Database;

const here = dirname(fileURLToPath(import.meta.url));
const defaultFile = resolve(here, "../data/art.db");

/** Open the sqlite database and make sure the schema exists. Pass ":memory:" for tests. */
export function openDatabase(file: string = process.env.ART_DB ?? defaultFile): DB {
  if (file !== ":memory:") {
    mkdirSync(dirname(file), { recursive: true });
  }
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db: DB): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS libraries (
      id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_libraries_token ON libraries(token_hash);

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      library_id TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_categories_library ON categories(library_id);

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      library_id TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      title TEXT,
      image_url TEXT,
      preview_file TEXT,
      width INTEGER,
      height INTEGER,
      preview_status TEXT NOT NULL DEFAULT 'pending',
      preview_error TEXT,
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_items_library ON items(library_id);

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      author TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_comments_item ON comments(item_id);
  `);
}