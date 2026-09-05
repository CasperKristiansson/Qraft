import { useEffect, useRef, useState } from "react";
import type { QACommand } from "../domain/commands";
import type { QADocument } from "../domain/model";
import { QAStorageError } from "./http-storage";
import type { QAStorage } from "./storage";

export type Feedback = {
  tone: "neutral" | "warning" | "error";
  text: string;
  source?: "read" | "write";
};

/** Keep confirmed writes authoritative over older reads and retain actionable write feedback. */
export function useDocument(
  storage: QAStorage | null,
  onConfirmed: (before: QADocument, after: QADocument, command: QACommand) => void,
  setConnected: (value: boolean) => void,
) {
  const [document, setDocument] = useState<QADocument | null>(null);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>({
    tone: "neutral",
    text: "Loading checklist…",
  });
  const refreshSequence = useRef(0);
  const locked = useRef(false);
  const confirmed = useRef(onConfirmed);
  confirmed.current = onConfirmed;

  useEffect(() => {
    const controller = new AbortController();
    setDocument(null);
    setConnected(true);
    setFeedback({ tone: "neutral", text: "Loading checklist…" });
    if (!storage) return () => controller.abort();
    const refresh = async () => {
      const sequence = ++refreshSequence.current;
      try {
        const next = await storage.getDocument(controller.signal);
        if (controller.signal.aborted || sequence !== refreshSequence.current) return;
        setDocument(next);
        setFeedback((current) =>
          current.text === "Loading checklist…" || current.source === "read"
            ? { tone: "neutral", text: "Checklist loaded." }
            : current,
        );
      } catch (error) {
        if (!controller.signal.aborted && sequence === refreshSequence.current)
          setFeedback({
            tone: "error",
            source: "read",
            text: error instanceof Error ? error.message : "Could not load the checklist.",
          });
      }
    };
    void refresh();
    const unsubscribe = storage.subscribe(() => void refresh());
    return () => {
      controller.abort();
      refreshSequence.current += 1;
      unsubscribe();
    };
  }, [storage]);
  const execute = async (command: QACommand, success: string): Promise<QADocument | null> => {
    if (!document || !storage || locked.current) return null;
    locked.current = true;
    refreshSequence.current += 1;
    setPending(true);
    try {
      const next = await storage.execute(command, document.revision);
      refreshSequence.current += 1;
      confirmed.current(document, next, command);
      setDocument(next);
      setFeedback({ tone: "neutral", text: success });
      return next;
    } catch (error) {
      if (error instanceof QAStorageError && error.document) setDocument(error.document);
      setFeedback({
        tone:
          error instanceof QAStorageError &&
          ["revision_conflict", "write_locked"].includes(error.code)
            ? "warning"
            : "error",
        text:
          error instanceof Error ? error.message : "The change was not saved. Review and retry.",
        source: "write",
      });
      return null;
    } finally {
      locked.current = false;
      setPending(false);
    }
  };
  return { document, pending, feedback, setFeedback, execute };
}
