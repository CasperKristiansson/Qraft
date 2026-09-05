import {
  getElementAtPoint,
  getElementBounds,
  getElementContext,
  getElementSelector,
  isElementGrabbable,
  type ReactGrabElementContext,
} from "react-grab/primitives";
import { Target, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ElementReference } from "../../domain/model";

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius?: string;
}

interface Hovered {
  element: Element;
  bounds: Bounds;
  label: string;
}

export interface PickerSelection {
  element: ElementReference | null;
  label: string;
  sourceLabel: string | null;
  contextWarning: string | null;
}

export interface ElementPickerProps {
  onCancel: () => void;
  onSelect: (selection: PickerSelection) => void;
}

function isQraftElement(element: Element): boolean {
  let current: Element | null = element;
  while (current) {
    if (current.hasAttribute("data-react-grab-ignore") || current.hasAttribute("data-qraft-root")) return true;
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

function targetAt(x: number, y: number): Element | null {
  return getElementAtPoint(x, y, {
    filter: (candidate) => isElementGrabbable(candidate) && !isQraftElement(candidate),
  });
}

function eventIsInsideQraft(event: Event): boolean {
  return event.composedPath().some((node) => node instanceof Element && isQraftElement(node));
}

function topPoint(event: MouseEvent): { x: number; y: number } {
  const eventWindow = event.view;
  if (!eventWindow || eventWindow === window || !eventWindow.frameElement) {
    return { x: event.clientX, y: event.clientY };
  }
  const frame = eventWindow.frameElement as HTMLElement;
  const bounds = frame.getBoundingClientRect();
  const scaleX = frame.clientWidth ? bounds.width / frame.clientWidth : 1;
  const scaleY = frame.clientHeight ? bounds.height / frame.clientHeight : 1;
  return { x: bounds.x + event.clientX * scaleX, y: bounds.y + event.clientY * scaleY };
}

function eventDocuments(): Document[] {
  const documents = [document];
  for (const frame of document.querySelectorAll("iframe")) {
    try {
      if (frame.contentDocument) documents.push(frame.contentDocument);
    } catch {
      // Cross-origin frames stay selectable only through their outer iframe element.
    }
  }
  return documents;
}

function cleanSource(filePath: string | null): string | null {
  if (!filePath) return null;
  if (filePath.startsWith("file://")) {
    try {
      return decodeURIComponent(new URL(filePath).pathname);
    } catch {
      return null;
    }
  }
  return filePath;
}

function labelFor(element: Element, context?: ReactGrabElementContext): string {
  return context?.componentName ?? context?.selector ?? element.tagName.toLowerCase();
}

function sourceLabel(context: ReactGrabElementContext): string | null {
  const source = cleanSource(context.filePath);
  if (!source) return null;
  const pieces = source.replaceAll("\\", "/").split("/").filter(Boolean);
  const compact = pieces.slice(-3).join("/");
  return `${compact}${context.lineNumber ? `:${context.lineNumber}` : ""}`;
}

function selectionFrom(element: Element, context: ReactGrabElementContext): PickerSelection {
  const source = cleanSource(context.filePath);
  const selector = context.selector ?? getElementSelector(element) ?? null;
  const partial = !context.componentName && !source;
  return {
    element: {
      route: location.pathname,
      component: context.componentName,
      source,
      line: source ? context.lineNumber : null,
      column: source ? context.columnNumber : null,
      selector,
    },
    label: labelFor(element, context),
    sourceLabel: sourceLabel(context),
    contextWarning: partial ? "React source context was unavailable. You can keep the selector or save a plain finding." : null,
  };
}

export function ElementPicker({ onCancel, onSelect }: ElementPickerProps) {
  const [hovered, setHovered] = useState<Hovered | null>(null);
  const hoveredRef = useRef<Hovered | null>(null);
  const sequence = useRef(0);

  useEffect(() => {
    const update = (next: Hovered | null) => {
      hoveredRef.current = next;
      setHovered(next);
    };
    const inspect = async (element: Element, request: number) => {
      try {
        const context = await getElementContext(element);
        if (request !== sequence.current || hoveredRef.current?.element !== element) return;
        update({ element, bounds: getElementBounds(element), label: labelFor(element, context) });
      } catch {
        // Tag-name feedback remains usable when React context is unavailable.
      }
    };
    const move = (event: PointerEvent) => {
      if (eventIsInsideQraft(event)) {
        sequence.current += 1;
        update(null);
        return;
      }
      const point = topPoint(event);
      const element = targetAt(point.x, point.y);
      if (!element) {
        sequence.current += 1;
        update(null);
        return;
      }
      if (hoveredRef.current?.element === element) {
        update({ ...hoveredRef.current, bounds: getElementBounds(element) });
        return;
      }
      const request = ++sequence.current;
      update({ element, bounds: getElementBounds(element), label: element.tagName.toLowerCase() });
      void inspect(element, request);
    };
    const click = (event: MouseEvent) => {
      if (eventIsInsideQraft(event)) return;
      const point = topPoint(event);
      const element = targetAt(point.x, point.y);
      if (!element) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const request = ++sequence.current;
      void getElementContext(element)
        .then((context) => {
          if (request === sequence.current) onSelect(selectionFrom(element, context));
        })
        .catch(() => {
          if (request === sequence.current) {
            onSelect({
              element: null,
              label: element.tagName.toLowerCase(),
              sourceLabel: null,
              contextWarning: "Element context could not be read. You can still save a plain finding.",
            });
          }
        });
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    };
    const reposition = () => {
      const current = hoveredRef.current;
      if (current?.element.isConnected) update({ ...current, bounds: getElementBounds(current.element) });
      else update(null);
    };
    const documents = eventDocuments();
    for (const eventDocument of documents) {
      eventDocument.addEventListener("pointermove", move, true);
      eventDocument.addEventListener("click", click, true);
      eventDocument.addEventListener("keydown", keydown, true);
    }
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      sequence.current += 1;
      for (const eventDocument of documents) {
        eventDocument.removeEventListener("pointermove", move, true);
        eventDocument.removeEventListener("click", click, true);
        eventDocument.removeEventListener("keydown", keydown, true);
      }
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [onCancel, onSelect]);

  const bounds = hovered?.bounds;
  const labelLeft = bounds ? Math.max(4, Math.min(bounds.x, window.innerWidth - 184)) : 4;
  const labelTop = bounds ? (bounds.y >= 28 ? bounds.y - 25 : Math.min(window.innerHeight - 24, bounds.y + bounds.height + 4)) : 4;
  return (
    <div className="qraft-picker" data-react-grab-ignore="">
      {hovered && bounds ? (
        <>
          <div className="qraft-picker-outline" aria-hidden="true" style={{ left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height, borderRadius: bounds.borderRadius }} />
          <div className="qraft-picker-label" aria-hidden="true" style={{ left: labelLeft, top: labelTop }}>{hovered.label}</div>
        </>
      ) : null}
      <div className="qraft-picker-toolbar" role="status">
        <Target size={17} aria-hidden="true" />
        <span><strong>Select an element</strong><small>Click a host element · Esc to cancel</small></span>
        <button type="button" aria-label="Cancel element picker" onClick={onCancel}><X size={18} /></button>
      </div>
    </div>
  );
}
