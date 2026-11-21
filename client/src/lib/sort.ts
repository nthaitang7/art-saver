import type { ItemSummary, SortDirection, SortField } from "@art/shared";

/** Sort a copy of the items. Date uses added time; link uses the title, falling back to the URL. */
export function sortItems(items: ItemSummary[], field: SortField, direction: SortDirection): ItemSummary[] {
  const factor = direction === "asc" ? 1 : -1;

  return [...items].sort((a, b) => {
    if (field === "date") return (a.createdAt - b.createdAt) * factor;
    const aKey = (a.title ?? a.url).toLowerCase();
    const bKey = (b.title ?? b.url).toLowerCase();
    return aKey.localeCompare(bKey) * factor;
  });
}