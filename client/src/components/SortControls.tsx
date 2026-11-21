import type { SortDirection, SortField } from "@art/shared";
import { cn } from "../lib/utils";
import { SortIcon } from "./icons";
import { Button } from "./ui/button";

interface SortControlsProps {
  field: SortField;
  direction: SortDirection;
  onFieldChange: (field: SortField) => void;
  onDirectionChange: (direction: SortDirection) => void;
}

const FIELDS: Array<{ value: SortField; label: string }> = [
  { value: "date", label: "Date" },
  { value: "link", label: "Link" },
];

export function SortControls({ field, direction, onFieldChange, onDirectionChange }: SortControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="hidden items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground sm:inline-flex">
        <SortIcon className="h-3.5 w-3.5" />
        Sort
      </span>
      <div className="flex items-center gap-1 rounded-full border bg-card/60 p-1">
        {FIELDS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onFieldChange(option.value)}
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium transition-colors",
              field === option.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onDirectionChange(direction === "asc" ? "desc" : "asc")}
        title={direction === "asc" ? "Currently ascending" : "Currently descending"}
      >
        {direction === "asc" ? "Asc" : "Desc"}
      </Button>
    </div>
  );
}