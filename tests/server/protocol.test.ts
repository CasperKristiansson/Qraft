import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { build, createServer, preview, type PreviewServer, type ViteDevServer } from "vite";
import type { QACommand } from "../../src/domain/commands";
import type { QADocument } from "../../src/domain/model";
import { EMPTY_REVISION, sha256 } from "../../src/markdown/parse";
import { qraft } from "../../src/vite";

const directories: string[] = [];
const servers: Array<ViteDevServer | PreviewServer> = [];

async function fixtureRoot(source = "# QA\n") {
  const root = await mkdtemp(join(tmpdir(), "qraft-vite-"));
  directories.push(root);
  await writeFile(join(root, "index.html"), "<!doctype html><title>consumer</title>", "utf8");
  await writeFile(join(root, "QA.md"), source, "utf8");
  return root;
}

async function dev(root: string) {
  const server = await createServer({
    root,
    configFile: false,
    logLevel: "silent",
    plugins: [qraft()],
    server: { host: "127.0.0.1", port: 0, strictPort: false },
  });
  servers.push(server);
  await server.listen();
  const address = server.httpServer?.address() as AddressInfo;
  return { server, url: `http://127.0.0.1:${address.port}` };
}

async function command(url: string, request: { commandId: string; baseRevision: string; command: QACommand }) {
  return fetch(`${url}/__qraft/commands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("Qraft Vite protocol", () => {
  it("serves the exact document contract and applies a valid command", async () => {
    const source = "# QA\n";
    const { url } = await dev(await fixtureRoot(source));
    const response = await fetch(`${url}/__qraft/document`);
    const document = (await response.json()) as QADocument;
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("etag")).toBe(`"${sha256(source)}"`);
    const mutation = await command(url, {
      commandId: "one",
      baseRevision: document.revision,
      command: { type: "createSection", title: "Main" },
    });
    expect(mutation.status).toBe(200);
    expect(((await mutation.json()) as QADocument).sections[0]?.title).toBe("Main");
  });

  it("maps method, origin, media type, JSON, size, schema, missing target, and stale revision errors", async () => {
    const source = "# QA\n";
    const { url } = await dev(await fixtureRoot(source));
    expect((await fetch(`${url}/__qraft/document`, { method: "POST" })).status).toBe(405);
    expect((await fetch(`${url}/__qraft/document`, { headers: { Origin: "http://evil.invalid" } })).status).toBe(403);
    expect((await fetch(`${url}/__qraft/commands`, { method: "POST", body: "{}" })).status).toBe(415);
    expect(
      (
        await fetch(`${url}/__qraft/commands`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await fetch(`${url}/__qraft/commands`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ padding: "x".repeat(33 * 1024) }),
        })
      ).status,
    ).toBe(413);
    expect(
      (
        await command(url, {
          commandId: "invalid",
          baseRevision: sha256(source),
          command: { type: "createSection", title: "" },
        })
      ).status,
    ).toBe(400);
    const missing = await command(url, {
      commandId: "missing",
      baseRevision: sha256(source),
      command: { type: "setTaskChecked", taskId: "task_00000000-0000-4000-8000-000000000000", checked: true },
    });
    expect(missing.status).toBe(404);
    expect((await missing.json()) as object).toMatchObject({ revision: sha256(source) });
    const stale = await command(url, {
      commandId: "stale",
      baseRevision: EMPTY_REVISION,
      command: { type: "createSection", title: "Stale" },
    });
    expect(stale.status).toBe(409);
    expect((await stale.json()) as object).toMatchObject({ document: { revision: sha256(source) } });
  });

  it("deduplicates a successful command ID and conflicts on different reuse", async () => {
    const source = "# QA\n";
    const root = await fixtureRoot(source);
    const { url } = await dev(root);
    const request = {
      commandId: "same",
      baseRevision: sha256(source),
      command: { type: "createSection", title: "Once" } as QACommand,
    };
    const [first, concurrent] = await Promise.all([command(url, request), command(url, request)]);
    expect(concurrent.status).toBe(200);
    const firstDocument = (await first.json()) as QADocument;
    const retry = await command(url, request);
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual(firstDocument);
    const different = await command(url, { ...request, command: { type: "createSection", title: "Twice" } });
    expect(different.status).toBe(409);
    expect((await readFile(join(root, "QA.md"), "utf8")).match(/^## Once/gmu)).toHaveLength(1);
  });

  it("streams one coalesced store event and watcher add/change/unlink revisions", async () => {
    const source = "# QA\n";
    const root = await fixtureRoot(source);
    const { url } = await dev(root);
    const controller = new AbortController();
    const response = await fetch(`${url}/__qraft/events`, { signal: controller.signal });
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const readUntil = async (needle: string) => {
      let value = "";
      await Promise.race([
        (async () => {
          while (!value.includes(needle)) {
            const chunk = await reader.read();
            if (chunk.done) break;
            value += decoder.decode(chunk.value);
          }
        })(),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`SSE timeout: ${needle}`)), 5_000)),
      ]);
      return value;
    };
    expect(await readUntil(": connected")).toContain(": connected");
    const applied = await command(url, {
      commandId: "event",
      baseRevision: sha256(source),
      command: { type: "createSection", title: "Event" },
    });
    const changed = (await applied.json()) as QADocument;
    expect(await readUntil(changed.revision)).toContain(changed.revision);
    const external = "# External\n";
    await writeFile(join(root, "QA.md"), external, "utf8");
    expect(await readUntil(sha256(external))).toContain(sha256(external));
    await rm(join(root, "QA.md"));
    expect(await readUntil(EMPTY_REVISION)).toContain(EMPTY_REVISION);
    await writeFile(join(root, "QA.md"), source, "utf8");
    expect(await readUntil(sha256(source))).toContain(sha256(source));
    controller.abort();
  });

  it("rejects invalid or escaping plugin paths at startup", async () => {
    const root = await fixtureRoot();
    await expect(
      createServer({ root, configFile: false, logLevel: "silent", plugins: [qraft({ file: "QA.txt" })] }),
    ).rejects.toThrow(".md or .markdown");
    await expect(
      createServer({ root, configFile: false, logLevel: "silent", plugins: [qraft({ file: "../QA.md" })] }),
    ).rejects.toThrow("inside the Vite project root");
  });

  it("builds and previews without registering a Qraft endpoint", async () => {
    const root = await fixtureRoot();
    await build({ root, configFile: false, logLevel: "silent", plugins: [qraft()], build: { outDir: "dist" } });
    const server = await preview({
      root,
      configFile: false,
      logLevel: "silent",
      plugins: [qraft()],
      preview: { host: "127.0.0.1", port: 0, strictPort: false },
    });
    servers.push(server);
    const address = server.httpServer.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/__qraft/document`);
    expect(response.headers.get("content-type")).not.toContain("application/json");
    expect(await response.text()).not.toContain("revision");
  });
});
