import { ExternalLink, Pencil } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import type { QANote } from "../domain/model";
import { validDraft } from "./review-state";
import { ElementContext } from "./ElementContext";

export function NoteItem({
  note,
  pending,
  draft,
  onDraft,
  save,
  openSource,
  error,
}: {
  note: QANote;
  pending: boolean;
  draft: string | undefined;
  onDraft: (body: string | null) => void;
  save: (body: string) => Promise<boolean>;
  openSource: () => void;
  error: string | null;
}) {
  const fieldId = useId();
  const editing = draft !== undefined;
  const body = draft ?? note.body;
  const input = useRef<HTMLTextAreaElement>(null);
  const edit = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (editing) input.current?.focus();
  }, [editing]);
  const cancel = () => {
    onDraft(null);
    requestAnimationFrame(() => edit.current?.focus());
  };
  const submit = async () => {
    if (validDraft(body) && (await save(body))) cancel();
  };
  return (
    <li>
      {editing ? (
        <form
          className="qraft-note-edit"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              cancel();
            }
          }}
        >
          <label htmlFor={fieldId}>Edit note</label>
          <textarea
            id={fieldId}
            ref={input}
            value={body}
            maxLength={4_000}
            readOnly={pending}
            onChange={(event) => {
              onDraft(event.target.value);
            }}
          />
          <div className="qraft-composer-actions">
            <button type="button" onClick={cancel} disabled={pending}>
              Cancel
            </button>
            <button className="primary" disabled={pending || !validDraft(body)}>
              Save note
            </button>
          </div>
        </form>
      ) : (
        <>
          <p>{note.body}</p>
          <button
            className="qraft-note-edit-trigger"
            ref={edit}
            disabled={pending || note.readOnly}
            onClick={() => {
              onDraft(note.body);
            }}
            aria-label={`Edit note: ${note.body}`}
          >
            <Pencil size={13} /> Edit
          </button>
        </>
      )}
      {note.observation ? (
        <p className="qraft-note-observation">
          {note.observation.route} · {note.observation.viewport.width} ×{" "}
          {note.observation.viewport.height}
        </p>
      ) : null}
      {note.element ? (
        <div className="qraft-context">
          <ElementContext element={note.element} />
          {note.element.source ? (
            <button className="qraft-open-source" onClick={openSource}>
              <ExternalLink size={13} /> Open source
            </button>
          ) : null}
          {error ? (
            <span role="alert" className="qraft-source-error">
              {error}
            </span>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
