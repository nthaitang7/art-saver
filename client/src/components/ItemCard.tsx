import type { ItemSummary, PreviewStatus } from "@art/shared";
import { formatDate, hostOf } from "../lib/utils";
import { ClockIcon, CommentIcon, ImageIcon, LinkIcon, SparklesIcon, TagIcon } from "./icons";
import { Badge } from "./ui/badge";

interface ItemCardProps {
  item: ItemSummary;
  categoryName?: string | undefined;
  onOpen: () => void;
}

export function ItemCard({ item, categoryName, onOpen }: ItemCardProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="card-surface focus-ring group flex flex-col overflow-hidden text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden border-b bg-secondary/40">
        {item.previewUrl ? (
          <img
            src={item.previewUrl}
            alt={item.title ?? "Saved art"}
            loading="lazy"
            className="h-full w-full object-contain"
          />
        ) : (
          <PreviewPlaceholder status={item.previewStatus} error={item.previewError} />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="line-clamp-2 font-medium leading-snug">{item.title ?? hostOf(item.url)}</p>

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <LinkIcon className="h-3.5 w-3.5" />
            <span className="max-w-[12rem] truncate">{hostOf(item.url)}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <ClockIcon className="h-3.5 w-3.5" />
            {formatDate(item.createdAt)}
          </span>
          {item.commentCount > 0 ? (
            <span className="inline-flex items-center gap-1">
              <CommentIcon className="h-3.5 w-3.5" />
              {item.commentCount}
            </span>
          ) : null}
        </div>

        {categoryName ? (
          <Badge variant="outline" className="w-fit">
            <TagIcon className="h-3.5 w-3.5" />
            {categoryName}
          </Badge>
        ) : null}
      </div>
    </button>
  );
}

interface PreviewPlaceholderProps {
  status: PreviewStatus;
  error: string | null;
}

function PreviewPlaceholder({ status, error }: PreviewPlaceholderProps) {
  if (status === "pending") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <span className="h-16 w-16 animate-shimmer rounded-xl bg-[linear-gradient(110deg,hsl(var(--muted)),45%,hsl(var(--secondary)),55%,hsl(var(--muted)))] bg-[length:200%_100%]" />
        <span className="text-xs">Loading preview</span>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
        <ImageIcon className="h-8 w-8 opacity-60" />
        <span className="text-xs">{error ?? "No preview available"}</span>
      </div>
    );
  }

  // Ready but with no cached file, which only happens when the bytes could not be stored.
  return (
    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
      <SparklesIcon className="h-8 w-8 opacity-60" />
    </div>
  );
}