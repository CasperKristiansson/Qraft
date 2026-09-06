import { Target } from "lucide-react";
import type { RefObject } from "react";
import type { ReviewSession } from "./review-session";
import { ElementContext } from "./ElementContext";
import { validDraft } from "./review-state";

export type NoteDraft = ReviewSession["notes"][string];
interface NoteComposerProps {
  id: string;
  draft: NoteDraft;
  pending: boolean;
  readOnly: boolean | undefined;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (patch: Partial<NoteDraft>) => void;
  onSubmit: () => Promise<void>;
  onAttach: () => void;
}
export function NoteComposer({
  id,
  draft,
  pending,
  readOnly,
  inputRef,
  onChange,
  onSubmit,
  onAttach,
}: NoteComposerProps) {
  return (
    <form
      className="qraft-note-composer"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <label htmlFor={`${id}-note`}>Write a note</label>
      <textarea
        ref={inputRef}
        id={`${id}-note`}
        value={draft.body}
        maxLength={4_000}
        readOnly={pending || readOnly}
        placeholder="What could be improved?"
        onChange={(event) => onChange({ body: event.target.value })}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing &&
            event.nativeEvent.keyCode !== 229
          ) {
            event.preventDefault();
            void onSubmit();
          }
        }}
      />
      {draft.element ? (
        <div className="qraft-context">
          <ElementContext element={draft.element} />
          <button
            type="button"
            disabled={pending}
            onClick={() => onChange({ element: null, warning: null })}
          >
            Remove attachment
          </button>
        </div>
      ) : null}
      {draft.warning ? <p className="qraft-help">{draft.warning}</p> : null}
      {Array.from(draft.body.trim()).length > 2_000 ? (
        <p className="qraft-field-error">Keep the text to 2,000 characters or fewer.</p>
      ) : null}
      <div className="qraft-composer-actions">
        <button type="button" disabled={pending || readOnly} onClick={onAttach}>
          <Target size={15} /> Attach element
        </button>
        <button className="primary" disabled={pending || readOnly || !validDraft(draft.body)}>
          Submit
        </button>
      </div>
    </form>
  );
}
