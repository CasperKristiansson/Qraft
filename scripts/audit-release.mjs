import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const expected = {
  dependencies: {
    "@radix-ui/react-dialog": "1.1.23",
    "@radix-ui/react-focus-scope": "1.1.16",
    "lucide-react": "1.41.0",
    "react-grab": "0.2.0",
    "write-file-atomic": "8.0.0",
    zod: "4.5.4",
  },
  peerDependencies: { react: "19.2.8", "react-dom": "19.2.8", vite: "8.2.2" },
  devDependencies: {
    "@playwright/test": "1.62.1",
    "@types/node": "26.4.1",
    "@types/react": "19.2.18",
    "@types/react-dom": "19.2.7",
    "@vitejs/plugin-react": "6.1.1",
    react: "19.2.8",
    "react-dom": "19.2.8",
    typescript: "7.0.2",
    vite: "8.2.2",
    vitest: "5.0.0",
  },
};

const failures = [];
for (const [group, values] of Object.entries(expected)) {
  if (JSON.stringify(packageJson[group]) !== JSON.stringify(values)) failures.push(`${group} differs from the exact allowlist`);
}
if (JSON.stringify(packageJson.exports) !== JSON.stringify({
  ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
  "./vite": { types: "./dist/vite.d.ts", import: "./dist/vite.js" },
})) failures.push("package exports exceed the client and Vite entrypoints");

const licenses = {
  react: "MIT",
  "react-dom": "MIT",
  "@radix-ui/react-dialog": "MIT",
  "@radix-ui/react-focus-scope": "MIT",
  "lucide-react": "ISC",
  "react-grab": "MIT",
  "write-file-atomic": "ISC",
  zod: "MIT",
  vite: "MIT",
};
const notices = await readFile("THIRD_PARTY_NOTICES.md", "utf8");
for (const [name, license] of Object.entries(licenses)) {
  const installed = JSON.parse(await readFile(join("node_modules", name, "package.json"), "utf8"));
  if (installed.license !== license) failures.push(`${name} reports ${String(installed.license)}, expected ${license}`);
  if (!notices.includes(name)) failures.push(`THIRD_PARTY_NOTICES.md omits ${name}`);
}

const inspectExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".css", ".html"]);
async function inspect(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) await inspect(child);
    else if (inspectExtensions.has(extname(child)) && /agentation/iu.test(await readFile(child, "utf8"))) {
      failures.push(`${child} contains forbidden Agentation material or a reference outside canonical documentation`);
    }
  }
}
for (const root of ["src", "examples", "dist"]) await inspect(root);
for (const path of ["package.json", "pnpm-lock.yaml"]) {
  if (/agentation/iu.test(await readFile(path, "utf8"))) failures.push(`${path} contains an Agentation package reference`);
}

const clientBundle = await readFile("dist/index.js", "utf8");
for (const forbidden of ["node:", "write-file-atomic", "./markdown/", "./server/"]) {
  if (clientBundle.includes(forbidden)) failures.push(`browser entry contains ${forbidden}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("release audit: exact pins, licenses/notices, exports, browser boundary, and Agentation exclusion passed");
}
