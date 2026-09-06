import { createHash } from "node:crypto";
import { sourceFingerprint } from "./source-fingerprint.mjs";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
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
  peerDependencies: {
    react: "^19.2.8",
    "react-dom": "^19.2.8",
    vite: "^7.3.6 || ^8.2.2",
    next: "^15.5.25 || ^16.3.3",
  },
  devDependencies: {
    "@playwright/test": "1.62.1",
    "@types/node": "26.4.1",
    "@types/react": "19.2.18",
    "@types/react-dom": "19.2.7",
    "@vitejs/plugin-react": "6.1.1",
    prettier: "3.6.2",
    react: "19.2.8",
    "react-dom": "19.2.8",
    typescript: "7.0.2",
    vite: "8.2.2",
    vitest: "5.0.0",
    next: "16.3.3",
  },
};

const failures = [];
if (!packageJson.private || packageJson.publishConfig)
  failures.push("private distribution boundary changed");
if (packageJson.license !== "MIT") failures.push("package license differs from owner-approved MIT");
const projectLicense = await readFile("LICENSE", "utf8");
if (
  !projectLicense.startsWith("MIT License\n\nCopyright (c) 2026 Casper Kristiansson\n") ||
  !projectLicense.includes("The above copyright notice and this permission notice") ||
  !projectLicense.includes('THE SOFTWARE IS PROVIDED "AS IS"')
)
  failures.push("project MIT license is missing its notice, permission condition or disclaimer");
for (const hook of ["preinstall", "install", "postinstall", "prepare"]) {
  if (packageJson.scripts?.[hook]) failures.push(`unexpected package lifecycle hook: ${hook}`);
}
if (!packageJson.files.includes("skills")) failures.push("portable skill is outside the archive");
if (packageJson.repository?.url !== "git+https://github.com/CasperKristiansson/Qraft.git")
  failures.push("package repository metadata does not identify Qraft");
for (const [group, values] of Object.entries(expected)) {
  if (JSON.stringify(packageJson[group]) !== JSON.stringify(values))
    failures.push(`${group} differs from the exact allowlist`);
}
if (
  JSON.stringify(packageJson.exports) !==
  JSON.stringify({
    ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
    "./vite": { types: "./dist/vite.d.ts", import: "./dist/vite.js" },
    "./next": { types: "./dist/next.d.ts", import: "./dist/next.js" },
  })
)
  failures.push("package exports exceed the client, Vite and Next.js entrypoints");

if (JSON.stringify(packageJson.bin) !== JSON.stringify({ qraft: "./dist/cli.js" }))
  failures.push("unexpected command entry");
if (!(await readFile("dist/cli.js", "utf8")).startsWith("#!/usr/bin/env node"))
  failures.push("CLI executable header is missing");

if (
  packageJson.types !== "./dist/index.d.ts" ||
  JSON.stringify(packageJson.typesVersions) !==
    JSON.stringify({ "*": { vite: ["dist/vite.d.ts"], next: ["dist/next.d.ts"] } })
)
  failures.push("declaration resolver compatibility changed");

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
  next: "MIT",
  prettier: "MIT",
};
const notices = await readFile("THIRD_PARTY_NOTICES.md", "utf8");
for (const [name, license] of Object.entries(licenses)) {
  const installed = JSON.parse(await readFile(join("node_modules", name, "package.json"), "utf8"));
  if (installed.version !== (expected.dependencies[name] ?? expected.devDependencies[name]))
    failures.push(`${name} installed version differs from its pin`);
  if (installed.license !== license)
    failures.push(`${name} reports ${String(installed.license)}, expected ${license}`);
  if (!notices.includes(name)) failures.push(`THIRD_PARTY_NOTICES.md omits ${name}`);
}

const inspectExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".css", ".html"]);
async function inspect(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) await inspect(child);
    else if (
      inspectExtensions.has(extname(child)) &&
      /agentation/iu.test(await readFile(child, "utf8"))
    ) {
      failures.push(
        `${child} contains forbidden Agentation material or a reference outside canonical documentation`,
      );
    }
  }
}
for (const root of ["src", "examples", "dist"]) await inspect(root);
for (const path of ["package.json", "pnpm-lock.yaml"]) {
  if (/agentation/iu.test(await readFile(path, "utf8")))
    failures.push(`${path} contains an Agentation package reference`);
}

const clientBundle = await readFile("dist/index.js", "utf8");
for (const forbidden of ["node:", "write-file-atomic", "./markdown/", "./server/"]) {
  if (clientBundle.includes(forbidden)) failures.push(`browser entry contains ${forbidden}`);
}

const lock = await readFile("pnpm-lock.yaml", "utf8");
const inventory = [];
const approvedLicenses = new Set([
  "MIT",
  "ISC",
  "Apache-2.0",
  "BSD-3-Clause",
  "BSD-2-Clause",
  "0BSD",
  "MPL-2.0",
  "LGPL-3.0-or-later",
  "CC-BY-4.0",
]);
for (const slot of await readdir("node_modules/.pnpm", { withFileTypes: true })) {
  if (!slot.isDirectory() || slot.name === "node_modules") continue;
  const root = join("node_modules/.pnpm", slot.name, "node_modules");
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isSymbolicLink() || entry.name.startsWith(".")) continue;
    const names = entry.name.startsWith("@")
      ? (await readdir(join(root, entry.name), { withFileTypes: true }))
          .filter((value) => !value.isSymbolicLink())
          .map((value) => `${entry.name}/${value.name}`)
      : [entry.name];
    for (const name of names) {
      const path = join(root, name);
      const metadata = JSON.parse(await readFile(join(path, "package.json"), "utf8"));
      const key = `${metadata.name}@${metadata.version}`;
      if (!lock.includes(`${key}:`) && !lock.includes(`'${key}':`))
        failures.push(`${key} is absent from the lockfile`);
      const licenseFiles = (await readdir(path)).filter((file) =>
        /^(licen[sc]e|copying)([.-]|$)/iu.test(file),
      );
      let license = metadata.license;
      if (!license && key === "@react-grab/cli@0.2.0") {
        const text = await readFile(join(path, "LICENSE"), "utf8");
        if (text.startsWith("MIT License") && text.includes("2025 Aiden Bai")) license = "MIT";
      }
      if (!approvedLicenses.has(license))
        failures.push(`${key} has an unreviewed license: ${String(license)}`);
      const metadataOnly = new Set([
        "@rolldown/binding-darwin-arm64@1.2.6",
        "react-remove-scroll-bar@2.3.8",
        "stackback@0.0.2",
        "@img/sharp-libvips-darwin-arm64@1.3.3",
        "@next/env@16.3.3",
        "@next/swc-darwin-arm64@16.3.3",
        "client-only@0.0.1",
      ]);
      if (!licenseFiles.length && !metadataOnly.has(key))
        failures.push(`${key} has no reviewed license evidence`);
      inventory.push({
        package: key,
        license,
        licenseFiles,
        metadataSha256: createHash("sha256").update(JSON.stringify(metadata)).digest("hex"),
      });
    }
  }
}
await mkdir("artifacts/release", { recursive: true });
await writeFile(
  "artifacts/release/dependencies.json",
  JSON.stringify(
    {
      ...(await sourceFingerprint()),
      lockSha256: createHash("sha256").update(lock).digest("hex"),
      scope:
        "Installed lockfile graph on this platform, including development and runtime packages; platform-optional packages for other operating systems are not installed or claimed.",
      inventory: inventory.sort((a, b) => a.package.localeCompare(b.package)),
      failures,
    },
    null,
    2,
  ) + "\n",
);

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `release audit: exact pins, ${inventory.length} installed licenses/notices, exports, browser boundary, and Agentation exclusion passed`,
  );
}
