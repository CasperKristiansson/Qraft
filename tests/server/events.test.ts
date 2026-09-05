import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentEventHub } from "../../src/server/events";

class ResponseDouble {
  statusCode = 0;
  readonly headers = new Map<string, string>();
  readonly writes: string[] = [];
  ended = false;

  setHeader(name: string, value: string) {
    this.headers.set(name.toLowerCase(), value);
  }

  flushHeaders() {}

  write(value: string) {
    this.writes.push(value);
    return true;
  }

  end() {
    this.ended = true;
  }
}

afterEach(() => vi.useRealTimers());

describe("DocumentEventHub", () => {
  it("connects, emits heartbeats, coalesces revisions, and removes a closed client", () => {
    vi.useFakeTimers();
    const request = new EventEmitter() as IncomingMessage;
    const response = new ResponseDouble();
    const hub = new DocumentEventHub();

    hub.connect(request, response as unknown as ServerResponse);
    expect(response.statusCode).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(response.writes).toEqual([": connected\n\n"]);
    expect(hub.clientCount).toBe(1);

    vi.advanceTimersByTime(20_000);
    expect(response.writes.at(-1)).toBe(": heartbeat\n\n");
    hub.publish("revision-one");
    hub.publish("revision-one");
    expect(response.writes.filter((value) => value.includes("revision-one"))).toHaveLength(1);

    request.emit("close");
    expect(hub.clientCount).toBe(0);
    const count = response.writes.length;
    vi.advanceTimersByTime(40_000);
    expect(response.writes).toHaveLength(count);
  });

  it("ends every response and clears clients during plugin cleanup", () => {
    vi.useFakeTimers();
    const hub = new DocumentEventHub();
    const first = new ResponseDouble();
    const second = new ResponseDouble();
    hub.connect(new EventEmitter() as IncomingMessage, first as unknown as ServerResponse);
    hub.connect(new EventEmitter() as IncomingMessage, second as unknown as ServerResponse);

    hub.close();
    expect(hub.clientCount).toBe(0);
    expect(first.ended).toBe(true);
    expect(second.ended).toBe(true);
    vi.advanceTimersByTime(40_000);
    expect(first.writes).toEqual([": connected\n\n"]);
    expect(second.writes).toEqual([": connected\n\n"]);
  });
});
