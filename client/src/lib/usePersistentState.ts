import { useCallback, useState } from "react";

/**
 * State backed by localStorage so sort and filter survive a reload. Falls back to the initial
 * value when storage is blocked or holds something unreadable.
 */
export function usePersistentState<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Keep the value for this session even if it cannot be stored.
      }
    },
    [key],
  );

  return [value, set];
}