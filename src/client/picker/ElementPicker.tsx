import {
  targetAt,
  eventIsInsideQraft,
  topPoint,
  eventDocuments,
  hierarchy,
  shortName,
  labelFor,
  selectionFrom,
} from "./element-context";
import {
  getElementBounds,
  getElementContext,
  isElementGrabbable,
  type ReactGrabElementContext,
} from "react-grab/primitives";
import { ArrowUp, ArrowDown, Target, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ElementReference } from "../../domain/model";

export interface Bounds {
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

export function ElementPicker({ onCancel, onSelect }: ElementPickerProps) {
  const [hovered, setHovered] = useState<Hovered | null>(null);
  const [trail, setTrail] = useState<Element[]>([]);
  const [held, setHeld] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [guides, setGuides] = useState(false);
  const callbacks = useRef({ onCancel, onSelect });
  callbacks.current = { onCancel, onSelect };
  const actions = useRef({
    navigate: (_index: number) => {},
    resume: () => {},
    attach: () => {},
    cancel: () => {},
  });

  useEffect(() => {
    let current: Hovered | null = null;
    let path: Element[] = [];
    let index = 0;
    let point: { x: number; y: number } | null = null;
    let insideTool = false;
    let holding = false;
    let selecting = false;
    let disposed = false;
    let generation = 0;
    let selectionTimer: ReturnType<typeof setTimeout> | undefined;
    let frame = 0;
    let contextTimer: ReturnType<typeof setTimeout> | undefined;
    const lookups = new WeakMap<Element, Promise<ReactGrabElementContext>>();
    const contextFor = (element: Element) => {
      let promise = lookups.get(element);
      if (!promise) {
        promise = getElementContext(element);
        lookups.set(element, promise);
      }
      return promise;
    };
    const update = (element: Element | null) => {
      if (!element?.isConnected) {
        if (current) {
          current = null;
          setHovered(null);
        }
        return;
      }
      const bounds = getElementBounds(element);
      if (
        !Number.isFinite(bounds.x + bounds.y + bounds.width + bounds.height) ||
        bounds.width <= 0 ||
        bounds.height <= 0
      )
        return;
      if (current?.element === element) {
        if (
          ["x", "y", "width", "height"].some(
            (key) =>
              Math.abs(
                (bounds[key as keyof Bounds] as number) -
                  (current!.bounds[key as keyof Bounds] as number),
              ) > 0.2,
          ) ||
          bounds.borderRadius !== current.bounds.borderRadius
        ) {
          current = { ...current, bounds };
          setHovered(current);
        }
        return;
      }
      current = { element, bounds, label: shortName(element) };
      setHovered(current);
      clearTimeout(contextTimer);
      contextTimer = setTimeout(() => {
        void contextFor(element)
          .then((context) => {
            if (disposed || current?.element !== element || selecting) return;
            current = { ...current, label: labelFor(element, context) };
            setHovered(current);
          })
          .catch(() => {});
      }, 100);
    };
    const target = (element: Element | null) => {
      if (current?.element === element) return;
      path = element ? hierarchy(element) : [];
      index = 0;
      setTrail(path);
      update(element);
    };
    const navigate = (next: number) => {
      if (selecting || !path[next]?.isConnected) return;
      holding = true;
      setHeld(true);
      index = next;
      update(path[index]!);
    };
    const attach = async (element: Element) => {
      if (selecting || !element.isConnected) return;
      selecting = true;
      holding = true;
      setAttaching(true);
      setHeld(true);
      update(element);
      clearTimeout(contextTimer);
      const request = ++generation;
      const snapshot = selectionFrom(element);
      const start = performance.now();
      try {
        const context = await Promise.race([
          contextFor(element),
          new Promise<undefined>((resolve) => {
            selectionTimer = setTimeout(() => resolve(undefined), 3_000);
          }),
        ]);
        clearTimeout(selectionTimer);
        const selection =
          context && element.isConnected ? selectionFrom(element, context) : snapshot;
        const delay = matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : Math.max(0, 140 - (performance.now() - start));
        if (delay)
          await new Promise<void>((resolve) => {
            selectionTimer = setTimeout(() => resolve(), delay);
          });
        if (!disposed && request === generation) callbacks.current.onSelect(selection);
      } catch {
        if (!disposed && request === generation) callbacks.current.onSelect(snapshot);
      } finally {
        clearTimeout(selectionTimer);
      }
    };
    const cancel = () => {
      generation += 1;
      callbacks.current.onCancel();
    };
    actions.current = {
      cancel,
      navigate,
      resume: () => {
        if (!selecting) {
          holding = false;
          setHeld(false);
        }
      },
      attach: () => {
        if (current) void attach(current.element);
      },
    };
    const move = (event: PointerEvent) => {
      insideTool = eventIsInsideQraft(event);
      if (insideTool || selecting || holding) return;
      point = topPoint(event);
      target(targetAt(point.x, point.y));
    };
    const focus = (event: FocusEvent) => {
      if (eventIsInsideQraft(event) || holding || selecting) return;
      const element = event
        .composedPath()
        .find((node) => (node as Node).nodeType === Node.ELEMENT_NODE) as Element | undefined;
      if (element && isElementGrabbable(element)) {
        point = null;
        target(element);
      }
    };
    const suppress = (event: Event) => {
      if (eventIsInsideQraft(event)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
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
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        cancel();
      }
      if (selecting || eventIsInsideQraft(event)) return;
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        navigate(index + (event.key === "ArrowUp" ? 1 : -1));
      }
      if ((event.key === "Enter" || event.key === " ") && current) {
        event.preventDefault();
        event.stopPropagation();
        void attach(current.element);
      }
    };
    const documents = new Set<Document>();
    const suppressed = [
      "pointerdown",
      "pointerup",
      "mousedown",
      "mouseup",
      "dblclick",
      "contextmenu",
      "dragstart",
    ];
    const observer = new MutationObserver(() => bind());
    const bind = () => {
      for (const owner of eventDocuments((root) =>
        observer.observe(root, { childList: true, subtree: true }),
      )) {
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
      disposed = true;
      generation += 1;
      clearTimeout(contextTimer);
      clearTimeout(selectionTimer);
      clearInterval(scan);
      observer.disconnect();
      cancelAnimationFrame(frame);
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
  const labelTop = bounds
    ? Math.max(
        4,
        Math.min(
          window.innerHeight - 28,
          bounds.y >= 28 ? bounds.y - 25 : bounds.y + bounds.height + 4,
        ),
      )
    : 4;
  return (
    <div className="qraft-picker" data-react-grab-ignore="">
      {hovered && bounds ? (
        <>
          {guides ? (
            <div className="qraft-picker-guides" aria-hidden="true">
              <i style={{ left: bounds.x }} />
              <i style={{ left: bounds.x + bounds.width }} />
              <b style={{ top: bounds.y }} />
              <b style={{ top: bounds.y + bounds.height }} />
            </div>
          ) : null}
          <div
            className={`qraft-picker-outline ${attaching ? "selected" : ""}`}
            aria-hidden="true"
            style={{
              left: bounds.x,
              top: bounds.y,
              width: bounds.width,
              height: bounds.height,
              borderRadius: bounds.borderRadius,
            }}
          />
          <div
            className="qraft-picker-label"
            aria-hidden="true"
            style={{
              left: labelLeft,
              top: labelTop,
              transform: `translateX(min(0px, calc(100vw - 4px - ${labelLeft}px - 100%)))`,
            }}
          >
            {hovered.label} · {Math.round(bounds.width)} × {Math.round(bounds.height)}
          </div>
        </>
      ) : null}
      <div className="qraft-picker-toolbar" aria-label="Element picker">
        <div className="qraft-picker-toolbar-head">
          <Target size={17} aria-hidden="true" />
          <span role="status">
            <strong>
              {attaching ? "Attaching element…" : held ? "Selection held" : "Select an element"}
            </strong>
            <small>
              {attaching
                ? "Keeping this target while source context loads"
                : "Click or Enter to attach · ↑ parent · ↓ child · Esc cancel"}
            </small>
          </span>
          <button
            type="button"
            aria-label="Cancel element picker"
            onClick={() => actions.current.cancel()}
          >
            <X size={18} />
          </button>
        </div>
        {hovered ? (
          <>
            <nav className="qraft-picker-trail" aria-label="Element hierarchy">
              {trail
                .map((element, index) => (
                  <button
                    type="button"
                    key={index}
                    disabled={attaching}
                    aria-current={index === selectedIndex ? "true" : undefined}
                    onClick={() => actions.current.navigate(index)}
                  >
                    {shortName(element)}
                  </button>
                ))
                .reverse()}
            </nav>
            <div className="qraft-picker-actions">
              <button
                type="button"
                disabled={attaching || selectedIndex >= trail.length - 1}
                onClick={() => actions.current.navigate(selectedIndex + 1)}
              >
                <ArrowUp size={13} /> Parent
              </button>
              <button
                type="button"
                disabled={attaching || selectedIndex <= 0}
                onClick={() => actions.current.navigate(selectedIndex - 1)}
              >
                <ArrowDown size={13} /> Child
              </button>
              {held ? (
                <button type="button" disabled={attaching} onClick={() => actions.current.resume()}>
                  Resume picking
                </button>
              ) : null}
              <button type="button" aria-pressed={guides} onClick={() => setGuides(!guides)}>
                Guides
              </button>
              <button type="button" disabled={attaching} onClick={() => actions.current.attach()}>
                Attach
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
