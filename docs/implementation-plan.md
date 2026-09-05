# Owner feedback revision — complete, 2026-09-05

The original M1–M6 acceptance below remains historical evidence for commit 7dae055. The owner approved a notes-only review workflow, three task states, editable attached notes, a compact draggable tab, simplified details, and remembered project file selection. Changed contracts are owned by the existing canonical documents. The revised local candidate now satisfies all 16 acceptance criteria, with current evidence in the final owner-feedback record below.

Execution: update contracts → domain/Markdown goldens → file catalog and safety tests → UI/picker/browser regressions → final root checks and fresh screenshot review → commit/push (owner authorized), without waiting on hosted CI. Use focused checks during edits and one final aggregate candidate; repeat only after a relevant change or recorded diagnosis. No dependencies or external resources are needed.

# Qraft v0.1 Codex Goal-mode execution plan

## Historical status — original v0.1 acceptance

- Current state: M1–M6 and all 16 acceptance criteria are complete for the local internal v0.1 candidate, with final evidence below.
- Active milestone: none — local roadmap complete; no external delivery is authorized or claimed.
- Branch/worktree: `main` at `d2fb66d50db8413c00ad4893bb987e1e0c319e36`; clean at the start of the 2026-09-05 resumption. Preserve all subsequent uncommitted work.
- Last validation: 2026-09-05 final isolated `check`, `test:browser`, `audit:release`, and `verify:consumer` passed; final packed `@Browser` acceptance passed at all three required viewports.
- Requested delivery boundary: complete local internal v0.1 candidate. Commit, push, package publication, deployment, or public release requires separate authority.

## Background and context

Qraft is a development-only React QA drawer backed by a local `QA.md`. A tester uses the running application to pass tasks, add notes/findings, and attach a live React element. A coding agent reads and updates the same Markdown. The browser sends typed commands to a local Vite plugin; it never writes a path or whole document.

The implementation should reuse proven open-source packages and study focused implementation patterns instead of recreating difficult accessibility, element-selection, validation, icon, build, test, and atomic-write machinery. Reuse must remain deliberate: Qraft owns its workflow, data model, Markdown patcher, visual system, and composition.

## Source of truth

Read in this order before implementation:

1. `AGENTS.md`
2. `docs/README.md`
3. `docs/product-requirements.md`
4. `docs/architecture.md`
5. `docs/markdown-storage.md`
6. `docs/dev-server-protocol.md`
7. `docs/design.md`
8. `docs/testing-and-acceptance.md`
9. `docs/upstream-and-licensing.md`
10. This plan, including its exact OSS allowlist and current evidence log

Visual source of truth:

- `docs/visuals/qraft-v0.1-visual-direction.png`
- Locked digest: `ba14d7f37f19b257c521b31c5b2293f2f40a2dd69e817f65fd66d46b11315850`

Preservation rules:

- Preserve the original scope, milestone meaning, and unchecked state.
- Do not mark an item complete without the evidence required by its checkpoint.
- Do not delete ambiguous work; record it under blockers/decisions.
- A contract change must update its canonical owning document in the same change.
- Written functional and accessibility requirements override ambiguous image details. Material visual changes require owner review.

## Operating rules

- One roadmap owns M1–M6. Milestones are internal checkpoints, not separate goals or automatic releases.
- Work sequentially. Do not stop after one milestone while safe roadmap work remains.
- Use the fastest relevant automated check during edits and broader gates only at the declared checkpoint.
- **Mandatory Browser rule:** use the actual `@Browser` surface during every milestone. Playwright does not replace this interactive inspection.
- At each Browser checkpoint, record date, source revision, URL, viewport, journey, result, and screenshot path when visual behavior changed.
- Use deterministic Vite example routes and fixtures. Never exercise a developer's real `QA.md` during tests.
- Reuse only the exact OSS repositories and roles allowlisted below. A new dependency/reference needs a demonstrated gap and updates to this plan, architecture, and licensing documents.
- Do not copy entire components or subsystems from structural references. Extract the lifecycle, contract, state model, accessibility behavior, and test cases; implement a smaller Qraft-owned composition.
- Keep provenance: source repo, commit, inspected path, reused idea, and Qraft destination belong in the evidence log.
- Do not use Agentation source, CSS, assets, bundles, or package code.
- Keep local-only and Vite-only v0.1 boundaries intact.
- Create coherent local commits only when the active implementation request authorizes commits. Push only when a remote exists and the user explicitly requests delivery.

## Exact open-source reuse allowlist

The inspected commits are frozen research references. Published versions are exact initial package pins. Do not float ranges during v0.1.

### Direct runtime/build dependencies

| Repository and inspected commit | Exact package | License | Approved use |
| --- | --- | --- | --- |
| [`facebook/react`](https://github.com/facebook/react) `d9f4e76bd6582ef86048fefcedda9d5b041ae62f` | `react@19.2.8`, `react-dom@19.2.8` | MIT | Component runtime, portals, hooks, and Shadow DOM-mounted application tree. Do not copy React internals. |
| [`vitejs/vite`](https://github.com/vitejs/vite) `8492422b8f110625a90c702f42f30784e8cf19dc` | `vite@8.2.2` | MIT | Package/example build plus public `apply: "serve"`, `configureServer`, `closeServer`, middleware, watcher, and `normalizePath` APIs. |
| [`aidenybai/react-grab`](https://github.com/aidenybai/react-grab) `ea4bbec9e80f4802e8ae19ad18431edb9ddbb670` | `react-grab@0.2.0` | MIT | Public `react-grab/primitives`: hit testing, bounds, source context, selector, grabbability, and editor opening. |
| [`radix-ui/primitives`](https://github.com/radix-ui/primitives) `f7ecd5ab16f5e1e820eb5786a1419a98a2d594ae` | `@radix-ui/react-dialog@1.1.23`, `@radix-ui/react-focus-scope@1.1.16` | MIT | Custom portal container, Escape/outside interaction/focus restoration in non-modal drawer mode; add explicit focus trapping only for the narrow modal presentation. Do not permit body scroll locking or copy internals. |
| [`colinhacks/zod`](https://github.com/colinhacks/zod) `7a00236683c79000dbab0d92f6faf0b7fba39f59` | `zod@4.5.4` | MIT | Shared runtime validation for plugin options, command requests, strict unions, IDs, revisions, and safe server inputs. Domain types remain Qraft-owned. |
| [`npm/write-file-atomic`](https://github.com/npm/write-file-atomic) `23e111d95367e1d987c1b4d7823791eaaf6b21df` | `write-file-atomic@8.0.0` | ISC | Server-side temp sibling, fsync, mode/ownership preservation, rename, cleanup, and same-target write serialization. Qraft still owns the full read/patch/revision command queue and second revision check. |
| [`lucide-icons/lucide`](https://github.com/lucide-icons/lucide) `4dc5b7ebaed733642fae0382238d71a147fb5c7d` | `lucide-react@1.41.0` | ISC, with Feather-derived icons under MIT | One icon family for check, target, plus, arrow, warning, close, file, and status cues. Import only used icons and preserve notices. |

### Direct development dependencies

| Repository and inspected commit | Exact package | License | Approved use |
| --- | --- | --- | --- |
| [`vitest-dev/vitest`](https://github.com/vitest-dev/vitest) `9e1166959e14bd32298d8a0e85352431c769ec7a` | `vitest@5.0.0` | MIT | Domain, parser, golden-file, store, middleware, and component-level tests. |
| [`microsoft/playwright`](https://github.com/microsoft/playwright) `d1dcd6bc0a138ec0fd943df19e07458dc426ee22` | `@playwright/test@1.62.1` | Apache-2.0 | Repeatable Chromium/Firefox/WebKit journeys, layout measurements, keyboard/accessibility behavior, and regression screenshots. |
| [`microsoft/TypeScript`](https://github.com/microsoft/TypeScript) `2bd066d87f5bafd315be9f40889d0a60b9e58e0b` | `typescript@7.0.2` | Apache-2.0 | Development compiler, typecheck, and declaration emission required by the package contract. |
| [`DefinitelyTyped/DefinitelyTyped`](https://github.com/DefinitelyTyped/DefinitelyTyped) published tarballs locked by integrity in `pnpm-lock.yaml` | `@types/node@26.4.1`, `@types/react@19.2.18`, `@types/react-dom@19.2.7` | MIT | Development-only Node, React, and React DOM declarations. |
| [`vitejs/vite-plugin-react`](https://github.com/vitejs/vite-plugin-react) `04cac5020e349f452d76c5a4f6d788ad4b38930a` | `@vitejs/plugin-react@6.1.1` | MIT | Public React transform and refresh plugin for the deterministic Vite example. |

### Structural references only

| Repository and inspected commit | Inspect exactly | Extract structurally | Do not do |
| --- | --- | --- | --- |
| [`aidenybai/petite-react-grab`](https://github.com/aidenybai/petite-react-grab) `c013b3ac5318d45e2a68d39a738415f45685592c` | `src/index.tsx` and its tests/demo configuration | Capture-phase listener lifecycle, own-UI exclusion, async request sequencing, overlay cleanup, and small custom interface around React Grab context. | Do not copy the whole component/CSS or add `isolet-js`; Qraft already owns a React Shadow DOM shell. |
| [`shadcn-ui/ui`](https://github.com/shadcn-ui/ui) `7c9eaba1c0a6404c990c144a654792e3313c650d` | `apps/v4/registry/bases/radix/ui/{button,dialog,textarea,progress,badge}.tsx` | Thin source-owned wrappers, semantic slots, compact component APIs, state attributes, and accessible composition over Radix. | Do not install shadcn, Tailwind, or Vaul; do not copy its Drawer or theme; implement Qraft-owned CSS/tokens from the approved visual. |
| [`vitejs/vite`](https://github.com/vitejs/vite) same commit | `docs/guide/api-plugin.md`, `docs/guide/api-javascript.md`, related plugin tests | Public hook lifecycle, middleware ordering, server disposal, file watching, path normalization, and serve-only application. | Do not import Vite private modules or copy internal server implementation. |
| [`npm/write-file-atomic`](https://github.com/npm/write-file-atomic) same commit | `lib/index.js`, `test/concurrency.js`, `test/integration.js` | Understand guarantees, queue scope, fsync/mode behavior, temp cleanup, and failure cases so Qraft does not claim unsupported locking. | Do not reimplement the package or mistake its write queue for Qraft's complete read-modify-write transaction. |
| [`radix-ui/primitives`](https://github.com/radix-ui/primitives) same commit | `packages/react/dialog/src/dialog.tsx`, `packages/react/focus-scope/src/focus-scope.tsx`, `packages/react/dismissable-layer/src/dismissable-layer.tsx` and tests | Understand portal-container, focus-return, outside-pointer, nested layer, and Escape behavior needed in Shadow DOM. | Do not copy Radix internals; validate the published package in Qraft's actual ShadowRoot. |

### Explicitly excluded

- `agentation@3.0.2` and any Agentation repository/package source: documented interaction concepts only; no source inspection for reuse, dependency, CSS, asset, icon, bundle, or implementation copying.
- `remark`, `unified`, or another Markdown serializer: the v0.1 writer must preserve unknown Markdown and patch exact source spans.
- Vaul, Tailwind, another component system, another icon library, a state store, another watcher, or a WebSocket/SSE library unless a demonstrated gap is recorded and approved.

### Reuse procedure

For every structural extraction:

1. Read the pinned file and its relevant tests.
2. Write down the behavior/invariant being reused, not just the visual result.
3. Decide whether the published package already provides the behavior.
4. If Qraft-owned code is still needed, implement the smallest original version using Qraft names and contracts.
5. Add a focused test derived from the invariant, not copied test prose/data.
6. Record provenance in the evidence log.
7. Add required license notices for any copied or substantially adapted lines; ordinary package use still receives a final lockfile/license audit.

## Execution contract and budgets

Checkpoint types:

- `implementation`: targeted checks plus mandatory `@Browser`; broader gates explicitly deferred.
- `risk`: all affected focused boundaries plus mandatory `@Browser` against the integrated slice.
- `integrated-candidate`: complete local gate, package-consumer check, full `@Browser` acceptance, and coherent local delivery state.
- No `live` or `final-release` checkpoint exists because v0.1 is a local developer tool and external delivery was not authorized.

Retry invariant:

- Do not rerun an unchanged failed command or Browser journey unless code/input, external state, authority/session, or the recorded diagnostic hypothesis changed.

Execution budget:

- Complete local gates: at most 2 per integrated candidate and 1 final clean-checkout gate.
- Focused test reruns: as needed only after a relevant code/input change.
- `@Browser` checkpoints: exactly one complete focused pass per milestone, plus targeted reruns after changed UI/runtime behavior and one final acceptance pass.
- Browser viewport set for visual milestones: 1440×900, 1366×650, and 768×900; low-level milestones may use 1440×900 only when layout is not under test.
- Deployments: 0.
- Hosted CI watches: 0 unless a remote/push is separately authorized.
- Package publication/release attempts: 0.
- Authority transitions: 0 expected.
- Deliberate context handoffs: up to 2, after M3 and M5 if needed.

Crossing a budget triggers diagnosis and a plan/evidence update. It never permits skipping required proof.

## Evidence inheritance and freshness

- The approved visual remains fresh only while its file digest matches the locked SHA-256 and the owner has not superseded it.
- Upstream research remains pinned to the exact commits above. A package-version or inspected-commit change invalidates its compatibility/license evidence.
- Domain/Markdown evidence remains reusable only when grammar, command schemas, normalization, patch logic, or fixtures are unchanged.
- Protocol evidence becomes stale when middleware, schemas, origins, watcher behavior, endpoint paths, or Vite version changes.
- UI evidence becomes stale when components, tokens, Shadow DOM mounting, Radix version/configuration, viewport behavior, or relevant copy changes.
- Picker evidence becomes stale when React Grab version, filter/listener lifecycle, overlay geometry, persisted context, or example host changes.
- A later milestone may inherit earlier evidence only by naming the unchanged fingerprints. Ambiguity fails closed.

## Validation reference

M1 must create these root script contracts; after that `package.json` is exact command authority:

- Active development: `corepack pnpm test -- <focused target>` and `corepack pnpm typecheck`
- Formatting: `corepack pnpm format:check`
- Lint: `corepack pnpm lint`
- Risk checkpoint: `corepack pnpm test` plus affected Playwright project/test
- Package candidate: `corepack pnpm build`
- Complete local gate: `corepack pnpm check`
- Browser automation: `corepack pnpm test:browser`
- Example server for interactive evidence: `corepack pnpm dev` at deterministic `http://127.0.0.1:5173`

Toolchain baseline for M1:

- Node `24.19.0`
- pnpm `11.25.0` through Corepack

Discovery rule: if a command is missing or the toolchain changes, inspect `AGENTS.md`, root `package.json`, lockfile, Vite/Vitest/Playwright config, and CI before choosing a replacement. Update this section rather than silently inventing a second command.

## Milestone index

- [x] M1: Establish package, read model, and browser-visible foundation
- [x] M2: Implement safe Markdown command engine
- [x] M3: Deliver Vite bridge and live synchronization
- [x] M4: Build the approved drawer workflow
- [x] M5: Integrate React Grab element attachment
- [x] M6: Harden and prove the complete local candidate

## Primary goal command

```text
/goal Complete the Qraft v0.1 roadmap from docs/implementation-plan.md. First read AGENTS.md and every source-of-truth file listed by the plan, including the locked visual at docs/visuals/qraft-v0.1-visual-direction.png and the exact OSS reuse allowlist. Work through M1–M6 sequentially; do not stop after one milestone while safe in-scope work remains. Use only the pinned direct dependencies and structural-reference roles, record provenance, and never copy whole upstream components or use Agentation source. At every milestone, start the deterministic example and use @Browser to inspect the nearest integrated behavior, recording revision, URL, viewport, journey, outcome, and visual evidence when applicable; Playwright does not replace this pass. Use targeted checks during edits, focused gates at risk checkpoints, and the complete local check plus clean-consumer and final Browser journeys only for M6. Check items only after required evidence exists. Never rerun an unchanged failure without a recorded delta or new hypothesis. Preserve user changes and Markdown bytes, keep Vite/local-only scope, and do not push, publish, deploy, or create external resources without separate authority. If context becomes unsafe after M3 or M5, write the compact handoff state and continue the same roadmap. Finish only when all 16 acceptance criteria have current evidence or record the exact blocker without marking it done.
```

## Milestones

### M1 — Establish package, read model, and browser-visible foundation

Purpose:

Create the smallest buildable package, deterministic example, design tokens/shell, and read-only Markdown model so later work starts from verified contracts and an inspectable browser surface.

Checkpoint type:

- `implementation`

Scope:

- Root package/toolchain, client/server exports, domain read model, constrained parser, fixtures, example Vite app, locked visual tokens, and a read-only checklist preview.

Out of scope:

- File mutation, HTTP commands, SSE, full drawer workflow, and element picking.

Read first:

- All source-of-truth documents.
- React/Vite direct-dependency rows.
- Shadcn button/progress/badge structural files only.

Changed boundaries:

- Package/build graph, public exports, domain model, Markdown read grammar, example runtime, and visual-token baseline.

Evidence inheritance:

- Documentation and visual digest remain valid if unchanged. No implementation evidence exists yet.

Tasks:

- [x] Pin Node `24.19.0`, pnpm `11.25.0`, package manager metadata, exact dependency versions, and lockfile.
- [x] Create root TypeScript/Vite/Vitest/Playwright configuration and required root scripts.
- [x] Define `.` client and `./vite` server exports without leaking server modules to the browser entry.
- [x] Define domain types, diagnostics, strict validation primitives, and read-model helpers.
- [x] Implement the constrained read-only parser with exact source spans, stable IDs, and session-local legacy locators.
- [x] Add canonical, legacy, malformed, unknown-content, LF, CRLF, and mixed-newline fixtures.
- [x] Create the deterministic Vite React example at `127.0.0.1:5173` with a read-only fixture preview.
- [x] Implement Shadow DOM mounting and the locked neutral/purple token sheet without full workflow behavior.
- [x] Spike Radix Dialog `Portal container={shadowRoot}` in non-modal mode plus the focused narrow-screen `FocusScope`; record focus, ARIA, outside-click, Escape, and body-overflow results. Stop for a decision if isolation requires changing host layout/scroll.
- [x] Record OSS provenance for every used package/reference.

Validation:

- During edits: focused parser/domain Vitest and typecheck.
- Checkpoint gate: format/lint, typecheck, full M1 unit set, and package build.
- **Mandatory `@Browser`:** open `http://127.0.0.1:5173`, verify the fixture preview renders inside the Shadow DOM at 1440×900, inspect computed purple/neutral tokens, open/close the Radix shell with keyboard and Escape, and confirm the host example layout does not shift.

Done criteria:

- [x] Every task above is complete.
- [x] Read-only parsing leaves fixture bytes unchanged.
- [x] Client/server export isolation is proven.
- [x] Browser evidence is recorded with revision, URL, viewport, journey, and result.
- [x] Only M1-level evidence is claimed; broader workflow proof remains open.

Blocker handling:

- Record exact failing fixture, package/API incompatibility, Browser observation, and current Git state. Do not substitute a new framework or parser without a documented decision.

### M2 — Implement safe Markdown command engine

Purpose:

Implement all six typed mutations with minimal exact patches, stable identity, conflict safety, and atomic writes before exposing the public browser protocol.

Checkpoint type:

- `risk`

Scope:

- Command validation, patch engine, revisions, command queue, atomic write adapter, typed errors, golden files, and a development-only storage lab in the example.

Out of scope:

- Public Qraft HTTP/SSE contract, finished drawer UI, and picker.

Read first:

- `docs/markdown-storage.md`, architecture command model, testing contract.
- `npm/write-file-atomic` approved files/tests at the pinned commit.

Changed boundaries:

- Every Markdown mutation and filesystem integrity guarantee.

Evidence inheritance:

- M1 parser evidence remains valid only if parser/grammar files and fixtures are unchanged.

Tasks:

- [x] Implement the six commands with strict Zod boundary validation and Qraft-owned domain invariants.
- [x] Implement minimal span patches and lazy stable-ID insertion.
- [x] Implement exact SHA-256 revisions and stale-base rejection.
- [x] Serialize the complete read-modify-write operation per file.
- [x] Perform the second pre-write revision check.
- [x] Use `write-file-atomic@8.0.0` for sibling temp, fsync, metadata, rename, and cleanup while preserving Qraft's outer transaction semantics.
- [x] Return typed validation, missing-target, duplicate-ID, conflict, and I/O errors.
- [x] Add complete before/after golden fixtures for every mutation and legacy-target variant.
- [x] Add race/failure tests proving the original survives.
- [x] Add a private example storage lab that invokes the real store against a temporary fixture and will not ship in the package export.

Validation:

- During edits: one command/fixture test at a time.
- Checkpoint gate: all domain/Markdown/store tests, typecheck, and build.
- **Mandatory `@Browser`:** open the example storage lab at 1440×900, invoke create section/task, note/finding, task/finding status flows against a temporary file, inspect rendered before/after source, and verify unknown Markdown remains visibly unchanged. Confirm a forced stale revision shows conflict rather than success.

Done criteria:

- [x] All commands have byte-for-byte golden evidence.
- [x] External changes and injected failures do not overwrite the original.
- [x] Browser storage-lab evidence is recorded.
- [x] No public protocol or production surface was added early.

Blocker handling:

- Record the exact bytes, revision sequence, temp-file state, and hypothesis. Never weaken preservation or conflict rules to pass a test.

### M3 — Deliver Vite bridge and live synchronization

Purpose:

Expose the safe store through the specified same-origin development protocol and keep the drawer model synchronized with external file edits.

Checkpoint type:

- `risk`

Scope:

- Vite option/path validation, HTTP routes, SSE, origins, body limits, command dedupe, watcher lifecycle, `HttpQAStorage`, connection/error UI, and integration tests.

Out of scope:

- Finished visual workflow and React Grab picker.

Read first:

- `docs/dev-server-protocol.md`.
- Vite public plugin docs and approved source/test paths at the pinned commit.

Changed boundaries:

- Browser/server protocol, dev-server lifecycle, file watching, client synchronization, and production absence.

Evidence inheritance:

- M2 evidence remains valid only when store, schemas, grammar, write dependency, and fixtures are unchanged.

Tasks:

- [x] Resolve plugin options and reject paths outside Vite root or invalid extensions.
- [x] Implement exact document, command, and SSE routes with method/content/origin/body/schema safeguards.
- [x] Implement safe error mapping without paths or stack traces.
- [x] Implement bounded in-memory command-ID deduplication.
- [x] Integrate Vite watcher add/change/unlink and coalesce by revision.
- [x] Implement SSE heartbeat, cleanup, reconnect, and refetch behavior.
- [x] Implement `HttpQAStorage` against the public protocol.
- [x] Prove `apply: "serve"`, shutdown cleanup, and route absence in build/preview.
- [x] Add real-Vite integration coverage using temporary files.
- [x] Remove or isolate any M2-only harness path no longer needed.

Validation:

- During edits: focused endpoint/watcher tests.
- Checkpoint gate: full domain/store/protocol integration set, typecheck, and build/preview absence tests.
- **Mandatory `@Browser`:** load the example at 1440×900, perform a real command through `HttpQAStorage`, externally edit and then delete/recreate the temporary `QA.md`, observe live refresh without reload, force disconnect/reconnect, and verify conflict/write errors are truthful and preserve draft text.

Done criteria:

- [x] Public protocol exactly matches its canonical document.
- [x] Watch/reconnect/conflict journeys pass in the actual browser.
- [x] Build and preview expose no Qraft endpoint.
- [x] A compact handoff snapshot is written because context compacted during M3.

Blocker handling:

- Record request/response status, revision, watcher event, Browser state, and server lifecycle. Do not add CORS, WebSockets, or another watcher as an unplanned workaround.

### M4 — Build the approved drawer workflow

Purpose:

Deliver the complete non-picker QA workflow with the locked visual system, resilient drafts, and accessible keyboard behavior.

Checkpoint type:

- `risk`

Scope:

- Closed tab, drawer, list/detail, progress, pass/reopen/advance, all authoring forms, findings/notes, statuses, focus, responsive behavior, and visual regression coverage.

Out of scope:

- React Grab selection and deferred v0.2 features.

Read first:

- `docs/design.md` and approved image.
- Shadcn structural references and Radix published Dialog API.
- Product and accessibility requirements.

Changed boundaries:

- All non-picker user journeys, UI state, design tokens, Shadow DOM composition, focus, and layout.

Evidence inheritance:

- M3 protocol evidence remains valid if protocol/store fingerprints are unchanged. M1 shell visual evidence is superseded.

Tasks:

- [x] Implement the closed `QA n/n` edge tab and drawer shell.
- [x] Implement checklist hierarchy, progress, selected task, and unresolved-finding counts.
- [x] Implement task detail, pass/reopen guard, deterministic auto-advance, and completed state.
- [x] Implement add section/task/note/finding forms with validation, pending, conflict, and preserved-draft behavior.
- [x] Implement loading, empty, diagnostic, disconnected, conflict, and write-error states.
- [x] Implement approved semantic components using Qraft CSS, Radix Dialog, and Lucide icons.
- [x] Match the five non-picker surfaces in the six-surface visual baseline without gradients, glow, excess cards, or excess purple.
- [x] Implement keyboard order, focus trap/return, Escape hierarchy, live regions, reduced motion, and non-colour status cues.
- [x] Add integrated component-journey and Playwright tests for meaningful non-picker states.

Validation:

- During edits: focused component/journey tests and single-surface Browser checks.
- Checkpoint gate: affected unit/integration set, build, and full non-picker Playwright suite.
- **Mandatory `@Browser`:** compare checklist, task detail, finding, complete, and add-task surfaces directly with the approved image at 1440×900, 1366×650, and 768×900. Exercise all mouse/keyboard flows, inspect focus, confirm the host bounding box/scroll does not change, and save representative evidence screenshots.

Done criteria:

- [x] The full Markdown QA loop works without element attachment.
- [x] All five available approved surfaces match the locked character and written design rules.
- [x] Automated and hands-on browser evidence cover keyboard and three viewports.
- [x] No material visual deviations remain.

Blocker handling:

- Record screenshot, viewport, computed style, DOM/focus state, and mismatch. Do not change the locked artifact or add a UI framework to hide composition problems.

### M5 — Integrate React Grab element attachment

Purpose:

Complete the differentiating workflow: select a live React element, record concise context in a finding, and open its source safely.

Checkpoint type:

- `risk`

Scope:

- Public React Grab primitives, capture listeners, overlay/label, context form, persisted element fields, open-source action, cleanup, fallback, and picker tests.

Out of scope:

- Persisted screenshots/HTML/styles/stacks, selector re-highlighting, multi-select, and Agentation code.

Read first:

- `docs/upstream-and-licensing.md`, design picker section, architecture `ElementReference`.
- React Grab public primitives at pinned commit.
- petite-react-grab `src/index.tsx` plus tests/demo as structural reference only.

Changed boundaries:

- Pointer interception, host-app interaction, React context capture, finding persistence, editor integration, and visual overlay.

Evidence inheritance:

- M4 UI evidence remains valid only for unchanged components/tokens. Protocol/store evidence remains valid if element schemas and commands are unchanged.

Tasks:

- [x] Add `react-grab@0.2.0` and required MIT notice.
- [x] Implement capture-phase hit testing with public primitives and explicit Qraft/ignored-subtree filtering.
- [x] Implement async request sequencing, bounds tracking, purple/white picker halo, label clamping, and complete cleanup.
- [x] Prevent selected host controls from receiving the picker click.
- [x] Open the Qraft-owned finding form with concise target context.
- [x] Normalize/persist only approved `ElementReference` fields and omit unsafe source paths/query/hash.
- [x] Permit plain-finding fallback after partial/no context.
- [x] Implement `openFile()` with truthful inline errors.
- [x] Add React Grab compatibility, cleanup, Shadow DOM, iframe/shadow-root where supported, and three-browser E2E tests.
- [x] Complete provenance and third-party notices.

Validation:

- During edits: focused picker lifecycle/context tests.
- Checkpoint gate: affected unit/integration tests, build, and full picker Playwright suite.
- **Mandatory `@Browser`:** at all three viewports, activate picker, hover several host elements, verify Qraft never selects itself, select a quantity control without triggering it, save the finding, inspect exact Markdown context, exercise source opening, cancel with Escape, and test context-failure fallback. Compare picker/finding visuals to panels 03 and 04.

Done criteria:

- [x] Element attachment and fallback journeys work without host side effects.
- [x] Persisted data contains only approved fields.
- [x] Browser and automated evidence cover cleanup, Escape, and source errors.
- [x] A compact handoff snapshot is written if the roadmap moves to a fresh task after M5.

Blocker handling:

- Record browser/version, target DOM/context, listener state, React Grab result, persisted output, and exact failure. Do not reach into React Grab private modules or fall back to Agentation code.

### M6 — Harden and prove the complete local candidate

Purpose:

Close malformed-input, concurrency, accessibility, packaging, clean-consumer, and complete-journey risks and produce honest local v0.1 evidence.

Checkpoint type:

- `integrated-candidate`

Scope:

- All v0.1 code/docs/tests, clean checkout/consumer, full local gate, dependency/license audit, final Browser acceptance, and evidence closure.

Out of scope:

- Push, hosted CI, npm publication, deployment, public release, and v0.2 backlog.

Read first:

- All source-of-truth documents, current plan evidence, lockfile, package exports, and all accumulated Browser evidence.

Changed boundaries:

- Any touched boundary; a late change invalidates the mapped evidence for that boundary.

Evidence inheritance:

- Reuse only explicitly fingerprinted unchanged M1–M5 evidence. Re-run affected proof after every final-diff change.

Tasks:

- [x] Complete malformed-file, filesystem-failure, connection, duplicate-command, race, and cleanup fixtures.
- [x] Complete keyboard, focus, reduced-motion, contrast, status, and responsive acceptance.
- [x] Verify browser/server export separation and no build/preview endpoint.
- [x] Install/use the packed artifact in a clean temporary Vite React consumer.
- [x] Verify exact dependency pins, licenses, and `THIRD_PARTY_NOTICES.md`.
- [x] Verify no Agentation code/assets/bundles and no unapproved dependency/reference entered the tree.
- [x] Run format/lint, typecheck, full unit/integration, build, and three-browser Playwright gates from a clean state.
- [x] Run all 16 acceptance criteria and record evidence tier/results.
- [x] Update installation, Markdown dialect, safe-local-use, known-limitation, and implementation-state docs.

Validation:

- During edits: only affected focused checks.
- Checkpoint gate: `corepack pnpm check`, `corepack pnpm test:browser`, packed clean-consumer build/use, and repository/license audit.
- **Mandatory `@Browser`:** using the packed artifact in the clean consumer, run the complete human loop at 1440×900 and representative 1366×650/768×900 checks: open drawer, create content, pass/reopen, conflict/live refresh, attach element, save/resolve finding, open source, complete all tasks, and verify production preview has no Qraft endpoint. Compare final surfaces to the locked image and save final screenshots.

Done criteria:

- [x] All M6 tasks pass on the final diff.
- [x] All 16 v0.1 acceptance criteria have current evidence.
- [x] The clean consumer proves the packed package, not source aliases.
- [x] Final Browser evidence records source revision and artifact digest.
- [x] Documentation distinguishes specified, locally verified, and not externally delivered states.
- [x] No push/publication/deployment is inferred.

Blocker handling:

- Record exact command/journey, final source revision, stale evidence, retry delta/hypothesis, Git status, and required decision. Do not mark the roadmap complete because a budget or context limit was reached.

## Internal execution sequence and handoff boundaries

1. M1 establishes types, parsing, tooling, and the browser foundation required by everything else.
2. M2 closes data-integrity risk before a public browser mutation path exists.
3. M3 exposes only the already-safe store and proves live local synchronization.
4. M4 builds the ordinary human QA loop on stable storage/protocol boundaries.
5. M5 adds pointer interception and source context after the drawer workflow is stable.
6. M6 proves the packed integrated candidate and closes all acceptance evidence.

Potential deliberate handoffs:

- After M3: record exact commit/worktree state, dependency pins, accepted tests, Browser URL/evidence, remaining M4 start point, and any stale evidence.
- After M5: record the same plus React Grab compatibility, picker Browser evidence, notice state, and M6 first command.

A handoff continues this roadmap. It does not create a new plan or reset completed evidence.

## Plan update rules

- Check a task only after its direct implementation and targeted evidence exist.
- Check a milestone only after all done criteria and mandatory `@Browser` checkpoint pass.
- Append a dated validation note with exact command, result, source revision, Browser URL/viewport/journey, and screenshot path when applicable.
- Record inherited evidence and the fingerprint proving freshness.
- Record OSS provenance per structural extraction.
- Record budget crossings, changed retry input/state/hypothesis, and deliberate handoffs.
- Append blockers/decisions/evidence; do not erase historical entries.
- If a dependency, version, repo commit, or role changes, update both the allowlist and `docs/upstream-and-licensing.md` before use.

## Browser evidence log

| Date | Milestone | Source revision | URL and viewport | Journey | Result | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-09-04 | M1 | `773ff60` + worktree `0576babb8147` | `http://127.0.0.1:5173`, 1440×900 | Open read-only fixture drawer; inspect Shadow DOM and locked tokens; verify heading focus, Escape/focus return, non-modal outside click, body overflow, and host geometry | Pass — `#6d4bd2`/white computed tokens, fixed drawer, real ShadowRoot, `body` overflow unchanged, host remained 1440×900, no horizontal overflow | `artifacts/browser-evidence/m1-checklist--1440x900.png` (1440×900 PNG, original-size inspected) |
| 2026-09-04 | M2 | `773ff60` + worktree `0b2cf726f62b` | `http://127.0.0.1:5173/?lab=1`, 1440×900 | In the private temporary-file lab, create section/task/note/finding; observe blocked task pass; resolve finding; pass/reopen task; force stale revision | Pass — every command returned a new exact revision, unknown owner Markdown remained visible, reopening retained resolved finding, stale request showed conflict and no write | `artifacts/browser-evidence/m2-storage-lab--1440x900.png` (1440×900 PNG, original-size inspected) |
| 2026-09-04 | M3 | `773ff60` + worktree `48f11bcb5853` | `http://127.0.0.1:5173/?protocol=1` and `/`, 1440×900 | Execute a real section command; append externally; delete/recreate the file; force stale command and atomic-write failure; stop/restart Vite for disconnect/reconnect | Pass — exact revisions refreshed without page reload for add/change/unlink, missing and recreated models appeared, 409 and 500 messages were truthful with draft text retained, disconnected state appeared with retained draft, and restart returned to a live fixture | `artifacts/browser-evidence/m3-live-protocol--1440x900.png` (`8448d67e…`, 1440×900 PNG, original-size inspected) |
| 2026-09-04 | M4 | `773ff60` + worktree `a9e072713928` | `http://127.0.0.1:5173/`, 1440×900, 1366×650, 768×900 | Compare checklist, task detail, finding, complete, and add-task surfaces; add/cancel/save a finding; verify blocked pass, resolve, auto-advance, completion, focus return, and overlay geometry | Pass — five available panels match the locked neutral/list-first character; text/focus/status semantics are exposed; host remained 768×900 with `body` overflow `visible`, zero scroll, no horizontal overflow, and fixed 380 px overlay | `artifacts/browser-evidence/m4-{checklist,task-detail,finding-form,complete,add-task}--1440x900.png`, plus checklist at 1366×650 and 768×900 (all exact-size PNGs, original-size inspected) |
| 2026-09-04 | M5 | `773ff60` + worktree `a545e2c6d6b8` | `http://127.0.0.1:5173/`, `?picker=1`, and `?protocol=1`; 1440×900, 1366×650, 768×900 | Activate/cancel picker; inspect host/Qraft filtering, halo/label clamping, quantity selection without activation, React context, plain fallback, open Shadow DOM and same-origin iframe, approved Markdown fields, and source-open error | Pass — Qraft UI was never targetable; host quantity remained unchanged during selection; Escape restored Attach focus; attached Markdown contained only component/source/line/column/route/selector; fallback and inline open error remained usable | `artifacts/browser-evidence/m5-picker--{1440x900,1366x650,768x900}.png` and `m5-attached-finding--1440x900.png` (exact-size PNGs, original-size inspected) |
| 2026-09-05 | M6 / final refresh of affected M1–M5 boundaries | `d2fb66d50db8413c00ad4893bb987e1e0c319e36` + source `6a2b7a4b066ae97eff8d737bf43fd37f08573594a474846591c0a9b4aea44f60`; tarball `48653d3bd23f667a37ee5d2e9e260e335571e9138440ab67132f8f77b30a3d86` | `http://127.0.0.1:4176/`, 1440×900, 1366×650, 768×900; preview `http://127.0.0.1:4177/__qraft/document` and `/__qraft/events` | Create section/task/note; external note and unknown Markdown refresh; reject stale save and retain draft; retry; attach quantity without increment; save/resolve finding; safe editor failure; pass/auto-advance/reopen; preserve resolved finding; Escape picker/form/drawer; complete 4/4 tasks; narrow focus wrap; preview absence | Pass — final artifact installed through public exports only; fixed 380 px overlay, unchanged host geometry/scroll and body overflow, no horizontal overflow; final six surfaces retain locked visual character. Native Browser screenshots are JPEG; supplemental real-pointer hover captures are PNG. | `artifacts/browser-evidence/m6-*.jpg`, `m6-picker--{1440x900,1366x650,768x900}.png`; all 15 final image dimensions, encodings and digests in `artifacts/release/screenshots.json` |

## OSS provenance log

| Date | Milestone | Repository/commit/path | Extracted behavior | Qraft destination | Evidence |
| --- | --- | --- | --- | --- | --- |
| 2026-09-04 | Planning | Repositories in exact allowlist | Roles and boundaries researched; no code copied | This plan | GitHub/npm metadata and inspected upstream files |
| 2026-09-04 | M1 | `shadcn-ui/ui@7c9eaba1` `button.tsx`, `progress.tsx`, `badge.tsx` | Thin semantic controls, explicit variants/state, and progress indicator geometry; no source or CSS copied | `src/client/QA.tsx`, `src/client/styles.css` | Read-only GitHub API inspection plus browser result |
| 2026-09-04 | M1 | `vitejs/vite@8492422b` `docs/guide/api-plugin.md`; `vite@8.2.2`; `@vitejs/plugin-react@6.1.1` | Public library build, serve-only plugin shape, deterministic React example | `vite.config.ts`, `examples/vite-react/vite.config.ts`, `src/vite.ts` | Pinned lockfile, build pass, exact docs inspection |
| 2026-09-04 | M1 | `radix-ui/primitives@f7ecd5ab`; `@radix-ui/react-dialog@1.1.23`, `@radix-ui/react-focus-scope@1.1.16` | Published portal container, non-modal dismissal, focus entry/return, narrow focus-trap primitive | `src/client/QA.tsx` | Pinned lockfile and integrated ShadowRoot Browser pass |
| 2026-09-04 | M1 | Pinned React, Lucide, Zod, TypeScript, DefinitelyTyped, Vitest, and Playwright packages in allowlist | Runtime/types, selected icons, strict schemas, compile/test/capture tooling only | Package shell, domain, client, tests, evidence script | `pnpm-lock.yaml`, typecheck, tests, build, verified PNG |
| 2026-09-04 | M2 | `npm/write-file-atomic@23e111d` `lib/index.js`, `test/concurrency.js`, `test/integration.js`; package `8.0.0` | Sibling-temp lifecycle, fsync/default metadata preservation, cleanup, same-target queue boundary; Qraft retains full transaction queue and second hash check | `src/markdown/store.ts`, `tests/markdown/store.test.ts` | Exact GitHub API inspection; mode, failure cleanup, concurrency, and external-race tests |
| 2026-09-04 | M3 | `vitejs/vite@8492422b` `docs/guide/api-plugin.md`, `docs/guide/api-javascript.md`, `packages/vite/src/node/server/__tests__/watcher.spec.ts` | Public resolved-config, serve-only middleware, watcher, listen/close, and lifecycle testing patterns; no internals copied | `src/vite.ts`, `src/server/*`, `tests/server/protocol.test.ts` | Exact GitHub API inspection and real Vite ephemeral-server integration tests |
| 2026-09-04 | M4 | Previously inspected `shadcn-ui/ui@7c9eaba1` button/progress/badge files and published Radix Dialog/FocusScope APIs | Reapplied only the approved thin-control, progress-geometry, portal, dismissal, and focus concepts to an original Qraft composition and CSS sheet | `src/client/QA.tsx`, `src/client/styles.css`, `tests/e2e/m4-workflow.spec.ts` | Three-browser interaction suite and seven retained visual screenshots; no upstream source or CSS copied |
| 2026-09-04 | M5 | `aidenybai/react-grab@ea4bbec0b03aa81d351e2ea85f0004cf947314e6` `packages/react-grab/src/primitives.ts`, `tests/primitives-hit-testing.test.ts`, `tests/open-file.test.ts`, `packages/react-grab/src/utils/open-file.ts`; package `react-grab@0.2.0` | Public `getElementDimensions`, `getFiberFromElement`, `getSourceFromFiber`, and `getDisplayNameFromFiber` primitives plus observable hit-testing/open-file expectations; no private module or implementation copied | `src/client/picker/ElementPicker.tsx`, `tests/e2e/m5-picker.spec.ts`, `THIRD_PARTY_NOTICES.md` | Exact pin/lock, public-import typecheck/build, three-engine E2E, manual Browser inspection, React Grab MIT notice |
| 2026-09-04 | M5 | `kitze/petite-react-grab@c013b30b2ba8c7c159c47a4fc558550150882141` `src/index.tsx` and demo application | Structural reference for document-listener lifecycle, latest async target result, and Qraft-owned overlay separation; no source, CSS, component, or subsystem copied | `src/client/picker/ElementPicker.tsx`, `src/client/styles.css` | Direct upstream inspection; original Qraft implementation and retained visual evidence |

## Blockers, decisions, and evidence log

- 2026-09-04 — Decision: the six-panel generated visual is owner-approved and locked at the digest recorded above.
- 2026-09-04 — Decision: every milestone requires interactive `@Browser` evidence in addition to automated tests.
- 2026-09-04 — Decision: use published packages for React Grab, Radix Dialog, Zod, Lucide, and atomic writes; use petite-react-grab and selected shadcn files only as structural references.
- 2026-09-04 — Decision: shadcn's Vaul-based Drawer, Tailwind, and Agentation implementation code are excluded from v0.1.
- 2026-09-04 — Evidence boundary: documentation and upstream research only. No Qraft implementation, test, Browser, CI, package, or release evidence exists yet.
- 2026-09-04 — M1 dependency-gap decision: added exact development-only pins for TypeScript, Node/React declarations, and the already documented Vite React plugin. Registry metadata and immutable lockfile integrity provide provenance; runtime scope is unchanged.
- 2026-09-04 — M1 install evidence: the first `corepack pnpm install` was rejected by the configured seven-day `minimumReleaseAge` policy. Added version-specific `minimumReleaseAgeExclude` entries only for the eight exact direct/transitive versions reported by pnpm; all other packages retain the seven-day gate.
- 2026-09-04 — M1 checkpoint (`773ff60` + implementation fingerprint `0576babb8147`): `corepack pnpm format:check`, `lint`, `typecheck`, full M1 `test` (2 files, 7 tests), and `build` passed. `dist/index.js` contained no Node, Markdown, server, Vite, or atomic-write imports. The mandatory Browser pass and retained 1440×900 PNG passed; only M1 behavior is verified.
- 2026-09-04 — M1 Radix result: the dialog rendered inside the open ShadowRoot with correct ARIA dialog/title exposure; open focused the Qraft heading; Escape closed and returned focus to the edge tab; an outside host click dismissed the non-modal drawer and reached the host; `document.body` overflow remained `visible`. No host layout or scroll mutation was required.
- 2026-09-04 — M2 checkpoint (`773ff60` + implementation fingerprint `0b2cf726f62b`): `corepack pnpm test -- tests/domain tests/markdown` passed 4 files/28 tests; `corepack pnpm typecheck` and `corepack pnpm build` passed. The store suite proved missing-file laziness, all commands, exact hashes, stale/external conflicts, serialization, mode retention, original survival, sibling-temp cleanup, duplicate targets, and validation failures. Mandatory Browser lab and retained 1440×900 PNG passed. Public HTTP/SSE remains unimplemented as required at this checkpoint.
- 2026-09-04 — M3 retry evidence: the first real-Vite integration invocation failed only because the filesystem sandbox denied localhost `listen` (`EPERM`). The changed execution condition was an approved out-of-sandbox run; 6/6 tests passed. A later watcher-settle change from 40 ms to 750 ms was a source delta, after which the same suite passed again. The first example restart exposed old-server cleanup deleting the new fixture; removing that cleanup before a clean restart fixed the race. The first image verification invocation used obsolete flags; retrying with the tool's reported `--expected 1440x900 --require-format png` interface passed.
- 2026-09-04 — M3 checkpoint (`773ff60` + implementation fingerprint `48f11bcb5853`): `corepack pnpm test -- tests/domain tests/markdown tests/server` passed 5 files/34 tests; `corepack pnpm typecheck` and `corepack pnpm build` passed; the real-Vite suite also built and previewed an isolated app and proved all Qraft endpoints absent. The temporary M2 lab source and route were removed before closure.
- 2026-09-04 — M3 Browser result: at 1440×900, a real `HttpQAStorage` command changed revision `9a837e94` to `c6941898`; an external append refreshed to `24e93c78`; unlink showed the empty missing model `e3b0c442`; recreate restored `9a837e94`. Forced stale and permission-blocked writes showed safe 409/500 messages and retained `Conflict draft`/`Write failure draft`. Stopping Vite exposed the reconnect status while retaining `Reconnect draft`; restarting restored the seeded live fixture. The full dev-server restart necessarily reloaded the example page, so draft retention is claimed for the disconnected state, not across the Vite document reload.
- 2026-09-04 — Compact M3 handoff: base `773ff60b`; worktree fingerprint `48f11bcb5853`; exact Node/pnpm/direct pins are locked in `.node-version`, `package.json`, and `pnpm-lock.yaml`; accepted checks are M1 7 tests, M2 28 tests, M3 aggregate 34 tests plus typecheck/build and preview absence; latest Browser surface is `http://127.0.0.1:5173/` at 1440×900 with retained M3 PNG. M4 starts from `src/client/QA.tsx` and `styles.css`; M1 shell visual evidence is superseded by M4, while unchanged parser/store/protocol fingerprints remain inheritable.
- 2026-09-04 — M4 retry evidence: the first form test used a descendant locator whose `has` root could never match; narrowing from the Cart heading's parent fixed it. Escape initially focused a detached trigger node; stable `data-form-trigger` keys now focus the remounted button. Non-modal outside dismissal initially cleared the form, so retaining form state across drawer visibility changes fixed conflict preservation. A duplicate visible/hidden live message caused a strict locator ambiguity; the hidden live region now renders only for neutral messages. The first cross-browser aggregate inherited a malformed fixture from the preceding test; making the M1 test explicitly recreate the deterministic fixture isolated every test. Every rerun followed one of those recorded deltas.
- 2026-09-04 — M4 checkpoint (`773ff60` + implementation fingerprint `a9e072713928`; visual component digests `QA.tsx 612f43ff…`, `styles.css 342117c8…`): `corepack pnpm check` passed format, lint, typecheck, 5 files/34 unit-integration tests, and build. A persistent-terminal `corepack pnpm test:browser` passed 15/15 with one worker across Chromium, Firefox, and WebKit. The real-example journeys cover detail/pass/reopen/auto-advance, all four forms, unresolved-findings guard, draft refresh/conflict, focus/geometry at 1440 and 768, and missing/malformed recovery.
- 2026-09-04 — M4 visual evidence: seven retained screenshots passed exact PNG dimension verification and original-size inspection. Checklist, detail, finding, completion, and add-task views use the locked `#6d4bd2` accent, cool white/neutral list-first surfaces, restrained green/amber/error semantics, 40 px controls, compact type, and no gradients/glow/excess cards. The later private malformed-fixture endpoint did not touch the fingerprinted visual component or host CSS files, so those screenshots remain current for the M4 visual boundary.
- 2026-09-04 — M5 retry evidence: the first full three-browser run passed 21/24 and timed out only in the cleanup test after that test deliberately clicked a host control, which correctly dismissed the nonmodal drawer. The source delta explicitly asserted dismissal and reopened Qraft before each following picker cycle; the focused test then passed 3/3 and the aggregate passed 24/24. The first screenshot command forwarded a literal `--`, shifting arguments and producing a `NaN` viewport before browser creation; removing that command-only argument produced all four exact-size captures. The first aggregate `check` in the restricted shell passed 29 tests and failed the five real-server tests only at `listen EPERM 127.0.0.1`; rerunning with loopback permission passed without a source change.
- 2026-09-04 — M5 checkpoint (`773ff60` + implementation fingerprint `a545e2c6d6b8`; component digests `QA.tsx 9f0b6c38…`, `styles.css 0bbc7125…`, `ElementPicker.tsx 5035b9f1…`): `corepack pnpm check` passed format, lint, typecheck, 5 files/34 unit-integration tests, and build. `corepack pnpm test:browser` passed 24/24 with one worker across Chromium, Firefox, and WebKit. The picker uses only public `react-grab/primitives`, filters Qraft-owned UI, intercepts the selected host click, sequences async context, tracks geometry, cleans every listener, reaches open Shadow DOM and same-origin iframes, and falls back without inventing context.
- 2026-09-04 — M5 Browser result: manual `@Browser` journeys at all required viewports exercised picker selection/cancellation, host side-effect suppression, fallback, Shadow DOM, iframe, exact Markdown output, and a forced editor-open failure. CUA did not expose a pointer-hover method, so the manual click journeys were paired with agent-inspected original-size Playwright captures of real hover state; automated real-pointer assertions verify the same halo. The retained clean-example PNG digests are `55455fc0…` (1440 picker), `40082160…` (1366 picker), `a519ba90…` (768 picker), and `29707459…` (attached finding).
- 2026-09-04 — Compact M5 handoff: base `773ff60b`; worktree fingerprint `a545e2c6d6b8`; direct dependency `react-grab@0.2.0` is exact and its MIT notice is present; accepted checks are 34 unit/integration tests, build, and 24 three-engine E2E tests. Latest Browser surfaces are the local deterministic example at 1440×900, 1366×650, and 768×900 with four retained M5 PNGs. M6 starts by closing failure/connection/accessibility coverage, packaging and license audits, documentation, then performs the only final full gates and packed clean-consumer Browser journey.

- 2026-09-05 — Resumption reconciliation: the stale M1 status header is superseded by the recorded M1–M5 evidence and existing M6 code. Git started clean at `d2fb66d50db8413c00ad4893bb987e1e0c319e36`. Prior PNGs remain present, but their abbreviated aggregate fingerprints cannot prove unchanged boundaries; final source/package checks and Browser evidence will supersede affected earlier proof. No historical checkpoint is erased.
- 2026-09-05 — M6 inspection hypotheses: exact-byte decoding drops UTF-8 BOM; mixed-newline insertion selects any CRLF rather than the first newline; shorter fences can expose unknown Markdown as tasks; source paths from externally authored metadata bypass root normalization; the focus trap starts below the supported viewport range; status refreshes can erase failure feedback. These require focused regression proof before final gates. Final gate budget used on this resumption: 0 local, 0 isolated.

- 2026-09-05 — Focused retry diagnosis: the filesystem-failure fixture left the example directory at mode 0500 when Playwright killed Vite before its timer restored permissions. Subsequent accessibility and legacy tests correctly reported write failures. Restored the test-owned directory to 0755; added explicit restore/retry and server-close cleanup. This is a harness lifecycle change, not a relaxed storage assertion. The revised pass must prove the failed draft subsequently saves.

- 2026-09-05 — Package audit diagnosis: `pnpm licenses list --json` could not locate a package-index file in the pre-existing store. The release audit now reads the actually installed manifests/license files against the lockfile directly, records 111 packages including dev tooling, and names the exact missing-license-field/file exceptions in the canonical licensing document. No dependency version changed. The first consumer smoke check installed 80 packages from the packed artifact, built production successfully, and found HTML/404 (not Qraft responses) on all three preview paths. This preliminary artifact is superseded by the final isolated candidate after the remaining regression changes.

- 2026-09-05 — Final-gate budget update: local candidate gate 1 passed (45 tests/build). The first isolated frozen install and `check` passed; three-engine output exposed duplicate React keys on malformed entities even though functional assertions passed. Treating this diagnostic as a hardening failure: ambiguous task rows now disable selection and use occurrence-specific rendering keys, with a console/disabled-row regression. This relevant UI/test delta invalidates that candidate and justifies one additional isolated final gate beyond the planned single clean gate. Preserve its logs as `isolated-first-*`; no unchanged command is retried.

- 2026-09-05 — Final Browser diagnostic and budget update: the second isolated gate passed all four commands (45 tests, 36 E2E, 111-package license audit, installed tarball/production preview). Its 1440×900 hands-on finding screenshot exposed the progress tab above the open drawer after picker remount, obscuring the form. Hide only the expanded tab, retain the collapsed trigger/focus return, and add the M5 post-selection visibility regression. This CSS/test delta requires a replacement artifact, focused picker check, and a third isolated gate; prior logs/screenshots are diagnostic, not final acceptance. All functional runtime modules remain unchanged from the second candidate.

- 2026-09-05 — Provenance reconciliation: the historical M5 OSS rows contain alternate abbreviated commit/repository names and API labels that do not match the frozen allowlist or current source imports. They are retained as historical notes, not inherited as current provenance. The final package still uses exact `react-grab@0.2.0`; current `ElementPicker.tsx` imports the published `getElementAtPoint`, `getElementBounds`, `getElementContext`, `getElementSelector`, and `isElementGrabbable` APIs, and `QA.tsx` imports `openFile`. No private module, new structural reference, copied upstream code, or dependency was introduced during M6. The frozen allowlist and installed artifact/lockfile inventory remain authoritative.


## Final M6 acceptance evidence — 2026-09-05

This section closes the local roadmap. It supersedes the stale planning header and earlier candidate results only for the changed boundaries; historical evidence above remains intact. No commit, push, publication, deployment, external resource, hosted CI result, or external owner acceptance is claimed.

### Final candidate identity and clean-state proof

- Base commit: `d2fb66d50db8413c00ad4893bb987e1e0c319e36`; branch `main`. Git was clean at resumption. All M6 edits remain uncommitted, including the new source-fingerprint script.
- Source fingerprint: `6a2b7a4b066ae97eff8d737bf43fd37f08573594a474846591c0a9b4aea44f60` across 87 source/config/test/document files and their modes. `artifacts/release/source.json` records every hash. Generated files, local QA files, credentials, and the two evidence-only documents (`docs/implementation-plan.md`, `docs/README.md`) are excluded so recording results cannot invalidate the artifact being described.
- Final isolated copy: `/private/tmp/qraft-final-hvkmyt4a`. Copied all current tracked and untracked source files, including these uncommitted changes, using a byte/mode-preserving copy. No `.git`, dependency folder, build output, local QA file, or test artifact was copied. Its source fingerprint equals the workspace fingerprint. This is a clean source snapshot of the current candidate, not a claim that uncommitted changes exist in a Git commit.
- `corepack pnpm install --frozen-lockfile` passed in that copy with Node `24.19.0` and pnpm `11.25.0`.
- `corepack pnpm check` passed: formatting, lint, TypeScript, **7 files / 45 unit-integration tests**, and JavaScript/declaration build.
- `corepack pnpm test:browser` passed: **36/36**, one worker, Chromium/Firefox/WebKit. Includes duplicate-ID rendering, legacy ID transition, failed-write recovery, reconnect/draft, narrow focus wrapping, reduced motion, contrast, picker cleanup/context, and workflow coverage.
- `corepack pnpm audit:release` passed: exact direct versions, **111 installed packages** with reviewed license evidence, notice presence, public exports, client/server bundle boundary, and excluded-material scan. Exact transitive notice omissions and the platform scope are documented in the licensing owner; this is not an external-distribution legal sign-off.
- `corepack pnpm verify:consumer` passed: 24-file tarball, notices/README/declarations present, package imported through `.` and `./vite`, private subpath rejected, 80-package consumer install, production build, and all three preview paths absent as Qraft endpoints.
- Final tarball SHA-256: `48653d3bd23f667a37ee5d2e9e260e335571e9138440ab67132f8f77b30a3d86`. Retained locally at `artifacts/release/qraft-qa-0.1.0.tgz`.
- Packed consumer: `/var/folders/vh/q11rp8711qz5l2_r6bsndlb00000gn/T/qraft-clean-consumer-WhbSat`. No repository-source aliases are present. Browser dev URL was `http://127.0.0.1:4176/`; preview was `http://127.0.0.1:4177/`. Port 4173 was occupied, so that existing process was not disturbed.
- Final logs: `artifacts/release/isolated-{install,check,browser,audit,consumer}.log`. Machine-readable identity, installed dependency inventory, consumer/preview results, image digests, and hover metrics are in the sibling JSON files. These transient local artifacts are intentionally ignored by Git.

### Acceptance matrix

Each number maps to the identically numbered criterion in [Testing and acceptance](testing-and-acceptance.md#v01-acceptance-criteria).

| Criterion | Current evidence | Result |
| --- | --- | --- |
| 1. Documented Vite React installation | Final packed consumer imports both public entries, resolves exact peers, builds, and runs in Browser. | [x] Pass |
| 2. Overlay without host resize | Three-engine geometry tests; Browser measured 380 px drawer, unchanged host boxes, zero document scroll and `body` overflow `visible`, at required widths. | [x] Pass |
| 3. No startup rewrite | Store/parser read-only tests and initial packed Browser revision `3345df4f9439e2f41845f3ee08e38ef0eefec0ad8730ea29519b6bce110af1b9` matches the seed bytes. | [x] Pass |
| 4. Minimal pass/reopen patch | Full-file stable/legacy golden tests including newline/final-newline variants; real Browser pass, auto-advance and reopen. | [x] Pass |
| 5. Canonical authoring and IDs | All command goldens/store queue; Browser-created section/task/note/attached finding retained in `browser-final-QA.md`. | [x] Pass |
| 6. Unresolved-finding guard | Store rejection tests, three-engine guard tests, final packed Browser disabled Pass until resolution. | [x] Pass |
| 7. Live external edits | Real Vite add/change/unlink tests; final Browser external agent note appeared with unchanged page/quantity and preserved draft. | [x] Pass |
| 8. Stale revision safety | Store external-race and stale tests; real protocol 409; Browser stale submission preserved draft and exact before-file bytes (`cmp` passed), then explicit retry saved. | [x] Pass |
| 9. Picker isolation and suppression | Three-engine own-UI/shadow/iframe/cleanup tests; final Browser selected quantity twice with value remaining 2 and canceled with Escape. | [x] Pass |
| 10. Approved attachment data only | Schema/golden tests and final exact file: only Component, Source with line/column, Route pathname, Selector. Unsafe externally authored source paths are also omitted from read/conflict models. | [x] Pass |
| 11. Safe source opening | Final packed Browser called Open source on stored `main.tsx:26`; injected editor/fallback failure showed a copyable path and did not mutate QA. Actual editor success is environment-dependent, as documented. | [x] Pass |
| 12. Unknown Markdown preservation | All six full-file mutation goldens and fence/mixed-newline/BOM regressions; final Browser file retained the exact external owner comment and fenced checkbox example. | [x] Pass |
| 13. Production absence | Real Vite integration and final packed preview: document/events returned HTML, command POST returned 404, no JSON/SSE/filesystem endpoint; Browser preview showed no Qraft root. | [x] Pass |
| 14. Clean-state complete checks | Fresh current-source copy, frozen install, `check` 45/45 and three-engine `test:browser` 36/36; full logs and equal source manifests retained. | [x] Pass |
| 15. Notices and excluded material | Packed notices verified; exact-pin/111-package audit; source/example/dist/lock scans and source/provenance review found no Agentation implementation material or new unapproved dependency. | [x] Pass |
| 16. Current integrated/visual evidence | Historical M1–M5 Browser records retained; affected contracts re-proven by final gates and packed Browser journey. Final 15 native-size images cover all six visual surfaces and all required viewports. | [x] Pass |

### Browser observations and evidence freshness

- Final complete human loop used the final artifact above, not the earlier smoke tarballs. The final file revision is `feba499befb29c470f038a30321fbba1c98764a8951fad0a85b040ddce710ad3`; all four top-level tasks and the attached finding are checked. The external agent note remains legacy because it was never mutated. The unknown comment/fence remains byte-for-byte intact.
- At 1440×900 the host remained 1440×384.8125; at 1366×650 it remained 1366×384.8125; at 768×900 it remained 768×630.6875. Within each viewport, opening/closing did not change that box. Document/body scroll widths equal viewport width and document scroll remained `(0,0)`. The drawer remained 380 px wide; longer content scrolls within it.
- At 768 px, `aria-modal=true`, Shift+Tab from Close wrapped to Add section, Tab wrapped back to Close, and body overflow remained `visible`. Escape consumed the form first, then closed the drawer and returned focus to the `Open Qraft, 4 of 4 tasks passed` tab. Picker Escape restored Attach element focus.
- At 1366 px the drawer is intentionally non-modal; moving keyboard focus outside dismisses it. An attempted subsequent Close action had no target because that dismissal had already happened. The final closed-state capture records this correctly; it was not an application failure or a reason to rerun a gate.
- Checklist, detail, add-task, finding, completion and picker captures were visually inspected. They preserve the locked light neutral/list-first system, purple `#6d4bd2`, restrained semantic green/amber/red, readable type and focus outlines, compact controls, and original Qraft composition. Green was darkened for text contrast; the expanded tab is hidden to prevent form obstruction. No material redesign or change to the approved visual artifact was made.
- Browser emits native JPEG screenshots. Those 12 images are retained as `.jpg` without conversion/rescaling; three real-pointer hover captures are native PNGs. Every encoding and exact dimension was checked from file headers, and representative images were inspected at original size. The hover API is not exposed by the current Browser locator surface, so hover images use the existing Playwright evidence tier; actual selection, context, cancellation and host suppression were inspected through Browser. The hover capture verified QA bytes did not change.
- Browser preview console inspection returned no warning/error entries. The automated suite retains Vite's forward-looking native-config import-extension warning; it is not a Vite 8.2.2 failure. No warning was suppressed to obtain a passing gate.
- Earlier aggregate fingerprints are not used to assert an unchanged boundary when ambiguous. The final source manifest, final all-layer checks, and final integrated journey supersede earlier affected domain/Markdown/protocol/UI/picker evidence. No earlier milestone was restarted as a new implementation project.

### Final execution budget and Git state

One local aggregate candidate gate and three isolated candidate gates were run during this resumption. The additional isolated gates were explicitly diagnosed above: duplicate React keys, then a Browser-observed picker-exit tab overlap. Each retry followed its own relevant source/test delta and focused passing check. No unchanged failed gate was blindly repeated. Final Browser acceptance was refreshed after the visual correction; no deployment, hosted CI watch, package publication, or authority transition occurred.

Remaining implementation/acceptance work: **none within local v0.1 scope**. Remaining distribution decision: the owner has not selected a public license or authorized external distribution. Existing local-only limitations remain documented in README and canonical contracts. Final Git state is `main` at the unchanged base commit with the scoped M6 modifications and one new `scripts/source-fingerprint.mjs`; no user work was discarded and no commit was created.

- 2026-09-05 — Closure hygiene: stopped the three test-owned loopback consumer/preview servers and closed the temporary Browser tab; restored the Browser viewport override. Historical URLs above are evidence locations, not claims of still-running services. Rebuilt the workspace generated output after the final CSS change; `diff -qr dist /private/tmp/qraft-final-hvkmyt4a/dist` passed with identical output. No test gate was repeated for the evidence-only documentation updates. Final Git status is retained in `artifacts/release/final-git-status.txt`.


## Owner feedback revision diagnostics — 2026-09-05

- Domain/Markdown focused checks passed 40 tests; protocol/catalog focused checks passed 11 tests including two-file isolation and symlink substitution.
- First Chromium pass: 13/15 passed. The edit-note input used an implicit wrapped label that the ShadowRoot locator could not target; changed to explicit label/ID. The tab used React resize state for pixel top and briefly overflowed on resize; changed rendered top to viewport-relative CSS calculation.
- Focused retest confirmed tab persistence/clamping. The remaining note test assumed the caret returned at the end after picker cancellation; actual text was retained and Shift+Enter inserted at the focused caret. The test now sets End before checking the newline position. Added retained edit drafts for external note/task removal; both note tests pass.
- No dependencies, copied upstream implementation, screenshots-as-product feature, hosted resources, or framework adapters were added. New context uses the existing pinned public React Grab primitives and bounded platform DOM reads.

- First clean-copy gate: frozen install and check passed (54 unit/integration tests/build). Browser passed 46/48; Firefox/WebKit interpret End differently on this host, so the Shift+Enter test still inserted a newline at the initial caret. The newline behavior was correct. Set the test caret explicitly using the native textarea selection API, preserving the same exact newline assertion. This test-only diagnostic justifies a replacement check/browser run; audit and consumer had not yet run. Product code and built output are unchanged.

- Second clean-copy browser run passed the caret test in all engines; 46/48 passed overall. The new password-context test read the file before submission completed because its readiness locator also matched the textarea draft. Restricted the readiness assertion to the saved note timeline, then retained the exact persisted-context/no-value assertions. This is a test-only timing correction, not a product or persistence relaxation. Final audit/consumer still had not run.

- Third isolated candidate passed all four gates: 54 unit/integration tests, 48 E2E tests, 111-license audit and packed consumer. During the subsequent hands-on Browser journey, source opening did not report the injected local failure. Inspection of installed React Grab's public artifact showed that openFile falls back to an external website; the old test forced window.open to throw and masked that behavior. Replace only source opening with a timeout-bounded same-origin Vite request with redirects rejected, and assert that a local failure never attempts window.open. Updated canonical protocol, architecture and provenance to resolve the local-only conflict. This relevant product delta requires a replacement artifact and final checks; prior Browser captures are diagnostic until recaptured. The first focused filter matched no tests; use the inspected source-open test title.

- Source-opening focused Browser regression passed all three engines. The replacement aggregate stopped at TypeScript: the test callback referenced a shadowing QADocument variable named document. Use window.document explicitly in the serialized callback. No runtime product change; remaining gates had not run.

## Final owner-feedback acceptance — 2026-09-05

Status: **complete within the local internal scope**. Original M1–M6 evidence remains historical; this record refreshes all changed domain, Markdown, file/protocol, UI, picker and packaging boundaries. No earlier milestone was restarted as a separate project.

### Candidate identity and clean-state proof

- Base: `7dae055d578b406012fc01853e097b0ea8ecd07b`, branch `main`, clean before this feedback implementation. All changes belong to the owner-requested revision; no existing work was discarded.
- Final source fingerprint: `38bc8a27ffca8d7a71cff20a3c81b7b79bbfd87e1f356db34dcd3c569af6de9a`. The 93-file path/mode/SHA-256 manifest is `artifacts/release/feedback/source-manifest.json`. Exact equality was verified between the working implementation and isolated copy `/private/tmp/qraft-feedback-final-06k9l2mk`.
- The isolated copy started without `.git`, dependencies, generated output or local QA data. It included the actual current tracked/untracked implementation bytes and modes, excluding deleted files. `corepack pnpm install --frozen-lockfile` passed there. Later diagnostic deltas were copied into that same isolated tree, and the final manifest equality proves no uncommitted implementation was omitted.
- Final packed archive SHA-256: `1f4267ea59070011b633fbed2e9e907599f342abf2202e144527f2c9ccf031fd`; 27 archive entries, public client/Vite exports and notices verified. Clean consumer: `/var/folders/vh/q11rp8711qz5l2_r6bsndlb00000gn/T/qraft-clean-consumer-CQgRSs`. No repository source aliases or linked source imports.
- Final gates in the isolated root: `corepack pnpm check` passed format/lint/typecheck, 8 files/54 unit-integration tests and build; `corepack pnpm test:browser` passed 48/48 across Chromium, Firefox and WebKit; `corepack pnpm audit:release` passed exact pins, 111 installed licenses/notices, exports, browser boundary and Agentation exclusion; `corepack pnpm verify:consumer` passed installation, public exports, production build and five production endpoint-absence checks.
- Final logs: `artifacts/release/feedback/{check,browser,audit,consumer}.log`; installation: `install.log`; receipt: `consumer.json`. No dependencies, lockfile pins or public distribution model changed.
- Execution budget: one frozen installation; five isolated check starts, four browser starts and two audit/consumer runs. Every replacement follows the specific test diagnosis or source-opening product delta recorded above. The final candidate passed once; no unchanged gate was repeated afterward.

### Current acceptance mapping

| Criterion | Current evidence | Result |
| --- | --- | --- |
| 1. Install/integrate in Vite React | Packed public exports installed in the clean consumer; documented `qraft()` + `<QA />` file-choice journey | [x] Pass |
| 2. Overlay preserves host | Browser before/after geometry at all three required sizes; M1/M6 E2E | [x] Pass |
| 3. Read without startup rewrite | File-choice/reload E2E revision equality; catalog has no write operation | [x] Pass |
| 4. Minimal task-state patch | Full-file status goldens for completed/open/skipped, lazy IDs and newline variants | [x] Pass |
| 5. Canonical creation | Full-file section/task/attached-note goldens; packed Browser creation and saved Markdown readback | [x] Pass |
| 6. Editable independent notes | Body-only note/legacy-note goldens, retained attachment bytes, three-engine note/status journeys | [x] Pass |
| 7. External refresh | Packed Browser external note appears without reload and retains draft; watcher/SSE tests | [x] Pass |
| 8. Stale-write rejection | Store race tests and deterministic packed Browser stale save, visible conflict and successful retry | [x] Pass |
| 9. Safe picker targeting | Three-engine hover/ignore/cancel/host-control tests; packed selection leaves quantity at 2 | [x] Pass |
| 10. Bounded identifying context | Strict schema, password-value exclusion regression, packed Markdown context readback and expanded context screenshot | [x] Pass |
| 11. Local safe source opening | Final same-origin request regression checks file/line/column and no window fallback; packed Browser injected failure shows inline path | [x] Pass |
| 12. Preserve unknown Markdown | Full-file goldens and atomic store tests; packed unknown comment/fence and conflict sentinel survive subsequent mutations | [x] Pass |
| 13. Production absence | Five packed preview endpoint probes; Browser `/__qraft/files` and `/__qraft/document` show only host HTML and zero Qraft roots | [x] Pass |
| 14. Clean-state aggregate checks | Final isolated `check`, 48-browser suite, package audit and clean consumer all passed on source fingerprint above | [x] Pass |
| 15. License/provenance boundary | 111-package final audit, unchanged required React Grab notice and no Agentation material | [x] Pass |
| 16. Current integrated visuals | Final packed Browser journey plus 20 verified native screenshots; original visual compared with explicit owner-approved revision | [x] Pass |

### Final Browser journey and screenshots

- URL: `http://127.0.0.1:4182/`; production preview: `http://127.0.0.1:4184/`. All final screenshots below use source `38bc8a27ffca8d7a71cff20a3c81b7b79bbfd87e1f356db34dcd3c569af6de9a` and archive `1f4267ea59070011b633fbed2e9e907599f342abf2202e144527f2c9ccf031fd`.
- 1440×900: first-use chooser; select file; create section/task; keyboard complete from list; compact tab and remembered vertical movement/file choice after reload; double-click skip; open detail; Enter-submit note; attach quantity button without activation; edit saved note; observe external note; force stale revision with the fixture server paused before a queued request; reject without overwrite and retain/retry draft; local source failure; reopen/complete; all tasks completed with no celebration/auto-advance; empty file selection and return; expanded element context.
- 1366×650: inspect list and scrolling note timeline, cancel picker with Escape, retain composer draft through navigation. 768×900: inspect list/detail and picker cancellation; `aria-modal=true`; Shift+Tab from Close wraps to Change file and Tab wraps back; Escape returns focus to the closed tab.
- `browser-geometry.json` proves unchanged host boxes: 1440×384.8125, 1366×384.8125 and 768×630.6875, respectively. Body overflow remains `visible`, document scroll stays `(0,0)`, and body/document widths equal each viewport. The tab is 72.15625×26 px. Resize measurement was explicitly targeted back to the consumer after inspecting production; the earlier measurement of the inactive tab was discarded.
- Final consumer Markdown SHA-256: `757ef008728cadaab8cf6b6dfc280647406fbf1a5280d5129b2f95b174c85ef8`. All four tasks are completed, all four notes remain, and the unknown comment/fence plus external sentinel are byte-for-byte intact.
- Gallery: `artifacts/browser-evidence/review/feedback/index.html`, served at `http://127.0.0.1:4181/feedback/`. Screenshots: 17 native Browser JPEGs plus 3 supplemental lossless Playwright pointer-highlight PNGs. All image headers/dimensions passed the screenshot skill checker; originals were inspected. Browser warn/error log readback was empty on the final journey.
- Image manifest: `artifacts/browser-evidence/review/feedback/screenshots.json`, SHA-256 `c40a3d9559079d1e1130e857cf94efd3545076e2c0b8ac012d54371db2cab9ae`. Each entry records URL, exact viewport, state, evidence layer, actual encoding, source fingerprint, artifact digest and image SHA-256. Image metadata was reconciled against the retained native files after a capture-session array binding failed to retain entries; image bytes were unaffected. Prior candidate images are retained separately as diagnostics and excluded from the final manifest.
- Visual comparison retains the approved neutral, list-first typography and restrained purple identity. The owner's explicit update governs the compact concave tab, large Back, three states, note composer/timeline, softer shadow and removal of findings/completion surfaces.

Remaining implementation or local acceptance work: **none**. Known limits remain documented: source/selector information is best-effort, drafts survive mounted-session navigation but are not persisted across reload, the picker does not capture screenshots or form values, and the tool is Vite/local/development-only. The owner authorized commit and push without waiting on hosted CI; the validated scoped diff is ready for that handoff. Public publication/deployment and external resources remain outside scope. Generated evidence and local fixture data stay ignored by Git.
