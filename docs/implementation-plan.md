# Qraft v0.1 Codex Goal-mode execution plan

## Status

- Current state: specifications are complete and the six-surface visual direction is owner-approved; implementation has not started.
- Active milestone: M1 — establish the package, read model, and browser-visible foundation.
- Branch/worktree: `main` in `/Users/casperkristiansson/programming/Qraft`; preserve the existing uncommitted documentation preparation.
- Last validation: documentation links/code fences passed locally; approved visual PNG verified as 1536×1024 with SHA-256 `ba14d7f37f19b257c521b31c5b2293f2f40a2dd69e817f65fd66d46b11315850`.
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

- [ ] M1: Establish package, read model, and browser-visible foundation
- [ ] M2: Implement safe Markdown command engine
- [ ] M3: Deliver Vite bridge and live synchronization
- [ ] M4: Build the approved drawer workflow
- [ ] M5: Integrate React Grab element attachment
- [ ] M6: Harden and prove the complete local candidate

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

- [ ] Pin Node `24.19.0`, pnpm `11.25.0`, package manager metadata, exact dependency versions, and lockfile.
- [ ] Create root TypeScript/Vite/Vitest/Playwright configuration and required root scripts.
- [ ] Define `.` client and `./vite` server exports without leaking server modules to the browser entry.
- [ ] Define domain types, diagnostics, strict validation primitives, and read-model helpers.
- [ ] Implement the constrained read-only parser with exact source spans, stable IDs, and session-local legacy locators.
- [ ] Add canonical, legacy, malformed, unknown-content, LF, CRLF, and mixed-newline fixtures.
- [ ] Create the deterministic Vite React example at `127.0.0.1:5173` with a read-only fixture preview.
- [ ] Implement Shadow DOM mounting and the locked neutral/purple token sheet without full workflow behavior.
- [ ] Spike Radix Dialog `Portal container={shadowRoot}` in non-modal mode plus the focused narrow-screen `FocusScope`; record focus, ARIA, outside-click, Escape, and body-overflow results. Stop for a decision if isolation requires changing host layout/scroll.
- [ ] Record OSS provenance for every used package/reference.

Validation:

- During edits: focused parser/domain Vitest and typecheck.
- Checkpoint gate: format/lint, typecheck, full M1 unit set, and package build.
- **Mandatory `@Browser`:** open `http://127.0.0.1:5173`, verify the fixture preview renders inside the Shadow DOM at 1440×900, inspect computed purple/neutral tokens, open/close the Radix shell with keyboard and Escape, and confirm the host example layout does not shift.

Done criteria:

- [ ] Every task above is complete.
- [ ] Read-only parsing leaves fixture bytes unchanged.
- [ ] Client/server export isolation is proven.
- [ ] Browser evidence is recorded with revision, URL, viewport, journey, and result.
- [ ] Only M1-level evidence is claimed; broader workflow proof remains open.

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

- [ ] Implement the six commands with strict Zod boundary validation and Qraft-owned domain invariants.
- [ ] Implement minimal span patches and lazy stable-ID insertion.
- [ ] Implement exact SHA-256 revisions and stale-base rejection.
- [ ] Serialize the complete read-modify-write operation per file.
- [ ] Perform the second pre-write revision check.
- [ ] Use `write-file-atomic@8.0.0` for sibling temp, fsync, metadata, rename, and cleanup while preserving Qraft's outer transaction semantics.
- [ ] Return typed validation, missing-target, duplicate-ID, conflict, and I/O errors.
- [ ] Add complete before/after golden fixtures for every mutation and legacy-target variant.
- [ ] Add race/failure tests proving the original survives.
- [ ] Add a private example storage lab that invokes the real store against a temporary fixture and will not ship in the package export.

Validation:

- During edits: one command/fixture test at a time.
- Checkpoint gate: all domain/Markdown/store tests, typecheck, and build.
- **Mandatory `@Browser`:** open the example storage lab at 1440×900, invoke create section/task, note/finding, task/finding status flows against a temporary file, inspect rendered before/after source, and verify unknown Markdown remains visibly unchanged. Confirm a forced stale revision shows conflict rather than success.

Done criteria:

- [ ] All commands have byte-for-byte golden evidence.
- [ ] External changes and injected failures do not overwrite the original.
- [ ] Browser storage-lab evidence is recorded.
- [ ] No public protocol or production surface was added early.

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

- [ ] Resolve plugin options and reject paths outside Vite root or invalid extensions.
- [ ] Implement exact document, command, and SSE routes with method/content/origin/body/schema safeguards.
- [ ] Implement safe error mapping without paths or stack traces.
- [ ] Implement bounded in-memory command-ID deduplication.
- [ ] Integrate Vite watcher add/change/unlink and coalesce by revision.
- [ ] Implement SSE heartbeat, cleanup, reconnect, and refetch behavior.
- [ ] Implement `HttpQAStorage` against the public protocol.
- [ ] Prove `apply: "serve"`, shutdown cleanup, and route absence in build/preview.
- [ ] Add real-Vite integration coverage using temporary files.
- [ ] Remove or isolate any M2-only harness path no longer needed.

Validation:

- During edits: focused endpoint/watcher tests.
- Checkpoint gate: full domain/store/protocol integration set, typecheck, and build/preview absence tests.
- **Mandatory `@Browser`:** load the example at 1440×900, perform a real command through `HttpQAStorage`, externally edit and then delete/recreate the temporary `QA.md`, observe live refresh without reload, force disconnect/reconnect, and verify conflict/write errors are truthful and preserve draft text.

Done criteria:

- [ ] Public protocol exactly matches its canonical document.
- [ ] Watch/reconnect/conflict journeys pass in the actual browser.
- [ ] Build and preview expose no Qraft endpoint.
- [ ] A compact handoff snapshot is written if the roadmap moves to a fresh task after M3.

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

- [ ] Implement the closed `QA n/n` edge tab and drawer shell.
- [ ] Implement checklist hierarchy, progress, selected task, and unresolved-finding counts.
- [ ] Implement task detail, pass/reopen guard, deterministic auto-advance, and completed state.
- [ ] Implement add section/task/note/finding forms with validation, pending, conflict, and preserved-draft behavior.
- [ ] Implement loading, empty, diagnostic, disconnected, conflict, and write-error states.
- [ ] Implement approved semantic components using Qraft CSS, Radix Dialog, and Lucide icons.
- [ ] Match the six-surface visual baseline without gradients, glow, excess cards, or excess purple.
- [ ] Implement keyboard order, focus trap/return, Escape hierarchy, live regions, reduced motion, and non-colour status cues.
- [ ] Add component and Playwright tests for all meaningful states.

Validation:

- During edits: focused component/journey tests and single-surface Browser checks.
- Checkpoint gate: affected unit/integration set, build, and full non-picker Playwright suite.
- **Mandatory `@Browser`:** compare checklist, task detail, finding, complete, and add-task surfaces directly with the approved image at 1440×900, 1366×650, and 768×900. Exercise all mouse/keyboard flows, inspect focus, confirm the host bounding box/scroll does not change, and save representative evidence screenshots.

Done criteria:

- [ ] The full Markdown QA loop works without element attachment.
- [ ] All five available approved surfaces match the locked character and written design rules.
- [ ] Automated and hands-on browser evidence cover keyboard and three viewports.
- [ ] Material visual deviations are owner-approved or corrected.

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

- [ ] Add `react-grab@0.2.0` and required MIT notice.
- [ ] Implement capture-phase hit testing with public primitives and explicit Qraft/ignored-subtree filtering.
- [ ] Implement async request sequencing, bounds tracking, purple/white picker halo, label clamping, and complete cleanup.
- [ ] Prevent selected host controls from receiving the picker click.
- [ ] Open the Qraft-owned finding form with concise target context.
- [ ] Normalize/persist only approved `ElementReference` fields and omit unsafe source paths/query/hash.
- [ ] Permit plain-finding fallback after partial/no context.
- [ ] Implement `openFile()` with truthful inline errors.
- [ ] Add React Grab compatibility, cleanup, Shadow DOM, iframe/shadow-root where supported, and three-browser E2E tests.
- [ ] Complete provenance and third-party notices.

Validation:

- During edits: focused picker lifecycle/context tests.
- Checkpoint gate: affected unit/integration tests, build, and full picker Playwright suite.
- **Mandatory `@Browser`:** at all three viewports, activate picker, hover several host elements, verify Qraft never selects itself, select a quantity control without triggering it, save the finding, inspect exact Markdown context, exercise source opening, cancel with Escape, and test context-failure fallback. Compare picker/finding visuals to panels 03 and 04.

Done criteria:

- [ ] Element attachment and fallback journeys work without host side effects.
- [ ] Persisted data contains only approved fields.
- [ ] Browser and automated evidence cover cleanup, Escape, and source errors.
- [ ] A compact handoff snapshot is written if the roadmap moves to a fresh task after M5.

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

- [ ] Complete malformed-file, filesystem-failure, connection, duplicate-command, race, and cleanup fixtures.
- [ ] Complete keyboard, focus, reduced-motion, contrast, status, and responsive acceptance.
- [ ] Verify browser/server export separation and no build/preview endpoint.
- [ ] Install/use the packed artifact in a clean temporary Vite React consumer.
- [ ] Verify exact dependency pins, licenses, and `THIRD_PARTY_NOTICES.md`.
- [ ] Verify no Agentation code/assets/bundles and no unapproved dependency/reference entered the tree.
- [ ] Run format/lint, typecheck, full unit/integration, build, and three-browser Playwright gates from a clean state.
- [ ] Run all 16 acceptance criteria and record evidence tier/results.
- [ ] Update installation, Markdown dialect, safe-local-use, known-limitation, and implementation-state docs.

Validation:

- During edits: only affected focused checks.
- Checkpoint gate: `corepack pnpm check`, `corepack pnpm test:browser`, packed clean-consumer build/use, and repository/license audit.
- **Mandatory `@Browser`:** using the packed artifact in the clean consumer, run the complete human loop at 1440×900 and representative 1366×650/768×900 checks: open drawer, create content, pass/reopen, conflict/live refresh, attach element, save/resolve finding, open source, complete all tasks, and verify production preview has no Qraft endpoint. Compare final surfaces to the locked image and save final screenshots.

Done criteria:

- [ ] All M6 tasks pass on the final diff.
- [ ] All 16 v0.1 acceptance criteria have current evidence.
- [ ] The clean consumer proves the packed package, not source aliases.
- [ ] Final Browser evidence records source revision and artifact digest.
- [ ] Documentation distinguishes specified, locally verified, and not externally delivered states.
- [ ] No push/publication/deployment is inferred.

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
| — | — | — | — | No implementation Browser run yet | Not run | — |

## OSS provenance log

| Date | Milestone | Repository/commit/path | Extracted behavior | Qraft destination | Evidence |
| --- | --- | --- | --- | --- | --- |
| 2026-09-04 | Planning | Repositories in exact allowlist | Roles and boundaries researched; no code copied | This plan | GitHub/npm metadata and inspected upstream files |

## Blockers, decisions, and evidence log

- 2026-09-04 — Decision: the six-panel generated visual is owner-approved and locked at the digest recorded above.
- 2026-09-04 — Decision: every milestone requires interactive `@Browser` evidence in addition to automated tests.
- 2026-09-04 — Decision: use published packages for React Grab, Radix Dialog, Zod, Lucide, and atomic writes; use petite-react-grab and selected shadcn files only as structural references.
- 2026-09-04 — Decision: shadcn's Vaul-based Drawer, Tailwind, and Agentation implementation code are excluded from v0.1.
- 2026-09-04 — Evidence boundary: documentation and upstream research only. No Qraft implementation, test, Browser, CI, package, or release evidence exists yet.
