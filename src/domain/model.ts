export interface QADiagnostic {
  code: "duplicate-id" | "invalid-nesting" | "mixed-newlines" | "malformed-markdown";
  message: string;
  lines: number[];
  entityId?: string;
}

export interface SourceLocation {
  component: string | null;
  source: string;
  line: number | null;
  column: number | null;
}

export interface ElementReference {
  route: string;
  component: string | null;
  source: string | null;
  line: number | null;
  column: number | null;
  selector: string | null;
  context?: { tag: string; attributes: Record<string, string>; text: string; ancestors: string[]; sourceTrail?: SourceLocation[] | undefined } | undefined;
}

export interface QANote {
  id: string;
  body: string;
  element: ElementReference | null;
  readOnly?: boolean;
}

export type TaskStatus = "open" | "completed" | "skipped";

export interface QATask {
  id: string;
  title: string;
  checked: boolean;
  notes: QANote[];
  status: TaskStatus;
  readOnly?: boolean;
}

export interface QASection {
  id: string;
  title: string;
  tasks: QATask[];
  readOnly?: boolean;
}

export interface QADocument {
  title: string;
  revision: string;
  sections: QASection[];
  diagnostics: QADiagnostic[];
}

export interface QAProgress {
  passed: number;
  total: number;
  skipped: number;
}

export function getProgress(document: QADocument): QAProgress {
  const tasks = document.sections.flatMap((section) => section.tasks);
  return { passed: tasks.filter((task) => task.checked).length, total: tasks.length, skipped: tasks.filter((task) => task.status === "skipped").length };
}

export function getNextOpenTaskId(document: QADocument, currentTaskId: string): string | null {
  const tasks = document.sections.flatMap((section) => section.tasks);
  if (tasks.length === 0) return null;
  const currentIndex = Math.max(0, tasks.findIndex((task) => task.id === currentTaskId));
  for (let offset = 1; offset <= tasks.length; offset += 1) {
    const candidate = tasks[(currentIndex + offset) % tasks.length];
    if (candidate && candidate.status === "open") return candidate.id;
  }
  return null;
}
