import { FileChooser } from "./FileChooser";
import * as Dialog from "@radix-ui/react-dialog";
import { FocusScope } from "@radix-ui/react-focus-scope";
import { ArrowLeft, Menu, Plus, StickyNote, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { QACommand } from "../domain/commands";
import type { QADocument, QANote, QATask, TaskStatus } from "../domain/model";
import { getProgress } from "../domain/model";
import { HttpQAStorage, QAStorageError } from "./http-storage";
import type { QAFileCatalog, QAStorage } from "./storage";
import { ElementPicker, type PickerSelection } from "./picker/ElementPicker";
import { EdgeTab } from "./EdgeTab";
import { useShadowMount } from "./use-shadow-mount";
import { TaskRow } from "./TaskRow";
import { NoteItem } from "./NoteItem";
import { NoteComposer, type NoteDraft } from "./NoteComposer";
import { labels, validDraft } from "./review-state";

type FormState = { kind: "section" } | { kind: "task"; sectionId: string };
type Feedback = { tone: "neutral" | "warning" | "error"; text: string };
const emptyDraft: NoteDraft = { body: "", element: null };

export interface QAProps {
  storage?: QAStorage;
  editor?: "vite" | "manual";
  endpoint?: string;
}

export function QA({
  storage: providedStorage,
  editor = "vite",
  endpoint = "/__qraft",
}: QAProps = {}) {
  const mount = useShadowMount();
  const [open, setOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [document, setDocument] = useState<QADocument | null>(null);
  const [connected, setConnected] = useState(true);
  const [feedback, setFeedback] = useState<Feedback>({
    tone: "neutral",
    text: "Loading checklist…",
  });
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [draft, setDraft] = useState("");
  const [notes, setNotes] = useState<Record<string, NoteDraft>>({});
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});
  const [pending, setPending] = useState(false);
  const [picking, setPicking] = useState(false);
  const [sourceError, setSourceError] = useState<{ noteId: string; text: string } | null>(null);
  const [catalog, setCatalog] = useState<QAFileCatalog | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [search, setSearch] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [catalogVersion, setCatalogVersion] = useState(0);
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const formControl = useRef<HTMLInputElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const refreshSequence = useRef(0);
  const locked = useRef(false);
  const formTrigger = useRef<HTMLButtonElement | null>(null);
  const defaultStorage = useMemo(() => new HttpQAStorage(endpoint, setConnected), [endpoint]);
  const storage = useMemo(
    () => providedStorage ?? (fileId ? defaultStorage.forFile(fileId) : null),
    [providedStorage, defaultStorage, fileId],
  );
  const progress = document ? getProgress(document) : { passed: 0, total: 0, skipped: 0 };
  const selected = document?.sections
    .flatMap((section) => section.tasks.map((task) => ({ section, task })))
    .find(({ task }) => task.id === selectedTaskId);
  const noteKey = `${fileId ?? "bound"}:${selectedTaskId ?? ""}`;
  const noteDraft = notes[noteKey] ?? emptyDraft;
  const editDrafts = edits[noteKey] ?? {};
  const editDraft = (id: string, body: string | null) =>
    setEdits((current) => {
      const next = { ...(current[noteKey] ?? {}) };
      if (body === null) delete next[id];
      else next[id] = body;
      return { ...current, [noteKey]: next };
    });
  const orphanEdits = Object.entries(editDrafts).filter(
    ([id]) => !selected?.task.notes.some((note) => note.id === id),
  );
  const preservedEdits = orphanEdits.map(([id, body]) => (
    <div className="qraft-orphan" key={id} role="alert">
      <strong>The note being edited no longer exists.</strong>
      <textarea aria-label="Preserved edit draft" readOnly value={body} />
      <button className="qraft-add" onClick={() => editDraft(id, null)}>
        Discard edit draft
      </button>
    </div>
  ));
  const fileLabel = catalog?.files.find((file) => file.id === fileId)?.label ?? "Markdown";
  const showChooser = !providedStorage && (!fileId || choosing);
  const updateNote = (patch: Partial<NoteDraft>) =>
    setNotes((current) => ({
      ...current,
      [noteKey]: { ...(current[noteKey] ?? emptyDraft), ...patch },
    }));

  useEffect(() => {
    if (providedStorage) return;
    const controller = new AbortController();
    setCatalogError("");
    void defaultStorage
      .getFiles(controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return;
        setCatalog(next);
        setFileId((current) => {
          let saved = current;
          if (!saved) {
            try {
              saved = localStorage.getItem(`qraft:file:${next.projectId}`);
            } catch {
              /* Choice works for this session. */
            }
          }
          return next.files.some((file) => file.id === saved) ? saved : null;
        });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setCatalogError(
            error instanceof Error ? error.message : "Could not list Markdown files.",
          );
      });
    return () => controller.abort();
  }, [defaultStorage, providedStorage, catalogVersion]);

  useEffect(() => {
    const media = matchMedia("(max-width: 800px)");
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setDocument(null);
    setSelectedTaskId(null);
    setConnected(true);
    setFeedback({ tone: "neutral", text: "Loading checklist…" });
    if (!storage) return () => controller.abort();
    const refresh = async () => {
      const sequence = ++refreshSequence.current;
      try {
        const next = await storage.getDocument(controller.signal);
        if (controller.signal.aborted || sequence !== refreshSequence.current) return;
        setDocument(next);
        setFeedback((current) =>
          current.text === "Loading checklist…"
            ? { tone: "neutral", text: "Checklist loaded." }
            : current,
        );
      } catch (error) {
        if (!controller.signal.aborted && sequence === refreshSequence.current)
          setFeedback({
            tone: "error",
            text: error instanceof Error ? error.message : "Could not load the checklist.",
          });
      }
    };
    void refresh();
    const unsubscribe = storage.subscribe(() => void refresh());
    return () => {
      controller.abort();
      refreshSequence.current += 1;
      unsubscribe();
    };
  }, [storage]);
  useEffect(() => {
    if (form) formControl.current?.focus();
  }, [form]);

  const execute = async (command: QACommand, success: string): Promise<QADocument | null> => {
    if (!document || !storage || locked.current) return null;
    locked.current = true;
    refreshSequence.current += 1;
    setPending(true);
    try {
      const next = await storage.execute(command, document.revision);
      refreshSequence.current += 1;
      if (selectedTaskId?.startsWith("legacy:")) {
        const index = document.sections
          .flatMap((section) => section.tasks)
          .findIndex((task) => task.id === selectedTaskId);
        const stable = next.sections.flatMap((section) => section.tasks)[index]?.id;
        if (stable) {
          setSelectedTaskId(stable);
          setNotes((current) => ({
            ...current,
            [`${fileId ?? "bound"}:${stable}`]: current[noteKey] ?? emptyDraft,
          }));
        }
      }
      setDocument(next);
      setFeedback({ tone: "neutral", text: success });
      return next;
    } catch (error) {
      if (error instanceof QAStorageError && error.document) setDocument(error.document);
      setFeedback({
        tone:
          error instanceof QAStorageError && error.code === "revision_conflict"
            ? "warning"
            : "error",
        text:
          error instanceof Error ? error.message : "The change was not saved. Review and retry.",
      });
      return null;
    } finally {
      locked.current = false;
      setPending(false);
    }
  };
  const status = (task: QATask, value: TaskStatus) =>
    void execute(
      { type: "setTaskStatus", taskId: task.id, status: value },
      `Task ${labels[value].toLowerCase()}.`,
    );
  const cancelForm = () => {
    setForm(null);
    setDraft("");
    requestAnimationFrame(() =>
      (
        (mount?.getRootNode() as ShadowRoot | undefined)?.getElementById(
          formTrigger.current?.id ?? "",
        ) ?? heading.current
      )?.focus(),
    );
  };
  const beginForm = (next: FormState, trigger: HTMLButtonElement) => {
    formTrigger.current = trigger;
    setForm(next);
    setDraft("");
  };
  const submitForm = async () => {
    if (!form || !validDraft(draft)) return;
    const command: QACommand =
      form.kind === "section"
        ? { type: "createSection", title: draft }
        : { type: "createTask", sectionId: form.sectionId, title: draft };
    if (await execute(command, `${form.kind === "section" ? "Section" : "Task"} saved.`))
      cancelForm();
  };
  const submitNote = async () => {
    if (!selected || !validDraft(noteDraft.body)) return;
    const index =
      document?.sections
        .flatMap((section) => section.tasks)
        .findIndex((task) => task.id === selected.task.id) ?? -1;
    const next = await execute(
      {
        type: "addNote",
        taskId: selected.task.id,
        body: noteDraft.body,
        element: noteDraft.element,
      },
      "Note saved.",
    );
    if (next) {
      const stable =
        next.sections.flatMap((section) => section.tasks)[index]?.id ?? selected.task.id;
      setNotes((current) => ({
        ...current,
        [noteKey]: emptyDraft,
        [`${fileId ?? "bound"}:${stable}`]: emptyDraft,
      }));
      requestAnimationFrame(() => composer.current?.focus());
    }
  };
  const restoreComposer = () => {
    setPicking(false);
    setOpen(true);
    requestAnimationFrame(() => composer.current?.focus());
  };
  const selectPicker = (selection: PickerSelection) => {
    updateNote({ element: selection.element, warning: selection.contextWarning });
    restoreComposer();
  };
  const openSource = async (note: QANote) => {
    if (!note.element?.source) return;
    setSourceError(null);
    try {
      if (editor === "manual") throw new Error("Open the stored source path in your editor.");
      const query = new URLSearchParams({ file: note.element.source });
      if (note.element.line) query.set("line", String(note.element.line));
      if (note.element.column) query.set("column", String(note.element.column));
      const response = await fetch(`/__open-in-editor?${query}`, {
        redirect: "error",
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) throw new Error("Editor request failed.");
    } catch {
      setSourceError({
        noteId: note.id,
        text: `Could not open ${note.element.source}. Copy the path and open it in your editor.`,
      });
    }
  };
  const back = () => {
    setSelectedTaskId(null);
    setForm(null);
    setDraft("");
    requestAnimationFrame(() => heading.current?.focus());
  };
  const titleForm = (
    <form
      className="qraft-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submitForm();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          cancelForm();
        }
      }}
    >
      <strong>{form?.kind === "section" ? "Add section" : "Add task"}</strong>
      <label htmlFor={`${headingId}-title`}>Title</label>
      <input
        id={`${headingId}-title`}
        ref={formControl}
        value={draft}
        readOnly={pending}
        maxLength={4_000}
        onChange={(event) => setDraft(event.target.value)}
      />
      <div className="qraft-form-actions">
        <button type="button" onClick={cancelForm} disabled={pending}>
          Cancel
        </button>
        <button className="primary" disabled={pending || !validDraft(draft)}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
  const feedbackMessage = (
    <p
      className={feedback.tone === "neutral" ? "qraft-sr-only" : `qraft-banner ${feedback.tone}`}
      aria-live="polite"
      role={feedback.tone === "error" ? "alert" : "status"}
    >
      {feedback.text}
    </p>
  );
  if (!mount) return null;
  return createPortal(
    picking ? (
      <ElementPicker onCancel={restoreComposer} onSelect={selectPicker} />
    ) : (
      <Dialog.Root open={open} onOpenChange={setOpen} modal={false}>
        <EdgeTab open={open} passed={progress.passed} total={progress.total} />
        <Dialog.Portal container={mount}>
          <FocusScope asChild trapped={narrow} loop={narrow}>
            <Dialog.Content
              className="qraft-drawer"
              aria-labelledby={headingId}
              aria-modal={narrow || undefined}
              onInteractOutside={(event) => {
                if (narrow) event.preventDefault();
              }}
              onKeyDown={(event) => {
                if (!narrow || event.key !== "Tab") return;
                const controls = Array.from(
                  event.currentTarget.querySelectorAll<HTMLElement>(
                    "button:not(:disabled), input:not(:disabled), textarea:not(:disabled), summary, [tabindex='0']",
                  ),
                );
                const active = (mount.getRootNode() as ShadowRoot).activeElement;
                if (event.shiftKey && (active === controls[0] || active === heading.current)) {
                  event.preventDefault();
                  controls.at(-1)?.focus();
                } else if (!event.shiftKey && active === controls.at(-1)) {
                  event.preventDefault();
                  controls[0]?.focus();
                }
              }}
              onOpenAutoFocus={(event) => {
                event.preventDefault();
                heading.current?.focus();
              }}
              onEscapeKeyDown={(event) => {
                if (form) {
                  event.preventDefault();
                  cancelForm();
                }
              }}
            >
              <header className={`qraft-header ${selectedTaskId ? "detail" : ""}`}>
                {selectedTaskId ? (
                  <>
                    <button
                      className="qraft-header-back"
                      type="button"
                      onClick={back}
                      disabled={pending}
                    >
                      <ArrowLeft size={21} /> Back to checklist
                    </button>
                    <Dialog.Title
                      className="qraft-sr-only"
                      ref={heading}
                      id={headingId}
                      tabIndex={-1}
                    >
                      Task details
                    </Dialog.Title>
                  </>
                ) : (
                  <>
                    <Menu aria-hidden="true" size={19} />
                    <Dialog.Title ref={heading} id={headingId} tabIndex={-1}>
                      Qraft
                    </Dialog.Title>
                  </>
                )}
                {!providedStorage && !selectedTaskId && !showChooser ? (
                  <button
                    className="qraft-change-file"
                    disabled={pending}
                    onClick={() => setChoosing(true)}
                    title={`Selected file: ${fileLabel}`}
                  >
                    Change file
                  </button>
                ) : null}
                <Dialog.Close className="qraft-icon-button" aria-label="Close Qraft">
                  <X size={19} />
                </Dialog.Close>
              </header>
              <div className="qraft-content">
                {showChooser ? (
                  <FileChooser
                    id={headingId}
                    catalog={catalog}
                    catalogError={catalogError}
                    search={search}
                    pending={pending}
                    fileId={fileId}
                    setSearch={setSearch}
                    onRefresh={() => setCatalogVersion((value) => value + 1)}
                    onCancel={() => setChoosing(false)}
                    onChoose={(id) => {
                      if (pending || !catalog) return;
                      setFileId(id);
                      setChoosing(false);
                      setForm(null);
                      setDraft("");
                      requestAnimationFrame(() => heading.current?.focus());
                      try {
                        localStorage.setItem(`qraft:file:${catalog.projectId}`, id);
                      } catch {
                        /* Session selection remains usable. */
                      }
                    }}
                  />
                ) : (
                  <>
                    {!selectedTaskId ? (
                      <div className="qraft-progress-row">
                        <strong>
                          {progress.passed} / {progress.total}
                        </strong>
                        <div
                          className="qraft-progress"
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={progress.total}
                          aria-valuenow={progress.passed}
                          aria-label={`${progress.passed} of ${progress.total} tasks completed`}
                        >
                          <span
                            style={{
                              width: `${progress.total ? (progress.passed / progress.total) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        {progress.skipped ? <small>{progress.skipped} skipped</small> : null}
                      </div>
                    ) : null}
                    {!connected ? (
                      <p className="qraft-banner warning" role="status">
                        Disconnected. Qraft is reconnecting automatically.
                      </p>
                    ) : null}
                    {form?.kind !== "section" ? feedbackMessage : null}
                    {document?.diagnostics.map((diagnostic) => (
                      <p
                        className="qraft-banner warning"
                        key={`${diagnostic.code}-${diagnostic.lines.join("-")}`}
                      >
                        {diagnostic.message} Lines {diagnostic.lines.join(", ")}.
                      </p>
                    ))}
                    {selected ? (
                      <article className="qraft-detail">
                        <h2>{selected.task.title}</h2>
                        <div className="qraft-status-options" role="group" aria-label="Task status">
                          {(["open", "completed", "skipped"] as const).map((value) => (
                            <button
                              key={value}
                              aria-pressed={selected.task.status === value}
                              className={value}
                              disabled={pending || selected.task.readOnly}
                              onClick={() => status(selected.task, value)}
                            >
                              {labels[value]}
                            </button>
                          ))}
                        </div>
                        <section className="qraft-detail-section">
                          <h3>
                            <StickyNote size={13} /> Notes · {selected.task.notes.length}
                          </h3>
                          <NoteComposer
                            id={headingId}
                            draft={noteDraft}
                            pending={pending}
                            readOnly={selected.task.readOnly}
                            inputRef={composer}
                            onChange={updateNote}
                            onSubmit={submitNote}
                            onAttach={() => {
                              setOpen(false);
                              setPicking(true);
                            }}
                          />
                          {selected.task.notes.length ? (
                            <ol className="qraft-note-timeline">
                              {selected.task.notes.map((note, index) => (
                                <NoteItem
                                  key={note.readOnly ? `${note.id}-${index}` : note.id}
                                  note={note}
                                  pending={pending}
                                  draft={editDrafts[note.id]}
                                  onDraft={(body) => editDraft(note.id, body)}
                                  save={async (body) =>
                                    Boolean(
                                      await execute(
                                        { type: "editNote", noteId: note.id, body },
                                        "Note updated.",
                                      ),
                                    )
                                  }
                                  openSource={() => void openSource(note)}
                                  error={sourceError?.noteId === note.id ? sourceError.text : null}
                                />
                              ))}
                            </ol>
                          ) : (
                            <p className="qraft-empty-copy">
                              No notes yet. Add observations for your coding agent.
                            </p>
                          )}
                          {preservedEdits}
                        </section>
                      </article>
                    ) : selectedTaskId ? (
                      <div className="qraft-orphan" role="alert">
                        <strong>The selected task no longer exists.</strong>
                        <p>Your unsaved note remains here so you can copy it.</p>
                        <textarea aria-label="Preserved draft" readOnly value={noteDraft.body} />
                        {preservedEdits}
                        <button className="qraft-secondary" onClick={back}>
                          Back to checklist
                        </button>
                      </div>
                    ) : (
                      <div className="qraft-view">
                        <h2 className="qraft-document-title">{document?.title ?? "QA"}</h2>
                        {!document ? <p role="status">Loading checklist…</p> : null}
                        {document?.sections.length === 0 ? (
                          <div className="qraft-empty">
                            <strong>No QA tasks yet</strong>
                            <p>
                              Add a section below, or ask your coding editor to fill this Markdown
                              file with ## sections and - [ ] tasks.
                            </p>
                          </div>
                        ) : null}
                        {document?.sections.map((section, sectionIndex) => (
                          <section
                            className="qraft-section"
                            key={section.readOnly ? `${section.id}-${sectionIndex}` : section.id}
                          >
                            <h3>{section.title}</h3>
                            <div className="qraft-task-list">
                              {section.tasks.map((task, index) => (
                                <TaskRow
                                  key={task.readOnly ? `${task.id}-${index}` : task.id}
                                  task={task}
                                  pending={pending}
                                  change={(value) => status(task, value)}
                                  select={() => {
                                    setSelectedTaskId(task.id);
                                    setSourceError(null);
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
                                  beginForm(
                                    { kind: "task", sectionId: section.id },
                                    event.currentTarget,
                                  )
                                }
                              >
                                <Plus size={15} /> Add task
                              </button>
                            )}
                          </section>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
              {!showChooser && !selectedTaskId && document ? (
                <footer className="qraft-footer">
                  {form?.kind === "section" ? (
                    <>
                      {feedbackMessage}
                      {titleForm}
                    </>
                  ) : (
                    <button
                      id={`${headingId}-add-section`}
                      className="qraft-secondary"
                      disabled={pending}
                      onClick={(event) => beginForm({ kind: "section" }, event.currentTarget)}
                    >
                      <Plus size={16} /> Add section
                    </button>
                  )}
                </footer>
              ) : null}
            </Dialog.Content>
          </FocusScope>
        </Dialog.Portal>
      </Dialog.Root>
    ),
    mount,
  );
}
