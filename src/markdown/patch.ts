import { isAbsolute, relative, resolve } from "node:path";
import type { QACommand } from "../domain/commands";
import type { ElementReference, QASection, QATask } from "../domain/model";
import { QraftError, normalizeEntityText } from "../domain/validation";
import { createEntityId, type IdFactory } from "./ids";
import type { EntityKind, ParsedMarkdown, SourceSpan } from "./parse";

interface TextEdit {
  start: number;
  end: number;
  text: string;
}

export interface PatchOptions {
  idFactory?: IdFactory;
  root?: string;
}

function applyEdits(source: string, edits: TextEdit[]): string {
  let result = source;
  const sorted = [...edits].sort((left, right) => right.start - left.start || right.end - left.end);
  for (const edit of sorted) result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
  return result;
}

function entityComment(id: string): string {
  return ` <!-- qraft:id=${id} -->`;
}

function stabilize(span: SourceSpan, kind: EntityKind, idFactory: IdFactory, edits: TextEdit[]): string {
  if (span.stable) return span.id;
  const id = idFactory(kind);
  edits.push({ start: span.firstLineEnd, end: span.firstLineEnd, text: entityComment(id) });
  return id;
}

function escapeEntityText(value: string): string {
  return normalizeEntityText(value).replaceAll("<", "\\<").replaceAll(">", "\\>");
}

function codeFence(value: string): string {
  const longest = Math.max(0, ...Array.from(value.matchAll(/`+/gu), (match) => match[0].length));
  const fence = "`".repeat(longest + 1);
  return `${fence}${value}${fence}`;
}

function normalizeElement(element: ElementReference | null, root?: string): ElementReference | null {
  if (!element) return null;
  const route = element.route.split(/[?#]/u)[0] ?? "";
  let source = element.source?.replaceAll("\\", "/") ?? null;
  if (source && root) {
    const absolute = isAbsolute(source) ? resolve(source) : resolve(root, source);
    const fromRoot = relative(root, absolute).replaceAll("\\", "/");
    source = fromRoot === "" || fromRoot === ".." || fromRoot.startsWith("../") || isAbsolute(fromRoot) ? null : fromRoot;
  }
  return {
    route,
    component: element.component ? normalizeEntityText(element.component) : null,
    source,
    line: source ? element.line : null,
    column: source ? element.column : null,
    selector: element.selector ? normalizeEntityText(element.selector) : null,
  };
}

function ownedInsertionOffset(parsed: ParsedMarkdown, span: SourceSpan): number {
  let offset = span.end;
  while (offset > span.firstLineEnd) {
    const before = parsed.source.slice(0, offset);
    const match = before.match(/(?:\r\n|\n)[\t ]*(?:\r\n|\n)$/u);
    if (!match) break;
    offset -= match[0].length - (match[0].startsWith("\r\n") ? 2 : 1);
  }
  return offset;
}

function lineInsertion(parsed: ParsedMarkdown, offset: number, line: string): string {
  const before = parsed.source.slice(0, offset);
  const after = parsed.source.slice(offset);
  const needsLeading = before.length > 0 && !before.endsWith("\n");
  const needsTrailing = after.length > 0 || parsed.hasFinalNewline;
  return `${needsLeading ? parsed.newline : ""}${line}${needsTrailing ? parsed.newline : ""}`;
}

function topLevelLineInsertion(parsed: ParsedMarkdown, offset: number, line: string): string {
  const before = parsed.source.slice(0, offset);
  const after = parsed.source.slice(offset);
  const leading = before.length > 0 && !before.endsWith("\n") ? parsed.newline : "";
  const trailing = after.startsWith("## ") ? `${parsed.newline}${parsed.newline}` : after.length > 0 || parsed.hasFinalNewline ? parsed.newline : "";
  return `${leading}${line}${trailing}`;
}

function appendSection(parsed: ParsedMarkdown, line: string): string {
  if (parsed.source.length === 0) return line;
  const endsWithNewline = parsed.source.endsWith("\n");
  const hasBlankLine = parsed.source.endsWith(`${parsed.newline}${parsed.newline}`);
  const prefix = endsWithNewline ? (hasBlankLine ? "" : parsed.newline) : `${parsed.newline}${parsed.newline}`;
  return `${prefix}${line}${endsWithNewline ? parsed.newline : ""}`;
}

function getSection(parsed: ParsedMarkdown, id: string): { entity: QASection; span: SourceSpan } {
  if (parsed.duplicateIds.has(id)) throw new QraftError("conflict", `Section ${id} has a duplicate ID.`);
  const entity = parsed.document.sections.find((candidate) => candidate.id === id);
  const span = parsed.spans.get(id);
  if (!entity || !span || span.kind !== "section") throw new QraftError("not-found", "The section no longer exists.");
  return { entity, span };
}

function getTask(parsed: ParsedMarkdown, id: string): { entity: QATask; span: SourceSpan } {
  if (parsed.duplicateIds.has(id)) throw new QraftError("conflict", `Task ${id} has a duplicate ID.`);
  const entity = parsed.document.sections.flatMap((section) => section.tasks).find((candidate) => candidate.id === id);
  const span = parsed.spans.get(id);
  if (!entity || !span || span.kind !== "task") throw new QraftError("not-found", "The task no longer exists.");
  return { entity, span };
}

function findingLine(body: string, id: string, element: ElementReference | null, newline: string): string {
  const lines = [`  - [ ] ${escapeEntityText(body)}${entityComment(id)}`];
  if (element?.component) lines.push(`    - Component: ${codeFence(element.component)}`);
  if (element?.source) {
    const suffix = element.line ? `:${element.line}${element.column ? `:${element.column}` : ""}` : "";
    lines.push(`    - Source: ${codeFence(`${element.source}${suffix}`)}`);
  }
  if (element?.route) lines.push(`    - Route: ${codeFence(element.route)}`);
  if (element?.selector) lines.push(`    - Selector: ${codeFence(element.selector)}`);
  return lines.join(newline);
}

export function patchMarkdown(parsed: ParsedMarkdown, command: QACommand, options: PatchOptions = {}): string {
  const idFactory = options.idFactory ?? createEntityId;
  const edits: TextEdit[] = [];

  if (command.type === "createSection") {
    const id = idFactory("section");
    const line = `## ${escapeEntityText(command.title)}${entityComment(id)}`;
    edits.push({ start: parsed.source.length, end: parsed.source.length, text: appendSection(parsed, line) });
  }

  if (command.type === "createTask") {
    const { entity, span } = getSection(parsed, command.sectionId);
    stabilize(span, "section", idFactory, edits);
    const id = idFactory("task");
    const line = `- [ ] ${escapeEntityText(command.title)}${entityComment(id)}`;
    const offset = entity.tasks.length === 0 ? span.end : ownedInsertionOffset(parsed, span);
    edits.push({ start: offset, end: offset, text: topLevelLineInsertion(parsed, offset, line) });
  }

  if (command.type === "setTaskChecked") {
    const { entity, span } = getTask(parsed, command.taskId);
    if (command.checked && entity.findings.some((finding) => !finding.checked)) {
      throw new QraftError("validation", "Resolve outstanding findings before passing this task.");
    }
    stabilize(span, "task", idFactory, edits);
    if (span.checkboxOffset === null) throw new QraftError("validation", "The task checkbox could not be located.");
    edits.push({ start: span.checkboxOffset, end: span.checkboxOffset + 1, text: command.checked ? "x" : " " });
  }

  if (command.type === "addNote") {
    const { span } = getTask(parsed, command.taskId);
    stabilize(span, "task", idFactory, edits);
    const id = idFactory("note");
    const offset = ownedInsertionOffset(parsed, span);
    const line = `  - Note: ${escapeEntityText(command.body)}${entityComment(id)}`;
    edits.push({ start: offset, end: offset, text: lineInsertion(parsed, offset, line) });
  }

  if (command.type === "addFinding") {
    const { span } = getTask(parsed, command.taskId);
    stabilize(span, "task", idFactory, edits);
    const id = idFactory("finding");
    const offset = ownedInsertionOffset(parsed, span);
    const element = normalizeElement(command.element, options.root);
    edits.push({
      start: offset,
      end: offset,
      text: lineInsertion(parsed, offset, findingLine(command.body, id, element, parsed.newline)),
    });
  }

  if (command.type === "setFindingChecked") {
    if (parsed.duplicateIds.has(command.findingId)) throw new QraftError("conflict", `Finding ${command.findingId} has a duplicate ID.`);
    const entity = parsed.document.sections
      .flatMap((section) => section.tasks)
      .flatMap((task) => task.findings)
      .find((candidate) => candidate.id === command.findingId);
    const span = parsed.spans.get(command.findingId);
    if (!entity || !span || span.kind !== "finding") throw new QraftError("not-found", "The finding no longer exists.");
    stabilize(span, "finding", idFactory, edits);
    if (span.checkboxOffset === null) throw new QraftError("validation", "The finding checkbox could not be located.");
    edits.push({ start: span.checkboxOffset, end: span.checkboxOffset + 1, text: command.checked ? "x" : " " });
  }

  return applyEdits(parsed.source, edits);
}
