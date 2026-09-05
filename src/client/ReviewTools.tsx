import { ArrowRight, Check, ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import type { QADocument, QATask } from "../domain/model";
import {
  isRecoverableEdit,
  isRecoverableForm,
  isRecoverableTarget,
  type ReviewSession,
  type SessionUpdate,
} from "./review-session";

interface NavigationProps {
  index: number;
  total: number;
  pending: boolean;
  readOnly: boolean;
  previous: () => void;
  next: () => void;
  complete: () => void;
}

export function ReviewNavigation(props: NavigationProps) {
  return (
    <nav className="qraft-review-navigation" aria-label="Review tasks">
      <button
        aria-label="Previous"
        title="Previous task"
        disabled={props.pending || props.index <= 0}
        onClick={props.previous}
      >
        <ChevronLeft size={19} />
      </button>
      <button
        className="primary"
        disabled={props.pending || props.readOnly}
        onClick={props.complete}
      >
        <Check size={15} />
        {props.index >= props.total - 1 ? "Complete task" : "Complete and next"}
      </button>
      <button
        aria-label="Next"
        title="Next task"
        disabled={props.pending || props.index >= props.total - 1}
        onClick={props.next}
      >
        <ChevronRight size={19} />
      </button>
    </nav>
  );
}

export function ReviewRecovery({
  document,
  session,
  update,
}: {
  document: QADocument;
  session: ReviewSession;
  update: (apply: SessionUpdate) => void;
}) {
  const tasks = document.sections.flatMap((section) => section.tasks);
  const orphanNotes = Object.entries(session.notes).filter(
    ([id, draft]) =>
      (draft.body || draft.element) &&
      (!tasks.some((task) => task.id === id) || !isRecoverableTarget(id, draft.revision, document)),
  );
  const orphanEdits = Object.entries(session.edits).flatMap(([task, edits]) =>
    Object.entries(edits)
      .filter(([id, draft]) => !isRecoverableEdit(id, draft, document))
      .map(([id, draft]) => ({ task, id, draft })),
  );
  const orphanTitle = Boolean(session.titleDraft && !isRecoverableForm(session, document));
  if (!orphanNotes.length && !orphanEdits.length && !orphanTitle) return null;

  return (
    <section className="qraft-recovery" aria-label="Recovered drafts">
      <strong>These drafts need your review</strong>
      <p>
        The original task or note changed. Copy your text before discarding; Qraft will not guess
        where it belongs.
      </p>
      {orphanTitle ? (
        <div className="qraft-orphan">
          <textarea aria-label="Preserved task title" readOnly value={session.titleDraft} />
          <button onClick={() => update((current) => ({ ...current, form: null, titleDraft: "" }))}>
            Discard task title draft
          </button>
        </div>
      ) : null}
      {orphanNotes.map(([id, draft]) => (
        <div className="qraft-orphan" key={id}>
          <textarea aria-label="Preserved draft" readOnly value={draft.body} />
          {draft.element || draft.observation ? (
            <details>
              <summary>Preserved capture context</summary>
              <pre>
                {JSON.stringify(
                  { element: draft.element, observation: draft.observation },
                  null,
                  2,
                )}
              </pre>
            </details>
          ) : null}
          <button
            onClick={() =>
              update((current) => {
                const notes = { ...current.notes };
                delete notes[id];
                return { ...current, notes };
              })
            }
          >
            Discard recovered draft
          </button>
        </div>
      ))}
      {orphanEdits.map(({ task, id, draft }) => (
        <div className="qraft-orphan" key={`${task}:${id}`}>
          <textarea aria-label="Preserved edit draft" readOnly value={draft.body} />
          <button
            onClick={() =>
              update((current) => {
                const edits = { ...current.edits[task] };
                delete edits[id];
                return { ...current, edits: { ...current.edits, [task]: edits } };
              })
            }
          >
            Discard edit draft
          </button>
        </div>
      ))}
    </section>
  );
}

export function CompactReview({
  task,
  index,
  total,
  pending,
  expand,
  close,
  next,
  complete,
}: {
  task: QATask;
  index: number;
  total: number;
  pending: boolean;
  expand: () => void;
  close: () => void;
  next: () => void;
  complete: () => void;
}) {
  return (
    <aside className="qraft-compact-review" aria-label="Qraft current task">
      <button className="qraft-compact-title" onClick={expand}>
        <span>
          Task {index + 1} of {total}
        </span>
        <strong>{task.title}</strong>
      </button>
      <div>
        <button
          onClick={complete}
          disabled={pending || task.readOnly}
          aria-label="Complete current task"
        >
          <Check size={18} />
        </button>
        <button onClick={next} disabled={pending || index >= total - 1} aria-label="Next task">
          <ArrowRight size={18} />
        </button>
        <button onClick={expand} aria-label="Expand Qraft">
          <Maximize2 size={18} />
        </button>
        <button onClick={close} aria-label="Hide task strip">
          <X size={18} />
        </button>
      </div>
    </aside>
  );
}
