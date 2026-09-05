import {
  getElementAtPoint,
  getElementSelector,
  isElementGrabbable,
  type ReactGrabElementContext,
} from "react-grab/primitives";
import { cleanSource, sourceTrail } from "./source-trail";
import type { ElementReference } from "../../domain/model";
import type { PickerSelection } from "./ElementPicker";

export function isQraftElement(element: Element): boolean {
  let current: Element | null = element;
  while (current) {
    if (current.hasAttribute("data-react-grab-ignore") || current.hasAttribute("data-qraft-root"))
      return true;
    const parentElement: Element | null = current.parentElement;
    if (parentElement) {
      current = parentElement;
      continue;
    }
    const root = current.getRootNode();
    current = root instanceof ShadowRoot ? root.host : null;
  }
  return false;
}

export function targetAt(x: number, y: number): Element | null {
  return getElementAtPoint(x, y, {
    filter: (candidate) => isElementGrabbable(candidate) && !isQraftElement(candidate),
  });
}

export function eventIsInsideQraft(event: Event): boolean {
  return event.composedPath().some((node) => node instanceof Element && isQraftElement(node));
}

export function topPoint(event: MouseEvent): { x: number; y: number } {
  let view = event.view;
  let x = event.clientX;
  let y = event.clientY;
  while (view && view !== window && view.frameElement) {
    const frame = view.frameElement as HTMLElement;
    const bounds = frame.getBoundingClientRect();
    const scaleX = frame.offsetWidth ? bounds.width / frame.offsetWidth : 1;
    const scaleY = frame.offsetHeight ? bounds.height / frame.offsetHeight : 1;
    x = bounds.x + (frame.clientLeft + x) * scaleX;
    y = bounds.y + (frame.clientTop + y) * scaleY;
    view = frame.ownerDocument.defaultView;
  }
  return { x, y };
}

export function eventDocuments(observe: (root: Document | ShadowRoot) => void): Document[] {
  const documents: Document[] = [];
  const visit = (root: Document | ShadowRoot) => {
    observe(root);
    if (root.nodeType === Node.DOCUMENT_NODE) documents.push(root as Document);
    for (const element of root.querySelectorAll("*")) {
      if (isQraftElement(element)) continue;
      if (element.shadowRoot) visit(element.shadowRoot);
      if (element.tagName === "IFRAME") {
        try {
          const child = (element as HTMLIFrameElement).contentDocument;
          if (child) visit(child);
        } catch {
          /* Cross-origin frames are opaque. */
        }
      }
    }
  };
  visit(document);
  return documents;
}

export function parentOf(element: Element): Element | null {
  return (
    element.parentElement ??
    (element.getRootNode() as ShadowRoot).host ??
    element.ownerDocument.defaultView?.frameElement ??
    null
  );
}

export function hierarchy(element: Element): Element[] {
  const result = [element];
  let parent = parentOf(element);
  while (parent && result.length < 8) {
    if (isElementGrabbable(parent) && !isQraftElement(parent)) result.push(parent);
    parent = parentOf(parent);
  }
  return result;
}

export function shortName(element: Element): string {
  return (
    element.getAttribute("aria-label") ||
    (element.id ? `${element.tagName.toLowerCase()}#${element.id}` : element.tagName.toLowerCase())
  ).slice(0, 60);
}

export function labelFor(element: Element, context?: ReactGrabElementContext): string {
  return context?.componentName ?? context?.selector ?? element.tagName.toLowerCase();
}

export function sourceLabel(context: ReactGrabElementContext): string | null {
  const source = cleanSource(context.filePath);
  if (!source) return null;
  const pieces = source.replaceAll("\\", "/").split("/").filter(Boolean);
  const compact = pieces.slice(-3).join("/");
  return `${compact}${context.lineNumber ? `:${context.lineNumber}` : ""}`;
}

export function identity(element: Element): NonNullable<ElementReference["context"]> {
  const attributes: Record<string, string> = {};
  for (const name of [
    "id",
    "class",
    "role",
    "aria-label",
    "name",
    "type",
    "title",
    "data-testid",
    "data-test",
    "data-cy",
  ]) {
    const value = element.getAttribute(name);
    if (value) attributes[name] = value.replace(/\s+/gu, " ").slice(0, 300);
  }
  const ancestors: string[] = [];
  let current: Element | null = element;
  for (let index = 0; index < 5; index += 1) {
    const parent: Element | null =
      current?.parentElement ?? (current?.getRootNode() as ShadowRoot | undefined)?.host ?? null;
    if (!parent) break;
    ancestors.push(
      `${parent.tagName.toLowerCase()}${parent.id ? `#${parent.id}` : ""}${parent.getAttribute("class") ? `.${parent.getAttribute("class")?.trim().replace(/\s+/gu, ".")}` : ""}`.slice(
        0,
        300,
      ),
    );
    current = parent;
  }
  let text = "";
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let visited = 0;
  while (text.length < 300 && visited++ < 200) {
    const node = walker.nextNode();
    if (!node) break;
    const parent = node.parentElement;
    if (
      !parent ||
      parent.closest(
        "input, textarea, select, script, style, [contenteditable], [hidden], [aria-hidden='true']",
      )
    )
      continue;
    const view = parent.ownerDocument.defaultView;
    if (!parent.getClientRects().length || view?.getComputedStyle(parent).visibility === "hidden")
      continue;
    text += ` ${node.textContent ?? ""}`;
  }
  return {
    tag: element.tagName.toLowerCase().slice(0, 80),
    attributes,
    text: text.trim().replace(/\s+/gu, " ").slice(0, 300),
    ancestors,
  };
}

export function selectionFrom(
  element: Element,
  context?: ReactGrabElementContext,
): PickerSelection {
  const source = cleanSource(context?.filePath ?? null);
  let selector = context?.selector ?? null;
  try {
    selector ??= getElementSelector(element) ?? null;
  } catch {
    /* Structural identity remains available. */
  }
  return {
    element: {
      route: location.pathname,
      component: context?.componentName ?? null,
      source,
      line: source ? (context?.lineNumber ?? null) : null,
      column: source ? (context?.columnNumber ?? null) : null,
      selector: selector?.slice(0, 8_000) ?? null,
      context: { ...identity(element), ...(context ? { sourceTrail: sourceTrail(context) } : {}) },
    },
    label: labelFor(element, context),
    sourceLabel: context ? sourceLabel(context) : null,
    contextWarning: !source
      ? "React source context was unavailable. Element identifiers are attached; you can also remove the attachment."
      : null,
  };
}
