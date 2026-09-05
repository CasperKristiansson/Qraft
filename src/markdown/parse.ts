import { createHash } from "node:crypto";
import type {
  ElementReference,
  QADiagnostic,
  QADocument,
  QAFinding,
  QANote,
  QASection,
  QATask,
} from "../domain/model";

export type EntityKind = "section" | "task" | "note" | "finding";

export interface SourceSpan {
  kind: EntityKind;
  id: string;
  line: number;
  start: number;
  end: number;
  firstLineStart: number;
  firstLineEnd: number;
  checkboxOffset: number | null;
  stable: boolean;
}

export interface ParsedMarkdown {
  document: QADocument;
  source: string;
  newline: "\n" | "\r\n";
  hasFinalNewline: boolean;
  spans: Map<string, SourceSpan>;
  duplicateIds: Set<string>;
}

interface SourceLine {
  content: string;
  newline: string;
  number: number;
  start: number;
  end: number;
}

interface IdResult {
  text: string;
  id: string | null;
  malformedId: string | null;
}

const uuid = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";
const validId = new RegExp(`^(section|task|note|finding)_${uuid}$`, "u");

export function sha256(source: string | Uint8Array): string {
  return createHash("sha256").update(source).digest("hex");
}

export const EMPTY_REVISION = sha256("");

function sourceLines(source: string): SourceLine[] {
  if (source.length === 0) return [];
  const lines: SourceLine[] = [];
  let start = 0;
  let number = 1;
  while (start < source.length) {
    const lf = source.indexOf("\n", start);
    const end = lf === -1 ? source.length : lf + 1;
    const raw = source.slice(start, end);
    const newline = raw.endsWith("\r\n") ? "\r\n" : raw.endsWith("\n") ? "\n" : "";
    lines.push({ content: raw.slice(0, raw.length - newline.length), newline, number, start, end });
    start = end;
    number += 1;
  }
  return lines;
}

function splitId(text: string, kind: EntityKind): IdResult {
  const match = text.match(/^(.*?)(?:\s*<!--\s*qraft:id=([^\s>]+)\s*-->)\s*$/u);
  if (!match) return { text: text.trim(), id: null, malformedId: null };
  const candidate = match[2] ?? "";
  return {
    text: (match[1] ?? "").trim(),
    id: validId.test(candidate) && candidate.startsWith(`${kind}_`) ? candidate : null,
    malformedId: validId.test(candidate) && candidate.startsWith(`${kind}_`) ? null : candidate,
  };
}

function legacyId(kind: EntityKind, line: number, text: string): string {
  const digest = createHash("sha256").update(`${kind}\0${line}\0${text}`).digest("hex").slice(0, 16);
  return `legacy:${kind}:${line}:${digest}`;
}

function inlineCode(value: string): string {
  const match = value.match(/^(`+)([\s\S]*)\1$/u);
  return match ? (match[2] ?? "") : value;
}

function parseSource(value: string): Pick<ElementReference, "source" | "line" | "column"> {
  const match = value.match(/^(.*?)(?::(\d+))?(?::(\d+))?$/u);
  const source = match?.[1]?.replaceAll("\\", "/") || null;
  return {
    source,
    line: match?.[2] ? Number(match[2]) : null,
    column: match?.[3] ? Number(match[3]) : null,
  };
}

export function parseMarkdown(source: string): ParsedMarkdown {
  const lines = sourceLines(source);
  const diagnostics: QADiagnostic[] = [];
  const sections: QASection[] = [];
  const spans = new Map<string, SourceSpan>();
  const idLines = new Map<string, number[]>();
  let title = "QA";
  let sawTitle = false;
  let section: QASection | null = null;
  let task: QATask | null = null;
  let finding: QAFinding | null = null;
  let sectionSpan: SourceSpan | null = null;
  let taskSpan: SourceSpan | null = null;
  let findingSpan: SourceSpan | null = null;
  let fence: string | null = null;

  const newlineKinds = new Set(lines.map((line) => line.newline).filter(Boolean));
  if (newlineKinds.size > 1) {
    diagnostics.push({ code: "mixed-newlines", message: "The file mixes LF and CRLF newlines.", lines: [] });
  }

  const register = (kind: EntityKind, result: IdResult, line: SourceLine, checkboxOffset: number | null): SourceSpan => {
    if (result.malformedId) {
      diagnostics.push({
        code: "malformed-markdown",
        message: `Malformed ${kind} ID on line ${line.number}.`,
        lines: [line.number],
      });
    }
    const id = result.id ?? legacyId(kind, line.number, result.text);
    if (result.id) idLines.set(id, [...(idLines.get(id) ?? []), line.number]);
    const span: SourceSpan = {
      kind,
      id,
      line: line.number,
      start: line.start,
      end: line.end,
      firstLineStart: line.start,
      firstLineEnd: line.end - line.newline.length,
      checkboxOffset,
      stable: result.id !== null,
    };
    spans.set(id, span);
    return span;
  };

  for (const line of lines) {
    const fenceMatch = line.content.match(/^ {0,3}(`{3,}|~{3,})/u);
    if (fenceMatch) {
      const marker = fenceMatch[1] ?? "";
      if (!fence) fence = marker[0] ?? null;
      else if (marker[0] === fence) fence = null;
      if (sectionSpan) sectionSpan.end = line.end;
      if (taskSpan) taskSpan.end = line.end;
      continue;
    }
    if (fence) {
      if (sectionSpan) sectionSpan.end = line.end;
      if (taskSpan) taskSpan.end = line.end;
      continue;
    }

    const h1 = line.content.match(/^# (.+)$/u);
    if (h1 && !sawTitle) {
      title = (h1[1] ?? "").trim() || "QA";
      sawTitle = true;
      continue;
    }

    const h2 = line.content.match(/^## (.+)$/u);
    if (h2) {
      if (sectionSpan) sectionSpan.end = line.start;
      if (taskSpan) taskSpan.end = line.start;
      if (findingSpan) findingSpan.end = line.start;
      const result = splitId(h2[1] ?? "", "section");
      const span = register("section", result, line, null);
      section = { id: span.id, title: result.text, tasks: [] };
      sections.push(section);
      sectionSpan = span;
      task = null;
      taskSpan = null;
      finding = null;
      findingSpan = null;
      continue;
    }

    const taskMatch = line.content.match(/^- \[([ xX])\] (.*)$/u);
    if (taskMatch) {
      if (!section) {
        diagnostics.push({
          code: "invalid-nesting",
          message: `Top-level task on line ${line.number} is outside a section.`,
          lines: [line.number],
        });
        task = null;
        taskSpan = null;
        finding = null;
        findingSpan = null;
        continue;
      }
      if (taskSpan) taskSpan.end = line.start;
      if (findingSpan) findingSpan.end = line.start;
      const result = splitId(taskMatch[2] ?? "", "task");
      const span = register("task", result, line, line.start + 3);
      task = {
        id: span.id,
        title: result.text,
        checked: (taskMatch[1] ?? " ").toLowerCase() === "x",
        notes: [],
        findings: [],
      };
      section.tasks.push(task);
      taskSpan = span;
      finding = null;
      findingSpan = null;
      if (sectionSpan) sectionSpan.end = line.end;
      continue;
    }

    const findingMatch = line.content.match(/^  - \[([ xX])\] (.*)$/u);
    if (findingMatch) {
      if (!task) {
        diagnostics.push({
          code: "invalid-nesting",
          message: `Finding on line ${line.number} is outside a task.`,
          lines: [line.number],
        });
        continue;
      }
      if (findingSpan) findingSpan.end = line.start;
      const result = splitId(findingMatch[2] ?? "", "finding");
      const span = register("finding", result, line, line.start + 5);
      finding = { id: span.id, body: result.text, checked: (findingMatch[1] ?? " ").toLowerCase() === "x", element: null };
      task.findings.push(finding);
      findingSpan = span;
      if (taskSpan) taskSpan.end = line.end;
      if (sectionSpan) sectionSpan.end = line.end;
      continue;
    }

    const noteMatch = line.content.match(/^  - Note:\s*(.*)$/u);
    if (noteMatch) {
      if (!task) {
        diagnostics.push({
          code: "invalid-nesting",
          message: `Note on line ${line.number} is outside a task.`,
          lines: [line.number],
        });
        continue;
      }
      if (findingSpan) findingSpan.end = line.start;
      finding = null;
      findingSpan = null;
      const result = splitId(noteMatch[1] ?? "", "note");
      const span = register("note", result, line, null);
      const note: QANote = { id: span.id, body: result.text };
      task.notes.push(note);
      if (taskSpan) taskSpan.end = line.end;
      if (sectionSpan) sectionSpan.end = line.end;
      continue;
    }

    const metadataMatch = line.content.match(/^    - (Component|Source|Route|Selector):\s*(.+)$/u);
    if (metadataMatch && finding) {
      const label = metadataMatch[1] ?? "";
      const value = inlineCode(metadataMatch[2] ?? "");
      const element = finding.element ?? {
        route: "",
        component: null,
        source: null,
        line: null,
        column: null,
        selector: null,
      };
      if (label === "Component") element.component = value;
      if (label === "Route") element.route = value.split(/[?#]/u)[0] ?? "";
      if (label === "Selector") element.selector = value;
      if (label === "Source") Object.assign(element, parseSource(value));
      finding.element = element;
      if (findingSpan) findingSpan.end = line.end;
      if (taskSpan) taskSpan.end = line.end;
      if (sectionSpan) sectionSpan.end = line.end;
      continue;
    }

    if (line.content.startsWith("  - ") && !task) {
      diagnostics.push({
        code: "invalid-nesting",
        message: `Indented content on line ${line.number} is outside a task.`,
        lines: [line.number],
      });
    }
    if (sectionSpan) sectionSpan.end = line.end;
    if (taskSpan) taskSpan.end = line.end;
    if (line.content.length > 0 && !line.content.startsWith("    - ")) {
      finding = null;
      findingSpan = null;
    }
  }

  if (sectionSpan) sectionSpan.end = source.length;
  if (taskSpan) taskSpan.end = source.length;
  if (findingSpan) findingSpan.end = source.length;

  const duplicateIds = new Set<string>();
  for (const [id, duplicateLines] of idLines) {
    if (duplicateLines.length < 2) continue;
    duplicateIds.add(id);
    diagnostics.push({
      code: "duplicate-id",
      message: `Duplicate Qraft ID ${id} appears on lines ${duplicateLines.join(", ")}.`,
      lines: duplicateLines,
      entityId: id,
    });
  }
  for (const currentSection of sections) {
    if (duplicateIds.has(currentSection.id)) currentSection.readOnly = true;
    for (const currentTask of currentSection.tasks) {
      if (duplicateIds.has(currentTask.id)) currentTask.readOnly = true;
      for (const note of currentTask.notes) if (duplicateIds.has(note.id)) note.readOnly = true;
      for (const currentFinding of currentTask.findings) if (duplicateIds.has(currentFinding.id)) currentFinding.readOnly = true;
    }
  }

  return {
    document: { title, revision: sha256(source), sections, diagnostics },
    source,
    newline: newlineKinds.has("\r\n") ? "\r\n" : "\n",
    hasFinalNewline: source.endsWith("\n"),
    spans,
    duplicateIds,
  };
}
