import type { QACommand } from "../domain/commands";
import type { QADocument } from "../domain/model";
import type { QAFileCatalog, QAStorage } from "./storage";

interface ErrorResponse {
  error?: { code: string; message: string; retryable: boolean };
  document?: QADocument;
}

export class QAStorageError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean,
    public readonly document?: QADocument,
  ) {
    super(message);
    this.name = "QAStorageError";
  }
}

export interface HttpQAStorageOptions {
  /** Use short polling for hosted services that do not offer SSE. Minimum 1 second. */
  pollIntervalMs?: number;
  /** Fresh host-owned request headers, such as a CSRF token. Never embed service secrets. */
  headers?: () => HeadersInit;
}

export class HttpQAStorage implements QAStorage {
  private revision: string | null = null;
  constructor(
    private readonly endpoint = "/__qraft",
    private readonly onConnectionState?: (connected: boolean) => void,
    private readonly options: HttpQAStorageOptions = {},
  ) {
    if (
      options.pollIntervalMs !== undefined &&
      (!Number.isFinite(options.pollIntervalMs) || options.pollIntervalMs < 1_000)
    )
      throw new Error("Use a polling interval of at least 1,000 milliseconds.");
  }

  async getFiles(signal?: AbortSignal): Promise<QAFileCatalog> {
    const response = await this.#request("files", {
      cache: "no-store",
      ...(signal ? { signal } : {}),
    });
    if (!response.ok) throw await this.#error(response);
    return (await response.json()) as QAFileCatalog;
  }

  forFile(id: string): HttpQAStorage {
    if (!/^[a-f0-9]{64}$/u.test(id)) throw new Error("Invalid file selection.");
    return new HttpQAStorage(`${this.endpoint}/files/${id}`, this.onConnectionState, this.options);
  }

  async getDocument(signal?: AbortSignal): Promise<QADocument> {
    const response = await this.#request("document", {
      cache: "no-store",
      ...(signal ? { signal } : {}),
    });
    if (!response.ok) throw await this.#error(response);
    const document = (await response.json()) as QADocument;
    this.revision = document.revision;
    return document;
  }

  async execute(command: QACommand, baseRevision: string): Promise<QADocument> {
    const response = await this.#request("commands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commandId: crypto.randomUUID(), baseRevision, command }),
    });
    if (!response.ok) throw await this.#error(response);
    const document = (await response.json()) as QADocument;
    this.revision = document.revision;
    return document;
  }

  subscribe(onChange: () => void): () => void {
    if (this.options.pollIntervalMs !== undefined) {
      const timer = setInterval(onChange, this.options.pollIntervalMs);
      const focus = () => onChange();
      globalThis.addEventListener?.("focus", focus);
      return () => {
        clearInterval(timer);
        globalThis.removeEventListener?.("focus", focus);
      };
    }
    let source: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    let delay = 500;

    const connect = () => {
      if (stopped) return;
      source = new EventSource(`${this.endpoint}/events`);
      source.addEventListener("document-unavailable", () => {
        this.revision = null;
        onChange();
      });
      source.addEventListener("document-changed", (event) => {
        try {
          const data = JSON.parse((event as MessageEvent<string>).data) as { revision?: string };
          if (data.revision && data.revision !== this.revision) onChange();
        } catch {
          /* Ignore malformed invalidations; reconnect still refetches. */
        }
      });
      source.onopen = () => {
        this.onConnectionState?.(true);
        // A first successful connection can follow failed attempts or race the initial read.
        onChange();
        delay = 500;
      };
      source.onerror = () => {
        this.onConnectionState?.(false);
        source?.close();
        source = null;
        if (!stopped) {
          timer = setTimeout(connect, delay);
          delay = Math.min(delay * 2, 10_000);
        }
      };
    };
    connect();
    return () => {
      stopped = true;
      source?.close();
      if (timer) clearTimeout(timer);
    };
  }

  async #request(path: string, init: RequestInit): Promise<Response> {
    const deadline = AbortSignal.timeout(15_000);
    const signal = init.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
    try {
      const headers = new Headers(this.options.headers?.());
      new Headers(init.headers).forEach((value, name) => headers.set(name, value));
      const response = await fetch(`${this.endpoint}/${path}`, {
        ...init,
        headers,
        credentials: "same-origin",
        signal,
        redirect: "error",
      });
      if (response.ok && !response.headers.get("content-type")?.includes("application/json")) {
        throw new QAStorageError(
          "The Qraft route did not return JSON. Check the endpoint and sign-in configuration; for local development, run qraft doctor.",
          "unexpected_response",
          false,
        );
      }
      return response;
    } catch (error) {
      if (deadline.aborted)
        throw new QAStorageError(
          "The Qraft request timed out. Check the connection, then review the latest file before retrying; the save may have completed.",
          "request_timeout",
          true,
        );
      throw error;
    }
  }

  async #error(response: Response): Promise<QAStorageError> {
    let body: ErrorResponse = {};
    try {
      body = (await response.json()) as ErrorResponse;
    } catch {
      // Use the safe fallback below.
    }
    return new QAStorageError(
      body.error?.message ?? "Qraft could not complete the request.",
      body.error?.code ??
        ([401, 403].includes(response.status) ? "access_denied" : "request_failed"),
      body.error?.retryable ?? response.status >= 500,
      body.document,
    );
  }
}
