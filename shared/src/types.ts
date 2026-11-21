/** Preview generation state for a saved item. */
export type PreviewStatus = "pending" | "ready" | "failed";

export interface Category {
  id: string;
  name: string;
}

export interface Comment {
  id: string;
  author: string;
  body: string;
  createdAt: number;
}

/** An item as it appears in the library grid. Comment bodies are only in the detail payload. */
export interface ItemSummary {
  id: string;
  url: string;
  title: string | null;
  imageUrl: string | null;
  previewUrl: string | null;
  width: number | null;
  height: number | null;
  previewStatus: PreviewStatus;
  previewError: string | null;
  categoryId: string | null;
  commentCount: number;
  createdAt: number;
}

/** A single item together with its comments, used by the detail view. */
export interface ItemDetail extends ItemSummary {
  comments: Comment[];
}

/** Everything the owner of a library can see. */
export interface LibraryState {
  revision: number;
  categories: Category[];
  items: ItemSummary[];
}

/** Handed to a client the first time it uses the app. Stored hashed on the server. */
export interface LibrarySession {
  token: string;
}

export interface CreateLibraryResponse {
  library: LibraryState;
  session: LibrarySession;
}

export interface ItemResponse {
  item: ItemDetail;
}

export interface CategoryResponse {
  category: Category;
}

export interface HealthResponse {
  ok: boolean;
}

export type SortField = "date" | "link";
export type SortDirection = "asc" | "desc";

export interface ApiErrorBody {
  error: string;
}