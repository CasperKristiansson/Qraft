import { realpath } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { z } from "zod";
import type { Plugin, ResolvedConfig, ViteDevServer } from "vite";
import { normalizePath } from "vite";
import { MarkdownDocumentStore } from "./markdown/store";
import { DocumentEventHub } from "./server/events";
import { createQraftMiddleware } from "./server/middleware";

export interface QraftViteOptions {
  file?: string;
  endpoint?: string;
}

const optionsSchema = z.strictObject({
  file: z.string().min(1).optional(),
  endpoint: z.string().regex(/^\/[A-Za-z0-9/_-]*[A-Za-z0-9_-]$/u).optional(),
});

async function canonical(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch {
    return path;
  }
}

function isInside(root: string, candidate: string): boolean {
  const child = relative(root, candidate);
  const separator = process.platform === "win32" ? "\\" : "/";
  return child === "" || (child !== ".." && !child.startsWith(`..${separator}`) && !isAbsolute(child));
}

export function qraft(input: QraftViteOptions = {}): Plugin {
  const parsedOptions = optionsSchema.safeParse(input);
  if (!parsedOptions.success) throw new Error("Qraft options are invalid. Use a Markdown file and a leading-slash endpoint.");
  const options = parsedOptions.data;
  let config: ResolvedConfig;
  let filePath = "";
  let root = "";
  let events: DocumentEventHub | null = null;
  let unsubscribeStore: (() => void) | null = null;
  let watcherCleanup: (() => void) | null = null;
  let settleTimer: NodeJS.Timeout | null = null;

  const cleanup = () => {
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = null;
    watcherCleanup?.();
    watcherCleanup = null;
    unsubscribeStore?.();
    unsubscribeStore = null;
    events?.close();
    events = null;
  };

  return {
    name: "qraft",
    apply: "serve",
    async configResolved(resolved) {
      config = resolved;
      root = await canonical(resolve(config.root));
      const candidate = resolve(root, options.file ?? "QA.md");
      const extension = extname(candidate).toLowerCase();
      if (extension !== ".md" && extension !== ".markdown") {
        throw new Error("Qraft file must use a .md or .markdown extension.");
      }
      const existing = await canonical(candidate);
      const parent = await canonical(dirname(candidate));
      if (!isInside(root, existing) || !isInside(root, parent)) {
        throw new Error("Qraft file must resolve inside the Vite project root.");
      }
      filePath = candidate;
    },
    configureServer(server: ViteDevServer) {
      const endpoint = options.endpoint ?? "/__qraft";
      const store = new MarkdownDocumentStore(filePath, root);
      events = new DocumentEventHub();
      unsubscribeStore = store.subscribe((document) => events?.publish(document.revision));
      server.middlewares.use(
        createQraftMiddleware({
          endpoint,
          store,
          events,
          ...(config.server.origin ? { origin: config.server.origin } : {}),
        }),
      );

      const watched = normalizePath(filePath);
      server.watcher.add(filePath);
      const onWatch = (changed: string) => {
        if (normalizePath(resolve(changed)) !== watched) return;
        if (settleTimer) clearTimeout(settleTimer);
        settleTimer = setTimeout(() => {
          void store.read().then((document) => events?.publish(document.revision)).catch(() => undefined);
        }, 750);
      };
      server.watcher.on("add", onWatch);
      server.watcher.on("change", onWatch);
      server.watcher.on("unlink", onWatch);
      watcherCleanup = () => {
        server.watcher.off("add", onWatch);
        server.watcher.off("change", onWatch);
        server.watcher.off("unlink", onWatch);
      };
      server.httpServer?.once("close", cleanup);
    },
    closeBundle: cleanup,
  };
}
