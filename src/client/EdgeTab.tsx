import * as Dialog from "@radix-ui/react-dialog";
import { GripHorizontal } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const key = "qraft:tab-position";
const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function EdgeTab({ open, passed, total }: { open: boolean; passed: number; total: number }) {
  const [position, setPosition] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      const value = raw === null ? 0.5 : Number(raw);
      return Number.isFinite(value) ? clamp(value) : 0.5;
    } catch {
      return 0.5;
    }
  });
  const [height, setHeight] = useState(window.innerHeight);
  const [tabHeight, setTabHeight] = useState(72);
  const tab = useRef<HTMLDivElement>(null);
  const drag = useRef<{ start: number; position: number } | null>(null);
  const travel = Math.max(1, height - tabHeight - 16);
  const save = (value: number) => {
    const next = clamp(value);
    setPosition(next);
    try {
      localStorage.setItem(key, String(next));
    } catch {
      /* Position still works without browser persistence. */
    }
  };
  useEffect(() => {
    const resize = () => setHeight(window.innerHeight);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useLayoutEffect(() => {
    const element = tab.current;
    if (!element) return;
    const measure = () => {
      const next = element.getBoundingClientRect().height;
      if (next > 0) setTabHeight(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={tab}
      className="qraft-tab"
      hidden={open}
      style={{ top: `calc(${position * 100}dvh + ${8 - position * (tabHeight + 16)}px)` }}
    >
      <button
        className="qraft-grip"
        type="button"
        aria-label="Move Qraft tab"
        title="Drag up or down. Arrow keys move; Home/End move to the edges."
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.focus();
          drag.current = { start: event.clientY, position };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (drag.current)
            save(drag.current.position + (event.clientY - drag.current.start) / travel);
        }}
        onPointerUp={(event) => {
          drag.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
        onKeyDown={(event) => {
          const next =
            event.key === "ArrowUp"
              ? position - 16 / travel
              : event.key === "ArrowDown"
                ? position + 16 / travel
                : event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? 1
                    : null;
          if (next !== null) {
            event.preventDefault();
            save(next);
          }
        }}
      >
        <GripHorizontal aria-hidden="true" size={12} />
      </button>
      <Dialog.Trigger asChild>
        <button
          className="qraft-tab-open"
          aria-label={`Open Qraft, ${passed} of ${total} tasks completed`}
        >
          <span>QA</span>
          <strong>
            {passed}/{total}
          </strong>
        </button>
      </Dialog.Trigger>
    </div>
  );
}
