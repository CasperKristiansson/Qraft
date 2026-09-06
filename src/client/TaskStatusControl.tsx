import { Check, Circle, Minus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { QATask, TaskStatus } from "../domain/model";
import { labels, nextStatus } from "./review-state";

export function TaskStatusControl({
  task,
  pending,
  change,
  onBusy,
}: {
  task: QATask;
  pending: boolean;
  onBusy: (value: boolean) => void;
  change: (value: TaskStatus) => Promise<unknown>;
}) {
  const [preview, setPreview] = useState<TaskStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const displayed = preview ?? task.status;
  const ownsGesture = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(
    () => () => {
      clear();
      if (ownsGesture.current) onBusy(false);
    },
    [onBusy],
  );
  const previewStatus = (value: TaskStatus) => {
    ownsGesture.current = true;
    onBusy(true);
    setPreview(value);
  };
  const commit = async (value: TaskStatus) => {
    setSaving(true);
    try {
      await change(value);
    } finally {
      // Confirmed props remain authoritative, including conflict/failure recovery.
      ownsGesture.current = false;
      onBusy(false);
      setPreview(null);
      setSaving(false);
    }
  };
  const unavailable = (pending && preview === null) || saving || Boolean(task.readOnly);

  return (
    <button
      type="button"
      className={`qraft-status ${displayed}`}
      aria-label={`${task.title}: ${labels[displayed]}. Change status`}
      title="Click to cycle status; double-click to skip"
      disabled={task.readOnly}
      aria-disabled={unavailable || undefined}
      aria-busy={preview !== null || undefined}
      onClick={(event) => {
        if (unavailable) return;
        clear();
        const value = event.detail === 2 ? "skipped" : nextStatus[displayed];
        previewStatus(value);
        if (event.detail === 0) {
          void commit(value);
        } else {
          // Show feedback now; coalesce pointer clicks into one safe Markdown write.
          timer.current = setTimeout(() => {
            timer.current = null;
            void commit(value);
          }, 300);
        }
      }}
      onDoubleClick={() => {
        if (unavailable) return;
        clear();
        previewStatus("skipped");
        void commit("skipped");
      }}
    >
      {displayed === "completed" ? (
        <Check size={13} />
      ) : displayed === "skipped" ? (
        <Minus size={13} />
      ) : (
        <Circle size={13} />
      )}
    </button>
  );
}
