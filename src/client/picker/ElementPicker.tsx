import {
  getElementAtPoint,
  getElementBounds,
  getElementContext,
  getElementSelector,
  isElementGrabbable,
  type ReactGrabElementContext,
} from "react-grab/primitives";
import { ArrowUp, ArrowDown, Target, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cleanSource, sourceTrail } from "./source-trail";
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
  let view = event.view;
  let x = event.clientX; let y = event.clientY;
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

function eventDocuments(observe: (root: Document | ShadowRoot) => void): Document[] {
  const documents: Document[] = [];
  const visit = (root: Document | ShadowRoot) => {
    observe(root);
    if (root.nodeType === Node.DOCUMENT_NODE) documents.push(root as Document);
    for (const element of root.querySelectorAll("*")) {
      if (isQraftElement(element)) continue;
      if (element.shadowRoot) visit(element.shadowRoot);
      if (element.tagName === "IFRAME") {
        try { const child = (element as HTMLIFrameElement).contentDocument; if (child) visit(child); } catch { /* Cross-origin frames are opaque. */ }
      }
    }
  };
  visit(document);
  return documents;
}

function parentOf(element: Element): Element | null {
  return element.parentElement ?? (element.getRootNode() as ShadowRoot).host ?? element.ownerDocument.defaultView?.frameElement ?? null;
}

function hierarchy(element: Element): Element[] {
  const result = [element]; let parent = parentOf(element);
  while (parent && result.length < 8) {
    if (isElementGrabbable(parent) && !isQraftElement(parent)) result.push(parent);
    parent = parentOf(parent);
  }
  return result;
}

function shortName(element: Element): string {
  return (element.getAttribute("aria-label") || (element.id ? `${element.tagName.toLowerCase()}#${element.id}` : element.tagName.toLowerCase())).slice(0, 60);
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

function identity(element: Element): NonNullable<ElementReference["context"]> {
  const attributes: Record<string, string> = {};
  for (const name of ["id", "class", "role", "aria-label", "name", "type", "title", "data-testid", "data-test", "data-cy"]) {
    const value = element.getAttribute(name);
    if (value) attributes[name] = value.replace(/\s+/gu, " ").slice(0, 300);
  }
  const ancestors: string[] = [];
  let current: Element | null = element;
  for (let index = 0; index < 5; index += 1) {
    const parent: Element | null = current?.parentElement ?? ((current?.getRootNode() as ShadowRoot | undefined)?.host ?? null);
    if (!parent) break;
    ancestors.push(`${parent.tagName.toLowerCase()}${parent.id ? `#${parent.id}` : ""}${parent.getAttribute("class") ? `.${parent.getAttribute("class")?.trim().replace(/\s+/gu, ".")}` : ""}`.slice(0, 300));
    current = parent;
  }
  let text = "";
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let visited = 0;
  while (text.length < 300 && visited++ < 200) {
    const node = walker.nextNode();
    if (!node) break;
    const parent = node.parentElement;
    if (!parent || parent.closest("input, textarea, select, script, style, [contenteditable], [hidden], [aria-hidden='true']")) continue;
    const view = parent.ownerDocument.defaultView;
    if (!parent.getClientRects().length || view?.getComputedStyle(parent).visibility === "hidden") continue;
    text += ` ${node.textContent ?? ""}`;
  }
  return { tag: element.tagName.toLowerCase().slice(0, 80), attributes, text: text.trim().replace(/\s+/gu, " ").slice(0, 300), ancestors };
}

function selectionFrom(element: Element, context?: ReactGrabElementContext): PickerSelection {
  const source = cleanSource(context?.filePath ?? null);
  let selector = context?.selector ?? null;
  try { selector ??= getElementSelector(element) ?? null; } catch { /* Structural identity remains available. */ }
  return {
    element: {
      route: location.pathname,
      component: context?.componentName ?? null,
      source,
      line: source ? context?.lineNumber ?? null : null,
      column: source ? context?.columnNumber ?? null : null,
      selector: selector?.slice(0, 8_000) ?? null,
      context: { ...identity(element), ...(context ? { sourceTrail: sourceTrail(context) } : {}) },
    },
    label: labelFor(element, context),
    sourceLabel: context ? sourceLabel(context) : null,
    contextWarning: !source ? "React source context was unavailable. Element identifiers are attached; you can also remove the attachment." : null,
  };
}

export function ElementPicker({ onCancel, onSelect }: ElementPickerProps) {
  const [hovered, setHovered] = useState<Hovered | null>(null);
  const [trail, setTrail] = useState<Element[]>([]);
  const [held, setHeld] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [guides, setGuides] = useState(false);
  const callbacks = useRef({ onCancel, onSelect });
  callbacks.current = { onCancel, onSelect };
  const actions = useRef({ navigate: (_index: number) => {}, resume: () => {}, attach: () => {}, cancel: () => {} });

  useEffect(() => {
    let current: Hovered | null = null; let path: Element[] = []; let index = 0;
    let point: { x: number; y: number } | null = null; let insideTool = false;
    let holding = false; let selecting = false; let disposed = false; let generation = 0;
    let selectionTimer: ReturnType<typeof setTimeout> | undefined;
    let frame = 0; let contextTimer: ReturnType<typeof setTimeout> | undefined;
    const lookups = new WeakMap<Element, Promise<ReactGrabElementContext>>();
    const contextFor = (element: Element) => {
      let promise = lookups.get(element);
      if (!promise) { promise = getElementContext(element); lookups.set(element, promise); }
      return promise;
    };
    const update = (element: Element | null) => {
      if (!element?.isConnected) { if (current) { current = null; setHovered(null); } return; }
      const bounds = getElementBounds(element);
      if (!Number.isFinite(bounds.x + bounds.y + bounds.width + bounds.height) || bounds.width <= 0 || bounds.height <= 0) return;
      if (current?.element === element) {
        if (["x", "y", "width", "height"].some((key) => Math.abs(bounds[key as keyof Bounds] as number - (current!.bounds[key as keyof Bounds] as number)) > 0.2) || bounds.borderRadius !== current.bounds.borderRadius) {
          current = { ...current, bounds }; setHovered(current);
        }
        return;
      }
      current = { element, bounds, label: shortName(element) }; setHovered(current);
      clearTimeout(contextTimer);
      contextTimer = setTimeout(() => {
        void contextFor(element).then((context) => {
          if (disposed || current?.element !== element || selecting) return;
          current = { ...current, label: labelFor(element, context) }; setHovered(current);
        }).catch(() => {});
      }, 100);
    };
    const target = (element: Element | null) => {
      if (current?.element === element) return;
      path = element ? hierarchy(element) : []; index = 0; setTrail(path); update(element);
    };
    const navigate = (next: number) => {
      if (selecting || !path[next]?.isConnected) return;
      holding = true; setHeld(true); index = next; update(path[index]!);
    };
    const attach = async (element: Element) => {
      if (selecting || !element.isConnected) return;
      selecting = true; holding = true; setAttaching(true); setHeld(true); update(element);
      clearTimeout(contextTimer);
      const request = ++generation;
      const snapshot = selectionFrom(element);
      const start = performance.now();
      try {
        const context = await Promise.race([contextFor(element), new Promise<undefined>((resolve) => { selectionTimer = setTimeout(() => resolve(undefined), 3_000); })]);
        clearTimeout(selectionTimer);
        const selection = context && element.isConnected ? selectionFrom(element, context) : snapshot;
        const delay = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : Math.max(0, 140 - (performance.now() - start));
        if (delay) await new Promise<void>((resolve) => { selectionTimer = setTimeout(() => resolve(), delay); });
        if (!disposed && request === generation) callbacks.current.onSelect(selection);
      } catch {
        if (!disposed && request === generation) callbacks.current.onSelect(snapshot);
      } finally { clearTimeout(selectionTimer); }
    };
    const cancel = () => { generation += 1; callbacks.current.onCancel(); };
    actions.current = { cancel, navigate, resume: () => { if (!selecting) { holding = false; setHeld(false); } }, attach: () => { if (current) void attach(current.element); } };
    const move = (event: PointerEvent) => {
      insideTool = eventIsInsideQraft(event);
      if (insideTool || selecting || holding) return;
      point = topPoint(event); target(targetAt(point.x, point.y));
    };
    const focus = (event: FocusEvent) => {
      if (eventIsInsideQraft(event) || holding || selecting) return;
      const element = event.composedPath().find((node) => (node as Node).nodeType === Node.ELEMENT_NODE) as Element | undefined;
      if (element && isElementGrabbable(element)) { point = null; target(element); }
    };
    const suppress = (event: Event) => {
      if (eventIsInsideQraft(event)) return;
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    };
    const click = (event: MouseEvent) => {
      if (eventIsInsideQraft(event)) return;
      suppress(event);
      if (selecting) return;
      const position = topPoint(event);
      const element = holding ? current?.element : targetAt(position.x, position.y);
      if (element) void attach(element);
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancel(); }
      if (selecting || eventIsInsideQraft(event)) return;
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault(); event.stopPropagation(); navigate(index + (event.key === "ArrowUp" ? 1 : -1));
      }
      if (event.key === "Enter" && current) { event.preventDefault(); event.stopPropagation(); void attach(current.element); }
    };
    const documents = new Set<Document>();
    const suppressed = ["pointerdown", "pointerup", "mousedown", "mouseup", "dblclick", "contextmenu", "dragstart"];
    const observer = new MutationObserver(() => bind());
    const bind = () => {
      for (const owner of eventDocuments((root) => observer.observe(root, { childList: true, subtree: true }))) {
        if (documents.has(owner)) continue;
        documents.add(owner);
        owner.addEventListener("focusin", focus, true);
        owner.addEventListener("load", bind, true);
        owner.addEventListener("pointermove", move, true);
        owner.addEventListener("click", click, true);
        owner.addEventListener("keydown", keydown, true);
        for (const name of suppressed) owner.addEventListener(name, suppress, true);
      }
    };
    bind();
    const scan = setInterval(bind, 2_000);
    const track = () => {
      if (disposed) return;
      if (!holding && !selecting && !insideTool && point) target(targetAt(point.x, point.y));
      if (current) update(current.element);
      frame = requestAnimationFrame(track);
    };
    frame = requestAnimationFrame(track);
    return () => {
      disposed = true; generation += 1; clearTimeout(contextTimer); clearTimeout(selectionTimer); clearInterval(scan); observer.disconnect(); cancelAnimationFrame(frame);
      for (const owner of documents) {
        owner.removeEventListener("focusin", focus, true);
        owner.removeEventListener("load", bind, true);
        owner.removeEventListener("pointermove", move, true);
        owner.removeEventListener("click", click, true);
        owner.removeEventListener("keydown", keydown, true);
        for (const name of suppressed) owner.removeEventListener(name, suppress, true);
      }
    };
  }, []);

  const bounds = hovered?.bounds;
  const selectedIndex = trail.indexOf(hovered?.element as Element);
  const labelLeft = bounds ? Math.max(4, Math.min(bounds.x, window.innerWidth - 4)) : 4;
  const labelTop = bounds ? Math.max(4, Math.min(window.innerHeight - 28, bounds.y >= 28 ? bounds.y - 25 : bounds.y + bounds.height + 4)) : 4;
  return <div className="qraft-picker" data-react-grab-ignore="">
    {hovered && bounds ? <>
      {guides ? <div className="qraft-picker-guides" aria-hidden="true"><i style={{ left: bounds.x }} /><i style={{ left: bounds.x + bounds.width }} /><b style={{ top: bounds.y }} /><b style={{ top: bounds.y + bounds.height }} /></div> : null}
      <div className={`qraft-picker-outline ${attaching ? "selected" : ""}`} aria-hidden="true" style={{ left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height, borderRadius: bounds.borderRadius }} />
      <div className="qraft-picker-label" aria-hidden="true" style={{ left: labelLeft, top: labelTop, transform: `translateX(min(0px, calc(100vw - 4px - ${labelLeft}px - 100%)))` }}>{hovered.label} · {Math.round(bounds.width)} × {Math.round(bounds.height)}</div>
    </> : null}
    <div className="qraft-picker-toolbar" aria-label="Element picker">
      <div className="qraft-picker-toolbar-head"><Target size={17} aria-hidden="true" /><span role="status"><strong>{attaching ? "Attaching element…" : held ? "Selection held" : "Select an element"}</strong><small>{attaching ? "Keeping this target while source context loads" : "Click or Enter to attach · ↑ parent · ↓ child · Esc cancel"}</small></span><button type="button" aria-label="Cancel element picker" onClick={() => actions.current.cancel()}><X size={18} /></button></div>
      {hovered ? <><nav className="qraft-picker-trail" aria-label="Element hierarchy">{trail.map((element, index) => <button type="button" key={index} disabled={attaching} aria-current={index === selectedIndex ? "true" : undefined} onClick={() => actions.current.navigate(index)}>{shortName(element)}</button>).reverse()}</nav>
        <div className="qraft-picker-actions"><button type="button" disabled={attaching || selectedIndex >= trail.length - 1} onClick={() => actions.current.navigate(selectedIndex + 1)}><ArrowUp size={13} /> Parent</button><button type="button" disabled={attaching || selectedIndex <= 0} onClick={() => actions.current.navigate(selectedIndex - 1)}><ArrowDown size={13} /> Child</button>{held ? <button type="button" disabled={attaching} onClick={() => actions.current.resume()}>Resume picking</button> : null}<button type="button" aria-pressed={guides} onClick={() => setGuides(!guides)}>Guides</button><button type="button" disabled={attaching} onClick={() => actions.current.attach()}>Attach</button></div></> : null}
    </div>
  </div>;
}
