import * as Dialog from "@radix-ui/react-dialog";
import { FocusScope } from "@radix-ui/react-focus-scope";
import { ArrowLeft, Check, ChevronRight, Circle, ExternalLink, Menu, Minus, Pencil, Plus, StickyNote, Target, X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { QACommand } from "../domain/commands";
import type { ElementReference, QADocument, QANote, QATask, TaskStatus } from "../domain/model";
import { getProgress } from "../domain/model";
import { HttpQAStorage, QAStorageError } from "./http-storage";
import type { QAFileCatalog, QAStorage } from "./storage";
import { ElementPicker, type PickerSelection } from "./picker/ElementPicker";
import { EdgeTab } from "./EdgeTab";
import styles from "./styles.css?raw";

type FormState = { kind: "section" } | { kind: "task"; sectionId: string };
type Feedback = { tone: "neutral" | "warning" | "error"; text: string };
type NoteDraft = { body: string; element: ElementReference | null; warning?: string | null };
const emptyDraft: NoteDraft = { body: "", element: null };
const labels: Record<TaskStatus, string> = { open: "Not completed", completed: "Completed", skipped: "Skipped" };
const nextStatus: Record<TaskStatus, TaskStatus> = { open: "completed", completed: "skipped", skipped: "open" };
const validDraft = (value: string) => Array.from(value.trim()).length > 0 && Array.from(value.trim()).length <= 2_000;

function useShadowMount() {
  const [mount, setMount] = useState<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const host = document.createElement("div");
    host.dataset.qraftRoot = ""; host.dataset.reactGrabIgnore = "";
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style"); style.textContent = styles;
    const container = document.createElement("div"); container.dataset.qraftPortal = "";
    shadow.append(style, container); document.body.append(host); setMount(container);
    return () => host.remove();
  }, []);
  return mount;
}

export interface QAProps { storage?: QAStorage }

export function QA({ storage: providedStorage }: QAProps = {}) {
  const mount = useShadowMount();
  const [open, setOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [document, setDocument] = useState<QADocument | null>(null);
  const [connected, setConnected] = useState(true);
  const [feedback, setFeedback] = useState<Feedback>({ tone: "neutral", text: "Loading checklist…" });
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
  const defaultStorage = useMemo(() => new HttpQAStorage("/__qraft", setConnected), []);
  const storage = useMemo(() => providedStorage ?? (fileId ? defaultStorage.forFile(fileId) : null), [providedStorage, defaultStorage, fileId]);
  const progress = document ? getProgress(document) : { passed: 0, total: 0, skipped: 0 };
  const selected = document?.sections.flatMap((section) => section.tasks.map((task) => ({ section, task }))).find(({ task }) => task.id === selectedTaskId);
  const noteKey = `${fileId ?? "bound"}:${selectedTaskId ?? ""}`;
  const noteDraft = notes[noteKey] ?? emptyDraft;
  const editDrafts = edits[noteKey] ?? {};
  const editDraft = (id: string, body: string | null) => setEdits((current) => {
    const next = { ...(current[noteKey] ?? {}) };
    if (body === null) delete next[id]; else next[id] = body;
    return { ...current, [noteKey]: next };
  });
  const orphanEdits = Object.entries(editDrafts).filter(([id]) => !selected?.task.notes.some((note) => note.id === id));
  const preservedEdits = orphanEdits.map(([id, body]) => <div className="qraft-orphan" key={id} role="alert"><strong>The note being edited no longer exists.</strong><textarea aria-label="Preserved edit draft" readOnly value={body} /><button className="qraft-add" onClick={() => editDraft(id, null)}>Discard edit draft</button></div>);
  const fileLabel = catalog?.files.find((file) => file.id === fileId)?.label ?? "Markdown";
  const showChooser = !providedStorage && (!fileId || choosing);
  const updateNote = (patch: Partial<NoteDraft>) => setNotes((current) => ({ ...current, [noteKey]: { ...(current[noteKey] ?? emptyDraft), ...patch } }));

  useEffect(() => {
    if (providedStorage) return;
    const controller = new AbortController();
    setCatalogError("");
    void defaultStorage.getFiles(controller.signal).then((next) => {
      if (controller.signal.aborted) return;
      setCatalog(next);
      setFileId((current) => {
        let saved = current;
        if (!saved) { try { saved = localStorage.getItem(`qraft:file:${next.projectId}`); } catch { /* Choice works for this session. */ } }
        return next.files.some((file) => file.id === saved) ? saved : null;
      });
    }).catch((error: unknown) => { if (!controller.signal.aborted) setCatalogError(error instanceof Error ? error.message : "Could not list Markdown files."); });
    return () => controller.abort();
  }, [defaultStorage, providedStorage, catalogVersion]);

  useEffect(() => {
    const media = matchMedia("(max-width: 800px)");
    const update = () => setNarrow(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setDocument(null); setSelectedTaskId(null); setConnected(true);
    setFeedback({ tone: "neutral", text: "Loading checklist…" });
    if (!storage) return () => controller.abort();
    const refresh = async () => {
      const sequence = ++refreshSequence.current;
      try {
        const next = await storage.getDocument(controller.signal);
        if (controller.signal.aborted || sequence !== refreshSequence.current) return;
        setDocument(next);
      } catch (error) {
        if (!controller.signal.aborted && sequence === refreshSequence.current) setFeedback({ tone: "error", text: error instanceof Error ? error.message : "Could not load the checklist." });
      }
    };
    void refresh();
    const unsubscribe = storage.subscribe(() => void refresh());
    return () => { controller.abort(); refreshSequence.current += 1; unsubscribe(); };
  }, [storage]);
  useEffect(() => { if (form) formControl.current?.focus(); }, [form]);

  const execute = async (command: QACommand, success: string): Promise<QADocument | null> => {
    if (!document || !storage || locked.current) return null;
    locked.current = true; refreshSequence.current += 1; setPending(true);
    try {
      const next = await storage.execute(command, document.revision);
      refreshSequence.current += 1;
      if (selectedTaskId?.startsWith("legacy:")) {
        const index = document.sections.flatMap((section) => section.tasks).findIndex((task) => task.id === selectedTaskId);
        const stable = next.sections.flatMap((section) => section.tasks)[index]?.id;
        if (stable) {
          setSelectedTaskId(stable);
          setNotes((current) => ({ ...current, [`${fileId ?? "bound"}:${stable}`]: current[noteKey] ?? emptyDraft }));
        }
      }
      setDocument(next); setFeedback({ tone: "neutral", text: success }); return next;
    } catch (error) {
      if (error instanceof QAStorageError && error.document) setDocument(error.document);
      setFeedback({ tone: error instanceof QAStorageError && error.code === "revision_conflict" ? "warning" : "error", text: error instanceof Error ? error.message : "The change was not saved. Review and retry." });
      return null;
    } finally { locked.current = false; setPending(false); }
  };
  const status = (task: QATask, value: TaskStatus) => void execute({ type: "setTaskStatus", taskId: task.id, status: value }, `Task ${labels[value].toLowerCase()}.`);
  const cancelForm = () => { setForm(null); setDraft(""); requestAnimationFrame(() => ((mount?.getRootNode() as ShadowRoot | undefined)?.getElementById(formTrigger.current?.id ?? "") ?? heading.current)?.focus()); };
  const beginForm = (next: FormState, trigger: HTMLButtonElement) => { formTrigger.current = trigger; setForm(next); setDraft(""); };
  const submitForm = async () => {
    if (!form || !validDraft(draft)) return;
    const command: QACommand = form.kind === "section" ? { type: "createSection", title: draft } : { type: "createTask", sectionId: form.sectionId, title: draft };
    if (await execute(command, `${form.kind === "section" ? "Section" : "Task"} saved.`)) cancelForm();
  };
  const submitNote = async () => {
    if (!selected || !validDraft(noteDraft.body)) return;
    const index = document?.sections.flatMap((section) => section.tasks).findIndex((task) => task.id === selected.task.id) ?? -1;
    const next = await execute({ type: "addNote", taskId: selected.task.id, body: noteDraft.body, element: noteDraft.element }, "Note saved.");
    if (next) {
      const stable = next.sections.flatMap((section) => section.tasks)[index]?.id ?? selected.task.id;
      setNotes((current) => ({ ...current, [noteKey]: emptyDraft, [`${fileId ?? "bound"}:${stable}`]: emptyDraft }));
      requestAnimationFrame(() => composer.current?.focus());
    }
  };
  const restoreComposer = () => { setPicking(false); setOpen(true); requestAnimationFrame(() => composer.current?.focus()); };
  const selectPicker = (selection: PickerSelection) => { updateNote({ element: selection.element, warning: selection.contextWarning }); restoreComposer(); };
  const openSource = async (note: QANote) => {
    if (!note.element?.source) return;
    setSourceError(null);
    try {
      const query = new URLSearchParams({ file: note.element.source });
      if (note.element.line) query.set("line", String(note.element.line));
      if (note.element.column) query.set("column", String(note.element.column));
      const response = await fetch(`/__open-in-editor?${query}`, { redirect: "error", signal: AbortSignal.timeout(5_000) });
      if (!response.ok) throw new Error("Editor request failed.");
    }
    catch { setSourceError({ noteId: note.id, text: `Could not open ${note.element.source}. Copy the path and open it in your editor.` }); }
  };
  const back = () => { setSelectedTaskId(null); setForm(null); setDraft(""); requestAnimationFrame(() => heading.current?.focus()); };
  const titleForm = <form className="qraft-form" onSubmit={(event) => { event.preventDefault(); void submitForm(); }} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancelForm(); } }}>
    <strong>{form?.kind === "section" ? "Add section" : "Add task"}</strong><label htmlFor={`${headingId}-title`}>Title</label>
    <input id={`${headingId}-title`} ref={formControl} value={draft} readOnly={pending} maxLength={4_000} onChange={(event) => setDraft(event.target.value)} />
    <div className="qraft-form-actions"><button type="button" onClick={cancelForm} disabled={pending}>Cancel</button><button className="primary" disabled={pending || !validDraft(draft)}>{pending ? "Saving…" : "Save"}</button></div>
  </form>;
  const feedbackMessage = <p className={feedback.tone === "neutral" ? "qraft-sr-only" : `qraft-banner ${feedback.tone}`} aria-live="polite" role={feedback.tone === "error" ? "alert" : "status"}>{feedback.text}</p>;
  if (!mount) return null;
  return createPortal(picking ? <ElementPicker onCancel={restoreComposer} onSelect={selectPicker} /> : <Dialog.Root open={open} onOpenChange={setOpen} modal={false}>
    <EdgeTab open={open} passed={progress.passed} total={progress.total} />
    <Dialog.Portal container={mount}><FocusScope asChild trapped={narrow} loop={narrow}>
      <Dialog.Content className="qraft-drawer" aria-labelledby={headingId} aria-modal={narrow || undefined}
        onInteractOutside={(event) => { if (narrow) event.preventDefault(); }}
        onKeyDown={(event) => {
          if (!narrow || event.key !== "Tab") return;
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), textarea:not(:disabled), summary, [tabindex='0']"));
          const active = (mount.getRootNode() as ShadowRoot).activeElement;
          if (event.shiftKey && (active === controls[0] || active === heading.current)) { event.preventDefault(); controls.at(-1)?.focus(); }
          else if (!event.shiftKey && active === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
        }}
        onOpenAutoFocus={(event) => { event.preventDefault(); heading.current?.focus(); }}
        onEscapeKeyDown={(event) => { if (form) { event.preventDefault(); cancelForm(); } }}>
        <header className={`qraft-header ${selectedTaskId ? "detail" : ""}`}>
          {selectedTaskId ? <><button className="qraft-header-back" type="button" onClick={back} disabled={pending}><ArrowLeft size={21} /> Back to checklist</button><Dialog.Title className="qraft-sr-only" ref={heading} id={headingId} tabIndex={-1}>Task details</Dialog.Title></> : <><Menu aria-hidden="true" size={19} /><Dialog.Title ref={heading} id={headingId} tabIndex={-1}>Qraft</Dialog.Title></>}
          {!providedStorage && !selectedTaskId && !showChooser ? <button className="qraft-change-file" disabled={pending} onClick={() => setChoosing(true)} title={`Selected file: ${fileLabel}`}>Change file</button> : null}
          <Dialog.Close className="qraft-icon-button" aria-label="Close Qraft"><X size={19} /></Dialog.Close>
        </header>
        <div className="qraft-content">
          {showChooser ? <section className="qraft-file-chooser">
            <h2>Choose a checklist</h2><p>Select a Markdown file from this project. Your choice is remembered in this browser.</p>
            <label htmlFor={`${headingId}-search`}>Find a Markdown file</label><input id={`${headingId}-search`} value={search} onChange={(event) => setSearch(event.target.value)} />
            {catalogError ? <p role="alert" className="qraft-banner error">{catalogError}</p> : null}
            {!catalog && !catalogError ? <p role="status">Loading files…</p> : null}
            {catalog?.files.filter((file) => file.label.toLowerCase().includes(search.toLowerCase())).map((file) => <button className="qraft-file" key={file.id} onClick={() => {
              if (pending) return;
              setFileId(file.id); setChoosing(false); setForm(null); setDraft("");
              requestAnimationFrame(() => heading.current?.focus());
              try { localStorage.setItem(`qraft:file:${catalog.projectId}`, file.id); } catch { /* Session selection remains usable. */ }
            }}>{file.label}<ChevronRight size={16} /></button>)}
            {catalog?.files.length === 0 ? <p>No Markdown files yet. Ask your coding editor to create a checklist with ## section headings and - [ ] tasks, then refresh the file list.</p> : null}
            {catalog?.truncated ? <p>The file list was limited. Configure qraft's file option to include a specific checklist.</p> : null}
            <button className="qraft-secondary" onClick={() => setCatalogVersion((value) => value + 1)}>Refresh files</button>
            {fileId ? <button className="qraft-add" onClick={() => setChoosing(false)}>Cancel file change</button> : null}
          </section> : <>
            {!selectedTaskId ? <div className="qraft-progress-row"><strong>{progress.passed} / {progress.total}</strong><div className="qraft-progress" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.passed} aria-label={`${progress.passed} of ${progress.total} tasks completed`}><span style={{ width: `${progress.total ? progress.passed / progress.total * 100 : 0}%` }} /></div>{progress.skipped ? <small>{progress.skipped} skipped</small> : null}</div> : null}
            {!connected ? <p className="qraft-banner warning" role="status">Disconnected. Qraft is reconnecting automatically.</p> : null}
            {form?.kind !== "section" ? feedbackMessage : null}
            {document?.diagnostics.map((diagnostic) => <p className="qraft-banner warning" key={`${diagnostic.code}-${diagnostic.lines.join("-")}`}>{diagnostic.message} Lines {diagnostic.lines.join(", ")}.</p>)}
            {selected ? <article className="qraft-detail">
              <h2>{selected.task.title}</h2>
              <div className="qraft-status-options" role="group" aria-label="Task status">{(["open", "completed", "skipped"] as const).map((value) => <button key={value} aria-pressed={selected.task.status === value} className={value} disabled={pending || selected.task.readOnly} onClick={() => status(selected.task, value)}>{labels[value]}</button>)}</div>
              <section className="qraft-detail-section"><h3><StickyNote size={13} /> Notes · {selected.task.notes.length}</h3>
                <form className="qraft-note-composer" onSubmit={(event) => { event.preventDefault(); void submitNote(); }}>
                  <label htmlFor={`${headingId}-note`}>Write a note</label>
                  <textarea ref={composer} id={`${headingId}-note`} value={noteDraft.body} maxLength={4_000} readOnly={pending || selected.task.readOnly} placeholder="What could be improved?" onChange={(event) => updateNote({ body: event.target.value })} onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) { event.preventDefault(); void submitNote(); }
                  }} />
                  {noteDraft.element ? <div className="qraft-context"><ElementContext element={noteDraft.element} /><button type="button" disabled={pending} onClick={() => updateNote({ element: null, warning: null })}>Remove attachment</button></div> : null}
                  {noteDraft.warning ? <p className="qraft-help">{noteDraft.warning}</p> : null}
                  {Array.from(noteDraft.body.trim()).length > 2_000 ? <p className="qraft-field-error">Keep the text to 2,000 characters or fewer.</p> : null}
                  <div className="qraft-composer-actions"><button type="button" disabled={pending || selected.task.readOnly} onClick={() => { setOpen(false); setPicking(true); }}><Target size={15} /> Attach element</button><button className="primary" disabled={pending || selected.task.readOnly || !validDraft(noteDraft.body)}>{pending ? "Saving…" : "Submit"}</button></div>
                </form>
                {selected.task.notes.length ? <ol className="qraft-note-timeline">{selected.task.notes.map((note, index) => <NoteItem key={note.readOnly ? `${note.id}-${index}` : note.id} note={note} pending={pending} draft={editDrafts[note.id]} onDraft={(body) => editDraft(note.id, body)} save={async (body) => Boolean(await execute({ type: "editNote", noteId: note.id, body }, "Note updated."))} openSource={() => void openSource(note)} error={sourceError?.noteId === note.id ? sourceError.text : null} />)}</ol> : <p className="qraft-empty-copy">No notes yet. Add observations for your coding agent.</p>}
              {preservedEdits}</section>
            </article> : selectedTaskId ? <div className="qraft-orphan" role="alert"><strong>The selected task no longer exists.</strong><p>Your unsaved note remains here so you can copy it.</p><textarea aria-label="Preserved draft" readOnly value={noteDraft.body} />{preservedEdits}<button className="qraft-secondary" onClick={back}>Back to checklist</button></div> : <div className="qraft-view">
              <h2 className="qraft-document-title">{document?.title ?? "QA"}</h2>
              {!document ? <p role="status">Loading checklist…</p> : null}
              {document?.sections.length === 0 ? <div className="qraft-empty"><strong>No QA tasks yet</strong><p>Add a section below, or ask your coding editor to fill this Markdown file with ## sections and - [ ] tasks.</p></div> : null}
              {document?.sections.map((section, sectionIndex) => <section className="qraft-section" key={section.readOnly ? `${section.id}-${sectionIndex}` : section.id}><h3>{section.title}</h3>
                <div className="qraft-task-list">{section.tasks.map((task, index) => <TaskRow key={task.readOnly ? `${task.id}-${index}` : task.id} task={task} pending={pending} change={(value) => status(task, value)} select={() => { setSelectedTaskId(task.id); setSourceError(null); }} />)}</div>
                {form?.kind === "task" && form.sectionId === section.id ? titleForm : <button id={`${headingId}-add-task-${section.id}`} className="qraft-add" disabled={pending || section.readOnly} onClick={(event) => beginForm({ kind: "task", sectionId: section.id }, event.currentTarget)}><Plus size={15} /> Add task</button>}
              </section>)}
            </div>}
          </>}
        </div>
        {!showChooser && !selectedTaskId && document ? <footer className="qraft-footer">
          {form?.kind === "section" ? <>{feedbackMessage}{titleForm}</> : <button id={`${headingId}-add-section`} className="qraft-secondary" disabled={pending} onClick={(event) => beginForm({ kind: "section" }, event.currentTarget)}><Plus size={16} /> Add section</button>}
        </footer> : null}
      </Dialog.Content>
    </FocusScope></Dialog.Portal>
  </Dialog.Root>, mount);
}

function TaskRow({ task, pending, change, select }: { task: QATask; pending: boolean; change: (value: TaskStatus) => void; select: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  useEffect(() => clear, []);
  return <div className={`qraft-task-row ${task.status}`}>
    <button type="button" className={`qraft-status ${task.status}`} aria-label={`${task.title}: ${labels[task.status]}. Change status`} title="Click to cycle status; double-click to skip" disabled={pending || task.readOnly}
      onClick={(event) => { if (event.detail === 0) { clear(); change(nextStatus[task.status]); } else { clear(); timer.current = setTimeout(() => { timer.current = null; change(nextStatus[task.status]); }, 300); } }}
      onDoubleClick={() => { clear(); change("skipped"); }}>{task.status === "completed" ? <Check size={13} /> : task.status === "skipped" ? <Minus size={13} /> : <Circle size={13} />}</button>
    <button type="button" className="qraft-task" disabled={pending || task.readOnly} onClick={select}><span className="qraft-task-copy"><span>{task.title}</span>{task.notes.length ? <small>{task.notes.length} {task.notes.length === 1 ? "note" : "notes"}</small> : null}</span><ChevronRight size={16} /></button>
  </div>;
}

function ElementContext({ element }: { element: ElementReference }) {
  return <><strong>{element.component ?? element.context?.tag ?? "Selected element"}</strong>{element.source ? <code>{element.source}{element.line ? `:${element.line}` : ""}{element.column ? `:${element.column}` : ""}</code> : <small>Source unavailable; use the identifying context below.</small>}
    <details><summary>Element context</summary><dl>{element.route ? <><dt>Route</dt><dd>{element.route}</dd></> : null}{element.selector ? <><dt>Selector</dt><dd><code>{element.selector}</code></dd></> : null}{element.context ? <><dt>Tag</dt><dd>{element.context.tag}</dd><dt>Attributes</dt><dd><code>{JSON.stringify(element.context.attributes)}</code></dd>{element.context.text ? <><dt>Text</dt><dd>{element.context.text}</dd></> : null}<dt>Ancestors</dt><dd><code>{element.context.ancestors.join(" → ")}</code></dd></> : null}</dl></details></>;
}

function NoteItem({ note, pending, draft, onDraft, save, openSource, error }: { note: QANote; pending: boolean; draft: string | undefined; onDraft: (body: string | null) => void; save: (body: string) => Promise<boolean>; openSource: () => void; error: string | null }) {
  const fieldId = useId();
  const [editing, setEditing] = useState(draft !== undefined);
  const [body, setBody] = useState(draft ?? note.body);
  const input = useRef<HTMLTextAreaElement>(null);
  const edit = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (editing) input.current?.focus(); }, [editing]);
  const cancel = () => { onDraft(null); setEditing(false); requestAnimationFrame(() => edit.current?.focus()); };
  const submit = async () => { if (validDraft(body) && await save(body)) cancel(); };
  return <li>{editing ? <form className="qraft-note-edit" onSubmit={(event) => { event.preventDefault(); void submit(); }} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancel(); } }}><label htmlFor={fieldId}>Edit note</label><textarea id={fieldId} ref={input} value={body} maxLength={4_000} readOnly={pending} onChange={(event) => { setBody(event.target.value); onDraft(event.target.value); }} /><div className="qraft-composer-actions"><button type="button" onClick={cancel} disabled={pending}>Cancel</button><button className="primary" disabled={pending || !validDraft(body)}>Save note</button></div></form> : <><p>{note.body}</p><button className="qraft-note-edit-trigger" ref={edit} disabled={pending || note.readOnly} onClick={() => { setBody(note.body); onDraft(note.body); setEditing(true); }} aria-label={`Edit note: ${note.body}`}><Pencil size={13} /> Edit</button></>}
    {note.element ? <div className="qraft-context"><ElementContext element={note.element} />{note.element.source ? <button className="qraft-open-source" onClick={openSource}><ExternalLink size={13} /> Open source</button> : null}{error ? <span role="alert" className="qraft-source-error">{error}</span> : null}</div> : null}</li>;
}
