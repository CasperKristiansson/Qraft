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
  plugins: [react(), qraft({ file: "./QA.md" })],
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

The optional `qraft()` `file` must be a `.md` or `.markdown` path inside the Vite root and defaults to `./QA.md`. Its optional `endpoint` defaults to `/__qraft`. The browser component never receives a filesystem path.

## QA.md dialect

Qraft recognizes H2 sections, top-level task checkboxes, two-space-indented notes and finding checkboxes, and four-space-indented attachment metadata:

```md
# Checkout QA

## Cart

- [ ] Change quantity
  - Note: Check keyboard controls too.
  - [ ] Quantity control jumps at two digits.
    - Component: `QuantitySelector`
    - Source: `src/cart/QuantitySelector.tsx:87:5`
    - Route: `/checkout`
    - Selector: `.quantity-selector`
```

Qraft adds hidden `<!-- qraft:id=... -->` comments when it creates an entity or first mutates compatible legacy content. Merely starting Vite, opening Qraft, or parsing the file never rewrites it. Unknown Markdown remains outside the read model and is preserved byte-for-byte during supported mutations. See [the complete Markdown contract](docs/markdown-storage.md).

## Safe local use

- Run Qraft only on a trusted local development machine.
- Do not bind a Qraft-enabled Vite server to an untrusted network. The local endpoints intentionally have no authentication.
- Keep `<QA />` behind `import.meta.env.DEV`; the `qraft()` plugin itself uses Vite's serve-only boundary and registers nothing in builds or preview servers.
- Keep the QA file inside the Vite project root. Browser requests contain typed commands, never paths, editor commands, shell commands, or replacement Markdown.
- Commit or back up important checklist changes using your normal project workflow. Qraft detects stale revisions and writes atomically, but it is not a version-control system.

## Known v0.1 limitations

- Only Vite, React 19.2.8, desktop pointer input, and layouts at 768 CSS pixels or wider are supported.
- The file store has an in-process command queue and a second revision check, but no cross-process lock. A simultaneous external write in the final check-to-rename window remains possible.
- Element source context depends on React Grab and source-map availability. Plain findings remain available when context is partial or unavailable.
- Picker traversal supports the main document, open Shadow DOM, and same-origin iframes. Closed shadow roots and cross-origin frames are inaccessible.
- Editor opening depends on the local Vite/editor integration and can fail; Qraft keeps the stored path visible for manual use.
- IDs and selector strings are implementation metadata, not a public automation API.

## Repository development

Use the pinned Node and pnpm versions, then run:

```sh
corepack pnpm install
corepack pnpm check
corepack pnpm test:browser
corepack pnpm verify:consumer
```

`check` covers formatting, lint, typecheck, unit/integration tests, and the package build. `test:browser` exercises Chromium, Firefox, and WebKit. `verify:consumer` packs Qraft, installs that tarball into a clean temporary Vite React app, imports only the two public exports, and builds the production consumer.

## Project status and documentation

The v0.1 implementation is complete locally when every acceptance item and its current evidence are checked in [the implementation plan](docs/implementation-plan.md). This repository has not been pushed, published, deployed, or externally released by that local verification.

Start with [the documentation index](docs/README.md). Product scope, design, architecture, Markdown, protocol, testing, roadmap evidence, and OSS boundaries each have one canonical owner. Third-party notices ship in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
