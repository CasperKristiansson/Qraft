# Install Qraft in your app

Install Qraft from npm with your project's existing package manager. Do not upgrade its framework just to add Qraft.

```sh
pnpm add -D @qraft-dev/qa
pnpm exec qraft doctor
pnpm exec qraft setup
```

`doctor` inspects versions and common configuration without executing project config. `setup`
prints integration and removal steps. Neither changes files, installs a skill, or chooses a checklist.
In a monorepo, run them from the application workspace. Qraft's trusted `root` is the directory
containing the Markdown files you want it to discover, which may be a parent project directory.

## Supported environments

| Dependency          | Supported lines                              |
| ------------------- | -------------------------------------------- |
| Node.js             | 22.23+ or 24.19+ within those major versions |
| React and React DOM | Matching 19.2.8+ versions within React 19    |
| Vite                | 7.3.6+ or 8.2.2+ within those major versions |
| Next.js             | App Router 15.5.25+ or 16.3.3+, Node runtime |

Use only your own framework; Vite and Next are optional peers. The exact current and maintenance
profiles tested for a candidate are recorded in [acceptance](testing-and-acceptance.md).
Pages Router, Edge runtime and static export are outside the supported integration.

## Next.js App Router

Create `app/api/qraft/[...path]/route.ts`:

```ts
import { createQraftRoute } from "@qraft-dev/qa/next";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const qraft = createQraftRoute({ endpoint: "/api/qraft" });
export const GET = qraft.GET;
export const POST = qraft.POST;
```

In the root layout (let Next.js bundle Qraft normally; do not add the client package to `serverExternalPackages`):

```tsx
// Inside the existing async root layout, before returning JSX:
const QA = process.env.NODE_ENV === "development" ? (await import("@qraft-dev/qa")).QA : null;

// Inside the body, beside the application:
{
  QA ? <QA endpoint="/api/qraft" editor="manual" /> : null;
}
```

The conditional import keeps the picker out of production client chunks. If a production artifact policy also excludes all local server tooling, conditionally import the route factory behind the same development check and export handlers that return 404 when it is absent.

If a trusted local gateway rewrites the Host header, configure `origin` on `createQraftRoute` with the exact browser origin (for example `http://localhost:3060`). Qraft never trusts forwarded headers to authorize writes.

When Next.js has a `basePath`, include it only in the QA client endpoint (for example `/email/api/qraft`). Next.js strips it from the route handler request, so the server endpoint stays `/api/qraft`.

The package declares its client boundary. The route independently returns 404 outside development,
before accessing files or creating watchers. Keep authentication/proxy middleware from redirecting
this local development route; any exception must itself be development-only. The trusted `root`
option defaults to the Next.js working directory. `file` optionally restricts the chooser to a
project-relative Markdown path. This integration supports App Router on Node, not Edge, Pages Router
or static export. Next.js source paths are displayed for manual editor navigation.

## Vite

Add the development plugin to `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { qraft } from "@qraft-dev/qa/vite";

export default defineConfig({
  plugins: [react(), qraft()],
});
```

Mount the drawer behind Vite's development guard:

```tsx
import { QA } from "@qraft-dev/qa";

export function App() {
  return (
    <>
      <Application />
      {import.meta.env.DEV && <QA />}
    </>
  );
}
```

The drawer first asks you to choose a Markdown checklist inside the Vite project. It remembers the choice per project in your browser. Use **Change file** to choose another. There is no default filename. An optional trusted `qraft({ file: "./reviews/checkout.md" })` restricts the chooser to that file, including a missing file which the first Add section action can create. The browser sends only a server-issued file ID, never a filesystem path. The optional `endpoint` still defaults to `/__qraft`.

## Choose your first checklist

Create a file using the [checklist guide](creating-checklists.md), start your normal development
server, then open the QA tab and select that file. The chooser remembers your selection per project
in browser local storage. Use **Change file** at the bottom of the checklist to select another.
Qraft never chooses a filename implicitly, even when the server restricts the chooser to one file.

## Share with teammates

Commit the dependency entry, lockfile and development integration. Teammates can pull and run the
project's normal install command. Use your package manager to update Qraft; no archive is needed.
Checklist changes travel through your project's normal Git workflow, not live sync between machines.

## Test an unpublished build

From a verified Qraft checkout, run `corepack pnpm build`, then `corepack pnpm pack`. Copy the archive
into `vendor/` in the consuming private repository and install it there. Commit the archive,
dependency entry, lockfile and integration together so teammates can pull and install normally.
Use a new version or immutable archive filename for updates; do not overwrite an installed archive.
Checklist changes travel through your project's normal Git workflow, not live sync between machines.

The package contains built modules, types, the portable skill, documentation and third-party notices.
It has no install hook. Installing it never edits `AGENTS.md`, `CLAUDE.md`, or agent skill folders.

## Remove Qraft

Remove the QA import and development mount. For Vite, remove `qraft()` and its config import.
For Next.js, remove the dedicated Qraft route and any development-only middleware exception you
added for it. Remove `@qraft-dev/qa` with your package manager. Keep your Markdown review and notes.
If you explicitly installed the skill, remove only its installed folder and routing pointer when
no longer needed; uninstalling the package does not erase project instructions or review files.

See [troubleshooting](troubleshooting.md) for connection, picker, file and recovery problems.
