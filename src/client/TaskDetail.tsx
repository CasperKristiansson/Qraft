import { StickyNote } from "lucide-react";
import type { RefObject } from "react";
import type { QACommand } from "../domain/commands";
import type { QADocument, QANote, QATask, TaskStatus } from "../domain/model";
import { NoteComposer, type NoteDraft } from "./NoteComposer";
import { NoteItem } from "./NoteItem";
import { isRecoverableEdit, type ReviewSession } from "./review-session";
import { TaskStatusControl } from "./TaskStatusControl";

interface TaskDetailProps {
  task: QATask;
  document: QADocument;
  headingId: string;
  pending: boolean;
  noteDraft: NoteDraft;
  draftBlocked: boolean;
  composer: RefObject<HTMLTextAreaElement | null>;
  editDrafts: ReviewSession["edits"][string];
  sourceError: { noteId: string; text: string } | null;
  status: (task: QATask, status: TaskStatus) => void;
  onChange: (patch: Partial<NoteDraft>) => void;
  onSubmit: () => Promise<void>;
  onAttach: () => void;
  editDraft: (id: string, body: string | null) => void;
  execute: (command: QACommand, success: string) => Promise<QADocument | null>;
  openSource: (note: QANote) => Promise<void>;
}

export function TaskDetail({
  task,
  document,
  headingId,
  pending,
  noteDraft,
  draftBlocked,
  composer,
  editDrafts,
  sourceError,
  status,
  onChange,
  onSubmit,
  onAttach,
  editDraft,
  execute,
  openSource,
}: TaskDetailProps) {
  return (
    <article className="qraft-detail">
      <div className={`qraft-detail-heading ${task.status}`}>
        <TaskStatusControl task={task} pending={pending} change={(value) => status(task, value)} />
        <h2>{task.title}</h2>
      </div>
      {task.instructions ? <p className="qraft-instructions">{task.instructions}</p> : null}
      <section className="qraft-detail-section">
        <h3>
          <StickyNote size={13} /> Notes · {task.notes.length}
        </h3>
        <NoteComposer
          id={headingId}
          draft={noteDraft}
          pending={pending}
          readOnly={task.readOnly || draftBlocked}
          inputRef={composer}
          onChange={onChange}
          onSubmit={onSubmit}
          onAttach={onAttach}
        />
        {task.notes.length ? (
          <ol className="qraft-note-timeline">
            {task.notes.map((note, index) => (
              <NoteItem
                key={note.readOnly ? `${note.id}-${index}` : note.id}
                note={{
                  ...note,
                  readOnly: Boolean(
                    note.readOnly ||
                      (editDrafts[note.id] &&
                        !isRecoverableEdit(note.id, editDrafts[note.id]!, document)),
                  ),
                }}
                pending={pending}
                draft={
                  editDrafts[note.id] && isRecoverableEdit(note.id, editDrafts[note.id]!, document)
                    ? editDrafts[note.id]?.body
                    : undefined
                }
                onDraft={(body) => editDraft(note.id, body)}
                save={async (body) =>
                  Boolean(
                    await execute({ type: "editNote", noteId: note.id, body }, "Note updated."),
                  )
                }
                openSource={() => void openSource(note)}
                error={sourceError?.noteId === note.id ? sourceError.text : null}
              />
            ))}
          </ol>
        ) : (
          <p className="qraft-empty-copy">No notes yet. Add observations for your coding agent.</p>
        )}
      </section>
    </article>
  );
}
