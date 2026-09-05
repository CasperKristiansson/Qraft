import { realpath } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { z } from "zod";
import type { Plugin, ResolvedConfig, ViteDevServer } from "vite";
import { normalizePath } from "vite";
import { FileCatalog } from "./server/files";
import { validateFilePath } from "./markdown/path-safety";
import { isAllowedOrigin } from "./server/origin";
import { json, safeError } from "./server/middleware";
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
  const active = new Map<string, { store: MarkdownDocumentStore; events: DocumentEventHub; unsubscribe: () => void; middleware: ReturnType<typeof createQraftMiddleware> }>();
  let watcherCleanup: (() => void) | null = null;
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const cleanup = () => {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    watcherCleanup?.();
    for (const entry of active.values()) { entry.unsubscribe(); entry.events.close(); }
    active.clear();
  };

  return {
    name: "qraft",
    apply: "serve",
    async configResolved(resolved) {
      config = resolved;
      root = await canonical(resolve(config.root));
      if (!options.file) return;
      const candidate = resolve(root, options.file);
      const extension = extname(candidate).toLowerCase();
      if (extension !== ".md" && extension !== ".markdown") {
        throw new Error("Qraft file must use a .md or .markdown extension.");
      }
      const existing = await canonical(candidate);
      const parent = await canonical(dirname(candidate));
      if (!isInside(root, existing) || !isInside(root, parent)) {
        throw new Error("Qraft file must resolve inside the Vite project root.");
      }
      await validateFilePath(root, candidate);
      filePath = candidate;
    },
    configureServer(server: ViteDevServer) {
      const endpoint = options.endpoint ?? "/__qraft";
      const catalog = new FileCatalog(root, filePath || undefined);
      const mount = (prefix: string, path: string) => {
        let entry = active.get(prefix);
        if (entry) return entry;
        if (active.size >= 128) throw new Error("Too many selected files.");
        const store = new MarkdownDocumentStore(path, root);
        const events = new DocumentEventHub();
        entry = { store, events, unsubscribe: store.subscribe((document) => events.publish(document.revision)), middleware: createQraftMiddleware({ endpoint: prefix, store, events, ...(config.server.origin ? { origin: config.server.origin } : {}) }) };
        active.set(prefix, entry);
        server.watcher.add(path);
        return entry;
      };
      if (filePath) mount(endpoint, filePath);
      server.middlewares.use(async (request, response, next) => {
        const path = request.url?.split("?", 1)[0] ?? "";
        if (path !== `${endpoint}/files` && !path.startsWith(`${endpoint}/files/`)) {
          const legacy = active.get(endpoint);
          if (legacy) await legacy.middleware(request, response, next);
          else next();
          return;
        }
        if (!isAllowedOrigin(request, config.server.origin)) { safeError(response, 403, "origin_not_allowed", "The request origin does not match this Vite server.", false); return; }
        if (path === `${endpoint}/files`) {
          if (request.method !== "GET") { safeError(response, 405, "method_not_allowed", "Use GET to list project Markdown files.", false); return; }
          try { json(response, 200, await catalog.list()); }
          catch { safeError(response, 500, "catalog_failed", "Could not list project Markdown files. Check permissions and refresh.", true); }
          return;
        }
        const suffix = path.slice(`${endpoint}/files/`.length);
        const match = suffix.match(/^([a-f0-9]{64})\/(document|commands|events)$/u);
        const id = match?.[1];
        const file = id ? catalog.paths.get(id) : undefined;
        if (!file || !id) { safeError(response, 404, "file_not_found", "This file is unavailable. Refresh the file list and choose again.", false); return; }
        try {
          await validateFilePath(root, file);
          await mount(`${endpoint}/files/${id}`, file).middleware(request, response, next);
        } catch { safeError(response, 500, "file_unavailable", "The selected file is unavailable. Check its path and permissions, then choose again.", true); }
      });
      const onWatch = (changed: string) => {
        for (const [prefix, entry] of active) {
          if (normalizePath(resolve(changed)) !== normalizePath(entry.store.filePath)) continue;
          const previous = timers.get(prefix);
          if (previous) clearTimeout(previous);
          timers.set(prefix, setTimeout(() => {
            timers.delete(prefix);
            void entry.store.read().then((document) => entry.events.publish(document.revision)).catch(() => undefined);
          }, 750));
        }
      };
      for (const event of ["add", "change", "unlink"] as const) server.watcher.on(event, onWatch);
      watcherCleanup = () => { for (const event of ["add", "change", "unlink"] as const) server.watcher.off(event, onWatch); };
      server.httpServer?.once("close", cleanup);
    },
    closeBundle: cleanup,
  };
}
