import type { IncomingMessage, ServerResponse } from "node:http";

export class DocumentEventHub {
  readonly #streams = new Set<{ send: (value: string) => void; close: () => void }>();
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

  stream(signal: AbortSignal): Response {
    let dispose = (_closeController = true) => {};
    const body = new ReadableStream<Uint8Array>({
      start: (controller) => {
        const encoder = new TextEncoder();
        const client = {
          send: (value: string) => {
            // Bound queued output when a client stops reading.
            if ((controller.desiredSize ?? 0) < -64) {
              dispose();
              return;
            }
            controller.enqueue(encoder.encode(value));
          },
          close: () => dispose(),
        };
        const heartbeat = setInterval(() => client.send(": heartbeat\n\n"), 20_000);
        heartbeat.unref();
        let closed = false;
        dispose = (closeController = true) => {
          if (closed) return;
          closed = true;
          clearInterval(heartbeat);
          signal.removeEventListener("abort", abort);
          this.#streams.delete(client);
          if (closeController) controller.close();
        };
        const abort = () => dispose();
        this.#streams.add(client);
        client.send(": connected\n\n");
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) dispose();
      },
      cancel: () => dispose(false),
    });
    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  }

  publish(revision: string): void {
    if (revision === this.#lastRevision) return;
    this.#lastRevision = revision;
    const event = `event: document-changed\ndata: ${JSON.stringify({ revision })}\n\n`;
    for (const client of this.#clients) client.write(event);
    for (const client of this.#streams) client.send(event);
  }

  close(): void {
    for (const client of this.#streams) client.close();
    if (this.#heartbeat) clearInterval(this.#heartbeat);
    this.#heartbeat = null;
    for (const client of this.#clients) client.end();
    this.#clients.clear();
  }

  get clientCount(): number {
    return this.#clients.size + this.#streams.size;
  }

  #remove(response: ServerResponse): void {
    this.#clients.delete(response);
    if (this.#clients.size === 0 && this.#heartbeat) {
      clearInterval(this.#heartbeat);
      this.#heartbeat = null;
    }
  }
}
