# Technical architecture

This document owns module boundaries, runtime composition, data types, dependencies, and package structure. Product behavior is defined in [Product requirements](product-requirements.md).

## System shape

```text
Browser                                        Vite development process
┌────────────────────────────┐                 ┌────────────────────────────┐
│ <QA />                     │                 │ qraft() plugin             │
│ ├─ Shadow DOM UI           │                 │ ├─ HTTP/SSE middleware     │
│ ├─ QAStorage               │◀───────────────▶│ ├─ MarkdownDocumentStore  │
│ └─ React Grab picker       │                 │ └─ Vite file watcher       │
└────────────────────────────┘                 └─────────────┬──────────────┘
                                                           │
                                                           ▼
                                                         QA.md
```

The browser knows domain objects and typed commands. It receives project-relative file labels and opaque file IDs but never parser offsets or filesystem APIs. The server resolves file IDs from its own catalog; it accepts no path from a browser request.

## Consumer integration

```ts
// vite.config.ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { qraft } from "@qraft/qa/vite";

export default defineConfig({
  plugins: [react(), qraft()],
});
```

```tsx
// application root
import { QA } from "@qraft/qa";

export function App() {
  return (
    <>
      <Application />
      {import.meta.env.DEV && <QA />}
    </>
  );
}
```

The file path belongs only to the server plugin. `<QA />` does not accept it.

### Plugin options

```ts
export interface QraftViteOptions {
  /** Resolved relative to Vite root. Optional chooser restriction; no default. */
  file?: string;

  /** Same-origin endpoint prefix. Default: "/__qraft". */
  endpoint?: string;
}
```

- The configured file must resolve inside the Vite project root.
- Its extension must be `.md` or `.markdown`.
- Invalid paths fail Vite startup with a clear message.
- A missing file is represented as an empty document and is created only by the first mutation.
- The plugin uses `apply: "serve"` and has no production or preview middleware.

## Layer boundaries

### Domain

Owns data types, command types, validation, invariants, progress, and status semantics. It imports no React, HTTP, Vite, or filesystem APIs.

### Markdown

Owns the constrained parser, source spans, stable IDs, minimal patches, revision checks, serialized command queue, and atomic file replacement. It is server-only. See [Markdown storage](markdown-storage.md).

### Server

Owns HTTP parsing, request limits, origin/method safeguards, response mapping, SSE clients, and watcher-event coalescing. It delegates all checklist rules and mutations.

### Client

Owns the Shadow DOM shell, list/detail state, forms, focus, transport adapter, picker integration, and error presentation. It renders domain values as text.

### Vite adapter

Resolves trusted options and composes the server modules with Vite middleware and its existing watcher. It must not contain checklist business logic.

## Domain model

```ts
export interface QADocument {
  title: string;
  revision: string;
  sections: QASection[];
  diagnostics: QADiagnostic[];
}

export interface QASection {
  id: string;
  title: string;
  tasks: QATask[];
}

export interface QATask {
  id: string;
  title: string;
  checked: boolean; // compatibility projection: status === "completed"
  notes: QANote[];
  status: "open" | "completed" | "skipped";
}

export interface QANote {
  id: string;
  body: string;
  element: ElementReference | null;
}

export interface ElementReference {
  route: string;
  component: string | null;
  source: string | null;
  line: number | null;
  column: number | null;
  selector: string | null;
  context?: { tag: string; attributes: Record<string, string>; text: string; ancestors: string[]; sourceTrail?: { component: string | null; source: string; line: number | null; column: number | null }[] };
}
```

`route` is `location.pathname` only. `source` is a repository-relative path normalized to `/`; the server omits it if it resolves outside the Vite root. The optional context contains tag (80 chars), at most 12 identifying attributes (80-char keys/300-char values), selected visible text (300 chars), and up to 5 ancestor descriptions (300 chars each). The optional sourceTrail holds at most five deduplicated application source locations (component 200 chars, source 2,000 chars, positive nullable line/column). Derive it from the published structured React Grab context, excluding ignore-listed/dependency frames; normalize every path inside the Vite root on reads and writes and omit invalid/outside paths. Never persist raw stacks, stack arguments, query strings, hashes, DOM/Fiber objects, HTML previews, styles, form values, or unrestricted page content.

`revision` is the SHA-256 hash of the exact file bytes returned by the server.

## Command model

```ts
export type QACommand =
  | { type: "createSection"; title: string }
  | { type: "createTask"; sectionId: string; title: string }
  | { type: "setTaskChecked"; taskId: string; checked: boolean }
  | { type: "setTaskStatus"; taskId: string; status: "open" | "completed" | "skipped" }
  | { type: "addNote"; taskId: string; body: string; element?: ElementReference | null }
  | { type: "editNote"; noteId: string; body: string };


export interface CommandRequest {
  commandId: string;
  baseRevision: string;
  command: QACommand;
}
```

There is no replace-document command. `commandId` lets the transport reject or safely recognize an accidental duplicate during one server lifetime; durable cross-restart deduplication is not required.

Business invariants include:

- duplicate IDs are never valid mutation targets;
- task statuses and notes are independent; legacy finding markers are never mutated by task actions;
- entity text is normalized and validated on the server.

## Client storage interface

```ts
export interface QAStorage {
  getDocument(signal?: AbortSignal): Promise<QADocument>;
  execute(command: QACommand, baseRevision: string): Promise<QADocument>;
  subscribe(onChange: () => void): () => void;
}
```

v0.1 implements only `HttpQAStorage`. `MarkdownDocumentStore` is not an implementation of this browser-facing interface and is never included in the client bundle. Do not add unused cloud adapters or cloud-shaped fields.

## Package and repository layout

Use one package at the repository root:

```text
Qraft/
├── docs/
├── examples/
│   └── vite-react/
├── src/
│   ├── client/
│   │   ├── QA.tsx
│   │   ├── drawer/
│   │   ├── picker/
│   │   ├── shadow-root.tsx
│   │   └── http-storage.ts
│   ├── domain/
│   │   ├── model.ts
│   │   ├── commands.ts
│   │   └── validation.ts
│   ├── markdown/
│   │   ├── parse.ts
│   │   ├── patch.ts
│   │   ├── ids.ts
│   │   └── store.ts
│   ├── server/
│   │   ├── middleware.ts
│   │   ├── events.ts
│   │   └── origin.ts
│   ├── vite.ts
│   └── index.ts
├── tests/
│   ├── markdown/
│   ├── server/
│   └── e2e/
├── AGENTS.md
├── THIRD_PARTY_NOTICES.md
├── package.json
├── tsconfig.json
└── vite.config.ts
```

Package exports:

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./vite": "./dist/vite.js"
  }
}
```

## Technology choices

- TypeScript on Node `24.19.0`, with pnpm `11.25.0` and one exact lockfile.
- `typescript@7.0.2`, `@types/node@26.4.1`, `@types/react@19.2.18`, and `@types/react-dom@19.2.7` as exact development-only compiler/type pins.
- `react@19.2.8` and `react-dom@19.2.8` as peer/development dependencies.
- `vite@8.2.2` as a peer/development dependency for the `./vite` entry and example.
- `@vitejs/plugin-react@6.1.1` as a development-only example transform/refresh plugin.
- Exact `react-grab@0.2.0` for picker work.
- `@radix-ui/react-dialog@1.1.23` for portal/drawer semantics in non-modal mode and `@radix-ui/react-focus-scope@1.1.16` only where the narrow overlay requires trapping. Validate both in the real ShadowRoot; do not allow Radix to change `document.body` overflow.
- `zod@4.5.4` for runtime validation at untrusted/plugin/command boundaries.
- `write-file-atomic@8.0.0` for the final atomic write mechanics beneath Qraft's own read-modify-write queue and revision checks.
- `lucide-react@1.41.0` as the sole icon family.
- `vitest@5.0.0` for unit and integration tests.
- `@playwright/test@1.62.1` for repeatable browser tests.
- Hand-written Shadow DOM CSS.
- Native HTTP middleware, Server-Sent Events, Web Crypto/Node crypto, and Vite watcher capabilities.

Do not add a state library, CSS framework, full Markdown renderer/serializer, database, WebSocket library, or separate file watcher without concrete evidence that the platform implementation is inadequate.

The exact repository commits, approved source paths, reuse mode, and licenses are frozen in [the implementation plan](implementation-plan.md#exact-open-source-reuse-allowlist) and [upstream boundary](upstream-and-licensing.md). Direct packages remove hard generic machinery; the workflow, visual composition, domain model, Markdown patches, and protocol remain Qraft-owned.

## Error boundaries

- Domain and Markdown layers return typed errors with safe details such as entity ID and line number.
- Server maps typed errors to the statuses in [Dev-server protocol](dev-server-protocol.md) and never returns stack traces.
- Client keeps unsaved text where recovery is possible and never presents an unconfirmed write as successful.
- A picker or editor-open error cannot mutate the checklist.

## Production boundary

The Vite plugin exists only during `serve`. The consumer is responsible for mounting `<QA />` behind `import.meta.env.DEV`. Tests must separately prove that a production build and preview server expose no Qraft endpoint. Static client code remaining in an unused production chunk is not a filesystem exposure, but the documented integration should allow normal bundler dead-code elimination.

## M6 boundary clarifications

- The drawer uses non-modal Radix composition to avoid global scroll changes. At 768–800 px Qraft adds modal semantics, FocusScope, and explicit keyboard wrapping within its ShadowRoot; see the owning design contract.
- Confirmed mutations invalidate older in-flight UI reads. Background synchronization preserves actionable save/conflict errors and drafts. Legacy task identity is remapped only after Qraft's own successful append/status command, whose preserved order is known.
- The store normalizes attachment source paths for reads and conflict documents as well as new writes. External Markdown bytes remain unchanged.
- Candidate and package provenance is recorded by `scripts/source-fingerprint.mjs`, `audit:release`, and `verify:consumer`; these local tools do not publish packages.

## Project file catalog

The default plugin discovers .md/.markdown files inside the Vite root, excluding hidden directories, node_modules, dist, coverage and artifacts, and never follows symlinks. Discovery is bounded (2,000 files and 10,000 directory entries) and reports truncation. A trusted `file` option restricts discovery to that path. The browser chooses an opaque SHA-256 file ID from GET files and uses file-scoped document/commands/events endpoints. Catalog identity is scoped to the canonical project root. Stores/event hubs are created only for selected files and share the existing per-file transaction queue. Revalidate path containment and symlink absence before reads/writes, including before rename. A missing previously discovered file stays selectable so its UI can recover, but an unknown ID is rejected. No global active file is shared between clients.

`HttpQAStorage` provides catalog loading and creates file-scoped storage instances. The core `QAStorage` interface remains bound to one document, including explicit in-memory/test adapters. Local storage stores only file IDs and tab position, never checklist bodies or notes. Per-file drafts remain in browser memory for the mounted session.

Source opening uses Vite's same-origin editor endpoint directly, with a five-second timeout and redirects rejected. React Grab's `openFile` fallback opens an external website and is excluded from the local-only client workflow. This action never changes Markdown.
