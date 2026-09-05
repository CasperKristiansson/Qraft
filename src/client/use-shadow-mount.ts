import { useLayoutEffect, useState } from "react";
import styles from "./styles.css?raw";

export function useShadowMount() {
  const [mount, setMount] = useState<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const host = document.createElement("div");
    host.dataset.qraftRoot = "";
    host.dataset.reactGrabIgnore = "";
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = styles;
    const container = document.createElement("div");
    container.dataset.qraftPortal = "";
    shadow.append(style, container);
    document.body.append(host);
    setMount(container);
    return () => host.remove();
  }, []);
  return mount;
}
