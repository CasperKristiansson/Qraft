import type { TaskStatus } from "../domain/model";

export const labels: Record<TaskStatus, string> = {
  open: "Not completed",
  completed: "Completed",
  skipped: "Skipped",
};
export const nextStatus: Record<TaskStatus, TaskStatus> = {
  open: "completed",
  completed: "skipped",
  skipped: "open",
};
export const validDraft = (value: string) =>
  Array.from(value.trim()).length > 0 && Array.from(value.trim()).length <= 2_000;
