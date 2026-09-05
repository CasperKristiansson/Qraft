import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import type { QADocument, QATask, TaskStatus } from "../domain/model";
import { TaskRow } from "./TaskRow";
import type { ReviewSession, SessionUpdate } from "./review-session";

interface ChecklistViewProps {
  document: QADocument | null;
  session: ReviewSession;
  updateSession: (apply: SessionUpdate) => void;
  pending: boolean;
  headingId: string;
  titleForm: ReactNode;
  beginForm: (form: NonNullable<ReviewSession["form"]>, trigger: HTMLButtonElement) => void;
  status: (task: QATask, status: TaskStatus) => void;
  navigate: (id: string | undefined) => void;
}

export function ChecklistView({
  document,
  session,
  updateSession,
  pending,
  headingId,
  titleForm,
  beginForm,
  status,
  navigate,
}: ChecklistViewProps) {
  const { form } = session;

  return (
    <div className="qraft-view">
      {!document ? <p role="status">Loading checklist…</p> : null}
      {document?.sections.length === 0 ? (
        <div className="qraft-empty">
          <strong>No QA tasks yet</strong>
          <p>
            Add a section below, or ask your coding editor to fill this Markdown file with ##
            sections and - [ ] tasks.
          </p>
        </div>
      ) : null}
      {document?.sections.map((section, sectionIndex) => (
        <section
          className="qraft-section"
          key={section.readOnly ? `${section.id}-${sectionIndex}` : section.id}
        >
          <h3>
            <button
              className="qraft-section-toggle"
              aria-expanded={!session.collapsed.includes(section.id)}
              onClick={() =>
                updateSession((current) => ({
                  ...current,
                  collapsed: current.collapsed.includes(section.id)
                    ? current.collapsed.filter((id) => id !== section.id)
                    : [...current.collapsed, section.id],
                }))
              }
            >
              {section.title}
              <span>{section.tasks.length}</span>
            </button>
          </h3>
          <div hidden={session.collapsed.includes(section.id)}>
            <div className="qraft-task-list">
              {section.tasks.map((task, index) => (
                <TaskRow
                  key={task.readOnly ? `${task.id}-${index}` : task.id}
                  task={task}
                  pending={pending}
                  change={(value) => status(task, value)}
                  select={() => {
                    navigate(task.id);
                  }}
                />
              ))}
            </div>
            {form?.kind === "task" && form.sectionId === section.id ? (
              titleForm
            ) : (
              <button
                id={`${headingId}-add-task-${section.id}`}
                className="qraft-add"
                disabled={pending || section.readOnly}
                onClick={(event) =>
                  beginForm({ kind: "task", sectionId: section.id }, event.currentTarget)
                }
              >
                <Plus size={15} /> Add task
              </button>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
