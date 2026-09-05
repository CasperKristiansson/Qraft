import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createQraftRoute } from "../../src/next";

const origin = "http://localhost:3000";
let root: string;
let routes: ReturnType<typeof createQraftRoute>[];
function route(options = {}) {
  const value = createQraftRoute({ root, ...options });
  routes.push(value);
  return value;
}
function request(path: string, init?: RequestInit) {
  return new Request(`${origin}/__qraft/${path}`, init);
}
async function selected(api: ReturnType<typeof route>) {
  const response = await api.GET(request("files"));
  const catalog = await response.json();
  return `files/${catalog.files[0].id}`;
}
async function command(api: ReturnType<typeof route>, path: string, body: unknown) {
  return api.POST(
    request(`${path}/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(async () => {
  vi.stubEnv("NODE_ENV", "development");
  root = await mkdtemp(join(tmpdir(), "qraft-next-test-"));
  routes = [];
  await writeFile(
    join(root, "QA.md"),
    "# Review\n\n<!-- preserve -->\n\n## Inbox\n\n- [ ] Read a message\n",
  );
});
afterEach(async () => {
  await Promise.all(routes.map((value) => value.dispose()));
  vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});

describe("Next.js route adapter", () => {
  it("fails closed in production before accessing invalid configuration or bodies", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const api = route({ root: "/does-not-exist" });
    expect((await api.GET(request("files"))).status).toBe(404);
    expect((await api.POST(request("commands", { method: "POST", body: "bad" }))).status).toBe(404);
  });

  it("discovers without writes, saves once across hot reload, and preserves unknown Markdown", async () => {
    const api = route();
    const before = await readFile(join(root, "QA.md"), "utf8");
    const path = await selected(api);
    expect(await readFile(join(root, "QA.md"), "utf8")).toBe(before);
    const document = await (await api.GET(request(`${path}/document`))).json();
    const body = {
      commandId: "next-command",
      baseRevision: document.revision,
      command: { type: "addNote", taskId: document.sections[0].tasks[0].id, body: "Next.js note" },
    };
    expect((await command(api, path, body)).status).toBe(200);
    const refreshed = route();
    expect((await command(refreshed, path, body)).status).toBe(200);
    const text = await readFile(join(root, "QA.md"), "utf8");
    expect(text).toContain("<!-- preserve -->");
    expect(text.match(/Note: Next.js note/gu)).toHaveLength(1);
  });

  it("rejects stale writes with the latest document", async () => {
    const api = route();
    const path = await selected(api);
    const document = await (await api.GET(request(`${path}/document`))).json();
    const changed = "# External\n\n## Inbox\n\n- [ ] External task\n";
    await writeFile(join(root, "QA.md"), changed);
    const response = await command(api, path, {
      commandId: "stale",
      baseRevision: document.revision,
      command: { type: "createSection", title: "Never saved" },
    });
    expect(response.status).toBe(409);
    expect((await response.json()).document.title).toBe("External");
    expect(await readFile(join(root, "QA.md"), "utf8")).toBe(changed);
  });

  it("rejects cross-origin, wrong methods, invalid types and oversized bodies", async () => {
    const api = route();
    const path = await selected(api);
    expect(
      (
        await api.GET(
          request("files", {
            headers: { Origin: "https://evil.example", "x-forwarded-host": "evil.example" },
          }),
        )
      ).status,
    ).toBe(403);
    expect((await api.POST(request("files", { method: "POST" }))).status).toBe(405);
    expect(
      (await api.POST(request(`${path}/commands`, { method: "POST", body: "bad" }))).status,
    ).toBe(415);
    expect(
      (
        await api.POST(
          request(`${path}/commands`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "x".repeat(33 * 1024),
          }),
        )
      ).status,
    ).toBe(413);
    expect(
      (
        await api.POST(
          request(`${path}/commands`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "bad",
          }),
        )
      ).status,
    ).toBe(400);
  });

  it("streams external changes and closes streams on abort and disposal", async () => {
    const api = route();
    const path = await selected(api);
    const abort = new AbortController();
    const response = await api.GET(request(`${path}/events`, { signal: abort.signal }));
    const reader = response.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain(": connected");
    await writeFile(join(root, "QA.md"), "# Changed\n");
    const next = reader.read();
    const result = await Promise.race([
      next,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Watcher did not notify")), 4000).unref(),
      ),
    ]);
    expect(new TextDecoder().decode(result.value)).toContain("document-changed");
    abort.abort();
    expect((await reader.read()).done).toBe(true);
    const second = await api.GET(request(`${path}/events`));
    const secondReader = second.body!.getReader();
    await secondReader.read();
    await api.dispose();
    expect((await secondReader.read()).done).toBe(true);
  });

  it("allows only the configured gateway origin without trusting forwarded headers", async () => {
    const api = route({ origin: "http://localhost:3060" });
    const gatewayRequest = (origin: string) =>
      request("files", {
        headers: { Origin: origin, Host: "localhost:3062", "x-forwarded-host": "localhost:3060" },
      });
    expect((await api.GET(gatewayRequest("http://localhost:3060"))).status).toBe(200);
    expect((await api.GET(gatewayRequest("https://evil.example"))).status).toBe(403);
    const direct = route();
    expect((await direct.GET(gatewayRequest("http://localhost:3060"))).status).toBe(403);
  });

  it("cleans up when the response body is cancelled directly", async () => {
    const api = route();
    const path = await selected(api);
    const response = await api.GET(request(`${path}/events`));
    await expect(response.body!.cancel()).resolves.toBeUndefined();
    await api.dispose();
  });

  it("revalidates selected paths against symlink replacement", async () => {
    const api = route();
    const path = await selected(api);
    await rm(join(root, "QA.md"));
    await symlink("/etc/hosts", join(root, "QA.md"));
    expect((await api.GET(request(`${path}/document`))).status).toBe(500);
    expect((await api.GET(request(`files/${"a".repeat(64)}/document`))).status).toBe(404);
  });
});
