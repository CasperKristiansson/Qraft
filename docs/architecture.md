# Technical architecture

This document owns module boundaries, runtime composition and package decisions. [Product requirements](product-requirements.md) owns workflow; [design](design.md) owns presentation.

## Modules and dependencies

| Layer                        | Responsibility                                                                                    | Boundary                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/domain`                 | Document types, typed commands, validation, status/progress                                       | No React, HTTP, filesystem or framework imports                                                |
| `src/markdown`               | Parse recognized spans, preserve bytes, assign lazy IDs, patch, check revisions and replace files | Server-only; no full-document serialization                                                    |
| `src/server`                 | Catalog, exact routes, request bounds, errors, SSE and file-runtime lifecycle                     | Standard Request/Response; delegate all mutations to the store                                 |
| `src/client`                 | Shadow DOM UI, review session, forms, QAStorage transport, picker and recovery                    | Render text; no filesystem or Markdown parser imports                                          |
| `src/vite.ts`                | Compose project service with Vite middleware and existing watcher                                 | `apply: serve`; no build/preview routes                                                        |
| `src/next.ts`                | App Router Node route factory, polling, hot-reload runtime reuse                                  | Refuse non-development requests before initializing storage                                    |
| `src/setup` and `src/cli.ts` | Read-only setup/doctor diagnostics and bundled guide output                                       | Inspect bounded files and installed metadata, never execute host config or modify dependencies |

The browser receives domain documents, project-relative labels and opaque file IDs. It sends typed commands and exact base revisions. It never sends parser offsets, filesystem paths or replacement documents. `QA` depends on the bound [QAStorage interface](../src/client/storage.ts); the default HttpQAStorage owns file-scoped HTTP/SSE. Custom adapters stay in memory and introduce no unused cloud fields.

`QA` composes task/detail views, session recovery and storage orchestration. Review session schema and identity reconciliation are independent from rendering. Only a confirmed local command may map legacy identities using preserved entity order. External edits never authorize guessing where an unsaved note, edit or task title belongs.

## Model and command authority

The maintained definitions are [model.ts](../src/domain/model.ts) and [commands.ts](../src/domain/commands.ts), rather than duplicated interfaces in documentation. Revision is SHA-256 of exact file bytes. Commands create sections/tasks, set a task's three-state status, add notes with optional observation/element context, and edit a note body. `setTaskChecked` remains a compatibility command; `checked` projects completed status. There is no replace-document operation.

Task statuses and notes are independent. Duplicate or malformed IDs are read-only mutation targets. Recognized instructions are read-only. Unsectioned top-level checklists use a synthetic section in memory without creating a heading on disk. The grammar and all write semantics belong to [Markdown storage](markdown-storage.md).

## Capture and privacy bounds

New notes record capture pathname and CSS viewport width/height independently of optional element attachments. Exclude query strings and hashes. Capture begins with composition/attachment and survives navigation; body-only edits preserve that context.

An attachment has component/source/line/column and a selector. Source paths are normalized to repository-relative `/` paths on reads, writes and conflicts; omit outside-root and dependency paths. Optional context is bounded to tag (80 characters), the allowlisted identifying attributes (300 characters each), selected visible text (300 characters), five ancestor descriptions (300 characters each), and five deduplicated source locations (component 200, source 2,000, positive nullable line/column). Inspect at most 40 raw React Grab frames before filtering. Never persist raw stacks, arguments, DOM/Fiber objects, full HTML, styles, form values or unrestricted page content.

Use only `react-grab/primitives` for public selection/context APIs. Qraft owns its overlay, held target, asynchronous cancellation and failure fallback. Closed shadow roots and cross-origin frames remain inaccessible. Source opening uses Vite's local endpoint with a five-second timeout and redirects rejected; Next.js retains source for manual navigation. React Grab's external editor fallback is excluded.

## State and lifecycle

- UI/styles mount in Shadow DOM. Nonmodal Radix composition never locks body scrolling. Overlay mode preserves host layout; the opt-in page-space hook reserves measured drawer width using reversible document-root styles on wide screens. Its observers and owned style overrides are cleaned up on exit/unmount. Design specifies focus containment for an unpinned narrow sheet and nonmodal pinned/compact review.
- Local storage holds selected file ID, edge position and project pin/page-space preferences. Versioned session storage holds tab/project/file drafts and view state, bounded to 512,000 characters per file and 20 files per tab. Never evict unsaved work or overwrite malformed saved data silently. Reload/HMR/server restart are recoverable; tab closure is not guaranteed.
- Confirmed mutations invalidate older in-flight reads. Read recovery clears read errors; synchronization does not hide actionable save/conflict errors. Dirty edits retain the original body and revision for external-change detection.
- Catalog discovery uses the canonical project root, skips hidden/dependency/output directories and symlinks, and stops at 2,000 files or 10,000 entries. Trusted `file` configuration restricts the chooser; no filename is auto-selected. Revalidate paths before access and replacement.
- Each project has at most 32 file runtimes; idle eviction disposes watchers and events. Streams, commands and response caches have the bounds in [protocol](dev-server-protocol.md). Next.js reuses up to eight project runtimes across hot reloads and polls selected files every 750 ms with non-persistent watchers.
- Writes use a per-file process queue, cooperative exclusive sibling lock, bounded UTF-8 reads, staged durable bytes, then the final path/revision check and rename. `write-file-atomic` writes the staging file; Qraft owns final conditional replacement. See Markdown storage for crash recovery and the remaining arbitrary-editor race boundary.

## Package and compatibility

One root package exports `.`, `./vite`, and `./next`, with matching declarations. A types/typesVersions fallback supports the older TypeScript resolver generated by Next.js 15 without requiring a host tsconfig rewrite. The browser entry includes a use-client directive and excludes server code. The `qraft` executable offers read-only `doctor`, `setup` and `guide` commands. `guide` reads the bundled skill relative to the executable, independently of the current working directory. Archives contain built output, the portable skill, documentation and third-party notices. No registry publication is implied.

`skills/qraft-review/SKILL.md` is the single workflow guide for agent-assisted human checklist creation.
The owner-approved skill is inert package content, not an agent runtime or application dependency.
Installation into a host agent is explicit; there are no install hooks, agent-config writes, or custom
installer. Optional root `QRAFT.md` is project context read by the guide, not a parsed Qraft config.
Installed copies are snapshots and are refreshed explicitly. The Markdown contract remains the
parser authority; guidance cannot add syntax or promise conflict-free external editor writes.

The first-review example uses `review.config.ts` and an exclusive initial copy of `first-review.md`
to ignored `review.local.md`; restarts preserve existing bytes. The automated `dev` fixture remains
separate and may reset only its disposable `QA.local.md`. Neither example runs remote actions.

Consumer ranges are React/React DOM `^19.2.8` (matching versions), Vite `^7.3.6 || ^8.2.2`, Next.js `^15.5.25 || ^16.3.3`, and Node `^22.23.0 || ^24.19.0`. Vite and Next are optional peers. Development dependencies remain exact pins in [package.json](../package.json) and the lockfile; the repository toolchain uses Node 24.19.0. Range declarations do not mean every patch combination was tested: acceptance records exact current and maintenance profiles. Never upgrade a host application's framework merely to install Qraft.

The Next route endpoint excludes Next's `basePath`; the browser endpoint includes it. Set a monorepo root explicitly when review files live outside the app working directory. A trusted local gateway may configure one exact browser origin; forwarded headers never authorize access. Do not mark the client package as a server external.

## Dependency decisions

Use the existing Radix Dialog/FocusScope, Lucide, Zod, React Grab and write-file-atomic packages for their narrow documented roles. No extra state library, CSS framework, serializer, transport or watcher package is introduced. Prettier formats owned files; boundary lint, strict unused/type checks and behavior tests remain separate checks. [Upstream and licensing](upstream-and-licensing.md) owns provenance and notices.

Setup diagnostics use built-in Node APIs and static hints only. They detect the app workspace, installed versions, conventional integration files and leftover writer locks, and print integration/removal instructions. They do not execute config, select Markdown, remove locks or promise that static inspection proves runtime correctness.

## Verification and errors

Typed server errors expose safe recovery messages rather than stacks or absolute paths. A write whose outcome is uncertain must not be described as leaving the original unchanged. A listener failure after a confirmed rename cannot turn success into a failed save. Picker/editor errors never write the file.

Consumer development guards and independently disabled production adapters must both be tested. Source fingerprints, artifact digests, clean-install/build/production checks and integrated browser evidence follow [testing and acceptance](testing-and-acceptance.md). Passing local checks does not publish, deploy or establish physical-device/network support.
