import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, firefox, webkit, expect } from "@playwright/test";
import { createS3Fixture } from "./s3-fixture.mjs";
import { sourceFingerprint } from "./source-fingerprint.mjs";

const registry = process.argv.includes("--registry");
const keep = process.argv.includes("--serve");
const source = await sourceFingerprint(process.cwd());
const consumer = await mkdtemp(join(tmpdir(), "qraft-shared-consumer-"));
const version = JSON.parse(await readFile("package.json", "utf8")).version;
function run(command, args, cwd = consumer) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", timeout: 180_000 });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
run(
  registry ? "npm" : "corepack",
  registry
    ? [
        "pack",
        `@qraft-dev/qa@${version}`,
        "--min-release-age=0",
        "--registry=https://registry.npmjs.org/",
        "--pack-destination",
        consumer,
      ]
    : ["pnpm", "pack", "--pack-destination", consumer],
  process.cwd(),
);
const archive = join(
  consumer,
  (await readdir(consumer)).find((name) => name.endsWith(".tgz")),
);
await writeFile(
  join(consumer, "package.json"),
  JSON.stringify({
    name: "qraft-shared-consumer",
    private: true,
    type: "module",
    packageManager: "pnpm@11.25.0",
    dependencies: {
      "@qraft-dev/qa": registry ? version : `file:${archive}`,
      react: "19.2.8",
      "react-dom": "19.2.8",
      vite: "8.2.2",
      "@vitejs/plugin-react": "6.1.1",
      "@aws-sdk/client-s3": "3.984.0",
    },
  }),
);
await writeFile(
  join(consumer, "pnpm-workspace.yaml"),
  `packages: ["."]\nautoInstallPeers: false\nminimumReleaseAgeExclude: ["@qraft-dev/qa@${version}", "lucide-react@1.41.0", "zod@4.5.4"]\n`,
);
await writeFile(
  join(consumer, "index.html"),
  '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Qraft shared review</title></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>',
);
await writeFile(
  join(consumer, "vite.config.ts"),
  'import {defineConfig} from "vite";import react from "@vitejs/plugin-react";export default defineConfig({plugins:[react()]});',
);
await writeFile(
  join(consumer, "main.tsx"),
  `import {useState} from "react";import {createRoot} from "react-dom/client";import {QA} from "@qraft-dev/qa";
function App(){const [session,setSession]=useState(null);return <><main style={{fontFamily:"system-ui",padding:40}}><p>PRIVATE QA · PACKED PRODUCTION BUILD</p><h1>Shared review workspace</h1><p>This loopback-only fixture uses persistent Markdown and independent browser sessions.</p><button onClick={async()=>{await fetch('/fixture/login',{method:'POST'});setSession('reviewer-1')}}>Enter review</button><button onClick={()=>setSession('reviewer-2')}>Switch session</button><button onClick={()=>setSession(null)}>Hide review</button></main>{session?<QA backend={{endpoint:'/api/qa',sessionKey:session,pollIntervalMs:1000}}/>:null}</>};createRoot(document.getElementById('root')).render(<App/>);`,
);
run("corepack", ["pnpm", "install"]);
run("corepack", ["pnpm", "exec", "vite", "build"]);
const { createQraftBackend, createQraftLambdaHandler, nodeMiddleware } = await import(
  pathToFileURL(join(consumer, "node_modules/@qraft-dev/qa/dist/backend.js")).href
);
const { createS3Storage } = await import(
  pathToFileURL(join(consumer, "node_modules/@qraft-dev/qa/dist/s3.js")).href
);
const s3 = await createS3Fixture();
// Explicit synthetic credentials and loopback endpoint; never use a developer AWS account.
process.env.AWS_ACCESS_KEY_ID = "qraft-fixture";
process.env.AWS_SECRET_ACCESS_KEY = "qraft-fixture";
delete process.env.AWS_SESSION_TOKEN;
process.env.AWS_ENDPOINT_URL_S3 = s3.endpoint;
const seed =
  "# Shared review\n\n## Email <!-- qraft:id=section_11111111-1111-4111-8111-111111111111 -->\n\n- [ ] Send email <!-- qraft:id=task_22222222-2222-4222-8222-222222222222 -->\n  Send one message and verify recipient delivery.\n";
for (const name of ["01-email.md", "02-folders.md"])
  s3.set(
    name,
    seed.replaceAll("Send email", name.startsWith("02") ? "Create folder" : "Send email"),
  );
let authorized = true;
let backend;
let middleware;
let origin;
const assets = new Map([
  ["/", { type: "text/html", body: await readFile(join(consumer, "dist/index.html")) }],
]);
for (const name of await readdir(join(consumer, "dist/assets")))
  assets.set(`/assets/${name}`, {
    type: name.endsWith(".js")
      ? "text/javascript"
      : name.endsWith(".css")
        ? "text/css"
        : "image/png",
    body: await readFile(join(consumer, "dist/assets", name)),
  });
const server = createServer((request, response) => {
  if (
    request.url === "/fixture/login" &&
    request.method === "POST" &&
    request.headers.origin === origin
  ) {
    response.setHeader("Set-Cookie", "qa_fixture=reviewer; HttpOnly; SameSite=Strict; Path=/");
    response.end("ok");
    return;
  }
  if (request.url?.startsWith("/api/qa/")) {
    void middleware(request, response, () => {
      response.statusCode = 500;
      response.end();
    });
    return;
  }
  const asset = assets.get(request.url);
  if (asset) {
    response.setHeader("Content-Type", asset.type);
    response.end(asset.body);
  } else {
    response.statusCode = 404;
    response.end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
origin = `http://127.0.0.1:${server.address().port}`;
function mount() {
  backend = createQraftBackend({
    storage: createS3Storage({
      bucket: "qraft-fixture",
      prefix: "launch/",
      region: "eu-north-1",
      projectId: "packed-launch",
    }),
    projectId: "packed-launch",
    origin,
    endpoint: "/api/qa",
    authorize: (request) =>
      authorized && request.headers.get("cookie")?.includes("qa_fixture=reviewer") === true,
  });
  const lambda = createQraftLambdaHandler(backend);
  middleware = nodeMiddleware(async (request) => {
    const url = new URL(request.url);
    const result = await lambda({
      version: "2.0",
      rawPath: url.pathname,
      rawQueryString: url.search.slice(1),
      headers: Object.fromEntries([...request.headers].filter(([name]) => name !== "cookie")),
      cookies: request.headers.get("cookie")?.split("; "),
      requestContext: { domainName: url.host, http: { method: request.method } },
      ...(!["GET", "HEAD"].includes(request.method)
        ? {
            body: Buffer.from(await request.arrayBuffer()).toString("base64"),
            isBase64Encoded: true,
          }
        : {}),
    });
    return new Response(result.body, { status: result.statusCode, headers: result.headers });
  });
}
mount();
const evidence = [];
try {
  for (const [name, launcher] of Object.entries({ chromium, firefox, webkit })) {
    authorized = true;
    s3.set("01-email.md", seed);
    const browser = await launcher.launch();
    try {
      const first = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const second = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const a = await first.newPage();
      const b = await second.newPage();
      for (const page of [a, b]) {
        await page.goto(origin);
        await page.getByRole("button", { name: "Enter review", exact: true }).click();
        await page.getByRole("button", { name: /Open Qraft/ }).click();
        await page.getByRole("button", { name: "01-email.md", exact: true }).click();
        await page.locator(".qraft-task").filter({ hasText: "Send email" }).click();
      }
      const note = a.getByRole("textbox", { name: "Write a note", exact: true });
      await note.fill(`Shared ${name} note`);
      await note.press("Enter");
      await expect(b.getByText(`Shared ${name} note`, { exact: true })).toBeVisible();
      await a
        .getByRole("button", { name: "Send email: Not completed. Change status", exact: true })
        .click();
      await expect(
        b.getByRole("button", { name: "Send email: Completed. Change status", exact: true }),
      ).toBeVisible();

      await note.fill("Unsaved draft retained");
      const bNote = b.getByRole("textbox", { name: "Write a note", exact: true });
      await bNote.fill(`Second ${name} reviewer`);
      await bNote.press("Enter");
      await expect(a.getByText(`Second ${name} reviewer`, { exact: true })).toBeVisible();
      await expect(note).toHaveValue("Unsaved draft retained");
      await a.getByRole("button", { name: "Back to checklist", exact: true }).click();
      await a.getByRole("button", { name: "Change file", exact: true }).click();
      await a.getByRole("button", { name: "02-folders.md", exact: true }).click();
      await expect(a.locator(".qraft-task").filter({ hasText: "Create folder" })).toBeVisible();
      await a.getByRole("button", { name: "Change file", exact: true }).click();
      await a.getByRole("button", { name: "01-email.md", exact: true }).click();
      await a.locator(".qraft-task").filter({ hasText: "Send email" }).click();
      await expect(note).toHaveValue("Unsaved draft retained");
      await backend.dispose();
      mount();
      await expect(a.getByText(`Shared ${name} note`, { exact: true })).toBeVisible();
      await bNote.fill(`Restart ${name} note`);
      await bNote.press("Enter");
      await expect(a.getByText(`Restart ${name} note`, { exact: true })).toBeVisible();
      await a.setViewportSize({ width: 390, height: 844 });
      await expect(note).toBeVisible();
      await a.screenshot({ path: join(consumer, `${name}-shared-mobile.png`) });
      // Switch the host session while its old draft exists; it must not reappear.
      await a.setViewportSize({ width: 1440, height: 900 });
      await a.getByRole("button", { name: "Close Qraft", exact: true }).click();
      await a.getByRole("button", { name: "Switch session", exact: true }).click();
      await a.getByRole("button", { name: /Open Qraft/ }).click();
      await a.locator(".qraft-task").filter({ hasText: "Send email" }).click();
      await expect(a.getByRole("textbox", { name: "Write a note", exact: true })).toHaveValue("");
      authorized = false;
      await expect(b.getByText(`Shared ${name} note`, { exact: true })).not.toBeVisible({
        timeout: 6000,
      });
      await expect(b.getByText(/Your session cannot access this review/)).toBeVisible();
      assert.match(s3.read("01-email.md"), new RegExp(`Restart ${name} note`));
      evidence.push({
        browser: name,
        result: "passed",
        viewports: ["1440x900", "390x844"],
        journeys: [
          "two-session shared notes and status",
          "file switching and retained draft",
          "stateless Lambda restart with S3 persistence",
          "session replacement isolation",
          "revocation",
        ],
      });
    } finally {
      await browser.close();
    }
  }
  authorized = true;
  const digest = createHash("sha256")
    .update(await readFile(archive))
    .digest("hex");
  await mkdir("artifacts/release", { recursive: true });
  const receipt = {
    consumer,
    archive,
    digest,
    sourceFingerprint: source.fingerprint,
    storage: "AWS SDK against local S3 protocol fixture; Lambda HTTP v2 bridge",
    conditionalWrites: s3.writes(),
    distribution: registry ? "npm" : "archive",
    url: origin,
    runtime: process.version,
    evidence,
  };
  await writeFile(
    `artifacts/release/shared-consumer${registry ? "-registry" : ""}.json`,
    JSON.stringify(receipt, null, 2) + "\n",
  );
  console.log(JSON.stringify(receipt, null, 2));
  if (keep) {
    console.log(`READY ${origin}`);
    await new Promise((resolve) => {
      process.once("SIGINT", resolve);
      process.once("SIGTERM", resolve);
    });
  }
} finally {
  await backend.dispose();
  await s3.close();
  await new Promise((resolve) => server.close(resolve));
}
