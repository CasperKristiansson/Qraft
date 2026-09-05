import type { IncomingMessage, ServerResponse } from "node:http";
import { commandRequestSchema, type CommandRequest } from "../domain/commands";
import type { QADocument } from "../domain/model";
import { QraftError } from "../domain/validation";
import type { MarkdownDocumentStore, StoreConflict } from "../markdown/store";
import type { DocumentEventHub } from "./events";
import { isAllowedOrigin } from "./origin";

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

type Next = (error?: unknown) => void;

export function json(response: ServerResponse, status: number, value: unknown, etag?: string): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  if (etag) response.setHeader("ETag", `"${etag}"`);
  response.end(JSON.stringify(value));
}

export function safeError(response: ServerResponse, status: number, code: string, message: string, retryable: boolean, extra = {}): void {
  json(response, status, { error: { code, message, retryable }, ...extra });
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > 32 * 1024) {
      request.resume();
      throw new QraftError("validation", "The command request is larger than 32 KiB.");
    }
    chunks.push(bytes);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new QraftError("validation", "The command request is not valid JSON.");
  }
}

export function createQraftMiddleware(options: MiddlewareOptions) {
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

  return async (request: IncomingMessage, response: ServerResponse, next: Next): Promise<void> => {
    const path = request.url?.split("?", 1)[0];
    if (path !== documentPath && path !== commandPath && path !== eventsPath) {
      next();
      return;
    }
    if (!isAllowedOrigin(request, options.origin)) {
      safeError(response, 403, "origin_not_allowed", "The request origin does not match this Vite server.", false);
      return;
    }

    if (path === documentPath) {
      if (request.method !== "GET") {
        safeError(response, 405, "method_not_allowed", "Use GET for the Qraft document endpoint.", false);
        return;
      }
      try {
        const document = await options.store.read();
        json(response, 200, document, document.revision);
      } catch {
        safeError(response, 500, "read_failed", "Qraft could not read the QA file. Check local permissions and retry.", true);
      }
      return;
    }

    if (path === eventsPath) {
      if (request.method !== "GET") {
        safeError(response, 405, "method_not_allowed", "Use GET for the Qraft events endpoint.", false);
        return;
      }
      options.events.connect(request, response);
      return;
    }

    if (request.method !== "POST") {
      safeError(response, 405, "method_not_allowed", "Use POST for the Qraft command endpoint.", false);
      return;
    }
    if (request.headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
      safeError(response, 415, "unsupported_media_type", "Send Qraft commands as application/json.", false);
      return;
    }
    const declaredLength = Number(request.headers["content-length"] ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > 32 * 1024) {
      request.resume();
      safeError(response, 413, "request_too_large", "The command request is larger than 32 KiB.", false);
      return;
    }

    let parsed: CommandRequest;
    let fingerprint: string;
    try {
      const body = await readJsonBody(request);
      const result = commandRequestSchema.safeParse(body);
      if (!result.success) {
        safeError(response, 400, "invalid_command", "The command contains invalid or unsupported values.", false);
        return;
      }
      parsed = result.data;
      fingerprint = JSON.stringify(parsed);
    } catch (error) {
      const tooLarge = error instanceof QraftError && error.message.includes("32 KiB");
      safeError(
        response,
        tooLarge ? 413 : 400,
        tooLarge ? "request_too_large" : "invalid_json",
        error instanceof Error ? error.message : "The command request is invalid.",
        false,
      );
      return;
    }

    prune();
    const duplicate = recent.get(parsed.commandId);
    if (duplicate) {
      if (duplicate.fingerprint === fingerprint) json(response, 200, duplicate.document, duplicate.document.revision);
      else safeError(response, 409, "duplicate_command", "This command ID was already used for a different request.", false);
      return;
    }

    const active = inFlight.get(parsed.commandId);
    if (active && active.fingerprint !== fingerprint) {
      safeError(response, 409, "duplicate_command", "This command ID is already in use for a different request.", false);
      return;
    }
    try {
      const operation = active?.operation ?? options.store.execute(parsed.command, parsed.baseRevision);
      if (!active) inFlight.set(parsed.commandId, { fingerprint, operation });
      const document = await operation;
      recent.set(parsed.commandId, { fingerprint, document, expires: now() + 5 * 60_000 });
      options.events.publish(document.revision);
      json(response, 200, document, document.revision);
    } catch (error) {
      const qraft = error as StoreConflict;
      if (qraft.code === "not-found") {
        safeError(response, 404, "target_not_found", qraft.message, false, { revision: qraft.document?.revision });
      } else if (qraft.code === "conflict") {
        safeError(response, 409, "revision_conflict", qraft.message, true, {
          revision: qraft.document?.revision,
          document: qraft.document,
        });
      } else if (qraft.code === "validation") {
        safeError(response, 400, "invalid_command", qraft.message, false);
      } else {
        safeError(response, 500, "write_failed", "Qraft could not save the QA file. The original was left unchanged.", true);
      }
    } finally {
      if (!active) inFlight.delete(parsed.commandId);
    }
  };
}
