import type { Category } from "@art/shared";
import { useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { LinkIcon, PlusIcon } from "./icons";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";

interface AddItemFormProps {
  token: string;
  categories: Category[];
  onAdded: () => void | Promise<void>;
}

/** The one input that matters: paste a link, optionally name it and file it. */
export function AddItemForm({ token, categories, onAdded }: AddItemFormProps) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.addItem(token, {
        url: url.trim(),
        title: title.trim() || undefined,
        categoryId: categoryId || null,
      });
      setUrl("");
      setTitle("");
      await onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that link");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste an image or page link"
                className="pl-9"
                spellCheck={false}
                autoComplete="off"
              />
            </div>
            <Button type="submit" variant="accent" disabled={busy || url.trim().length === 0}>
              <PlusIcon className="h-4 w-4" />
              {busy ? "Saving..." : "Save"}
            </Button>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Optional title"
              maxLength={200}
              className="flex-1"
            />
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background/70 px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-52"
            >
              <option value="">No category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </form>
      </CardContent>
    </Card>
  );
}