import { Check, Circle, Minus } from "lucide-react";
import { useEffect, useRef } from "react";
import type { QATask, TaskStatus } from "../domain/model";
import { labels, nextStatus } from "./review-state";

export function TaskStatusControl({
  task,
  pending,
  change,
}: {
  task: QATask;
  pending: boolean;
  change: (value: TaskStatus) => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);
  return (
    <button
      type="button"
      className={`qraft-status ${task.status}`}
      aria-label={`${task.title}: ${labels[task.status]}. Change status`}
      title="Click to cycle status; double-click to skip"
      disabled={pending || task.readOnly}
      onClick={(event) => {
        if (event.detail === 0) {
          clear();
          change(nextStatus[task.status]);
        } else {
          clear();
          timer.current = setTimeout(() => {
            timer.current = null;
            change(nextStatus[task.status]);
          }, 300);
        }
      }}
      onDoubleClick={() => {
        clear();
        change("skipped");
      }}
    >
      {task.status === "completed" ? (
        <Check size={13} />
      ) : task.status === "skipped" ? (
        <Minus size={13} />
      ) : (
        <Circle size={13} />
      )}
    </button>
  );
}
