import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpQAStorage } from "../../src/client/http-storage";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  readonly listeners = new Map<string, EventListener>();
  onerror: ((event: Event) => void) | null = null;
  onopen: ((event: Event) => void) | null = null;
  closed = false;

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: EventListener) {
    this.listeners.set(type, listener);
  }

  close() {
    this.closed = true;
  }

  open() {
    this.onopen?.(new Event("open"));
  }

  fail() {
    this.onerror?.(new Event("error"));
  }
}

afterEach(() => {
  FakeEventSource.instances = [];
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("HttpQAStorage events", () => {
  it("reconnects with backoff and refreshes once the replacement stream opens", () => {
    vi.useFakeTimers();
    vi.stubGlobal("EventSource", FakeEventSource);
    const states: boolean[] = [];
    const changed = vi.fn();
    const storage = new HttpQAStorage("/__test", (connected) => states.push(connected));

    const unsubscribe = storage.subscribe(changed);
    const first = FakeEventSource.instances[0]!;
    expect(first.url).toBe("/__test/events");
    first.open();
    expect(states).toEqual([true]);
    expect(changed).not.toHaveBeenCalled();

    first.fail();
    expect(first.closed).toBe(true);
    expect(states).toEqual([true, false]);
    vi.advanceTimersByTime(499);
    expect(FakeEventSource.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    const second = FakeEventSource.instances[1]!;
    second.open();
    expect(states).toEqual([true, false, true]);
    expect(changed).toHaveBeenCalledTimes(1);

    unsubscribe();
    expect(second.closed).toBe(true);
  });

  it("cancels a scheduled reconnect when the subscriber cleans up", () => {
    vi.useFakeTimers();
    vi.stubGlobal("EventSource", FakeEventSource);
    const unsubscribe = new HttpQAStorage().subscribe(vi.fn());
    FakeEventSource.instances[0]!.fail();
    unsubscribe();
    vi.advanceTimersByTime(20_000);
    expect(FakeEventSource.instances).toHaveLength(1);
  });
});

it("ignores malformed and already-confirmed revision events", async () => {
  vi.stubGlobal("EventSource", FakeEventSource);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ revision: "a".repeat(64), sections: [] }))));
  const storage = new HttpQAStorage();
  await storage.getDocument();
  const changed = vi.fn();
  const unsubscribe = storage.subscribe(changed);
  const listener = FakeEventSource.instances[0]!.listeners.get("document-changed")!;
  listener(new MessageEvent("document-changed", { data: "{" }));
  listener(new MessageEvent("document-changed", { data: JSON.stringify({ revision: "a".repeat(64) }) }));
  expect(changed).not.toHaveBeenCalled();
  listener(new MessageEvent("document-changed", { data: JSON.stringify({ revision: "b".repeat(64) }) }));
  expect(changed).toHaveBeenCalledTimes(1);
  unsubscribe();
});
