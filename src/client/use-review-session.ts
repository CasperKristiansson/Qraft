import { useMemo, useSyncExternalStore } from "react";
import { emptySession, parseSession, type SessionUpdate } from "./review-session";

export function createSessionStore(key: string | null) {
  let snapshot = { session: emptySession(), warning: "" };
  const listeners = new Set<() => void>();

  if (key) {
    try {
      const raw = sessionStorage.getItem(key);
      const session = parseSession(raw);
      snapshot = {
        session: session ?? emptySession(),
        warning:
          raw && !session
            ? "The saved session could not be restored. Its original data is retained in browser storage."
            : "",
      };
    } catch {
      snapshot.warning =
        "Browser session storage is unavailable. Keep this page open until your notes are saved.";
    }
  }

  // Keep malformed saved data intact until the user explicitly clears it.
  let damaged = snapshot.warning.includes("could not be restored");
  const update = (apply: SessionUpdate) => {
    const session = apply(snapshot.session);
    let warning = snapshot.warning;
    if (key && !damaged) {
      try {
        const raw = JSON.stringify(session);
        const keys = Object.keys(sessionStorage).filter((item) =>
          item.startsWith("qraft:review:v1:"),
        );
        if (!parseSession(raw) || (!sessionStorage.getItem(key) && keys.length >= 20)) {
          throw new Error("Session capacity reached");
        }
        sessionStorage.setItem(key, raw);
        warning = "";
      } catch {
        warning =
          "This session cannot be stored for reload. Save or copy your drafts before leaving; clear unused review sessions to free space.";
      }
    }
    snapshot = { session, warning };
    listeners.forEach((notify) => notify());
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (notify: () => void) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    update,
    clear: () => {
      let warning = "";
      if (key) {
        try {
          sessionStorage.removeItem(key);
          damaged = false;
        } catch {
          warning =
            "The saved session could not be cleared from browser storage. Retry before closing this page.";
        }
      }
      snapshot = { session: emptySession(), warning };
      listeners.forEach((notify) => notify());
    },
  };
}

export function useReviewSession(key: string | null, identity?: object) {
  const store = useMemo(() => createSessionStore(key), [key, identity]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { ...snapshot, updateSession: store.update, clearSession: store.clear };
}
