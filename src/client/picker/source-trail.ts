import type { ReactGrabElementContext } from "react-grab/primitives";
import type { SourceLocation } from "../../domain/model";

export function cleanSource(filePath: string | null): string | null {
  if (!filePath) return null;
  if (filePath.startsWith("file://")) {
    try { return decodeURIComponent(new URL(filePath).pathname); } catch { return null; }
  }
  return filePath.split(/[?#]/u)[0] ?? null;
}

export function sourceTrail(context: Pick<ReactGrabElementContext, "componentName" | "filePath" | "lineNumber" | "columnNumber" | "stack">): SourceLocation[] {
  const frames = [{ functionName: context.componentName, fileName: context.filePath, lineNumber: context.lineNumber, columnNumber: context.columnNumber, isIgnoreListed: false }, ...context.stack.slice(0, 40)];
  const seen = new Set<string>();
  return frames.flatMap((frame) => {
    const source = cleanSource(frame.fileName ?? null)?.replaceAll("\\", "/");
    if (!source || source.length > 2_000 || frame.isIgnoreListed || /(?:^|\/)node_modules(?:\/|$)/u.test(source) || /^[a-z]+:\/\//iu.test(source) || /[\x00-\x1f\x7f]/u.test(source)) return [];
    const positive = (value: number | null | undefined) => value && Number.isInteger(value) && value > 0 ? value : null;
    const result = { component: frame.functionName?.replace(/\s+/gu, " ").slice(0, 200) ?? null, source, line: positive(frame.lineNumber), column: positive(frame.columnNumber) };
    const key = `${source}:${result.line}:${result.column}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [result];
  }).slice(0, 5);
}
