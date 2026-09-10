import { createProject } from "./server/project";
import { createDocumentHandler, json, safeError } from "./server/document-handler";
import { DocumentEventHub } from "./server/events";
import type { QACommand } from "./domain/commands";
import type { QADocument } from "./domain/model";
import type { QAFileCatalog } from "./client/storage";
import { parseOrigin } from "./server/origin";

export { createQraftLambdaHandler, type QraftHttpEvent } from "./server/lambda";
export { nodeMiddleware } from "./server/node-http";

export interface QraftBackendStorage {
  list(): Promise<QAFileCatalog>;
  open(id: string): Promise<{
    read(): Promise<QADocument>;
    execute(command: QACommand, baseRevision: string): Promise<QADocument>;
  } | null>;
}

export interface QraftBackendOptions {
  /** Dedicated persistent directory containing only this campaign's Markdown files. */
  root?: string;
  /** Shared object storage, e.g. createS3Storage(). Mutually exclusive with root. */
  storage?: QraftBackendStorage;
  /** Stable campaign identity; change it for a new release/review campaign. */
  projectId: string;
  /** Same-origin browser route, for example /api/qa. */
  endpoint: string;
  /** Exact public application origin. Forwarded headers are never trusted. */
  origin: string;
  /** Host-owned authentication AND authorization, checked before every read or write. */
  authorize: (request: Request) => boolean | Promise<boolean>;
}

/** Explicit hosted backend. Local Vite/Next adapters remain development-only. */
export function createQraftBackend(options: QraftBackendOptions) {
  if (!options || typeof options.authorize !== "function")
    throw new Error("Qraft requires a host authorization callback.");
  if (!options.projectId?.trim() || options.projectId.length > 200)
    throw new Error("Qraft requires a stable campaign ID of at most 200 characters.");
  const origin = parseOrigin(options.origin)?.origin;
  if (!origin || !/^\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/u.test(options.endpoint))
    throw new Error("Qraft requires an exact application origin and an absolute route path.");
  const { root, storage, projectId, endpoint, authorize } = options;
  if (Boolean(root) === Boolean(storage))
    throw new Error("Configure exactly one backend storage or root.");
  let project: ReturnType<typeof createProject> | undefined;
  let closed = false;
  const requestAllowed = (request: Request) => {
    const supplied = request.headers.get("origin");
    return (
      request.headers.get("sec-fetch-site") !== "cross-site" &&
      (supplied === origin || (supplied === null && request.method === "GET"))
    );
  };

  async function handle(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (
      closed ||
      (path !== `${endpoint}/files` &&
        !new RegExp(`^${endpoint}/files/[a-f0-9]{64}/(document|commands)$`, "u").test(path))
    )
      return safeError(404, "not_found", "This review endpoint is unavailable.", false);
    if (!requestAllowed(request))
      return safeError(
        403,
        "origin_not_allowed",
        "Open this review from the configured application.",
        false,
      );
    try {
      if ((await authorize(request)) !== true)
        return safeError(
          403,
          "access_denied",
          "Your session cannot access this review. Sign in with an authorized account.",
          false,
        );
    } catch {
      return safeError(
        503,
        "authorization_unavailable",
        "Review access could not be checked. Try again shortly.",
        true,
      );
    }
    if (closed) return safeError(503, "backend_closed", "The review service is restarting.", true);
    try {
      if (storage) {
        if (path === `${endpoint}/files`) {
          if (request.method !== "GET")
            return safeError(405, "method_not_allowed", "Use GET to list checklists.", false);
          return json(200, await storage.list());
        }
        const id = path.slice(`${endpoint}/files/`.length).split("/")[0]!;
        const store = await storage.open(id);
        if (!store)
          return safeError(
            404,
            "file_not_found",
            "This checklist is unavailable. Refresh the menu.",
            false,
          );
        // Per-request composition is stateless across Lambda instances. S3 owns atomic concurrency.
        return (await createDocumentHandler({
          endpoint: `${endpoint}/files/${id}`,
          store,
          events: new DocumentEventHub(),
          requestAllowed,
        })(request))!;
      }
      if (!project) {
        project = createProject({ root: root!, projectId, endpoint, requestAllowed });
        void project.catch(() => {
          project = undefined;
        });
      }
      return (
        (await (await project).handle(request)) ??
        safeError(404, "not_found", "This review is unavailable.", false)
      );
    } catch {
      return safeError(
        503,
        "storage_unavailable",
        "The review files are unavailable. Try again shortly.",
        true,
      );
    }
  }

  return {
    handle,
    async dispose() {
      closed = true;
      await project?.then((value) => value.dispose());
    },
  };
}
