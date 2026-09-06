import { verifyRemoval } from "./verify-removal.mjs";
import { verifyPackagedGuide } from "./verify-packaged-guide.mjs";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sourceFingerprint } from "./source-fingerprint.mjs";

const registry = process.argv.includes("--registry");
const maintenance = process.argv.includes("--maintenance");
const profile = maintenance ? "maintenance" : "current";
const source = await sourceFingerprint();
const root = await mkdtemp(join(tmpdir(), "qraft-next-consumer-"));
function run(args, cwd = root) {
  const result = spawnSync("corepack", ["pnpm", ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`pnpm ${args.join(" ")} failed`);
}
const packageVersion = JSON.parse(await readFile("package.json", "utf8")).version;
const packageSpec = `@qraft-dev/qa@${packageVersion}`;
if (registry) {
  const result = spawnSync(
    "npm",
    ["pack", packageSpec, "--registry=https://registry.npmjs.org/", "--pack-destination", root],
    { encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error(result.stderr);
} else run(["pack", "--pack-destination", root], process.cwd());
const archive = join(
  root,
  (await readdir(root)).find((name) => name.endsWith(".tgz")),
);
await cp("examples/next-app", root, { recursive: true });
await writeFile(
  join(root, "QA.md"),
  "# Next.js QA\n\n<!-- preserve consumer bytes -->\n\n## Review\n\n- [ ] Inspect quantity\n",
);
await writeFile(
  join(root, "package.json"),
  JSON.stringify(
    {
      name: "qraft-next-consumer",
      private: true,
      type: "module",
      packageManager: "pnpm@11.25.0",
      dependencies: {
        "@qraft-dev/qa": registry ? packageVersion : `file:${archive}`,
        next: maintenance ? "15.5.25" : "16.3.3",
        react: "19.2.8",
        "react-dom": "19.2.8",
      },
      devDependencies: {
        typescript: "6.0.3",
        "@types/node": "24.13.3",
        "@types/react": "19.2.18",
        "@types/react-dom": "19.2.7",
      },
    },
    null,
    2,
  ),
);
await writeFile(
  join(root, "pnpm-workspace.yaml"),
  `packages: ["."]\nautoInstallPeers: false\nminimumReleaseAgeExclude: ${JSON.stringify([
    packageSpec,
    "lucide-react@1.41.0",
    "zod@4.5.4",
    "@types/react-dom@19.2.7",
    ...(maintenance
      ? [
          "next@15.5.25",
          "@next/env@15.5.25",
          ...[
            "darwin-arm64",
            "darwin-x64",
            "linux-arm64-gnu",
            "linux-arm64-musl",
            "linux-x64-gnu",
            "linux-x64-musl",
            "win32-arm64-msvc",
            "win32-x64-msvc",
          ].map((platform) => `@next/swc-${platform}@15.5.25`),
        ]
      : []),
  ])}\n`,
);
run(["install"]);
run(["exec", "qraft", "doctor"]);
run(["exec", "qraft", "setup"]);
const guide = await verifyPackagedGuide(root);
const results = [];
async function exercise(mode, port) {
  const child = spawn(
    "corepack",
    ["pnpm", "exec", "next", mode, "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: root,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  child.stdout.on("data", (data) => {
    output += data;
  });
  child.stderr.on("data", (data) => {
    output += data;
  });
  const url = `http://127.0.0.1:${port}/review`;
  try {
    // Healthy startup is normally under 15 s; fail after 60 s.
    let ready = false;
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(output);
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        if (response.status >= 500) throw new Error(`Application failed during startup: ${output}`);
        ready = response.ok;
      } catch (error) {
        if (error.message?.startsWith("Application failed")) throw error;
      }
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (!ready) throw new Error(`Next.js startup exceeded 60 s: ${output}`);
    if (mode === "dev") {
      const catalog = await (await fetch(`${url}/api/qraft/files`)).json();
      const endpoint = `${url}/api/qraft/files/${catalog.files[0].id}`;
      const document = await (await fetch(`${endpoint}/document`)).json();
      const response = await fetch(`${endpoint}/commands`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: new URL(url).origin },
        body: JSON.stringify({
          commandId: "packed-next-note",
          baseRevision: document.revision,
          command: {
            type: "addNote",
            taskId: document.sections[0].tasks[0].id,
            body: "Packed Next.js consumer works",
          },
        }),
      });
      if (!response.ok) throw new Error(`Next write failed: ${await response.text()}`);
      const bytes = await readFile(join(root, "QA.md"), "utf8");
      if (
        !bytes.includes("<!-- preserve consumer bytes -->") ||
        !bytes.includes("Note: Packed Next.js consumer works")
      )
        throw new Error("Next write did not preserve expected Markdown");
      results.push({ mode, url, catalog: true, mutation: true, preservation: true });
    } else {
      for (const suffix of [
        "files",
        "document",
        "events",
        "commands",
        `files/${"a".repeat(64)}/document`,
      ]) {
        const response = await fetch(`${url}/api/qraft/${suffix}`, {
          method: suffix === "commands" ? "POST" : "GET",
          signal: AbortSignal.timeout(5000),
        });
        if (response.status !== 404)
          throw new Error(`Production exposes ${suffix}: ${response.status}`);
      }
      const html = await (await fetch(url)).text();
      if (html.includes("data-qraft-root")) throw new Error("Production mounts Qraft");
      const chunks = join(root, ".next/static/chunks");
      for (const file of await readdir(chunks, { recursive: true })) {
        if (!file.endsWith(".js")) continue;
        const javascript = await readFile(join(chunks, file), "utf8");
        if (/data-qraft-root|qraft:tab-position/u.test(javascript)) {
          throw new Error(`Production includes Qraft client code: ${file}`);
        }
      }
      results.push({ mode, url, absentEndpoints: 5, clientCodeExcluded: true });
    }
  } finally {
    child.kill("SIGTERM");
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]);
    if (child.exitCode === null) child.kill("SIGKILL");
    await writeFile(join(root, `${mode}.log`), output);
  }
}
await exercise("dev", 4194);
run(["exec", "next", "build", ...(maintenance ? [] : ["--webpack"])]);
await exercise("start", 4195);
const removal = await verifyRemoval(root, "next", run);
const evidence = {
  root,
  distribution: registry ? "npm" : "archive",
  profile,
  runtime: process.version,
  next: maintenance ? "15.5.25" : "16.3.3",
  archive,
  digest: createHash("sha256")
    .update(await readFile(archive))
    .digest("hex"),
  sourceFingerprint: source.fingerprint,
  results,
  removal,
  guide,
};
await mkdir("artifacts/release", { recursive: true });
await writeFile(
  `artifacts/release/next-consumer-${profile}${registry ? "-registry" : ""}.json`,
  JSON.stringify(evidence, null, 2) + "\n",
);
console.log(JSON.stringify(evidence, null, 2));
