import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { requestOrigin } from "./origin";

export type RequestHandler = (request: Request) => Promise<Response | undefined>;

/** The only Node HTTP/Web Streams bridge. Server business rules use Web APIs. */
export function nodeMiddleware(handle: RequestHandler) {
  return async (
    incoming: IncomingMessage,
    outgoing: ServerResponse,
    next: (error?: unknown) => void,
  ): Promise<void> => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    outgoing.once("close", abort);
    try {
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
        else if (value !== undefined) headers.set(name, value);
      }
      const init: RequestInit & { duplex?: "half" } = {
        method: incoming.method ?? "GET",
        headers,
        signal: controller.signal,
      };
      if (init.method !== "GET" && init.method !== "HEAD") {
        init.body = Readable.toWeb(incoming) as ReadableStream<Uint8Array>;
        init.duplex = "half";
      }
      const request = new Request(
        new URL(incoming.url ?? "/", requestOrigin(incoming) ?? "http://localhost"),
        init,
      );
      const result = await handle(request);
      if (!result) {
        next();
        return;
      }
      outgoing.statusCode = result.status;
      result.headers.forEach((value, name) => outgoing.setHeader(name, value));
      outgoing.flushHeaders();
      if (result.body)
        await pipeline(
          Readable.fromWeb(result.body as import("node:stream/web").ReadableStream),
          outgoing,
        );
      else outgoing.end();
    } catch (error) {
      if (!controller.signal.aborted) next(error);
    } finally {
      outgoing.off("close", abort);
    }
  };
}
