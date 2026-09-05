# Qraft

Qraft is a development-only React QA drawer backed by one local Markdown checklist. A tester and a coding agent share `QA.md`: browser actions become minimal Markdown patches, while external file edits appear in the drawer without a page reload.

Qraft v0.1 supports Vite and React only. It has no accounts, cloud service, database, public server, or production middleware.

## Install an internal build

Qraft is private and has not been published. Build or obtain the approved internal tarball, then install it with its exact v0.1 peers:

```sh
pnpm add ./qraft-qa-0.1.0.tgz react@19.2.8 react-dom@19.2.8 vite@8.2.2
```

Add the development plugin to `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { qraft } from "@qraft/qa/vite";

export default defineConfig({
  plugins: [react(), qraft()],
});
```

Mount the drawer behind Vite's development guard:

```tsx
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

The drawer first asks you to choose a Markdown checklist inside the Vite project. It remembers the choice per project in your browser. Use **Change file** to choose another. There is no default filename. An optional trusted `qraft({ file: "./reviews/checkout.md" })` restricts the chooser to that file, including a missing file which the first Add section action can create. The browser sends only a server-issued file ID, never a filesystem path. The optional `endpoint` still defaults to `/__qraft`.

## Review workflow

Drag the small six-dot grip up or down the right edge; its position survives reload. Keyboard arrows and Home/End move it too. Click QA to open the checklist. Change status directly in a task row: not completed → completed → skipped → not completed. Double-click the status to skip. Open the title for explicit status buttons and notes.

While picking an element, use ↑/↓ or Parent/Child to choose its container, and Enter or click to attach. Parent navigation holds the target until Resume picking. The element trail shows your selection; Guides toggles faint edge lines. The outline follows moving elements and shows their dimensions.

Notes are observations for your coding agent, without their own completion state. The composer is always available: Enter submits, Shift+Enter inserts a line break. Attach an element while retaining your draft, add multiple notes, and edit earlier notes. Task completion never depends on notes and never auto-advances. Skipped tasks remain in the total and are counted separately from completed tasks.

## Markdown dialect

```md
# Checkout review

## Cart

- [ ] Change quantity
  - Note: Check keyboard controls too.
  - Note: The increment button needs more spacing.
    - Component: `QuantitySelector`
    - Source: `src/cart/QuantitySelector.tsx:87:5`
    - Route: `/checkout`
    - Selector: `.quantity-selector`
    - Context: `{"tag":"button","attributes":{"data-testid":"increment"},"text":"+","ancestors":["div.quantity"]}`
- [x] Remove product
- [-] Check an unsupported payment method
```

H2 headings define sections. Top-level markers are open `[ ]`, completed `[x]`, and skipped `[-]`. Two-space `Note:` bullets are editable notes. Legacy nested checkbox findings render as notes, with their original markers and bytes preserved. Qraft adds hidden stable IDs only when creating or first mutating an entity. Opening or selecting a file never rewrites it. See [the complete preservation contract](docs/markdown-storage.md).

If no file exists, ask your coding editor to create a Markdown checklist with sections and tasks, then use Refresh files. Discovery ignores hidden folders, dependency/build/output folders and symlinks. It is bounded to 2,000 files and 10,000 entries; configure a specific file if a large project exceeds that bound. File and tab persistence require browser local storage; otherwise selection works for the current session. Unsaved note drafts survive navigation within the mounted drawer, but are not persisted across page reloads.

## Safe local use

- Run Qraft only on a trusted local development machine.
- Do not bind a Qraft-enabled Vite server to an untrusted network. The local endpoints intentionally have no authentication.
- Keep `<QA />` behind `import.meta.env.DEV`; the `qraft()` plugin itself uses Vite's serve-only boundary and registers nothing in builds or preview servers.
- Keep the QA file inside the Vite project root. Browser requests contain typed commands, never paths, editor commands, shell commands, or replacement Markdown.
- Commit or back up important checklist changes using your normal project workflow. Qraft detects stale revisions and writes atomically, but it is not a version-control system.

## Known v0.1 limitations

- Only Vite, React 19.2.8, desktop pointer input, and layouts at 768 CSS pixels or wider are supported.
- The file store has an in-process command queue and a second revision check, but no cross-process lock. A simultaneous external write in the final check-to-rename window remains possible.
- Element source context depends on React Grab and source-map availability. Attachments also retain bounded tag, identifying attributes, selected visible text, ancestor context, and up to five relevant component/source locations; no form values, full HTML, styles, or screenshots are captured. Selectors and source locations are best-effort identifiers and may change as the application changes. Plain notes remain available when context is partial or unavailable.
- Picker traversal supports the main document, open Shadow DOM, and same-origin iframes. Closed shadow roots and cross-origin frames are inaccessible.
- Editor opening depends on the local Vite/editor integration and can fail; Qraft keeps the stored path visible for manual use.
- IDs and selector strings are implementation metadata, not a public automation API.

## Repository development

Use the pinned Node and pnpm versions, then run:

```sh
corepack pnpm install
corepack pnpm check
corepack pnpm test:browser
corepack pnpm audit:release
corepack pnpm verify:consumer
```

`check` covers formatting, lint, typecheck, unit/integration tests, and the package build. `test:browser` exercises Chromium, Firefox, and WebKit. `audit:release` checks the exact pins, installed transitive licenses, notices, exports, and excluded material. `verify:consumer` packs Qraft, installs that tarball into a clean temporary Vite React app, imports only the two public exports, and builds and checks the production consumer preview. Both scripts retain local evidence under ignored `artifacts/release/`. Run `build` before either artifact check. `scripts/source-fingerprint.mjs` records candidate bytes and file modes, excluding generated/local files and the two evidence-only roadmap/status documents.

## Project status and documentation

The v0.1 implementation is complete locally when every acceptance item and its current evidence are checked in [the implementation plan](docs/implementation-plan.md). Commits and pushes are separate from local verification; no package publication or deployment is implied.

Start with [the documentation index](docs/README.md). Product scope, design, architecture, Markdown, protocol, testing, roadmap evidence, and OSS boundaries each have one canonical owner. Third-party notices ship in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
