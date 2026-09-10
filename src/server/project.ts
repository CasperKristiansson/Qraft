import { realpath } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { z } from "zod";
import { validateFilePath } from "../markdown/path-safety";
import { MarkdownDocumentStore } from "../markdown/store";
import { createDocumentHandler, json, safeError } from "./document-handler";
import { DocumentEventHub } from "./events";
import { FileCatalog } from "./files";
import { isAllowedWebOrigin, parseOrigin } from "./origin";

export interface ProjectOptions {
  root: string;
  projectId?: string;
  requestAllowed?: (request: Request) => boolean;
  file?: string;
  endpoint?: string;
  origin?: string;
  watch?: (path: string, changed: () => void) => () => void;
}

const optionsSchema = z.object({
  root: z.string().min(1),
  file: z.string().min(1).optional(),
  origin: z
    .string()
    .refine(
      (value) => parseOrigin(value) !== null,
      "Use an exact HTTP(S) origin without a path, credentials or query.",
    )
    .optional(),
  endpoint: z
    .string()
    .regex(/^\/[A-Za-z0-9/_-]*[A-Za-z0-9_-]$/u)
    .optional(),
});

type Entry = {
  store: MarkdownDocumentStore;
  events: DocumentEventHub;
  handle: ReturnType<typeof createDocumentHandler>;
  dispose: () => void;
};

class ActiveFileLimitError extends Error {}
const MAX_ACTIVE_FILES = 32;

/** Owns catalog identity and selected-file lifecycles for either host framework. */
export async function createProject(options: ProjectOptions) {
  optionsSchema.parse(options);
  const root = await realpath(resolve(options.root));
  const endpoint = options.endpoint ?? "/__qraft";
  const file = options.file ? resolve(root, options.file) : undefined;
  if (file) {
    if (![".md", ".markdown"].includes(extname(file).toLowerCase())) {
      throw new Error("Qraft file must use a .md or .markdown extension.");
    }
    await validateFilePath(root, file);
  }
  const catalog = new FileCatalog(root, file, options.projectId);
  const entries = new Map<string, Entry>();
  const requestAllowed =
    options.requestAllowed ?? ((request: Request) => isAllowedWebOrigin(request, options.origin));

  function mount(prefix: string, path: string): Entry {
    const existing = entries.get(prefix);
    if (existing) return existing;
    if (entries.size >= MAX_ACTIVE_FILES) {
      const idle = Array.from(entries).find(([, entry]) => entry.events.clientCount === 0);
      if (!idle)
        throw new ActiveFileLimitError("Close an unused review tab before choosing another file.");
      idle[1].dispose();
      entries.delete(idle[0]);
    }

    const store = new MarkdownDocumentStore(path, root);
    const events = new DocumentEventHub();
    const unsubscribe = store.subscribe((document) => events.publish(document.revision));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unwatch = options.watch?.(path, () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void store
          .read()
          .then((document) => events.publish(document.revision))
          .catch(() => {
            events.unavailable();
          });
      }, 100);
      timer.unref();
    });
    const entry: Entry = {
      store,
      events,
      handle: createDocumentHandler({
        endpoint: prefix,
        store,
        events,
        requestAllowed,
        ...(options.origin ? { origin: options.origin } : {}),
      }),
      dispose() {
        clearTimeout(timer);
        unwatch?.();
        unsubscribe();
        events.close();
      },
    };
    entries.set(prefix, entry);
    return entry;
  }

  if (file) mount(endpoint, file);

  async function handle(request: Request): Promise<Response | undefined> {
    const path = new URL(request.url).pathname;
    if (path !== `${endpoint}/files` && !path.startsWith(`${endpoint}/files/`)) {
      if (
        !file ||
        !["document", "commands", "events"].some((suffix) => path === `${endpoint}/${suffix}`)
      )
        return;
      if (!requestAllowed(request))
        return safeError(
          403,
          "origin_not_allowed",
          "The request origin does not match this development server.",
          false,
        );
      try {
        return await mount(endpoint, file).handle(request);
      } catch (error) {
        if (error instanceof ActiveFileLimitError)
          return safeError(503, "active_file_limit", error.message, true);
        return safeError(
          500,
          "file_unavailable",
          "The configured file is unavailable. Check its path and permissions.",
          true,
        );
      }
    }
    if (!requestAllowed(request)) {
      return safeError(
        403,
        "origin_not_allowed",
        "The request origin does not match this development server.",
        false,
      );
    }
    if (path === `${endpoint}/files`) {
      if (request.method !== "GET")
        return safeError(
          405,
          "method_not_allowed",
          "Use GET to list project Markdown files.",
          false,
        );
      try {
        return json(200, await catalog.list());
      } catch {
        return safeError(
          500,
          "catalog_failed",
          "Could not list project Markdown files. Check permissions and refresh.",
          true,
        );
      }
    }
    const match = path
      .slice(`${endpoint}/files/`.length)
      .match(/^([a-f0-9]{64})\/(document|commands|events)$/u);
    const id = match?.[1];
    if (id && !catalog.paths.has(id)) await catalog.list();
    const selected = id ? catalog.paths.get(id) : undefined;
    if (!selected || !id)
      return safeError(
        404,
        "file_not_found",
        "This file is unavailable. Refresh the file list and choose again.",
        false,
      );
    try {
      await validateFilePath(root, selected);
      return await mount(`${endpoint}/files/${id}`, selected).handle(request);
    } catch (error) {
      if (error instanceof ActiveFileLimitError)
        return safeError(503, "active_file_limit", error.message, true);
      return safeError(
        500,
        "file_unavailable",
        "The selected file is unavailable. Check its path and permissions, then choose again.",
        true,
      );
    }
  }

  return {
    handle,
    dispose() {
      for (const entry of entries.values()) entry.dispose();
      entries.clear();
    },
  };
}
