import type { Category } from "@art/shared";
import { useState, type FormEvent } from "react";
import { cn } from "../lib/utils";
import { FolderIcon, PlusIcon, XIcon } from "./icons";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface CategoryBarProps {
  categories: Category[];
  activeId: string;
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

/** Filter chips for categories, plus a small inline form to add one. */
export function CategoryBar({ categories, activeId, onSelect, onCreate, onDelete }: CategoryBarProps) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onCreate(name.trim());
      setName("");
      setAdding(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip label="All" active={activeId === "all"} onClick={() => onSelect("all")} />

      {categories.map((category) => (
        <span key={category.id} className="group inline-flex items-center">
          <Chip
            label={category.name}
            active={activeId === category.id}
            onClick={() => onSelect(category.id)}
            onDelete={() => void onDelete(category.id)}
          />
        </span>
      ))}

      {adding ? (
        <form onSubmit={submit} className="flex items-center gap-1">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category name"
            maxLength={40}
            className="h-8 w-40"
          />
          <Button type="submit" size="sm" disabled={busy || name.trim().length === 0}>
            Add
          </Button>
        </form>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setAdding(true)} className="text-muted-foreground">
          <PlusIcon className="h-4 w-4" />
          New category
        </Button>
      )}
    </div>
  );
}

interface ChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  onDelete?: () => void;
}

function Chip({ label, active, onClick, onDelete }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border py-1 pl-3 text-sm transition-colors",
        onDelete ? "pr-1" : "pr-3",
        active ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card/60 hover:bg-secondary",
      )}
    >
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5">
        <FolderIcon className="h-3.5 w-3.5" />
        {label}
      </button>
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${label}`}
          title={`Delete ${label}`}
          className="rounded-full p-0.5 text-muted-foreground opacity-0 transition hover:bg-background hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </span>
  );
}