import { useLayoutEffect, useState } from "react";

/** Reserve normal-flow page space without reparenting the host app or locking scroll. */
export function usePageSpace(mount: HTMLDivElement | null, enabled: boolean): boolean {
  const [wide, setWide] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches,
  );
  const active = enabled && wide;

  useLayoutEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setWide(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useLayoutEffect(() => {
    if (!mount || !active) return;

    const root = document.documentElement;
    const padding = getComputedStyle(root).paddingRight;
    const properties = ["width", "box-sizing", "padding-right"] as const;
    const original = properties.map((name) => ({
      name,
      value: root.style.getPropertyValue(name),
      priority: root.style.getPropertyPriority(name),
    }));
    const owned = new Map<string, string>();
    const apply = (name: string, value: string) => {
      // Respect a host write made while Qraft was open.
      const previous = owned.get(name);
      if (
        previous !== undefined &&
        (root.style.getPropertyValue(name) !== previous ||
          root.style.getPropertyPriority(name) !== "important")
      )
        return;
      root.style.setProperty(name, value, "important");
      owned.set(name, root.style.getPropertyValue(name));
    };
    let drawer: HTMLElement | null = null;
    let width = 0;
    const measure = () => {
      const next = drawer?.offsetWidth ?? 0;
      if (next <= 0 || next === width) return;
      width = next;
      apply("box-sizing", "border-box");
      apply("width", "100%");
      apply("padding-right", `calc(${padding} + ${width}px)`);
    };
    const resize = new ResizeObserver(measure);
    const connect = () => {
      const next = mount.querySelector<HTMLElement>(".qraft-drawer");
      if (next === drawer) return;
      resize.disconnect();
      drawer = next;
      if (drawer) resize.observe(drawer);
      measure();
    };
    // Keep the reservation during element picking so the selected page does not reflow.
    const changes = new MutationObserver(connect);
    changes.observe(mount, { childList: true, subtree: true });
    connect();

    return () => {
      resize.disconnect();
      changes.disconnect();
      for (const { name, value, priority } of original) {
        if (
          root.style.getPropertyValue(name) !== owned.get(name) ||
          root.style.getPropertyPriority(name) !== "important"
        )
          continue;
        if (value) root.style.setProperty(name, value, priority);
        else root.style.removeProperty(name);
      }
    };
  }, [mount, active]);

  return active;
}
