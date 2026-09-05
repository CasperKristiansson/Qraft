import { unwatchFile, watchFile } from "node:fs";
import { resolve } from "node:path";
import { createProject } from "./server/project";

export interface QraftNextOptions {
  /** Absolute project directory; defaults to the Next.js working directory. */
  root?: string;
  /** Exact browser origin when a trusted local gateway rewrites the Host header. */
  origin?: string;
  /** Optional Markdown chooser restriction, resolved inside root. */
  file?: string;
  /** Must match the App Router route location. */
  endpoint?: string;
}

type Project = Awaited<ReturnType<typeof createProject>>;
const key = Symbol.for("qraft.next.projects.v1");
const registry = globalThis as typeof globalThis & { [key]?: Map<string, Promise<Project>> };

/** Mount as GET/POST in a Node-runtime App Router catch-all route. */
export function createQraftRoute(options: QraftNextOptions = {}) {
  let projectKey: string | undefined;

  async function handle(request: Request): Promise<Response> {
    // Fail closed before options, filesystem access, watchers or body parsing.
    if (process.env.NODE_ENV !== "development") return new Response(null, { status: 404 });

    const root = resolve(options.root ?? process.cwd());
    projectKey = JSON.stringify([root, options.file, options.endpoint, options.origin]);
    const projects = (registry[key] ??= new Map());
    let project = projects.get(projectKey);
    if (!project) {
      if (projects.size >= 8) return new Response("Too many Qraft projects.", { status: 503 });
      project = createProject({
        ...options,
        root,
        watch(path, changed) {
          watchFile(path, { persistent: false, interval: 750 }, changed);
          return () => unwatchFile(path, changed);
        },
      });
      projects.set(projectKey, project);
      const failedKey = projectKey;
      void project.catch(() => projects.delete(failedKey));
    }
    try {
      return (await (await project).handle(request)) ?? new Response(null, { status: 404 });
    } catch {
      return Response.json(
        {
          error: {
            code: "initialization_failed",
            message:
              "Qraft could not initialize. Check the server configuration and local permissions.",
            retryable: true,
          },
        },
        { status: 500 },
      );
    }
  }

  async function dispose() {
    if (!projectKey) return;
    const projects = registry[key];
    const project = projects?.get(projectKey);
    projects?.delete(projectKey);
    await project?.then((value) => value.dispose());
  }

  return { GET: handle, POST: handle, dispose };
}
