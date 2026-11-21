const KEY = "art.token.v1";

/** Remember the device token so a refresh keeps the same private library. */
export function saveToken(token: string): void {
  try {
    localStorage.setItem(KEY, token);
  } catch {
    // Storage can be full or blocked. Losing the token means a fresh library, not a crash.
  }
}

export function loadToken(): string | null {
  try {
    const token = localStorage.getItem(KEY);
    return token && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do.
  }
}