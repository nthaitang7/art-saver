import type { SortDirection, SortField } from "@art/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { sortItems } from "../lib/sort";
import { useLibrary } from "../lib/useLibrary";
import { usePersistentState } from "../lib/usePersistentState";
import { AddItemForm } from "./AddItemForm";
import { CategoryBar } from "./CategoryBar";
import { ImageIcon, PaletteIcon, RefreshIcon } from "./icons";
import { ItemCard } from "./ItemCard";
import { ItemDetailDialog } from "./ItemDetailDialog";
import { SortControls } from "./SortControls";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

interface LibraryViewProps {
  token: string;
  onSessionLost: () => void;
}

export function LibraryView({ token, onSessionLost }: LibraryViewProps) {
  const { state, error, unauthorized, loading, refresh } = useLibrary(token);
  const [filter, setFilter] = usePersistentState<string>("art.filter", "all");
  const [sortField, setSortField] = usePersistentState<SortField>("art.sort.field", "date");
  const [sortDir, setSortDir] = usePersistentState<SortDirection>("art.sort.dir", "desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // A rejected token means the library is gone, so start a fresh one.
  useEffect(() => {
    if (unauthorized) onSessionLost();
  }, [unauthorized, onSessionLost]);

  const categories = state?.categories ?? [];
  const items = state?.items ?? [];

  const visible = useMemo(() => {
    const filtered = items.filter((item) => filter === "all" || item.categoryId === filter);
    return sortItems(filtered, sortField, sortDir);
  }, [items, filter, sortField, sortDir]);

  const categoryName = useCallback(
    (id: string | null) => categories.find((category) => category.id === id)?.name,
    [categories],
  );

  const createCategory = useCallback(
    async (name: string) => {
      await api.createCategory(token, name);
      await refresh();
    },
    [token, refresh],
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      const name = categories.find((category) => category.id === id)?.name ?? "this category";
      if (!window.confirm(`Delete "${name}"? Items in it are kept without a category.`)) return;
      await api.deleteCategory(token, id);
      if (filter === id) setFilter("all");
      await refresh();
    },
    [token, refresh, categories, filter, setFilter],
  );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
          <div className="flex items-center gap-2 font-display text-lg font-semibold">
            <PaletteIcon className="h-6 w-6 text-primary" />
            Art Saver
          </div>
          <div className="flex items-center gap-1">
            <span className="mr-1 hidden text-sm text-muted-foreground sm:inline">
              {items.length} {items.length === 1 ? "piece" : "pieces"}
            </span>
            <Button variant="ghost" size="icon" onClick={() => void refresh()} aria-label="Refresh" title="Refresh">
              <RefreshIcon className="h-5 w-5" />
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-8">
        <AddItemForm token={token} categories={categories} onAdded={refresh} />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CategoryBar
            categories={categories}
            activeId={filter}
            onSelect={setFilter}
            onCreate={createCategory}
            onDelete={deleteCategory}
          />
          <SortControls
            field={sortField}
            direction={sortDir}
            onFieldChange={setSortField}
            onDirectionChange={setSortDir}
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {loading && items.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Opening your library...</p>
        ) : items.length === 0 ? (
          <EmptyLibrary />
        ) : visible.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Nothing in this category yet.</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                categoryName={categoryName(item.categoryId)}
                onOpen={() => setSelectedId(item.id)}
              />
            ))}
          </div>
        )}
      </main>

      <ItemDetailDialog
        token={token}
        itemId={selectedId}
        categories={categories}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        onChanged={refresh}
      />
    </div>
  );
}

function EmptyLibrary() {
  return (
    <Card className="overflow-hidden">
      <div className="dotfield flex flex-col items-center gap-4 px-6 py-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ImageIcon className="h-8 w-8" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-xl font-semibold">Your library is empty</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Paste a link above to save your first piece. Previews are fetched for you, categories keep things tidy, and
            comments are there when a note is worth keeping.
          </p>
        </div>
      </div>
    </Card>
  );
}