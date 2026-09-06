import { verifyRemoval } from "./verify-removal.mjs";
import { verifyPackagedGuide } from "./verify-packaged-guide.mjs";
import { sourceFingerprint } from "./source-fingerprint.mjs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const registry = process.argv.includes("--registry");
const maintenance = process.argv.includes("--maintenance");
const profile = maintenance ? "maintenance" : "current";
const repository = process.cwd();
const source = await sourceFingerprint(repository);
const consumer = await mkdtemp(join(tmpdir(), "qraft-clean-consumer-"));

function run(command, args, cwd = repository) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  if (result.status !== 0)
    throw new Error(`${command} ${args.join(" ")} failed with ${result.status ?? "no status"}`);
  return result.stdout;
}

const packageVersion = JSON.parse(await readFile("package.json", "utf8")).version;
const packageSpec = `@qraft-dev/qa@${packageVersion}`;
if (registry)
  run("npm", [
    "pack",
    packageSpec,
    "--registry=https://registry.npmjs.org/",
    "--pack-destination",
    consumer,
  ]);
else run("corepack", ["pnpm", "pack", "--pack-destination", consumer]);
const archiveName = (await readdir(consumer)).find((name) => name.endsWith(".tgz"));
if (!archiveName) throw new Error("pnpm pack did not create a package archive.");
const archive = join(consumer, archiveName);
const archiveFiles = run("tar", ["-tzf", archive]).trim().split("\n");
for (const expected of [
  "package/dist/cli.js",
  "package/dist/next.js",
  "package/dist/index.js",
  "package/dist/index.d.ts",
  "package/dist/vite.js",
  "package/dist/vite.d.ts",
  "package/README.md",
  "package/LICENSE",
  "package/THIRD_PARTY_NOTICES.md",
  "package/skills/qraft-review/SKILL.md",
  "package/docs/agent-skill.md",
]) {
  if (!archiveFiles.includes(expected)) throw new Error(`Packed package is missing ${expected}.`);
}
if (
  archiveFiles.some((path) => path.startsWith("package/src/") || path.startsWith("package/tests/"))
) {
  throw new Error(
    "Packed package contains source or test files outside the public artifact boundary.",
  );
}

const packageJson = {
  name: "qraft-clean-consumer",
  private: true,
  type: "module",
  packageManager: "pnpm@11.25.0",
  scripts: {
    build: "vite build",
    dev: "vite --host 127.0.0.1 --port 4173 --strictPort",
    preview: "vite preview --host 127.0.0.1 --port 4174 --strictPort",
  },
  dependencies: {
    "@qraft-dev/qa": registry ? packageVersion : `file:${archive}`,
    "@vitejs/plugin-react": maintenance ? "5.2.0" : "6.1.1",
    react: "19.2.8",
    "react-dom": "19.2.8",
    vite: maintenance ? "7.3.6" : "8.2.2",
  },
};

const files = {
  "package.json": `${JSON.stringify(packageJson, null, 2)}\n`,
  "pnpm-workspace.yaml": `packages:
  - "."
minimumReleaseAge: 10080
${maintenance ? 'allowBuilds:\n  "esbuild@0.28.2": true\n' : ""}minimumReleaseAgeExclude:
  - "${packageSpec}"
  - "lucide-react@1.41.0"
  - "zod@4.5.4"
`,
  "index.html":
    '<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Qraft clean consumer</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>\n',
  "QA.seed.md":
    "# QA\n\n## Cart <!-- qraft:id=section_11111111-1111-4111-8111-111111111111 -->\n\n- [ ] Change quantity <!-- qraft:id=task_22222222-2222-4222-8222-222222222222 -->\n- [ ] Remove product <!-- qraft:id=task_33333333-3333-4333-8333-333333333333 -->\n\n## Account <!-- qraft:id=section_44444444-4444-4444-8444-444444444444 -->\n\n- [ ] Expired session <!-- qraft:id=task_55555555-5555-4555-8555-555555555555 -->\n",
  "QA.md": "# QA\n",
  "vite.config.ts": `import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { qraft } from "@qraft-dev/qa/vite";
import { fixturePlugin } from "./fixture-plugin.ts";

export default defineConfig({ plugins: [react(), fixturePlugin(), qraft()] });
`,
  "fixture-plugin.ts": `import { appendFile, chmod, copyFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

export function fixturePlugin(): Plugin {
  let external = 0;
  let failOpen = false;
  return {
    name: "clean-consumer-fixture",
    apply: "serve",
    async configureServer(server) {
      const qa = resolve(server.config.root, "QA.md");
      const seed = resolve(server.config.root, "QA.seed.md");
      await copyFile(seed, qa);
      server.middlewares.use(async (request, response, next) => {
        if (request.method === "GET" && request.url?.startsWith("/__open-in-editor") && failOpen) {
          failOpen = false;
          response.statusCode = 500;
          response.end("Injected editor failure.");
          return;
        }
        if (request.method !== "POST" || !request.url?.startsWith("/__consumer/")) return next();
        response.setHeader("Content-Type", "application/json");
        if (request.url === "/__consumer/reset") await copyFile(seed, qa);
        else if (request.url === "/__consumer/external") await appendFile(qa, "\\n<!-- clean consumer external " + (++external) + " -->\\n");
        else if (request.url === "/__consumer/fail-write") {
          const mode = (await stat(server.config.root)).mode & 0o777;
          await chmod(server.config.root, 0o500);
          setTimeout(() => void chmod(server.config.root, mode), 10_000).unref();
        } else if (request.url === "/__consumer/fail-open") failOpen = true;
        else { response.statusCode = 404; response.end("{}"); return; }
        response.end("{}");
      });
    },
  };
}
`,
  "src/main.tsx": `import { useState } from "react";
import { createRoot } from "react-dom/client";
import { QA } from "@qraft-dev/qa";
import "./style.css";

function App() {
  const [quantity, setQuantity] = useState(2);
  return <>
    <main data-testid="host-layout">
      <nav><strong>Northstar</strong><span>Home</span><span>Shop</span><span>Deals</span></nav>
      <div className="grid"><section><p className="eyebrow">PACKED CLEAN CONSUMER</p><h1>Shopping cart</h1><article><b>Q</b><div><strong>Lounge Chair</strong><p>$249.00</p></div><div className="quantity"><button onClick={() => setQuantity(value => value - 1)}>−</button><span data-testid="quantity-value">{quantity}</span><button onClick={() => setQuantity(value => value + 1)}>+</button></div></article></section><aside><h2>Summary</h2><p>Subtotal <strong>$249.00</strong></p><p>Shipping <strong>$19.00</strong></p><hr/><p>Total <strong>$268.00</strong></p><button className="checkout">Checkout</button></aside></div>
    </main>
    {import.meta.env.DEV ? <QA /> : null}
  </>;
}

createRoot(document.getElementById("root")!).render(<App />);
`,
  "src/style.css": `*{box-sizing:border-box}body{margin:0;background:#f6f7f9;color:#202431;font:16px Inter,system-ui,sans-serif}nav{height:64px;padding:0 5%;display:flex;align-items:center;gap:32px;background:#fff;border-bottom:1px solid #ddd}nav strong{margin-right:auto}.grid{max-width:930px;margin:52px auto;display:grid;grid-template-columns:2fr 1fr;gap:28px}.eyebrow{font-size:12px;letter-spacing:.14em;color:#677085}h1{font-size:32px}article,aside{background:#fff;border:1px solid #d9dee8;border-radius:14px;padding:20px;box-shadow:0 8px 18px #18243c0b}article{display:flex;align-items:center;gap:18px}article>b{display:grid;place-items:center;width:80px;height:80px;border-radius:12px;background:#eeeafd;color:#6d4bd2;font-size:30px}article p{margin:5px 0;color:#687080}.quantity{display:flex;align-items:center;margin-left:auto;border:1px solid #d9dee8;border-radius:10px;overflow:hidden}.quantity button{border:0;background:#fff;padding:12px 16px;font-size:18px}.quantity span{min-width:28px;text-align:center}aside p{display:flex;justify-content:space-between}.checkout{width:100%;padding:12px;border:0;border-radius:10px;background:#202431;color:#fff}.controls{position:fixed;left:12px;bottom:12px;display:flex;gap:6px;z-index:2}.controls button{font-size:11px}@media(max-width:800px){.grid{margin:40px 24px;grid-template-columns:1fr}article{flex-wrap:wrap}.controls{max-width:340px;flex-wrap:wrap}}
`,
};

for (const [path, content] of Object.entries(files)) {
  const target = join(consumer, path);
  if (path.includes("/")) run("mkdir", ["-p", target.slice(0, target.lastIndexOf("/"))], consumer);
  await writeFile(target, content, "utf8");
}

run("corepack", ["pnpm", "install"], consumer);
run(
  "node",
  [
    "--input-type=module",
    "-e",
    "const client=await import('@qraft-dev/qa');const vite=await import('@qraft-dev/qa/vite');if(typeof client.QA!=='function'||typeof client.HttpQAStorage!=='function'||typeof vite.qraft!=='function')process.exit(1)",
  ],
  consumer,
);
run(
  "node",
  [
    "--input-type=module",
    "-e",
    "try{await import('@qraft-dev/qa/dist/vite.js');process.exit(1)}catch(error){if(error.code!=='ERR_PACKAGE_PATH_NOT_EXPORTED')throw error}",
  ],
  consumer,
);
run("corepack", ["pnpm", "exec", "qraft", "doctor"], consumer);
run("corepack", ["pnpm", "exec", "qraft", "setup"], consumer);
const guide = await verifyPackagedGuide(consumer);
run("corepack", ["pnpm", "build"], consumer);

const { preview } = await import(
  new URL(`file://${consumer}/node_modules/vite/dist/node/index.js`).href
);
const server = await preview({
  root: consumer,
  preview: { host: "127.0.0.1", port: 0, strictPort: false },
});
const previewChecks = [];
try {
  const address = server.httpServer.address();
  for (const path of [
    "document",
    "commands",
    "events",
    "files",
    `files/${"a".repeat(64)}/document`,
  ]) {
    const response = await fetch(`http://127.0.0.1:${address.port}/__qraft/${path}`, {
      method: path === "commands" ? "POST" : "GET",
      signal: AbortSignal.timeout(5000),
    });
    const body = await response.text();
    if (
      response.headers.get("content-type")?.includes("application/json") ||
      response.headers.get("content-type")?.includes("text/event-stream") ||
      body.includes('"revision"')
    )
      throw new Error(`Production preview exposes ${path}`);
    previewChecks.push({
      path,
      status: response.status,
      contentType: response.headers.get("content-type"),
    });
  }
} finally {
  await server.close();
}
const removal = await verifyRemoval(consumer, "vite", (args, cwd) =>
  run("corepack", ["pnpm", ...args], cwd),
);
const digest = createHash("sha256")
  .update(await readFile(archive))
  .digest("hex");
const evidence = {
  consumer,
  distribution: registry ? "npm" : "archive",
  profile,
  runtime: process.version,
  versions: packageJson.dependencies,
  archive,
  digest,
  sourceFingerprint: source.fingerprint,
  archiveFiles: archiveFiles.length,
  previewChecks,
  removal,
  guide,
};
await writeFile(join(consumer, "evidence.json"), JSON.stringify(evidence, null, 2) + "\n");
await mkdir("artifacts/release", { recursive: true });
await writeFile(
  `artifacts/release/consumer-${profile}${registry ? "-registry" : ""}.json`,
  JSON.stringify(evidence, null, 2) + "\n",
);
process.stdout.write(`${JSON.stringify(evidence)}\n`);
