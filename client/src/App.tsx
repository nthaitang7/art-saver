import { useCallback, useEffect, useState } from "react";
import { LibraryView } from "./components/LibraryView";
import { PaletteIcon, RefreshIcon } from "./components/icons";
import { Button } from "./components/ui/button";
import { Card, CardHeader, CardTitle } from "./components/ui/card";
import { api } from "./lib/api";
import { clearToken, loadToken, saveToken } from "./lib/session";

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    setLoading(true);
    setError(null);

    const stored = loadToken();
    if (stored) {
      setToken(stored);
      setLoading(false);
      return;
    }

    try {
      const res = await api.createLibrary();
      saveToken(res.session.token);
      setToken(res.session.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void start();
  }, [start]);

  const replaceSession = useCallback(async () => {
    clearToken();
    setToken(null);
    await start();
  }, [start]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-muted-foreground">
        <PaletteIcon className="h-8 w-8 animate-pulse text-primary" />
        <p className="text-sm">Opening your library...</p>
      </div>
    );
  }

  if (error || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-sm text-center">
          <CardHeader>
            <PaletteIcon className="mx-auto h-8 w-8 text-muted-foreground" />
            <CardTitle>Could not start</CardTitle>
          </CardHeader>
          <div className="flex flex-col gap-3 p-5 pt-0">
            <p className="text-sm text-muted-foreground">{error ?? "The server did not answer."}</p>
            <Button onClick={() => void start()}>
              <RefreshIcon className="h-4 w-4" />
              Try again
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return <LibraryView token={token} onSessionLost={() => void replaceSession()} />;
}