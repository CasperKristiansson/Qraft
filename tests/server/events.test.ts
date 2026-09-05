import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentEventHub } from "../../src/server/events";

const decode = (value: Uint8Array | undefined) => new TextDecoder().decode(value);
afterEach(() => vi.useRealTimers());

describe("DocumentEventHub", () => {
  it("sends heartbeats, coalesces revisions and recovers an unavailable revision", async () => {
    vi.useFakeTimers();
    const hub = new DocumentEventHub();
    const abort = new AbortController();
    const response = hub.stream(abort.signal);
    const reader = response.body!.getReader();
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(decode((await reader.read()).value)).toBe(": connected\n\n");
    vi.advanceTimersByTime(20_000);
    expect(decode((await reader.read()).value)).toBe(": heartbeat\n\n");
    hub.publish("one");
    hub.publish("one");
    hub.unavailable();
    hub.publish("one");
    expect(decode((await reader.read()).value)).toContain('"one"');
    expect(decode((await reader.read()).value)).toContain("document-unavailable");
    expect(decode((await reader.read()).value)).toContain('"one"');
    abort.abort();
    expect((await reader.read()).done).toBe(true);
    expect(hub.clientCount).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("bounds slow clients, stream count and cleans up every timer", async () => {
    vi.useFakeTimers();
    const hub = new DocumentEventHub();
    const responses = Array.from({ length: 32 }, () => hub.stream(new AbortController().signal));
    expect(hub.stream(new AbortController().signal).status).toBe(503);
    await responses[0]!.body!.cancel();
    expect(hub.clientCount).toBe(31);
    for (let i = 0; i < 70; i++) hub.publish(String(i));
    expect(hub.clientCount).toBe(0);
    const reader = hub.stream(new AbortController().signal).body!.getReader();
    await reader.read();
    hub.close();
    expect((await reader.read()).done).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
