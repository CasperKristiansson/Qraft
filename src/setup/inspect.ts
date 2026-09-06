import { readFile, readdir, realpath, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, relative } from "node:path";

export interface SetupReport {
  root: string;
  framework: "next" | "vite" | "unknown";
  manager: string;
  appDirectory: string | null;
  versions: Record<string, string>;
  checks: { level: "ok" | "warning"; message: string }[];
}

async function smallText(path: string): Promise<string | null> {
  try {
    if ((await stat(path)).size > 128 * 1024) return null;
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

/** Read installed versions and configuration hints; never run host project code. */
export async function inspectProject(directory: string): Promise<SetupReport> {
  const root = await realpath(directory);
  const raw = await smallText(join(root, "package.json"));
  if (!raw) throw new Error("Run Qraft from the app directory containing package.json.");
  const manifest = JSON.parse(raw);
  const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };
  const require = createRequire(join(root, "package.json"));
  const versions: Record<string, string> = {};
  for (const name of ["@qraft-dev/qa", "react", "react-dom", "next", "vite"]) {
    try {
      let metadata: string | null = null;
      for (const directory of require.resolve.paths(name) ?? []) {
        metadata = await smallText(join(directory, name, "package.json"));
        if (metadata) break;
      }
      if (metadata) versions[name] = JSON.parse(metadata).version ?? "unknown";
    } catch {
      /* A declared dependency may not be installed yet. */
    }
  }
  const framework = dependencies.next ? "next" : dependencies.vite ? "vite" : "unknown";
  const report: SetupReport = {
    root,
    framework,
    manager: manifest.packageManager?.split("@")[0] ?? "your package manager",
    appDirectory: null,
    versions,
    checks: [],
  };
  const add = (ok: boolean, message: string) =>
    report.checks.push({ level: ok ? "ok" : "warning", message });
  const entries = await readdir(root);
  if (entries.includes("pnpm-lock.yaml")) report.manager = "pnpm";
  else if (entries.includes("package-lock.json")) report.manager = "npm";
  else if (entries.includes("yarn.lock")) report.manager = "yarn";
  add(
    Boolean(versions["@qraft-dev/qa"]),
    versions["@qraft-dev/qa"]
      ? `Qraft ${versions["@qraft-dev/qa"]} is installed.`
      : "Qraft is not installed in this app. Install @qraft-dev/qa as a development dependency before integrating it.",
  );
  const node = process.versions.node.split(".").map(Number);
  add(
    (node[0] === 22 && (node[1] ?? 0) >= 23) || (node[0] === 24 && (node[1] ?? 0) >= 19),
    `Node ${process.versions.node}; tested consumer lines are Node 22.23+ and 24.19+.`,
  );
  add(
    versions.react?.startsWith("19.") === true && versions.react === versions["react-dom"],
    `React ${versions.react ?? "missing"}, React DOM ${versions["react-dom"] ?? "missing"}; use matching React 19 versions.`,
  );
  if (framework === "next") {
    for (const candidate of ["app", "src/app"]) {
      try {
        if ((await stat(join(root, candidate))).isDirectory()) report.appDirectory = candidate;
      } catch {
        /* Try the next conventional directory. */
      }
    }
    add(
      Boolean(report.appDirectory),
      report.appDirectory
        ? `App Router directory: ${report.appDirectory}.`
        : "App Router was not found. Pages Router and Edge runtime are unsupported.",
    );
    add(
      /^(15|16)\./u.test(versions.next ?? ""),
      `Next.js ${versions.next ?? "missing"}; supported majors are 15 and 16.`,
    );
    const routeRoot = report.appDirectory ? join(root, report.appDirectory, "api/qraft") : null;
    const routeFolders = routeRoot ? await readdir(routeRoot).catch(() => []) : [];
    const catchAll = routeFolders.find((name) => /^\[\.\.\.[^\]]+\]$/u.test(name));
    const route =
      routeRoot && catchAll ? await smallText(join(routeRoot, catchAll, "route.ts")) : null;
    add(
      Boolean(route?.includes("createQraftRoute") && /runtime\s*=\s*["']nodejs/u.test(route)),
      "The Qraft route must use createQraftRoute and export runtime = 'nodejs'. Custom route locations need manual verification.",
    );
  } else if (framework === "vite") {
    add(
      /^[78]\./u.test(versions.vite ?? ""),
      `Vite ${versions.vite ?? "missing"}; supported majors are 7 and 8.`,
    );
    const config = entries.find((name) => /^vite\.config\.[cm]?[jt]s$/u.test(name));
    const text = config ? await smallText(join(root, config)) : null;
    add(
      Boolean(text?.includes("@qraft-dev/qa/vite")),
      "Add qraft() to the Vite plugins in the app's Vite configuration.",
    );
  } else
    add(
      false,
      "No supported framework dependency found. Run this command in the Vite or Next.js app workspace.",
    );
  add(
    false,
    "Static diagnostics cannot prove runtime integration. Confirm development rendering, selected-file writes and production exclusion in the app.",
  );
  add(
    false,
    "Check monorepo root, Next.js basePath and proxy endpoint alignment. Keep the dev server local; configure one exact browser origin only when using a trusted local gateway.",
  );

  // Skip symlinks and dependency/build directories; keep diagnostics bounded.
  const ignored = new Set(["node_modules", "dist", "build", "coverage", "artifacts"]);
  const pending = [root];
  let visited = 0;
  while (pending.length && visited < 10_000) {
    const current = pending.pop()!;
    const children = await readdir(current, { withFileTypes: true }).catch(() => []);
    for (const entry of children) {
      if (++visited > 10_000) break;
      if (entry.name.startsWith(".") || ignored.has(entry.name) || entry.isSymbolicLink()) continue;
      const path = join(current, entry.name);
      if (entry.isDirectory()) pending.push(path);
      else if (/\.qraft-stage-[a-f0-9-]+$/u.test(entry.name)) {
        add(
          false,
          `Staging file ${relative(root, path)}. Stop all Qraft writers before inspecting and manually removing a crash leftover. Doctor leaves it untouched.`,
        );
      } else if (entry.name.endsWith(".qraft.lock")) {
        let owner = "unknown owner";
        try {
          const lock = JSON.parse((await smallText(path)) ?? "{}");
          if (Number.isSafeInteger(lock.pid) && lock.pid > 0) {
            let alive = true;
            try {
              process.kill(lock.pid, 0);
            } catch (error) {
              alive = (error as NodeJS.ErrnoException).code !== "ESRCH";
            }
            owner = `PID ${lock.pid}, ${alive ? "running or inaccessible" : "no longer running"}`;
          }
        } catch {
          /* An unreadable lock must never be silently removed. */
        }
        add(
          false,
          `Writer lock ${relative(root, path)} (${owner}). Stop every Qraft dev server for this project, verify no writer is active, then remove this specific lock manually and restart. Doctor never removes locks.`,
        );
      }
    }
  }
  if (pending.length || visited > 10_000)
    add(false, "Lock scan reached 10,000 entries; additional files were not inspected.");
  return report;
}

export function setupInstructions(report: SetupReport): string {
  const common =
    "No files changed. Keep Qraft as a development dependency. Choose the Markdown file in the browser; Qraft never selects a filename implicitly.";
  if (report.framework === "vite")
    return `${common}\n\nIn vite.config.ts:\nimport { qraft } from '@qraft-dev/qa/vite';\n// Add qraft() to the existing plugins array.\n\nIn your React root:\nimport { QA } from '@qraft-dev/qa';\n// Render alongside the app:\n{import.meta.env.DEV ? <QA /> : null}\n\nRemoval: remove this render/import and plugin/import, then remove the Qraft dependency. Keep your Markdown review file.\n`;
  if (report.framework === "next")
    return `${common}\n\nCreate ${report.appDirectory ?? "app"}/api/qraft/[...qraft]/route.ts:\nimport { createQraftRoute } from '@qraft-dev/qa/next';\nexport const runtime = 'nodejs';\nexport const dynamic = 'force-dynamic';\nconst route = createQraftRoute({ root: process.cwd(), endpoint: '/api/qraft' });\nexport const { GET, POST } = route;\n\nCreate a small client component:\n'use client';\nimport dynamic from 'next/dynamic';\nconst QA = process.env.NODE_ENV === 'development'\n  ? dynamic(() => import('@qraft-dev/qa').then(m => m.QA), { ssr: false })\n  : () => null;\nexport function Review() { return <QA endpoint='/api/qraft' editor='manual' />; }\n\nRender <Review /> in the root layout. For a Next.js basePath, prefix only the browser endpoint; Next strips it from route requests, so the route endpoint stays /api/qraft. In a monorepo, explicitly set root to the directory containing the review files.\n\nRemoval: remove the Review component/render and Qraft route, then remove the dependency. Keep your Markdown review file.\n`;
  return `${common}\nRun setup from a supported app workspace, not the monorepo aggregator.\n`;
}
