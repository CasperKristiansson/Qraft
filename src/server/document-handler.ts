import { commandRequestSchema, type CommandRequest } from "../domain/commands";
import type { QADocument } from "../domain/model";
import { QraftError } from "../domain/validation";
import type { MarkdownDocumentStore, StoreConflict } from "../markdown/store";
import type { DocumentEventHub } from "./events";
import { isAllowedWebOrigin } from "./origin";

export interface MiddlewareOptions {
  endpoint: string;
  store: MarkdownDocumentStore;
  events: DocumentEventHub;
  origin?: string;
  now?: () => number;
}

interface SuccessfulCommand {
  fingerprint: string;
  document: QADocument;
  expires: number;
}

export function json(status: number, value: unknown, etag?: string): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  if (etag) headers.set("ETag", `"${etag}"`);
  return new Response(JSON.stringify(value), { status, headers });
}

export function safeError(
  status: number,
  code: string,
  message: string,
  retryable: boolean,
  extra = {},
): Response {
  return json(status, { error: { code, message, retryable }, ...extra });
}

async function readJsonBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 32 * 1024) {
          await reader.cancel();
          throw new QraftError("validation", "The command request is larger than 32 KiB.");
        }
        chunks.push(value);
      }
    }
  } finally {
    reader?.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new QraftError("validation", "The command request is not valid JSON.");
  }
}

export function createDocumentHandler(options: MiddlewareOptions) {
  const recent = new Map<string, SuccessfulCommand>();
  const inFlight = new Map<string, { fingerprint: string; operation: Promise<QADocument> }>();
  const now = options.now ?? Date.now;
  const documentPath = `${options.endpoint}/document`;
  const commandPath = `${options.endpoint}/commands`;
  const eventsPath = `${options.endpoint}/events`;

  const prune = () => {
    const time = now();
    for (const [id, entry] of recent) if (entry.expires <= time) recent.delete(id);
    while (recent.size > 500) recent.delete(recent.keys().next().value as string);
  };

  return async (request: Request): Promise<Response | undefined> => {
    const path = new URL(request.url).pathname;
    if (path !== documentPath && path !== commandPath && path !== eventsPath) {
      return;
    }
    if (!isAllowedWebOrigin(request, options.origin)) {
      return safeError(
        403,
        "origin_not_allowed",
        "The request origin does not match this development server.",
        false,
      );
    }

    if (path === documentPath) {
      if (request.method !== "GET") {
        return safeError(
          405,
          "method_not_allowed",
          "Use GET for the Qraft document endpoint.",
          false,
        );
      }
      try {
        const document = await options.store.read();
        return json(200, document, document.revision);
      } catch {
        return safeError(
          500,
          "read_failed",
          "Qraft could not read the QA file. Check local permissions and retry.",
          true,
        );
      }
      return;
    }

    if (path === eventsPath) {
      if (request.method !== "GET") {
        return safeError(
          405,
          "method_not_allowed",
          "Use GET for the Qraft events endpoint.",
          false,
        );
      }
      return options.events.stream(request.signal);
    }

    if (request.method !== "POST") {
      return safeError(
        405,
        "method_not_allowed",
        "Use POST for the Qraft command endpoint.",
        false,
      );
    }
    if (
      request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !==
      "application/json"
    ) {
      return safeError(
        415,
        "unsupported_media_type",
        "Send Qraft commands as application/json.",
        false,
      );
    }
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > 32 * 1024) {
      return safeError(
        413,
        "request_too_large",
        "The command request is larger than 32 KiB.",
        false,
      );
    }

    let parsed: CommandRequest;
    let fingerprint: string;
    try {
      const body = await readJsonBody(request);
      const result = commandRequestSchema.safeParse(body);
      if (!result.success) {
        return safeError(
          400,
          "invalid_command",
          "The command contains invalid or unsupported values.",
          false,
        );
      }
      parsed = result.data;
      fingerprint = JSON.stringify(parsed);
    } catch (error) {
      const tooLarge = error instanceof QraftError && error.message.includes("32 KiB");
      return safeError(
        tooLarge ? 413 : 400,
        tooLarge ? "request_too_large" : "invalid_json",
        error instanceof Error ? error.message : "The command request is invalid.",
        false,
      );
    }

    prune();
    const duplicate = recent.get(parsed.commandId);
    if (duplicate) {
      if (duplicate.fingerprint === fingerprint)
        return json(200, duplicate.document, duplicate.document.revision);
      else
        return safeError(
          409,
          "duplicate_command",
          "This command ID was already used for a different request.",
          false,
        );
    }

    const active = inFlight.get(parsed.commandId);
    if (active && active.fingerprint !== fingerprint) {
      return safeError(
        409,
        "duplicate_command",
        "This command ID is already in use for a different request.",
        false,
      );
    }
    try {
      const operation =
        active?.operation ?? options.store.execute(parsed.command, parsed.baseRevision);
      if (!active) inFlight.set(parsed.commandId, { fingerprint, operation });
      const document = await operation;
      recent.set(parsed.commandId, { fingerprint, document, expires: now() + 5 * 60_000 });
      options.events.publish(document.revision);
      return json(200, document, document.revision);
    } catch (error) {
      const qraft = error as StoreConflict;
      if (qraft.code === "not-found") {
        return safeError(404, "target_not_found", qraft.message, false, {
          revision: qraft.document?.revision,
        });
      } else if (qraft.code === "conflict") {
        return safeError(409, "revision_conflict", qraft.message, true, {
          revision: qraft.document?.revision,
          document: qraft.document,
        });
      } else if (qraft.code === "validation") {
        return safeError(400, "invalid_command", qraft.message, false);
      } else {
        return safeError(
          500,
          "write_failed",
          "Qraft could not save the QA file. The original was left unchanged.",
          true,
        );
      }
    } finally {
      if (!active) inFlight.delete(parsed.commandId);
    }
  };
}
