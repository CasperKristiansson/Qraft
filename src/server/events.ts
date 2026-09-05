export class DocumentEventHub {
  readonly #streams = new Set<{ send: (value: string) => void; close: () => void }>();
  #lastRevision: string | null = null;

  stream(signal: AbortSignal): Response {
    if (this.#streams.size >= 32) {
      return new Response(
        JSON.stringify({
          error: {
            code: "stream_limit",
            message: "Close an unused review tab and retry.",
            retryable: true,
          },
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        },
      );
    }
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
    for (const client of this.#streams) client.send(event);
  }

  unavailable(): void {
    this.#lastRevision = null;
    const event = "event: document-unavailable\ndata: {}\n\n";
    for (const client of this.#streams) client.send(event);
  }

  close(): void {
    for (const client of this.#streams) client.close();
  }

  get clientCount(): number {
    return this.#streams.size;
  }
}
