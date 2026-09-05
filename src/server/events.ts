import type { IncomingMessage, ServerResponse } from "node:http";

export class DocumentEventHub {
  readonly #clients = new Set<ServerResponse>();
  #heartbeat: NodeJS.Timeout | null = null;
  #lastRevision: string | null = null;

  connect(request: IncomingMessage, response: ServerResponse): void {
    response.statusCode = 200;
    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders();
    response.write(": connected\n\n");
    this.#clients.add(response);
    if (!this.#heartbeat) {
      this.#heartbeat = setInterval(() => {
        for (const client of this.#clients) client.write(": heartbeat\n\n");
      }, 20_000);
      this.#heartbeat.unref();
    }
    request.once("close", () => this.#remove(response));
  }

  publish(revision: string): void {
    if (revision === this.#lastRevision) return;
    this.#lastRevision = revision;
    const event = `event: document-changed\ndata: ${JSON.stringify({ revision })}\n\n`;
    for (const client of this.#clients) client.write(event);
  }

  close(): void {
    if (this.#heartbeat) clearInterval(this.#heartbeat);
    this.#heartbeat = null;
    for (const client of this.#clients) client.end();
    this.#clients.clear();
  }

  get clientCount(): number {
    return this.#clients.size;
  }

  #remove(response: ServerResponse): void {
    this.#clients.delete(response);
    if (this.#clients.size === 0 && this.#heartbeat) {
      clearInterval(this.#heartbeat);
      this.#heartbeat = null;
    }
  }
}
