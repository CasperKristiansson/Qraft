# Qraft v0.1 Implementation Specification

Status: implementation-ready  
Audience: internal development use  
Research snapshot: 2026-09-04

## 1. Product definition

Qraft is a development-only React QA drawer backed by a local Markdown file. It lets a tester work through a checklist in the running application, record notes and actionable findings, attach a finding to a live UI element, and share the resulting state with a coding agent through the same `QA.md` file.

The v0.1 product is deliberately small:

> React Grab's element-selection primitives + an original annotation workflow + a Markdown-backed QA checklist drawer.

Qraft is not a hosted service. It has no accounts, database, MCP server, browser extension, AI features, screenshots, or collaboration model.

### The loop

```text
Tester in browser
       │
       │ pass task / add task / record finding
       ▼
Qraft drawer ──HTTP commands──▶ Vite dev-server plugin
       ▲                              │
       │ SSE change event             │ minimal file patch
       │                              ▼
       └──────────────────────────── QA.md
                                      ▲
                                      │ read and edit
                                      │
                                 coding agent
```

The browser never receives permission to write an arbitrary path or replace the whole document. It sends typed operations. The dev-server plugin owns parsing, validation, conflict handling, and filesystem writes.

## 2. Goals and non-goals

### Goals

1. Render an existing `QA.md` as sections, QA tasks, notes, and findings.
2. Let a tester pass or reopen a QA task and automatically move to the next incomplete task.
3. Let a tester create a section or task while testing.
4. Let a tester add a plain note to a task.
5. Let a tester add an actionable checkbox finding to a task.
6. Let a tester select an element in the running React application and attach concise source context to a finding.
7. Persist every meaningful change as a small, human-readable Markdown diff.
8. Watch external edits to `QA.md` and update the drawer without a page reload.
9. Keep the integration development-only and local-only.
10. Preserve Markdown content Qraft does not understand.

### Non-goals for v0.1

- Next.js, Webpack, or framework-neutral server adapters. Vite is the only supported host.
- Cloud or database storage.
- Accounts, authentication, permissions, teams, or concurrent remote testers.
- MCP, agent callbacks, webhooks, or automatic agent execution.
- Screenshots, video, console logs, network traces, or arbitrary attachments.
- AI-authored tasks, summaries, or fixes.
- Linear, Jira, or GitHub Issues integration.
- Browser extensions or use outside a local dev server.
- Rich Markdown editing, drag-and-drop reordering, task deletion, or section renaming.
- Mobile/touch support.
- Copying Agentation source code, styles, assets, or package output.

## 3. Product decisions

These decisions remove ambiguity from the generated concept and keep the first implementation modest.

| Area | v0.1 decision | Reason |
| --- | --- | --- |
| Host framework | Vite only | One bridge to build and test before generalizing. |
| Package shape | One package with `.` and `./vite` exports | Avoid monorepo and adapter overhead. |
| Storage | One Markdown file, default `./QA.md` | Human-readable and directly usable by coding agents. |
| Browser/server transport | Same-origin JSON HTTP commands + SSE notifications | Simple, inspectable, and independent of Vite's private HMR client API. |
| Markdown handling | A constrained line-oriented parser and minimal text patches | A full parse/stringify cycle would reformat user-authored Markdown. |
| IDs | Hidden stable IDs on all Qraft-created entities; lazy IDs for existing content | Stable identity without rewriting a file merely because the dev server started. |
| Task result | Passed or open only | “Skipped” needs a third persisted state and is not necessary for the first useful loop. |
| Findings | Nested checkboxes | Agents and humans can resolve them directly in Markdown. |
| Picker | `react-grab/primitives` | Source context and robust hit testing are the difficult reusable parts. |
| Styling | Shadow DOM, hand-written CSS | Prevent host and drawer styles from leaking into one another without a UI framework. |
| Production | Vite plugin runs only in `serve`; UI is mounted only behind `import.meta.env.DEV` | No filesystem API in preview/production. |

Next.js is the first plausible adapter after v0.1, but it is not part of the initial acceptance boundary.

## 4. Consumer experience

Install from the internal package source and pin the initial dependency version through the lockfile.

```ts
// vite.config.ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { qraft } from "@qraft/qa/vite";

export default defineConfig({
  plugins: [
    react(),
    qraft({ file: "./QA.md" }),
  ],
});
```

```tsx
// src/App.tsx or the application's root layout
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

The file path is configured only on the trusted server plugin. `<QA />` must not accept a filesystem path from the browser.

### Vite plugin options

```ts
export interface QraftViteOptions {
  /** Resolved relative to Vite's project root. Default: "QA.md". */
  file?: string;

  /** Same-origin endpoint prefix. Default: "/__qraft". */
  endpoint?: string;
}
```

Constraints:

- `file` must resolve within Vite's project root and must end in `.md` or `.markdown`.
- The plugin fails startup with a clear error if the configured path escapes the root.
- If the file does not exist, `GET /document` returns an empty document. The first create operation creates it.
- The plugin uses `apply: "serve"`; it registers no middleware or watcher during `vite build` or `vite preview`.

## 5. User interface and behavior

### 5.1 Closed state

A tab is fixed at the vertical center of the right viewport edge:

```text
┌───────────┐
│ QA 7 / 14 │
└───────────┘
```

It shows passed top-level tasks over total top-level tasks. Findings do not change this numerator or denominator.

### 5.2 Open state

The drawer overlays the application. It never changes the host application's width, layout, or scroll position.

Baseline geometry:

```css
position: fixed;
inset: 0 0 0 auto;
width: min(380px, 100vw);
height: 100dvh;
z-index: 2147483647;
```

The list view contains:

- document title and overall progress;
- sections in document order;
- each task's open/passed state and unresolved finding count;
- the currently selected task;
- “Add task” within a section;
- “Add section” at document level;
- loading, parse-warning, conflict, disconnected, and write-error states.

Clicking a task opens its detail view. Selection is browser-local UI state and is not written to Markdown.

### 5.3 Task detail

The task detail shows:

- task title and status;
- notes;
- findings and their open/resolved checkboxes;
- concise element context for attached findings;
- actions: `Add note`, `Add finding`, `Attach element`, and `Pass` or `Reopen`.

`Pass` is disabled while the task has an unresolved finding. Its disabled explanation is “Resolve or remove outstanding findings before passing this task.” Deleting findings is not in v0.1, so an unwanted finding can be checked as resolved and clarified with a note.

After a successful pass, Qraft selects the next open task in document order. At the end, it wraps to the first open task. If none remain, it shows the completed state and keeps the current task selected.

### 5.4 Adding content

- `Add section` requires a non-empty, single-paragraph title and appends an H2 section.
- `Add task` requires a non-empty, single-paragraph title and appends it to the selected section.
- `Add note` records an observation that has no completion state.
- `Add finding` records actionable work as an unchecked nested checkbox.
- Text inputs trim leading/trailing whitespace and collapse embedded line breaks to single spaces in v0.1.
- Empty values and values over 2,000 Unicode code points are rejected client- and server-side.

### 5.5 Element attachment flow

1. The tester opens a task and chooses `Attach element`.
2. The drawer collapses to a small cancel control and picker instructions.
3. Qraft listens for pointer movement and click in the document capture phase.
4. `getElementAtPoint()` chooses a target while filtering out the Qraft host and ignored subtrees.
5. `getElementBounds()` drives a fixed hover outline and label.
6. On click, Qraft prevents the host application click, calls `getElementContext()`, and opens an original Qraft finding form.
7. The tester writes what is wrong and saves it as a finding with the captured context.
8. `Escape` cancels from either picker or form and restores the task detail.

Qraft's Shadow DOM host must carry both `data-qraft-root` and `data-react-grab-ignore`. The picker filter must also explicitly reject the host subtree; the attribute is defense in depth, not the only exclusion mechanism.

The hover label uses `componentName`, then `selector`, then the lowercase tag name. Context resolution can be asynchronous, so pointer requests use a monotonically increasing request number and discard stale results.

Only one element can be attached to one finding in v0.1.

### 5.6 Stored element context

Store only:

```ts
export interface ElementReference {
  route: string;          // location.pathname only
  component: string | null;
  source: string | null;  // normalized repository-relative path
  line: number | null;
  column: number | null;
  selector: string | null;
}
```

Do not persist the DOM element, Fiber object, component stack, HTML preview, computed styles, or page contents. Query strings and hashes are excluded from `route` because they may contain transient or sensitive values.

The detail view offers `Open source` when `source` exists. It calls React Grab's `openFile(source, line)`, which first tries Vite's `__open-in-editor` endpoint. Failure is shown inline and does not modify the finding.

Re-highlighting a stored selector is deferred. React Grab selectors may cross open shadow roots and same-origin iframes using non-standard boundary markers, so implementing it correctly requires a resolver rather than `document.querySelector()`.

### 5.7 Accessibility and host-app safety

- All controls are reachable by keyboard and have visible focus styles.
- The tab exposes progress in its accessible name.
- Opening the drawer moves focus to its heading; closing returns focus to the tab.
- The drawer uses a focus trap because it acts as a modal overlay at narrow widths.
- `Escape` closes the drawer unless a picker/form sub-flow consumes it first.
- Status is expressed in text/icons as well as color.
- UI text is rendered as React text, never injected as raw HTML.
- Qraft does not alter `document.body` overflow or the host application's styles.
- Desktop Chromium, Firefox, and WebKit at viewport widths of 768 px and above are the v0.1 browser target.

## 6. Markdown contract

### 6.1 Canonical example

```md
# Checkout QA

## Authentication <!-- qraft:id=section_4dc6d70a -->

- [x] Login <!-- qraft:id=task_58f14d75 -->
- [ ] Expired session <!-- qraft:id=task_4c4f649b -->
  - Note: Check both idle and absolute expiry. <!-- qraft:id=note_d75fa92d -->

## Cart <!-- qraft:id=section_d98729e1 -->

- [ ] Change quantity <!-- qraft:id=task_e9e53cc7 -->
  - [ ] Alignment jumps when changing quantity from 9 to 10. <!-- qraft:id=finding_758583f2 -->
    - Component: `QuantitySelector`
    - Source: `src/components/cart/QuantitySelector.tsx:87:5`
    - Route: `/checkout`
    - Selector: `.cart .quantity-selector`
- [ ] Remove product <!-- qraft:id=task_6bb032d1 -->
```

IDs shown above are shortened for readability. The implementation generates `section_`, `task_`, `note_`, or `finding_` followed by `crypto.randomUUID()` and treats the whole value as opaque.

### 6.2 Recognized grammar

- The first H1 (`# `) is the document title. If absent, the UI title is `QA`.
- H2 headings (`## `) are sections.
- A top-level GitHub-style checkbox beginning in column 1 is a QA task.
- A checkbox indented by exactly two spaces beneath a task is a finding.
- A bullet beginning with `  - Note:` beneath a task is a note.
- Four-space-indented labeled bullets beneath a finding can be `Component`, `Source`, `Route`, or `Selector` metadata.
- Checkbox markers are case-insensitive for `x`: `[ ]`, `[x]`, and `[X]` are accepted; writes use `[ ]` or `[x]`.
- The Qraft ID comment must be on the entity's first line and match `<!-- qraft:id=... -->`.
- All other Markdown is preserved and ignored by the Qraft domain model.

An entity with no stable ID receives a deterministic session-local locator derived from its line, type, and content so it can render. The first mutation that targets it inserts a stable ID in the same atomic patch. Starting Qraft must never rewrite a file only to add IDs.

Duplicate stable IDs are parse errors. Affected entities render read-only with a warning that names the duplicate ID and line numbers. Qraft never guesses which duplicate to mutate.

### 6.3 Escaping and normalization

- Entity titles are stored as Markdown text, not raw HTML.
- The writer escapes text that would create a new list marker or comment delimiter.
- Element metadata is displayed with an inline-code fence one backtick longer than the longest backtick run in the value.
- Source paths are normalized to `/`, made relative to the Vite root, and omitted if they resolve outside that root.
- Selectors and routes must be single-line strings. NUL and other ASCII control characters are rejected.
- The original file's LF or CRLF newline convention and final-newline presence are preserved.

### 6.4 Status semantics

- A task checkbox means the tester has passed that QA task.
- A finding checkbox means the actionable issue has been resolved by an agent/developer and is ready for or has received human verification.
- Resolving a finding does not automatically pass its parent task.
- Reopening a task does not reopen its findings.
- Qraft never infers task completion from its children.

## 7. Domain model and commands

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
  checked: boolean;
  notes: QANote[];
  findings: QAFinding[];
}

export interface QANote {
  id: string;
  body: string;
}

export interface QAFinding {
  id: string;
  body: string;
  checked: boolean;
  element: ElementReference | null;
}
```

`revision` is the SHA-256 hash of the exact file bytes returned by the server.

The browser sends only this command union:

```ts
export type QACommand =
  | { type: "createSection"; title: string }
  | { type: "createTask"; sectionId: string; title: string }
  | { type: "setTaskChecked"; taskId: string; checked: boolean }
  | { type: "addNote"; taskId: string; body: string }
  | {
      type: "addFinding";
      taskId: string;
      body: string;
      element: ElementReference | null;
    }
  | { type: "setFindingChecked"; findingId: string; checked: boolean };

export interface CommandRequest {
  commandId: string;
  baseRevision: string;
  command: QACommand;
}
```

There is intentionally no “replace document” command.

### Storage abstraction

The React UI depends on an interface, not Markdown or Vite:

```ts
export interface QAStorage {
  getDocument(signal?: AbortSignal): Promise<QADocument>;
  execute(command: QACommand, baseRevision: string): Promise<QADocument>;
  subscribe(onChange: () => void): () => void;
}
```

v0.1 provides only `HttpQAStorage`. `MarkdownDocumentStore` lives server-side and is not imported by the UI. Future storage adapters are possible, but no cloud-shaped fields or unused adapters should be added now.

## 8. Dev-server protocol

The default endpoint prefix is `/__qraft`.

### `GET /__qraft/document`

Returns `200` with `QADocument`, `Cache-Control: no-store`, and an `ETag` equal to the revision. A missing file returns an empty document with the revision of zero bytes.

### `POST /__qraft/commands`

Accepts `CommandRequest` as `application/json`. Maximum request body is 32 KiB.

Responses:

- `200`: command applied; returns the new `QADocument`.
- `400`: invalid JSON, command, field, or Markdown target.
- `404`: referenced entity no longer exists.
- `409`: revision conflict or duplicate-ID ambiguity; returns the latest document when safe.
- `413`: request exceeds the size limit.
- `500`: read/write failure with a user-safe message; no stack trace is sent to the browser.

### `GET /__qraft/events`

An SSE stream. Events are only invalidation signals:

```text
event: document-changed
data: {"revision":"..."}
```

The client refetches the document; the event does not contain file contents. Send an SSE comment heartbeat every 20 seconds so proxies and browser tooling do not treat an idle local connection as dead. Reconnect with capped exponential backoff.

### Same-origin and method safeguards

- Register only on the Vite development server.
- Accept requests only when `Origin` is absent or matches the request host and protocol.
- Permit only the defined paths and methods.
- Require `Content-Type: application/json` for commands.
- Do not add permissive CORS headers.
- Do not accept a path in any browser request.

This is a local development safeguard, not an authentication system.

## 9. File mutation and external-edit safety

The Markdown store must patch the smallest recognized span instead of serializing the domain model.

Examples:

- passing a task replaces only the single checkbox character;
- assigning a missing ID appends only the ID comment to that entity line;
- adding a finding inserts lines at the end of that task's owned block;
- adding a task inserts lines at the end of the section's task block;
- adding a section appends a blank-line-normalized H2 block.

### Mutation algorithm

1. Read the exact file bytes and compute `readRevision`.
2. If `baseRevision !== readRevision`, return `409`; do not silently apply against a document the browser has not seen.
3. Parse and validate the target entity and command invariants.
4. Produce an in-memory minimal text patch.
5. Immediately re-read or re-hash the on-disk file before committing the write.
6. If it changed after step 1, return `409` and do not write.
7. Write a temporary sibling file, flush/close it, and rename it over the target.
8. Preserve the original file mode when replacing an existing file.
9. Publish one change event after the watcher observes or the store completes the write; coalesce duplicate events by revision.

All commands execute through a per-file promise queue, preventing two browser commands from racing each other. External editor changes are guarded by the second revision check.

No file lock is required for v0.1. A conflict keeps both parties safe and asks the tester to retry against the refreshed document.

## 10. Repository and module layout

Keep one package at the repository root:

```text
Qraft/
├── docs/
│   └── qraft-v0.1-implementation-spec.md
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
├── LICENSE
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

Use TypeScript, React as a peer dependency, Vite as a peer dependency of the `./vite` entry, Vitest for unit/integration tests, and Playwright for end-to-end tests. Do not add a state-management library, CSS framework, Markdown renderer, database, WebSocket library, or separate watcher dependency unless implementation evidence proves it necessary. Vite's watcher is sufficient.

Pin `react-grab` to the verified `0.2.0` API for the first implementation rather than using a floating range; the primitives surface is actively evolving. Upgrades should be explicit and covered by picker/open-file tests.

## 11. Error and recovery behavior

| Failure | UI behavior | Filesystem behavior |
| --- | --- | --- |
| `QA.md` missing | Empty state with “Add section” | Created only on first mutation. |
| Unsupported Markdown nearby | Render known entities and show diagnostics | Preserve unknown text. |
| Duplicate ID | Affected entities read-only; show line-level warning | No ambiguous mutation. |
| External edit during form entry | Keep draft, refresh document, require user to save again if target still exists | No overwrite. |
| Revision conflict on command | Refetch, keep unsaved input, show “QA.md changed; review and retry” | No write. |
| SSE disconnect | Show subtle disconnected state; reconnect and refetch | No effect. |
| File write fails | Show persistent error and retry action | Original file remains intact. |
| Element has no React source | Allow finding with selector/route or no attachment | Finding still saves. |
| `getElementContext()` fails | Return to form with plain finding option | No write until user saves. |
| Open-source action fails | Inline error with path available to copy | No document mutation. |

Unsaved note/finding text remains in component state across a document refetch as long as the parent task ID still exists.

## 12. Verification strategy

### Unit tests: Markdown and domain

- Parse H1/H2, tasks, notes, findings, metadata, LF, and CRLF.
- Accept `[x]` and `[X]`; emit canonical `[x]` only for touched markers.
- Preserve unknown headings, paragraphs, comments, lists, spacing, and final newline.
- Patch exactly one checkbox character for status changes.
- Add an ID lazily when mutating legacy content.
- Reject duplicate IDs and invalid nesting.
- Escape titles and metadata without creating unintended Markdown structure.
- Normalize and reject source paths outside the project root.
- Produce stable progress counts and next-task ordering.
- Block passing a task with unresolved findings.

Golden-file tests must compare the full before/after document byte-for-byte, not only the parsed domain model.

### Integration tests: Vite middleware and store

- Empty/missing document flow.
- GET document, POST each command, and SSE invalidation.
- Content type, body limit, origin, method, and endpoint checks.
- Stale `baseRevision` returns `409` without writing.
- External edit between read and rename returns `409` without data loss.
- Atomic replacement preserves file mode and newline style.
- Watcher events are coalesced by revision.
- `vite build` exposes no Qraft middleware.

### End-to-end tests: Playwright example app

- Open/close drawer without changing host layout dimensions.
- Render checklist and progress from a fixture file.
- Pass/reopen and auto-advance.
- Add section, task, note, and finding; verify exact file result.
- External fixture edit updates the open drawer without reload.
- Picker ignores Qraft UI, highlights a host element, suppresses its click, captures context, and saves a finding.
- Escape cancels picker without a write.
- Open source calls the Vite editor endpoint with the normalized file and line.
- Keyboard focus and narrow 768 px viewport behavior.

E2E tests must use a temporary copy of `QA.md` per test worker so tests cannot mutate a developer's real checklist.

## 13. Implementation sequence

Each milestone should end in a usable, tested vertical slice. Do not build later adapters in parallel.

### Milestone 1 — Package shell and Markdown read model

- Create the single-package TypeScript build and export map.
- Define the domain model, command schemas, and validation helpers.
- Implement the constrained parser, diagnostics, stable-ID recognition, and golden fixtures.
- Add the Vite example app and a representative `QA.md`.

Exit: a test can parse a real checklist into the complete read model without changing its bytes.

### Milestone 2 — Safe Markdown command engine

- Implement minimal patches for all six commands.
- Add lazy stable-ID insertion.
- Add revision hashing, per-file command queue, second pre-write revision check, atomic sibling-file rename, and file-mode preservation.
- Cover every operation with exact before/after golden tests and conflict tests.

Exit: all supported browser actions can be expressed as safe, minimal Markdown changes without a server or UI.

### Milestone 3 — Vite bridge and live updates

- Implement route/method/origin/body validation.
- Add document and command endpoints.
- Add SSE clients, heartbeat, watcher integration, and revision-based event coalescing.
- Confirm the plugin is development-server-only.

Exit: a small script can read, mutate, externally edit, and live-refresh a fixture through a real Vite dev server.

### Milestone 4 — Drawer workflow

- Mount the isolated Shadow DOM UI.
- Implement tab, list, progress, task detail, pass/reopen, auto-advance, add section/task, loading/error/conflict states, and HTTP storage.
- Add notes and plain findings.
- Add keyboard/focus behavior and responsive overlay geometry.

Exit: the full QA loop works in the example app without element attachment.

### Milestone 5 — React Grab attachment

- Integrate the pinned primitives APIs.
- Implement capture-phase picking, stale-request cancellation, overlay geometry, Qraft subtree exclusion, Escape cleanup, and original finding form.
- Normalize and persist the limited `ElementReference` fields.
- Add `Open source` with inline error handling.
- Add the required React Grab notice to `THIRD_PARTY_NOTICES.md`.

Exit: a tester can attach a live React element to a finding and open the stored source location from the drawer.

### Milestone 6 — Hardening and internal release

- Complete browser E2E coverage and malformed-file fixtures.
- Verify no production/preview middleware and document the dev-only integration.
- Document the supported Markdown dialect, recovery steps, and limitations.
- Run typecheck, unit/integration tests, package build, and Playwright tests from a clean checkout.

Exit: all v0.1 acceptance criteria below pass in a clean internal consumer project.

## 14. v0.1 acceptance criteria

v0.1 is complete only when all statements are true:

1. A Vite React app can add the plugin and `<QA />` using the documented integration.
2. The drawer overlays rather than resizes the host application.
3. An existing compatible `QA.md` renders without being rewritten on startup.
4. Passing or reopening a task changes only the intended checkbox marker plus a lazy ID when required.
5. Adding a section, task, note, or finding produces canonical, readable Markdown with stable IDs.
6. A task with an unresolved finding cannot be passed in the UI or command layer.
7. External file edits appear in the drawer without a page reload.
8. A stale browser revision cannot overwrite an external edit.
9. Element selection ignores Qraft's own UI and does not trigger the selected host control.
10. A saved attachment contains at most route pathname, component, repository-relative source/line/column, and selector.
11. `Open source` uses the stored normalized path and fails safely.
12. Unknown Markdown outside Qraft-owned lines survives every supported mutation byte-for-byte.
13. Vite production builds and preview servers expose no Qraft filesystem endpoints.
14. Unit, integration, package-build, and three-browser Playwright suites pass from a clean checkout.
15. The repository contains React Grab's required license notice and contains no Agentation source, assets, or copied styling.

## 15. Deferred backlog driven by use

Candidates for v0.2, in likely value order:

1. Filter by remaining tasks or open findings.
2. Search.
3. Current/next/previous keyboard shortcuts.
4. Route-based task filtering.
5. Re-highlight a stored React Grab selector with correct shadow-root/iframe support.
6. Rename and reorder tasks/sections.
7. Explicit skipped state, after its Markdown representation is agreed.
8. Next.js adapter using the same server-side store and protocol.

Cloud synchronization is deferred until simultaneous multi-person testing becomes a real requirement.

## 16. Upstream and licensing boundary

The research for this specification inspected these public upstreams at fixed revisions:

- [React Grab](https://github.com/aidenybai/react-grab), commit `ea4bbec9e80f4802e8ae19ad18431edb9ddbb670`. Its package declares MIT and its `react-grab/primitives` entry exports the selection/context APIs used by this design.
- [petite-react-grab](https://github.com/aidenybai/petite-react-grab), commit `c013b3ac5318d45e2a68d39a738415f45685592c`. This MIT-licensed reference demonstrates a small custom UI using React Grab context, capture-phase listeners, and an isolated host.
- [Agentation 3.0.2 on npm](https://www.npmjs.com/package/agentation), consulted only to understand its documented interaction concepts and current PolyForm Shield 1.0.0 license.

Implementation rules:

1. Depend on `react-grab@0.2.0` and import its published primitives rather than vendoring its internals.
2. If any React Grab or petite-react-grab source is copied or substantially adapted, preserve the applicable MIT copyright and permission notice in the source/distribution as required.
3. Do not add `agentation` as a dependency and do not copy its source, generated bundle, CSS, visual assets, or distinctive implementation details.
4. Qraft may implement generic interaction ideas—activate, hover, select, annotate—in original code and visual design.
5. Re-check upstream versions, exports, and license metadata before a public or commercial release; this snapshot supports the internal v0.1 plan only and is not legal advice.

## 17. Definition of done for each implementation change

A change is done when:

- its behavior is covered at the lowest useful test layer;
- Markdown mutations have exact full-file fixtures;
- filesystem and transport failures leave `QA.md` intact;
- the example app demonstrates the behavior;
- user-visible errors explain the recovery action;
- typecheck, relevant tests, and package build pass;
- the diff contains no unrelated framework, hosted-service, or future-adapter work.

