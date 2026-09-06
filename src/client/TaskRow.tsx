import { ChevronRight } from "lucide-react";
import type { QATask, TaskStatus } from "../domain/model";
import { TaskStatusControl } from "./TaskStatusControl";

export function TaskRow({
  task,
  pending,
  change,
  onStatusBusy,
  select,
}: {
  task: QATask;
  pending: boolean;
  onStatusBusy: (value: boolean) => void;
  change: (value: TaskStatus) => Promise<unknown>;
  select: () => void;
}) {
  return (
    <div className={`qraft-task-row ${task.status}`}>
      <TaskStatusControl task={task} pending={pending} change={change} onBusy={onStatusBusy} />
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
