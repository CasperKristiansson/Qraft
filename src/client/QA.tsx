import * as Dialog from "@radix-ui/react-dialog";
import { FocusScope } from "@radix-ui/react-focus-scope";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Circle,
  ExternalLink,
  Flag,
  Menu,
  Plus,
  RotateCcw,
  StickyNote,
  Target,
  X,
} from "lucide-react";
import { openFile } from "react-grab/primitives";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { QACommand } from "../domain/commands";
import type { QADocument, QAFinding, QASection, QATask } from "../domain/model";
import { getNextOpenTaskId, getProgress } from "../domain/model";
import { HttpQAStorage, QAStorageError } from "./http-storage";
import type { QAStorage } from "./storage";
import { ElementPicker, type PickerSelection } from "./picker/ElementPicker";
import styles from "./styles.css?raw";

type FormState =
  | { kind: "section" }
  | { kind: "task"; sectionId: string }
  | { kind: "note"; taskId: string }
  | { kind: "finding"; taskId: string; context?: PickerSelection };

type Feedback = { tone: "neutral" | "success" | "warning" | "error"; text: string };

function useShadowMount() {
  const [mount, setMount] = useState<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const host = document.createElement("div");
    host.dataset.qraftRoot = "";
    host.dataset.reactGrabIgnore = "";
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = styles;
    const container = document.createElement("div");
    container.dataset.qraftPortal = "";
    shadow.append(style, container);
    document.body.append(host);
    setMount(container);
    return () => host.remove();
  }, []);
  return mount;
}

function findTask(document: QADocument | null, id: string | null): { section: QASection; task: QATask } | null {
  if (!document || !id) return null;
  for (const section of document.sections) {
    const task = section.tasks.find((candidate) => candidate.id === id);
    if (task) return { section, task };
  }
  return null;
}

function validDraft(value: string): boolean {
  const length = Array.from(value.trim()).length;
  return length > 0 && length <= 2_000;
}

export interface QAProps {
  storage?: QAStorage;
}

export function QA({ storage: providedStorage }: QAProps = {}) {
  const mount = useShadowMount();
  const [open, setOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [document, setDocument] = useState<QADocument | null>(null);
  const [connected, setConnected] = useState(true);
  const [feedback, setFeedback] = useState<Feedback>({ tone: "neutral", text: "Loading QA.md…" });
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [picking, setPicking] = useState(false);
  const [sourceError, setSourceError] = useState<{ findingId: string; text: string } | null>(null);
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const formControl = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const refreshSequence = useRef(0);
  const formTrigger = useRef<string | null>(null);
  const defaultStorage = useMemo(() => new HttpQAStorage("/__qraft", setConnected), []);
  const storage = providedStorage ?? defaultStorage;
  const progress = useMemo(() => (document ? getProgress(document) : { passed: 0, total: 0 }), [document]);
  const selected = useMemo(() => findTask(document, selectedTaskId), [document, selectedTaskId]);
  const completed = progress.total > 0 && progress.passed === progress.total;

  useEffect(() => {
    const media = matchMedia("(max-width: 800px)");
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      const sequence = ++refreshSequence.current;
      try {
        const next = await storage.getDocument(controller.signal);
        if (controller.signal.aborted || sequence !== refreshSequence.current) return;
        setDocument(next);
        setFeedback((current) => current.tone === "neutral" ? { tone: "neutral", text: "QA.md is synchronized." } : current);
      } catch (error) {
        if (!controller.signal.aborted && sequence === refreshSequence.current) {
          setFeedback({ tone: "error", text: error instanceof Error ? error.message : "Qraft could not load QA.md." });
        }
      }
    };
    void refresh();
    const unsubscribe = storage.subscribe(() => void refresh());
    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [storage]);

  useEffect(() => {
    if (form) formControl.current?.focus();
  }, [form]);

  const beginForm = (next: FormState, trigger: HTMLButtonElement) => {
    setForm(next);
    setDraft("");
    formTrigger.current = trigger.dataset.formTrigger ?? null;
  };

  const cancelForm = () => {
    setForm(null);
    setDraft("");
    requestAnimationFrame(() => {
      const key = formTrigger.current;
      if (key) mount?.querySelector<HTMLButtonElement>(`[data-form-trigger="${key}"]`)?.focus();
    });
  };

  const execute = async (command: QACommand, success: string): Promise<QADocument | null> => {
    if (!document || pending) return null;
    refreshSequence.current += 1;
    setPending(true);
    try {
      const next = await storage.execute(command, document.revision);
      refreshSequence.current += 1;
      if (selectedTaskId?.startsWith("legacy:") && document) {
        const index = document.sections.flatMap((section) => section.tasks).findIndex((task) => task.id === selectedTaskId);
        setSelectedTaskId(next.sections.flatMap((section) => section.tasks)[index]?.id ?? selectedTaskId);
      }
      setDocument(next);
      setFeedback({ tone: "success", text: success });
      return next;
    } catch (error) {
      if (error instanceof QAStorageError && error.document) setDocument(error.document);
      setFeedback({
        tone: error instanceof QAStorageError && error.code === "revision_conflict" ? "warning" : "error",
        text: error instanceof Error ? error.message : "The change was not saved. Review and retry.",
      });
      return null;
    } finally {
      setPending(false);
    }
  };

  const submitForm = async () => {
    if (!form || !validDraft(draft)) return;
    let command: QACommand;
    if (form.kind === "section") command = { type: "createSection", title: draft };
    else if (form.kind === "task") command = { type: "createTask", sectionId: form.sectionId, title: draft };
    else if (form.kind === "note") command = { type: "addNote", taskId: form.taskId, body: draft };
    else command = { type: "addFinding", taskId: form.taskId, body: draft, element: form.context?.element ?? null };
    const next = await execute(command, `${form.kind[0]?.toUpperCase()}${form.kind.slice(1)} saved to QA.md.`);
    if (next) {
      setForm(null);
      setDraft("");
    }
  };

  const setTaskChecked = async (task: QATask, checked: boolean) => {
    const next = await execute(
      { type: "setTaskChecked", taskId: task.id, checked },
      checked ? "Task passed." : "Task reopened.",
    );
    if (next && checked) {
      const index = document?.sections.flatMap((section) => section.tasks).findIndex((current) => current.id === task.id) ?? -1;
      const savedId = next.sections.flatMap((section) => section.tasks)[index]?.id ?? task.id;
      const nextId = getNextOpenTaskId(next, savedId);
      setSelectedTaskId(nextId ?? savedId);
    }
  };

  const setFindingChecked = async (findingId: string, checked: boolean) => {
    await execute(
      { type: "setFindingChecked", findingId, checked },
      checked ? "Finding resolved." : "Finding reopened.",
    );
  };

  const cancelPicker = () => {
    setPicking(false);
    setOpen(true);
    requestAnimationFrame(() => mount?.querySelector<HTMLButtonElement>("[data-form-trigger^=attach-]")?.focus());
  };

  const selectPicker = (selection: PickerSelection) => {
    if (!selectedTaskId) return;
    setPicking(false);
    setForm({ kind: "finding", taskId: selectedTaskId, context: selection });
    setDraft("");
    setOpen(true);
  };

  const openFindingSource = async (finding: QAFinding) => {
    const source = finding.element?.source;
    if (!source) return;
    setSourceError(null);
    try {
      await openFile(source, finding.element?.line ?? undefined);
      setFeedback({ tone: "success", text: `Requested ${source} in the editor.` });
    } catch {
      setSourceError({ findingId: finding.id, text: `Could not open ${source}. Copy the path and open it in your editor.` });
    }
  };

  if (!mount) return null;

  const formTitle = form?.kind === "section" ? "Add section" : form?.kind === "task" ? "Add task" : form?.kind === "note" ? "Add note" : "Add finding";
  const bodyForm = form?.kind === "note" || form?.kind === "finding";

  return createPortal(
    picking ? <ElementPicker onCancel={cancelPicker} onSelect={selectPicker} /> : <Dialog.Root open={open} onOpenChange={setOpen} modal={false}>
      <Dialog.Trigger asChild>
        <button className="qraft-tab" aria-label={`Open Qraft, ${progress.passed} of ${progress.total} tasks passed`}>
          <span>QA</span><strong>{progress.passed}/{progress.total}</strong>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal container={mount}>
        <FocusScope asChild trapped={narrow} loop={narrow}>
          <Dialog.Content
            className="qraft-drawer"
            aria-labelledby={headingId}
            aria-modal={narrow || undefined}
            onInteractOutside={(event) => { if (narrow) event.preventDefault(); }}
            onKeyDown={(event) => {
              if (!narrow || event.key !== "Tab") return;
              const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input, textarea, summary, [tabindex='0']"));
              const active = mount.getRootNode() instanceof ShadowRoot ? (mount.getRootNode() as ShadowRoot).activeElement : null;
              const first = controls[0];
              const last = controls.at(-1);
              if (event.shiftKey && (active === first || active === heading.current)) { event.preventDefault(); last?.focus(); }
              else if (!event.shiftKey && active === last) { event.preventDefault(); first?.focus(); }
            }}
            onOpenAutoFocus={(event) => { event.preventDefault(); heading.current?.focus(); }}
            onEscapeKeyDown={(event) => { if (form) { event.preventDefault(); cancelForm(); } }}
          >
            <header className="qraft-header">
              <Menu aria-hidden="true" size={19} />
              <Dialog.Title ref={heading} id={headingId} tabIndex={-1}>Qraft</Dialog.Title>
              <Dialog.Close className="qraft-icon-button" aria-label="Close Qraft"><X size={19} /></Dialog.Close>
            </header>
            <div className="qraft-content">
              <div className="qraft-progress-row">
                <strong>{progress.passed} / {progress.total}</strong>
                <div className="qraft-progress" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.passed} aria-label={`${progress.passed} of ${progress.total} tasks passed`}>
                  <span style={{ width: `${progress.total ? (progress.passed / progress.total) * 100 : 0}%` }} />
                </div>
              </div>

              {!connected ? <p className="qraft-banner warning" role="status">Disconnected. Qraft is reconnecting automatically.</p> : null}
              {feedback.tone !== "neutral" ? <p className={`qraft-banner ${feedback.tone}`} aria-live="polite" role={feedback.tone === "error" ? "alert" : "status"}>{feedback.text}</p> : null}
              {feedback.tone === "neutral" ? <p className="qraft-sr-only" aria-live="polite">{feedback.text}</p> : null}

              {selected ? (
                <TaskDetail
                  section={selected.section}
                  task={selected.task}
                  completed={completed}
                  pending={pending}
                  activeForm={form}
                  draft={draft}
                  formTitle={formTitle}
                  bodyForm={bodyForm}
                  formControl={formControl}
                  onDraft={setDraft}
                  onBack={() => { setSelectedTaskId(null); setForm(null); setDraft(""); }}
                  onBeginForm={beginForm}
                  onCancelForm={cancelForm}
                  onSubmitForm={() => void submitForm()}
                  onTaskChecked={(checked) => void setTaskChecked(selected.task, checked)}
                  onFindingChecked={(findingId, checked) => void setFindingChecked(findingId, checked)}
                  onAttachElement={(trigger) => {
                    formTrigger.current = trigger.dataset.formTrigger ?? null;
                    setForm(null);
                    setDraft("");
                    setOpen(false);
                    setPicking(true);
                  }}
                  sourceError={sourceError}
                  onOpenSource={(finding) => void openFindingSource(finding)}
                  onUsePlainFinding={() => setForm((current) => current?.kind === "finding" ? {
                    ...current,
                    context: { element: null, label: "Plain finding", sourceLabel: null, contextWarning: "No element context will be saved." },
                  } : current)}
                />
              ) : (
                <Checklist
                  document={document}
                  activeForm={form}
                  pending={pending}
                  draft={draft}
                  formTitle={formTitle}
                  bodyForm={bodyForm}
                  formControl={formControl}
                  selectedTaskId={selectedTaskId}
                  onDraft={setDraft}
                  onSelectTask={(id) => { setSelectedTaskId(id); setForm(null); setDraft(""); }}
                  onBeginForm={beginForm}
                  onCancelForm={cancelForm}
                  onSubmitForm={() => void submitForm()}
                />
              )}

              {selectedTaskId && !selected ? (
                <div className="qraft-orphan" role="alert">
                  <strong>The selected task no longer exists.</strong>
                  <p>{draft ? "Your unsaved text remains below so you can copy it." : "Return to the checklist and choose another task."}</p>
                  {draft ? <textarea readOnly value={draft} aria-label="Preserved draft" /> : null}
                  <button className="qraft-secondary" type="button" onClick={() => setSelectedTaskId(null)}>Back to checklist</button>
                </div>
              ) : null}
              <p className="qraft-preview-note">Local Markdown sync · {document?.revision.slice(0, 8) ?? "loading"}</p>
            </div>
          </Dialog.Content>
        </FocusScope>
      </Dialog.Portal>
    </Dialog.Root>,
    mount,
  );
}

interface FormProps {
  title: string;
  body: boolean;
  value: string;
  pending: boolean;
  controlRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  onValue: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  context?: PickerSelection;
  onUsePlain?: () => void;
}

function InlineForm({ title, body, value, pending, controlRef, onValue, onCancel, onSubmit, context, onUsePlain }: FormProps) {
  const fieldId = useId();
  const length = Array.from(value.trim()).length;
  return (
    <form className="qraft-form" onSubmit={(event) => { event.preventDefault(); onSubmit(); }} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onCancel(); } }}>
      <div className="qraft-form-heading"><strong>{title}</strong><span>{length}/2000</span></div>
      {context ? (
        <div className="qraft-context">
          <strong>{context.label}</strong>
          {context.sourceLabel ? <code>{context.sourceLabel}</code> : null}
          {context.contextWarning ? <span>{context.contextWarning}</span> : null}
          {context.element && onUsePlain ? <button type="button" onClick={onUsePlain}>Use plain finding</button> : null}
        </div>
      ) : null}
      <label htmlFor={fieldId}>{body ? "Details" : "Title"}</label>
      {body ? (
        <textarea ref={controlRef as React.RefObject<HTMLTextAreaElement>} id={fieldId} value={value} maxLength={4_000} onChange={(event) => onValue(event.target.value)} />
      ) : (
        <input ref={controlRef as React.RefObject<HTMLInputElement>} id={fieldId} value={value} maxLength={4_000} onChange={(event) => onValue(event.target.value)} />
      )}
      {length > 2_000 ? <span className="qraft-field-error">Keep the text to 2,000 characters or fewer.</span> : null}
      <div className="qraft-form-actions"><button type="button" onClick={onCancel}>Cancel</button><button className="primary" type="submit" disabled={!validDraft(value) || pending}>{pending ? "Saving…" : "Save"}</button></div>
    </form>
  );
}

interface ChecklistProps {
  document: QADocument | null;
  activeForm: FormState | null;
  pending: boolean;
  draft: string;
  formTitle: string;
  bodyForm: boolean;
  formControl: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  selectedTaskId: string | null;
  onDraft: (value: string) => void;
  onSelectTask: (id: string) => void;
  onBeginForm: (form: FormState, trigger: HTMLButtonElement) => void;
  onCancelForm: () => void;
  onSubmitForm: () => void;
}

function Checklist(props: ChecklistProps) {
  const { document, activeForm, pending, draft, formTitle, bodyForm, formControl, selectedTaskId, onDraft, onSelectTask, onBeginForm, onCancelForm, onSubmitForm } = props;
  return (
    <div className="qraft-view">
      <h2 className="qraft-document-title">{document?.title ?? "QA"}</h2>
      {document?.diagnostics.map((diagnostic) => <p className="qraft-banner warning" key={`${diagnostic.code}-${diagnostic.lines.join("-")}`}>{diagnostic.message} Lines {diagnostic.lines.join(", ")}.</p>)}
      {!document ? <div className="qraft-loading" role="status">Loading checklist…</div> : null}
      {document && document.sections.length === 0 ? <div className="qraft-empty"><strong>No QA tasks yet</strong><p>Add the first section when you are ready to start testing.</p></div> : null}
      {document?.sections.map((section, sectionIndex) => (
        <section className="qraft-section" key={section.readOnly ? `${section.id}-${sectionIndex}` : section.id}>
          <h3>{section.title}</h3>
          <div className="qraft-task-list">
            {section.tasks.map((task, taskIndex) => {
              const unresolved = task.findings.filter((finding) => !finding.checked).length;
              return (
                <button className="qraft-task" key={task.readOnly ? `${task.id}-${taskIndex}` : task.id} type="button" disabled={task.readOnly} aria-current={selectedTaskId === task.id ? "true" : undefined} onClick={() => onSelectTask(task.id)}>
                  <span className={task.checked ? "qraft-status passed" : "qraft-status"}>{task.checked ? <Check size={13} /> : <Circle size={13} />}</span>
                  <span className="qraft-task-copy"><span>{task.title}</span>{unresolved ? <small>{unresolved} open finding{unresolved === 1 ? "" : "s"}</small> : null}</span>
                  {unresolved ? <span className="qraft-count" aria-label={`${unresolved} unresolved findings`}>{unresolved}</span> : <ChevronRight aria-hidden="true" size={16} />}
                </button>
              );
            })}
          </div>
          {activeForm?.kind === "task" && activeForm.sectionId === section.id ? (
            <InlineForm title={formTitle} body={bodyForm} value={draft} pending={pending} controlRef={formControl} onValue={onDraft} onCancel={onCancelForm} onSubmit={onSubmitForm} />
          ) : (
            <button className="qraft-add" type="button" data-form-trigger={`task-${section.id}`} disabled={section.readOnly} onClick={(event) => onBeginForm({ kind: "task", sectionId: section.id }, event.currentTarget)}><Plus size={15} /> Add task</button>
          )}
        </section>
      ))}
      {activeForm?.kind === "section" ? (
        <InlineForm title={formTitle} body={bodyForm} value={draft} pending={pending} controlRef={formControl} onValue={onDraft} onCancel={onCancelForm} onSubmit={onSubmitForm} />
      ) : (
        <button className="qraft-secondary" type="button" data-form-trigger="section" onClick={(event) => onBeginForm({ kind: "section" }, event.currentTarget)}><Plus size={16} /> Add section</button>
      )}
    </div>
  );
}

interface TaskDetailProps {
  section: QASection;
  task: QATask;
  completed: boolean;
  pending: boolean;
  activeForm: FormState | null;
  draft: string;
  formTitle: string;
  bodyForm: boolean;
  formControl: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  onDraft: (value: string) => void;
  onBack: () => void;
  onBeginForm: (form: FormState, trigger: HTMLButtonElement) => void;
  onCancelForm: () => void;
  onSubmitForm: () => void;
  onTaskChecked: (checked: boolean) => void;
  onFindingChecked: (id: string, checked: boolean) => void;
  onAttachElement: (trigger: HTMLButtonElement) => void;
  sourceError: { findingId: string; text: string } | null;
  onOpenSource: (finding: QAFinding) => void;
  onUsePlainFinding: () => void;
}

function TaskDetail(props: TaskDetailProps) {
  const { section, task, completed, pending, activeForm, draft, formTitle, bodyForm, formControl, onDraft, onBack, onBeginForm, onCancelForm, onSubmitForm, onTaskChecked, onFindingChecked, onAttachElement, sourceError, onOpenSource, onUsePlainFinding } = props;
  const unresolved = task.findings.filter((finding) => !finding.checked).length;
  const passBlocked = !task.checked && unresolved > 0;
  return (
    <article className="qraft-detail">
      <button className="qraft-back" type="button" onClick={onBack}><ArrowLeft size={16} /> {section.title}</button>
      {completed ? <div className="qraft-complete"><span><Check size={22} /></span><strong>Checklist complete</strong><p>Every QA task is passed.</p></div> : null}
      <h2>{task.title}</h2>
      <p className={`qraft-task-state ${task.checked ? "passed" : ""}`}>{task.checked ? <Check size={15} /> : <Circle size={15} />}{task.checked ? "Passed" : "Not completed"}</p>

      <section className="qraft-detail-section">
        <h3><StickyNote size={14} /> Notes</h3>
        {task.notes.length ? <ul className="qraft-notes">{task.notes.map((note, index) => <li key={note.readOnly ? `${note.id}-${index}` : note.id}>{note.body}</li>)}</ul> : <p className="qraft-empty-copy">No notes yet.</p>}
        {activeForm?.kind === "note" && activeForm.taskId === task.id ? (
          <InlineForm title={formTitle} body={bodyForm} value={draft} pending={pending} controlRef={formControl} onValue={onDraft} onCancel={onCancelForm} onSubmit={onSubmitForm} />
        ) : <button className="qraft-add" type="button" data-form-trigger={`note-${task.id}`} disabled={pending || task.readOnly} onClick={(event) => onBeginForm({ kind: "note", taskId: task.id }, event.currentTarget)}><Plus size={15} /> Note</button>}
      </section>

      <section className="qraft-detail-section">
        <h3><Flag size={14} /> Findings</h3>
        {task.findings.length ? <ul className="qraft-findings">{task.findings.map((finding, index) => (
          <li key={finding.readOnly ? `${finding.id}-${index}` : finding.id}>
            <button type="button" role="checkbox" aria-checked={finding.checked} aria-label={`${finding.checked ? "Reopen" : "Resolve"} finding: ${finding.body}`} disabled={pending || finding.readOnly} onClick={() => onFindingChecked(finding.id, !finding.checked)}>{finding.checked ? <Check size={13} /> : null}</button>
            <div>
              <span>{finding.body}</span>
              {finding.element ? (
                <div className="qraft-finding-context">
                  {finding.element.component ? <strong>{finding.element.component}</strong> : null}
                  {finding.element.source ? <code>{finding.element.source}{finding.element.line ? `:${finding.element.line}` : ""}</code> : null}
                  {finding.element.route ? <small>Route {finding.element.route}</small> : null}
                  {finding.element.selector ? <details><summary>Selector</summary><code>{finding.element.selector}</code></details> : null}
                  {finding.element.source ? <button type="button" className="qraft-open-source" onClick={() => onOpenSource(finding)}><ExternalLink size={13} /> Open source</button> : null}
                  {sourceError?.findingId === finding.id ? <span className="qraft-source-error" role="alert">{sourceError.text}</span> : null}
                </div>
              ) : null}
            </div>
          </li>
        ))}</ul> : <p className="qraft-empty-copy">No findings yet.</p>}
        {activeForm?.kind === "finding" && activeForm.taskId === task.id ? (
          <InlineForm title={formTitle} body={bodyForm} value={draft} pending={pending} controlRef={formControl} onValue={onDraft} onCancel={onCancelForm} onSubmit={onSubmitForm} onUsePlain={onUsePlainFinding} {...(activeForm.context ? { context: activeForm.context } : {})} />
        ) : (
          <div className="qraft-inline-actions">
            <button className="qraft-add" type="button" data-form-trigger={`finding-${task.id}`} disabled={pending || task.readOnly} onClick={(event) => onBeginForm({ kind: "finding", taskId: task.id }, event.currentTarget)}><Plus size={15} /> Finding</button>
            <button className="qraft-add" type="button" data-form-trigger={`attach-${task.id}`} disabled={pending || task.readOnly} onClick={(event) => onAttachElement(event.currentTarget)}><Target size={15} /> Attach element</button>
          </div>
        )}
      </section>

      <div className="qraft-detail-footer">
        {task.checked ? (
          <button className="qraft-secondary" type="button" disabled={pending || task.readOnly} onClick={() => onTaskChecked(false)}><RotateCcw size={16} /> Reopen</button>
        ) : (
          <button className="qraft-primary" type="button" disabled={pending || passBlocked || task.readOnly} title={passBlocked ? "Resolve outstanding findings before passing this task." : undefined} onClick={() => onTaskChecked(true)}><Check size={16} /> Pass</button>
        )}
        {passBlocked ? <p className="qraft-help">Resolve outstanding findings before passing this task.</p> : null}
      </div>
    </article>
  );
}
