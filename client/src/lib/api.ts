import type {
  CategoryResponse,
  CreateLibraryResponse,
  ItemResponse,
  LibraryState,
} from "@art/shared";

const BASE = "/api";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const res = await fetch(`${BASE}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : "Request failed";
    throw new ApiError(res.status, message);
  }

  return data as T;
}

export const api = {
  createLibrary: () => request<CreateLibraryResponse>("/library", { method: "POST" }),
  getLibrary: (token: string) => request<LibraryState>("/library", { token }),
  addItem: (token: string, body: { url: string; title?: string; categoryId?: string | null }) =>
    request<ItemResponse>("/items", { method: "POST", body, token }),
  getItem: (token: string, id: string) => request<ItemResponse>(`/items/${id}`, { token }),
  updateItem: (token: string, id: string, body: { title?: string | null; categoryId?: string | null }) =>
    request<ItemResponse>(`/items/${id}`, { method: "PATCH", body, token }),
  deleteItem: (token: string, id: string) => request<null>(`/items/${id}`, { method: "DELETE", token }),
  addComment: (token: string, id: string, body: { author: string; body: string }) =>
    request<ItemResponse>(`/items/${id}/comments`, { method: "POST", body, token }),
  deleteComment: (token: string, id: string, commentId: string) =>
    request<null>(`/items/${id}/comments/${commentId}`, { method: "DELETE", token }),
  createCategory: (token: string, name: string) =>
    request<CategoryResponse>("/categories", { method: "POST", body: { name }, token }),
  deleteCategory: (token: string, id: string) =>
    request<null>(`/categories/${id}`, { method: "DELETE", token }),
};