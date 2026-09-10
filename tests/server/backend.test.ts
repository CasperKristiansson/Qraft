import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, it, vi } from "vitest";
import { createQraftBackend } from "../../src/backend";
import type { QAFileCatalog } from "../../src/client/storage";
import type { QADocument } from "../../src/domain/model";

const roots: string[] = [];
const services: ReturnType<typeof createQraftBackend>[] = [];
const origin = "https://review.example.test";
const endpoint = "/api/qa";
const seed =
  "# Review\r\n\r\n- [ ] Send email <!-- qraft:id=task_11111111-1111-4111-8111-111111111111 -->\r\n\r\n<!-- preserve this -->\r\n";
const taskId = "task_11111111-1111-4111-8111-111111111111";
const command = { type: "setTaskStatus", taskId, status: "completed" };
function request(
  path: string,
  body?: unknown,
  allowed = true,
  browserOrigin: string | null = origin,
) {
  const headers = new Headers(allowed ? { cookie: "session=test" } : {});
  if (browserOrigin) headers.set("origin", browserOrigin);
  if (body) headers.set("content-type", "application/json");
  return new Request(`${origin}${endpoint}/${path}`, {
    method: body ? "POST" : "GET",
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function setup() {
  const root = await mkdtemp(join(tmpdir(), "qraft-backend-"));
  roots.push(root);
  await writeFile(join(root, "01-mail.md"), seed);
  await writeFile(join(root, "02-folders.md"), "# Folders\n- [ ] Create folder\n");
  let allowed = true;
  const authorize = vi.fn(
    (req: Request) => allowed && req.headers.get("cookie") === "session=test",
  );
  const options = { root, projectId: "launch-1", endpoint, origin, authorize };
  const backend = createQraftBackend(options);
  services.push(backend);
  const response = await backend.handle(request("files"));
  expect(response.status).toBe(200);
  const catalog = (await response.json()) as QAFileCatalog;
  const filePath = `files/${catalog.files[0]!.id}`;
  const document = (await (
    await backend.handle(request(`${filePath}/document`))
  ).json()) as QADocument;
  return {
    root,
    backend,
    options,
    catalog,
    filePath,
    document,
    revoke: () => {
      allowed = false;
    },
  };
}
afterEach(async () => {
  for (const service of services.splice(0)) await service.dispose();
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

it("requires host authorization before any filesystem discovery, including production", async () => {
  const authorize = vi.fn(() => false);
  const backend = createQraftBackend({
    root: "/nonexistent/private",
    projectId: "launch",
    origin,
    endpoint,
    authorize,
  });
  services.push(backend);
  expect((await backend.handle(request("files"))).status).toBe(403);
  expect(authorize).toHaveBeenCalledOnce();
  expect(
    (await backend.handle(request("files", undefined, true, "https://evil.example"))).status,
  ).toBe(403);
  expect(authorize).toHaveBeenCalledOnce();
  expect((await backend.handle(request("files/../private"))).status).toBe(404);
});

it("serializes competing testers, returns a conflict, and preserves exact Markdown bytes", async () => {
  const { backend, filePath, document, root } = await setup();
  const results = await Promise.all(
    ["first", "second"].map((commandId) =>
      backend.handle(
        request(`${filePath}/commands`, { commandId, baseRevision: document.revision, command }),
      ),
    ),
  );
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(await readFile(join(root, "01-mail.md"), "utf8")).toBe(seed.replace("- [ ]", "- [x]"));
  expect(await readFile(join(root, "02-folders.md"), "utf8")).toBe(
    "# Folders\n- [ ] Create folder\n",
  );
  expect((await results.find((r) => r.status === 409)!.json()).document.revision).not.toBe(
    document.revision,
  );
});

it("retains stable IDs and committed results across restart without catalog priming", async () => {
  const { backend, options, filePath, document, catalog } = await setup();
  const body = { commandId: "saved", baseRevision: document.revision, command };
  expect((await backend.handle(request(`${filePath}/commands`, body))).status).toBe(200);
  await backend.dispose();
  const restarted = createQraftBackend(options);
  services.push(restarted);
  const after = await restarted.handle(request(`${filePath}/document`));
  expect(after.status).toBe(200);
  expect((await after.json()).sections[0].tasks[0].status).toBe("completed");
  expect((await restarted.handle(request(`${filePath}/commands`, body))).status).toBe(409);
  expect(await (await restarted.handle(request("files"))).json()).toEqual(catalog);
});

it("rechecks membership for reads and writes and rejects missing or cross-site mutation origins", async () => {
  const { backend, filePath, document, root, revoke } = await setup();
  const body = { commandId: "revoke", baseRevision: document.revision, command };
  expect((await backend.handle(request(`${filePath}/commands`, body, true, null))).status).toBe(
    403,
  );
  const crossSite = request(`${filePath}/commands`, body);
  crossSite.headers.set("sec-fetch-site", "cross-site");
  expect((await backend.handle(crossSite)).status).toBe(403);
  revoke();
  for (const path of ["files", `${filePath}/document`])
    expect((await backend.handle(request(path))).status).toBe(403);
  expect((await backend.handle(request(`${filePath}/commands`, body))).status).toBe(403);
  expect(await readFile(join(root, "01-mail.md"), "utf8")).toBe(seed);
});

it("does not expose streams, replacement bodies, paths, symlinks or authorization errors", async () => {
  const { backend, options, filePath, document, root } = await setup();
  expect((await backend.handle(request(`${filePath}/events`))).status).toBe(404);
  expect(
    (
      await backend.handle(
        request(`${filePath}/commands`, {
          commandId: "replace",
          baseRevision: document.revision,
          command: { type: "replaceDocument", body: "bad" },
        }),
      )
    ).status,
  ).toBe(400);
  await mkdir(join(root, "hidden"));
  await symlink("/etc/passwd", join(root, "escape.md"));
  const listing = await (await backend.handle(request("files"))).json();
  expect(JSON.stringify(listing)).not.toContain(root);
  expect(JSON.stringify(listing)).not.toContain("escape.md");
  const unavailable = createQraftBackend({
    ...options,
    authorize() {
      throw new Error("secret credentials");
    },
  });
  services.push(unavailable);
  const response = await unavailable.handle(request("files"));
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("secret");
});

it("deduplicates exact replay and rejects changed-payload reuse", async () => {
  const { backend, filePath, document } = await setup();
  const body = { commandId: "repeat", baseRevision: document.revision, command };
  const first = await (await backend.handle(request(`${filePath}/commands`, body))).json();
  expect(await (await backend.handle(request(`${filePath}/commands`, body))).json()).toEqual(first);
  expect(
    (
      await backend.handle(
        request(`${filePath}/commands`, { ...body, command: { ...command, status: "skipped" } }),
      )
    ).status,
  ).toBe(409);
});

it("rejects network-path endpoints instead of treating them as same-origin routes", () => {
  for (const endpoint of ["//other-host", "/api//qa", "/api/qa?scope=other"])
    expect(() =>
      createQraftBackend({
        root: "/unused",
        projectId: "launch",
        endpoint,
        origin,
        authorize: () => false,
      }),
    ).toThrow("absolute route path");
});
