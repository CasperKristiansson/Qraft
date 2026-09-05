import { FileChooser } from "./FileChooser";
import * as Dialog from "@radix-ui/react-dialog";
import { FocusScope } from "@radix-ui/react-focus-scope";
import { ArrowLeft, ChevronDown, FolderOpen, Menu, Pin, Plus, Settings, X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { QACommand } from "../domain/commands";
import type { QANote, QATask, TaskStatus } from "../domain/model";
import { getProgress } from "../domain/model";
import { HttpQAStorage } from "./http-storage";
import type { QAFileCatalog, QAStorage } from "./storage";
import { ElementPicker, type PickerSelection } from "./picker/ElementPicker";
import { EdgeTab } from "./EdgeTab";
import { useShadowMount } from "./use-shadow-mount";
import { ChecklistView } from "./ChecklistView";
import { TaskDetail } from "./TaskDetail";
import { type NoteDraft } from "./NoteComposer";
import { labels, validDraft } from "./review-state";
import { useDocument } from "./use-document";
import { useReviewSession } from "./use-review-session";
import { isRecoverableForm, isRecoverableTarget, reconcileSession } from "./review-session";
import { ReviewNavigation, ReviewRecovery, CompactReview } from "./ReviewTools";

type FormState = { kind: "section" } | { kind: "task"; sectionId: string };
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
  const [connected, setConnected] = useState(true);
  const [catalog, setCatalog] = useState<QAFileCatalog | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const sessionKey =
    !providedStorage && catalog && fileId ? `qraft:review:v1:${catalog.projectId}:${fileId}` : null;
  const {
    session,
    updateSession,
    warning: sessionWarning,
    clearSession,
  } = useReviewSession(sessionKey, providedStorage);
  const { selectedTaskId, form, titleDraft: draft, notes, edits } = session;
  const setSelectedTaskId = (value: string | null) =>
    updateSession((current) => ({ ...current, selectedTaskId: value }));
  const setForm = (value: FormState | null) =>
    updateSession((current) => ({ ...current, form: value }));
  const setDraft = (value: string) =>
    updateSession((current) => ({ ...current, titleDraft: value }));
  const setNotes = (apply: (notes: Record<string, NoteDraft>) => Record<string, NoteDraft>) =>
    updateSession((current) => ({ ...current, notes: apply(current.notes) }));
  const [pinned, setPinned] = useState(false);
  const [compact, setCompact] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [settings, setSettings] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [preferenceWarning, setPreferenceWarning] = useState("");
  const [picking, setPicking] = useState(false);
  const [sourceError, setSourceError] = useState<{ noteId: string; text: string } | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [search, setSearch] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [catalogVersion, setCatalogVersion] = useState(0);
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const navigationFocus = useRef(false);
  const formControl = useRef<HTMLInputElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const formTrigger = useRef<HTMLButtonElement | null>(null);
  const defaultStorage = useMemo(() => new HttpQAStorage(endpoint, setConnected), [endpoint]);
  const storage = useMemo(
    () => providedStorage ?? (fileId ? defaultStorage.forFile(fileId) : null),
    [providedStorage, defaultStorage, fileId],
  );
  const { document, pending, feedback, execute } = useDocument(
    storage,
    (before, after, command) =>
      updateSession((current) => reconcileSession(current, before, after, command)),
    setConnected,
  );
  const progress = document ? getProgress(document) : { passed: 0, total: 0, skipped: 0 };
  const tasks = document?.sections.flatMap((section) => section.tasks) ?? [];
  const selected = document?.sections
    .flatMap((section) => section.tasks.map((task) => ({ section, task })))
    .find(({ task }) => task.id === selectedTaskId);
  const selectedIndex = tasks.findIndex((task) => task.id === selectedTaskId);
  const noteKey = selectedTaskId ?? "";
  const noteDraft = notes[noteKey] ?? emptyDraft;
  const editDrafts = edits[noteKey] ?? {};
  const editDraft = (id: string, body: string | null) =>
    updateSession((current) => {
      const next = { ...(current.edits[noteKey] ?? {}) };
      if (body === null) delete next[id];
      else
        next[id] = {
          body,
          originalBody:
            next[id]?.originalBody ??
            selected?.task.notes.find((note) => note.id === id)?.body ??
            "",
          revision: next[id]?.revision ?? document?.revision ?? "",
        };
      return { ...current, edits: { ...current.edits, [noteKey]: next } };
    });
  const fileLabel = catalog?.files.find((file) => file.id === fileId)?.label ?? "Markdown";
  const showChooser = !providedStorage && (!fileId || choosing);
  const modal = narrow && !pinned;
  const draftBlocked = Boolean(
    document &&
      (noteDraft.body || noteDraft.element) &&
      !isRecoverableTarget(noteKey, noteDraft.revision, document),
  );
  const updateNote = (patch: Partial<NoteDraft>) =>
    setNotes((current) => ({
      ...current,
      [noteKey]: {
        ...(current[noteKey] ?? emptyDraft),
        observation: (current[noteKey]?.body || current[noteKey]?.element
          ? current[noteKey]?.observation
          : undefined) ?? {
          route: location.pathname,
          viewport: { width: window.innerWidth, height: window.innerHeight },
        },
        revision: current[noteKey]?.revision ?? document?.revision,
        ...patch,
      },
    }));

  useEffect(() => {
    if (!catalog) return;
    try {
      setPinned(localStorage.getItem(`qraft:pinned:${catalog.projectId}`) === "true");
    } catch {
      setPreferenceWarning(
        "Pin preference will last for this page only because browser storage is unavailable.",
      );
    }
  }, [catalog?.projectId]);

  useLayoutEffect(() => {
    if (!navigationFocus.current) return;
    navigationFocus.current = false;
    if (selectedTaskId && content.current) content.current.scrollTop = 0;
    heading.current?.focus();
  });

  useLayoutEffect(() => {
    if (!selectedTaskId && !showChooser && document && content.current)
      content.current.scrollTop = session.scroll;
  }, [selectedTaskId, showChooser, document === null]);

  useEffect(() => {
    if (compact && document && !selected) {
      setCompact(false);
      setOpen(true);
    }
  }, [compact, document, selected]);

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
    if (form) formControl.current?.focus();
  }, [form]);

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
    updateSession((current) => ({
      ...current,
      form:
        next.kind === "task"
          ? { ...next, ...(document ? { revision: document.revision } : {}) }
          : next,
    }));
    setDraft("");
  };
  const submitForm = async () => {
    if (!form || !document || !isRecoverableForm(session, document) || !validDraft(draft)) return;
    const command: QACommand =
      form.kind === "section"
        ? { type: "createSection", title: draft }
        : { type: "createTask", sectionId: form.sectionId, title: draft };
    if (await execute(command, `${form.kind === "section" ? "Section" : "Task"} saved.`))
      cancelForm();
  };
  const submitNote = async () => {
    if (!selected || draftBlocked || !validDraft(noteDraft.body)) return;
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
        ...(noteDraft.observation ? { observation: noteDraft.observation } : {}),
      },
      "Note saved.",
    );
    if (next) {
      const stable =
        next.sections.flatMap((section) => section.tasks)[index]?.id ?? selected.task.id;
      setNotes((current) => ({
        ...current,
        [noteKey]: emptyDraft,
        [stable]: emptyDraft,
      }));
      requestAnimationFrame(() => composer.current?.focus());
    }
  };
  const restoreComposer = () => {
    setPicking(false);
    setCompact(false);
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
    navigationFocus.current = true;
    setSelectedTaskId(null);
    setForm(null);
    setDraft("");
  };
  const navigate = (id: string | undefined) => {
    if (!id || pending) return;
    navigationFocus.current = true;
    setSelectedTaskId(id);
    setSourceError(null);
  };
  const completeAndNext = async () => {
    if (!selected) return;
    const next = await execute(
      { type: "setTaskStatus", taskId: selected.task.id, status: "completed" },
      "Task completed.",
    );
    const target = next?.sections.flatMap((section) => section.tasks)[selectedIndex + 1];
    if (target) navigate(target.id);
  };
  const togglePin = () => {
    const next = !pinned;
    setPinned(next);
    if (catalog) {
      try {
        localStorage.setItem(`qraft:pinned:${catalog.projectId}`, String(next));
      } catch {
        setPreferenceWarning(
          "Pin preference will last for this page only because browser storage is unavailable.",
        );
      }
    }
  };
  const navigation = selected ? (
    <ReviewNavigation
      index={selectedIndex}
      total={tasks.length}
      pending={pending}
      readOnly={Boolean(selected.task.readOnly)}
      previous={() => navigate(tasks[selectedIndex - 1]?.id)}
      next={() => navigate(tasks[selectedIndex + 1]?.id)}
      complete={() => void completeAndNext()}
    />
  ) : null;
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
        <button
          className="primary"
          disabled={
            pending ||
            !validDraft(draft) ||
            Boolean(document && !isRecoverableForm(session, document))
          }
        >
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
  if (!mount || hidden) return null;
  return createPortal(
    picking ? (
      <ElementPicker onCancel={restoreComposer} onSelect={selectPicker} />
    ) : (
      <Dialog.Root
        open={open && !compact}
        onOpenChange={(value) => {
          setOpen(value);
          if (value) setCompact(false);
        }}
        modal={false}
      >
        <EdgeTab open={open || compact} passed={progress.passed} total={progress.total} />
        {compact && selected ? (
          <CompactReview
            task={selected.task}
            index={selectedIndex}
            total={tasks.length}
            pending={pending}
            expand={() => {
              setCompact(false);
              setOpen(true);
            }}
            close={() => setCompact(false)}
            next={() => navigate(tasks[selectedIndex + 1]?.id)}
            complete={() => status(selected.task, "completed")}
          />
        ) : null}
        <Dialog.Portal container={mount}>
          <FocusScope asChild trapped={modal} loop={modal}>
            <Dialog.Content
              className="qraft-drawer"
              aria-labelledby={headingId}
              aria-modal={modal || undefined}
              onInteractOutside={(event) => {
                if (narrow || pinned) event.preventDefault();
              }}
              onKeyDown={(event) => {
                const typing =
                  event.target instanceof HTMLElement &&
                  event.target.closest("input, textarea, select, [contenteditable='true']");
                if (
                  selected &&
                  !typing &&
                  event.altKey &&
                  !event.ctrlKey &&
                  !event.metaKey &&
                  (event.key === "ArrowLeft" || event.key === "ArrowRight")
                ) {
                  event.preventDefault();
                  navigate(tasks[selectedIndex + (event.key === "ArrowLeft" ? -1 : 1)]?.id);
                }
                if (!modal || event.key !== "Tab") return;
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
                {narrow && selected ? (
                  <button
                    className="qraft-icon-button"
                    aria-label="Collapse to task strip"
                    onClick={() => {
                      setCompact(true);
                      setOpen(false);
                    }}
                  >
                    <ChevronDown size={18} />
                  </button>
                ) : null}
                {!selectedTaskId && !showChooser ? (
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
                <Dialog.Close className="qraft-icon-button" aria-label="Close Qraft">
                  <X size={19} />
                </Dialog.Close>
              </header>
              <div
                className={`qraft-content ${!selectedTaskId && !showChooser && !settings ? "checklist" : ""}`}
                ref={content}
                onScroll={() => {
                  if (!selectedTaskId && !showChooser && content.current) {
                    const scroll = content.current.scrollTop;
                    if (scroll !== session.scroll)
                      updateSession((current) => ({ ...current, scroll }));
                  }
                }}
              >
                {sessionWarning || preferenceWarning ? (
                  <p className="qraft-banner warning" role="status">
                    {sessionWarning || preferenceWarning}
                  </p>
                ) : null}
                {settings && !selectedTaskId ? (
                  <section className="qraft-settings" aria-label="Review settings">
                    <strong>Review settings</strong>
                    <p>
                      Pin the drawer to keep it open. Drafts and your place survive reloads in this
                      browser tab.
                    </p>
                    <button disabled={pending} onClick={() => setHidden(true)}>
                      Hide Qraft until reload
                    </button>
                    {!showChooser ? (
                      <>
                        <button disabled={pending} onClick={() => setClearing(true)}>
                          Clear saved review session…
                        </button>
                        {clearing ? (
                          <div role="group" aria-label="Confirm clearing session">
                            <p>Discard this file’s unsaved drafts and saved view state?</p>
                            <button onClick={() => setClearing(false)}>Cancel</button>
                            <button
                              disabled={pending}
                              onClick={() => {
                                clearSession();
                                setClearing(false);
                                setSettings(false);
                              }}
                            >
                              Discard unsaved session
                            </button>
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </section>
                ) : null}
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
                    {!connected ? (
                      <p className="qraft-banner warning" role="status">
                        Disconnected. Qraft is reconnecting automatically.
                      </p>
                    ) : null}
                    {form?.kind !== "section" ? feedbackMessage : null}
                    {document ? (
                      <ReviewRecovery
                        document={document}
                        session={session}
                        update={updateSession}
                      />
                    ) : null}
                    {document?.diagnostics.map((diagnostic) => (
                      <p
                        className="qraft-banner warning"
                        key={`${diagnostic.code}-${diagnostic.lines.join("-")}`}
                      >
                        {diagnostic.message} Lines {diagnostic.lines.join(", ")}.
                      </p>
                    ))}
                    {selected ? (
                      <TaskDetail
                        task={selected.task}
                        document={document!}
                        headingId={headingId}
                        pending={pending}
                        noteDraft={noteDraft}
                        draftBlocked={draftBlocked}
                        composer={composer}
                        editDrafts={editDrafts}
                        sourceError={sourceError}
                        status={status}
                        onChange={updateNote}
                        onSubmit={submitNote}
                        onAttach={() => {
                          setOpen(false);
                          setPicking(true);
                        }}
                        editDraft={editDraft}
                        execute={execute}
                        openSource={openSource}
                      />
                    ) : selectedTaskId && document ? (
                      <div className="qraft-orphan" role="alert">
                        <strong>The selected task no longer exists.</strong>
                        <p>Your unsaved note remains here so you can copy it.</p>
                        <button className="qraft-secondary" onClick={back}>
                          Back to checklist
                        </button>
                      </div>
                    ) : (
                      <ChecklistView
                        document={document}
                        session={session}
                        updateSession={updateSession}
                        pending={pending}
                        headingId={headingId}
                        titleForm={titleForm}
                        beginForm={beginForm}
                        status={status}
                        navigate={navigate}
                      />
                    )}
                  </>
                )}
              </div>
              {!showChooser && selected ? navigation : null}
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
                  <div className="qraft-footer-tools">
                    {!providedStorage ? (
                      <button
                        className="qraft-change-file"
                        disabled={pending}
                        onClick={() => setChoosing(true)}
                        title={`Selected file: ${fileLabel}`}
                      >
                        <FolderOpen size={15} aria-hidden="true" /> Change file
                      </button>
                    ) : null}
                    <button
                      className="qraft-pin"
                      aria-label="Keep Qraft open"
                      title="Keep Qraft open while interacting with the app"
                      aria-pressed={pinned}
                      onClick={togglePin}
                    >
                      <Pin size={15} /> Keep open
                    </button>
                    <button
                      className="qraft-icon-button"
                      aria-label="Review settings"
                      aria-expanded={settings}
                      onClick={() => setSettings((value) => !value)}
                    >
                      <Settings size={17} />
                    </button>
                  </div>
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
