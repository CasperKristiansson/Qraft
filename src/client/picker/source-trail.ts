import type { ReactGrabElementContext } from "react-grab/primitives";
import type { SourceLocation } from "../../domain/model";

type GrabSourceContext = Pick<
  ReactGrabElementContext,
  "componentName" | "filePath" | "lineNumber" | "columnNumber" | "stack"
>;
const MAX_INSPECTED_FRAMES = 40;
const MAX_SOURCE_LOCATIONS = 5;

export function cleanSource(filePath: string | null): string | null {
  if (!filePath) return null;
  if (!filePath.startsWith("file://")) return filePath.split(/[?#]/u)[0] ?? null;

  try {
    return decodeURIComponent(new URL(filePath).pathname);
  } catch {
    return null;
  }
}

function positiveInteger(value: number | null | undefined): number | null {
  return value !== undefined && value !== null && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function isApplicationSource(source: string): boolean {
  return (
    source.length <= 2_000 &&
    !/(?:^|\/)node_modules(?:\/|$)/u.test(source) &&
    !/^[a-z]+:\/\//iu.test(source) &&
    !/[\x00-\x1f\x7f]/u.test(source)
  );
}

export function sourceTrail(context: GrabSourceContext): SourceLocation[] {
  const frames = [
    {
      functionName: context.componentName,
      fileName: context.filePath,
      lineNumber: context.lineNumber,
      columnNumber: context.columnNumber,
      isIgnoreListed: false,
    },
    ...context.stack.slice(0, MAX_INSPECTED_FRAMES),
  ];
  const seen = new Set<string>();
  const locations: SourceLocation[] = [];

  for (const frame of frames) {
    if (frame.isIgnoreListed) continue;
    const source = cleanSource(frame.fileName ?? null)?.replaceAll("\\", "/");
    if (!source || !isApplicationSource(source)) continue;

    const location: SourceLocation = {
      component: frame.functionName?.replace(/\s+/gu, " ").slice(0, 200) ?? null,
      source,
      line: positiveInteger(frame.lineNumber),
      column: positiveInteger(frame.columnNumber),
    };
    const key = `${source}:${location.line}:${location.column}`;
    if (seen.has(key)) continue;

    seen.add(key);
    locations.push(location);
    if (locations.length === MAX_SOURCE_LOCATIONS) break;
  }

  return locations;
}
