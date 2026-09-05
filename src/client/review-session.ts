import { z } from "zod";
import { elementReferenceSchema, noteObservationSchema, type QACommand } from "../domain/commands";
import type { QADocument } from "../domain/model";

const id = z.string().max(200);
const revision = z.string().regex(/^[a-f0-9]{64}$/u);
const noteDraft = z.strictObject({
  body: z.string().max(4_000),
  element: elementReferenceSchema.nullable(),
  observation: noteObservationSchema.optional(),
  warning: z.string().max(1_000).nullable().optional(),
  revision: revision.optional(),
});

const sessionSchema = z.strictObject({
  version: z.literal(1),
  selectedTaskId: id.nullable(),
  collapsed: z.array(id).max(2_000),
  scroll: z.number().min(0).max(10_000_000),
  notes: z.record(id, noteDraft),
  edits: z.record(
    id,
    z.record(
      id,
      z.strictObject({
        body: z.string().max(4_000),
        originalBody: z.string().max(4_000),
        revision,
      }),
    ),
  ),
  form: z
    .discriminatedUnion("kind", [
      z.strictObject({ kind: z.literal("section") }),
      z.strictObject({ kind: z.literal("task"), sectionId: id, revision: revision.optional() }),
    ])
    .nullable(),
  titleDraft: z.string().max(4_000),
});

export type ReviewSession = z.infer<typeof sessionSchema>;
export type SessionUpdate = (session: ReviewSession) => ReviewSession;

export function emptySession(): ReviewSession {
  return {
    version: 1,
    selectedTaskId: null,
    collapsed: [],
    scroll: 0,
    notes: {},
    edits: {},
    form: null,
    titleDraft: "",
  };
}

export function parseSession(raw: string | null): ReviewSession | null {
  if (!raw || raw.length > 512_000) return null;

  try {
    const value: unknown = JSON.parse(raw);
    // Retired filters must not invalidate existing drafts or keep tasks hidden.
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      "version" in value &&
      value.version === 1
    ) {
      for (const key of ["query", "statusFilter", "withNotes"]) Reflect.deleteProperty(value, key);
    }
    const parsed = sessionSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function isRecoverableTarget(
  id: string,
  capturedRevision: string | undefined,
  document: QADocument,
): boolean {
  return !id.startsWith("legacy:") || capturedRevision === document.revision;
}

export function isRecoverableForm(session: ReviewSession, document: QADocument): boolean {
  const form = session.form;
  return (
    !form ||
    form.kind === "section" ||
    (document.sections.some((section) => section.id === form.sectionId) &&
      isRecoverableTarget(form.sectionId, form.revision, document))
  );
}

export function isRecoverableEdit(
  id: string,
  draft: ReviewSession["edits"][string][string],
  document: QADocument,
): boolean {
  const note = document.sections
    .flatMap((section) => section.tasks)
    .flatMap((task) => task.notes)
    .find((note) => note.id === id);
  return Boolean(
    note && note.body === draft.originalBody && isRecoverableTarget(id, draft.revision, document),
  );
}

/** Only call after our own confirmed mutation: existing entity order is preserved. */
export function reconcileSession(
  session: ReviewSession,
  before: QADocument,
  after: QADocument,
  command?: QACommand,
): ReviewSession {
  const tasks = new Map<string, string>();
  const sections = new Map<string, string>();
  const notes = new Map<string, string>();

  before.sections.forEach((section, sectionIndex) => {
    const next = after.sections[sectionIndex];
    if (!next) return;
    sections.set(section.id, next.id);
    section.tasks.forEach((task, taskIndex) => {
      const nextTask = next.tasks[taskIndex];
      if (!nextTask) return;
      tasks.set(task.id, nextTask.id);
      task.notes.forEach((note, noteIndex) => {
        const nextNote = nextTask.notes[noteIndex];
        if (nextNote) notes.set(note.id, nextNote.id);
      });
    });
  });

  const nextNotes: ReviewSession["notes"] = {};
  const nextEdits: ReviewSession["edits"] = {};
  for (const [id, draft] of Object.entries(session.notes)) {
    const safe = tasks.has(id) && isRecoverableTarget(id, draft.revision, before);
    const target = safe ? (tasks.get(id) ?? id) : id;
    nextNotes[target] = safe ? { ...draft, revision: after.revision } : draft;
  }
  for (const [taskId, edits] of Object.entries(session.edits)) {
    for (const [noteId, draft] of Object.entries(edits)) {
      if (command?.type === "editNote" && noteId === command.noteId) continue;
      const safe =
        tasks.has(taskId) && notes.has(noteId) && isRecoverableEdit(noteId, draft, before);
      const targetTask = safe ? (tasks.get(taskId) ?? taskId) : taskId;
      const targetNote = safe ? (notes.get(noteId) ?? noteId) : noteId;
      nextEdits[targetTask] ??= {};
      nextEdits[targetTask][targetNote] = safe ? { ...draft, revision: after.revision } : draft;
    }
  }

  return {
    ...session,
    selectedTaskId: session.selectedTaskId
      ? (tasks.get(session.selectedTaskId) ?? session.selectedTaskId)
      : null,
    collapsed: session.collapsed.map((id) => sections.get(id) ?? id),
    form:
      session.form?.kind === "task" && isRecoverableForm(session, before)
        ? {
            kind: "task",
            sectionId: sections.get(session.form.sectionId) ?? session.form.sectionId,
            revision: after.revision,
          }
        : session.form,
    notes: nextNotes,
    edits: nextEdits,
  };
}
