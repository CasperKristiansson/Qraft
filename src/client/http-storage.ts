import type { QACommand } from "../domain/commands";
import type { QADocument } from "../domain/model";
import type { QAStorage } from "./storage";

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

export class HttpQAStorage implements QAStorage {
  private revision: string | null = null;
  constructor(
    private readonly endpoint = "/__qraft",
    private readonly onConnectionState?: (connected: boolean) => void,
  ) {}

  async getDocument(signal?: AbortSignal): Promise<QADocument> {
    const response = await fetch(`${this.endpoint}/document`, { cache: "no-store", ...(signal ? { signal } : {}) });
    if (!response.ok) throw await this.#error(response);
    const document = (await response.json()) as QADocument;
    this.revision = document.revision;
    return document;
  }

  async execute(command: QACommand, baseRevision: string): Promise<QADocument> {
    const response = await fetch(`${this.endpoint}/commands`, {
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
    let source: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    let delay = 500;
    let opened = false;

    const connect = () => {
      if (stopped) return;
      source = new EventSource(`${this.endpoint}/events`);
      source.addEventListener("document-changed", (event) => {
        try {
          const data = JSON.parse((event as MessageEvent<string>).data) as { revision?: string };
          if (data.revision && data.revision !== this.revision) onChange();
        } catch { /* Ignore malformed invalidations; reconnect still refetches. */ }
      });
      source.onopen = () => {
        this.onConnectionState?.(true);
        if (opened) onChange();
        opened = true;
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

  async #error(response: Response): Promise<QAStorageError> {
    let body: ErrorResponse = {};
    try {
      body = (await response.json()) as ErrorResponse;
    } catch {
      // Use the safe fallback below.
    }
    return new QAStorageError(
      body.error?.message ?? "Qraft could not complete the request.",
      body.error?.code ?? "request_failed",
      body.error?.retryable ?? response.status >= 500,
      body.document,
    );
  }
}
