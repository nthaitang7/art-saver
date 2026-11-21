import type { LibraryState } from "@art/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "./api";

const POLL_MS = 3000;

export interface UseLibrary {
  state: LibraryState | null;
  error: string | null;
  unauthorized: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Poll the library on an interval. We pause when the tab is hidden and skip re-renders when the
 * server revision has not moved, so an idle library is cheap to keep open.
 */
export function useLibrary(token: string): UseLibrary {
  const [state, setState] = useState<LibraryState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const revision = useRef(-1);

  const refresh = useCallback(async () => {
    try {
      const library = await api.getLibrary(token);
      if (library.revision !== revision.current) {
        revision.current = library.revision;
        setState(library);
      }
      setError(null);
      setUnauthorized(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUnauthorized(true);
      } else {
        setError(err instanceof Error ? err.message : "Could not reach the server");
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    revision.current = -1;
    setState(null);
    setLoading(true);
    void refresh();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return { state, error, unauthorized, loading, refresh };
}