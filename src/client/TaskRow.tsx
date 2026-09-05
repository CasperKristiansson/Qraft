import { Check, ChevronRight, Circle, Minus } from "lucide-react";
import { useEffect, useRef } from "react";
import type { QATask, TaskStatus } from "../domain/model";
import { labels, nextStatus } from "./review-state";

export function TaskRow({
  task,
  pending,
  change,
  select,
}: {
  task: QATask;
  pending: boolean;
  change: (value: TaskStatus) => void;
  select: () => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);
  return (
    <div className={`qraft-task-row ${task.status}`}>
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
      <button
        type="button"
        className="qraft-task"
        disabled={pending || task.readOnly}
        onClick={select}
      >
        <span className="qraft-task-copy">
          <span>{task.title}</span>
          {task.notes.length ? (
            <small>
              {task.notes.length} {task.notes.length === 1 ? "note" : "notes"}
            </small>
          ) : null}
        </span>
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
