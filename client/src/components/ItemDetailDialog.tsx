import type { Category, ItemDetail } from "@art/shared";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { formatDateTime, hostOf } from "../lib/utils";
import { ClockIcon, ExternalLinkIcon, ImageIcon, PencilIcon, TrashIcon } from "./icons";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

const AUTHOR_KEY = "art.author";

interface ItemDetailDialogProps {
  token: string;
  itemId: string | null;
  categories: Category[];
  onOpenChange: (open: boolean) => void;
  onChanged: () => void | Promise<void>;
}

/** Full view of one saved item: preview, editable title and category, and its comments. */
export function ItemDetailDialog({ token, itemId, categories, onOpenChange, onChanged }: ItemDetailDialogProps) {
  const [detail, setDetail] = useState<ItemDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [saving, setSaving] = useState(false);
  const [author, setAuthor] = useState(() => {
    try {
      return localStorage.getItem(AUTHOR_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [commentBody, setCommentBody] = useState("");
  const [commenting, setCommenting] = useState(false);

  useEffect(() => {
    if (!itemId) {
      setDetail(null);
      setEditing(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    setActionError(null);
    api
      .getItem(token, itemId)
      .then((res) => {
        if (!active) return;
        setDetail(res.item);
        setTitle(res.item.title ?? "");
        setCategoryId(res.item.categoryId ?? "");
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load that item");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, itemId]);

  function rememberAuthor(value: string) {
    setAuthor(value);
    try {
      localStorage.setItem(AUTHOR_KEY, value);
    } catch {
      // Not fatal, the comment still posts with the typed name.
    }
  }

  async function saveDetails() {
    if (!itemId) return;
    setSaving(true);
    setActionError(null);
    try {
      const res = await api.updateItem(token, itemId, { title: title.trim() || null, categoryId: categoryId || null });
      setDetail(res.item);
      setEditing(false);
      await onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not save the changes");
    } finally {
      setSaving(false);
    }
  }

  async function addComment(event: FormEvent) {
    event.preventDefault();
    if (!itemId || !commentBody.trim() || !author.trim()) return;
    setCommenting(true);
    setActionError(null);
    try {
      const res = await api.addComment(token, itemId, { author: author.trim(), body: commentBody.trim() });
      setDetail(res.item);
      setCommentBody("");
      await onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not post the comment");
    } finally {
      setCommenting(false);
    }
  }

  async function removeComment(commentId: string) {
    if (!itemId) return;
    setActionError(null);
    try {
      await api.deleteComment(token, itemId, commentId);
      const res = await api.getItem(token, itemId);
      setDetail(res.item);
      await onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not delete the comment");
    }
  }

  async function removeItem() {
    if (!itemId) return;
    if (!window.confirm("Delete this item and its comments?")) return;
    setActionError(null);
    try {
      await api.deleteItem(token, itemId);
      await onChanged();
      onOpenChange(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not delete the item");
    }
  }

  return (
    <Dialog open={itemId !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Saved item</DialogTitle>
          <DialogDescription>Details, categories and comments for this piece.</DialogDescription>
        </DialogHeader>

        {loading ? <p className="py-6 text-center text-sm text-muted-foreground">Loading...</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {detail ? (
          <div className="flex flex-col gap-5">
            <div className="flex max-h-80 items-center justify-center overflow-hidden rounded-lg border bg-secondary/40">
              {detail.previewUrl ? (
                <img src={detail.previewUrl} alt={detail.title ?? "Saved art"} className="max-h-80 w-full object-contain" />
              ) : (
                <div className="flex h-40 w-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                  <ImageIcon className="h-8 w-8 opacity-60" />
                  <span className="px-4 text-xs">{detail.previewError ?? "No preview available"}</span>
                </div>
              )}
            </div>

            <a
              href={detail.url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ExternalLinkIcon className="h-4 w-4" />
              <span className="truncate">{hostOf(detail.url)}</span>
            </a>

            {editing ? (
              <div className="flex flex-col gap-3 rounded-lg border p-3">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Title"
                  maxLength={200}
                />
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background/70 px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">No category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => void saveDetails()} disabled={saving}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <p className="font-medium leading-snug">{detail.title ?? hostOf(detail.url)}</p>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <ClockIcon className="h-3.5 w-3.5" />
                    Added {formatDateTime(detail.createdAt)}
                  </span>
                </div>
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <PencilIcon className="h-4 w-4" />
                  Edit
                </Button>
              </div>
            )}

            <div className="flex flex-col gap-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <h4 className="font-display text-sm font-semibold">
                  Comments {detail.comments.length > 0 ? <Badge variant="muted">{detail.comments.length}</Badge> : null}
                </h4>
              </div>

              {detail.comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {detail.comments.map((comment) => (
                    <li key={comment.id} className="rounded-md bg-secondary/50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{comment.author}</p>
                        <button
                          type="button"
                          onClick={() => void removeComment(comment.id)}
                          aria-label="Delete comment"
                          title="Delete comment"
                          className="rounded p-0.5 text-muted-foreground transition hover:bg-background hover:text-destructive"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{comment.body}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(comment.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              )}

              <form onSubmit={addComment} className="flex flex-col gap-2">
                <Input
                  value={author}
                  onChange={(e) => rememberAuthor(e.target.value)}
                  placeholder="Your name"
                  maxLength={40}
                  className="h-9"
                />
                <Textarea
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder="Add a note about this piece..."
                  maxLength={1000}
                  className="min-h-[70px]"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="self-start"
                  disabled={commenting || !commentBody.trim() || !author.trim()}
                >
                  {commenting ? "Posting..." : "Post comment"}
                </Button>
              </form>
            </div>

            {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}

            <div className="flex justify-end border-t pt-4">
              <Button variant="ghost" size="sm" onClick={() => void removeItem()} className="text-destructive hover:bg-destructive/10">
                <TrashIcon className="h-4 w-4" />
                Delete item
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}