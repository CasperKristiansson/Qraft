# Upstream research and licensing boundary

This document records the sources inspected for the v0.1 design and the rules agents must follow when implementing element selection. It is an engineering boundary, not legal advice.

Research snapshot: 2026-09-04

This document is the single owner of the dependency and structural-reference allowlist. package.json and pnpm-lock.yaml own the installed versions.

## Verified upstreams

### React Grab

- Repository: [aidenybai/react-grab](https://github.com/aidenybai/react-grab)
- Inspected commit: `ea4bbec9e80f4802e8ae19ad18431edb9ddbb670`
- Inspected package version: `react-grab@0.2.0`
- Declared package/repository license: MIT
- Relevant public entry: `react-grab/primitives`

At the inspected commit, public primitives include:

- `getElementAtPoint()`
- `getElementBounds()`
- `getElementContext()`
- `getElementSelector()`
- `isElementGrabbable()`
- `openFile()`

`getElementContext()` exposes component/source/selector information plus richer DOM, stack, Fiber, HTML, and style context. Qraft deliberately persists only the limited fields in [Architecture](architecture.md), including a bounded projection of relevant component/source locations rather than raw stacks.

The installed `openFile()` implementation attempts the host editor endpoint and then opens an external website on failure. Qraft does not use that primitive: its local-only source action requests Vite's editor endpoint directly and reports failure inline. Selection continues to use the published primitives above. This behavior was verified against the installed `react-grab@0.2.0` artifact during the 2026-09-05 packed-consumer review; no upstream code was copied.

### petite-react-grab

- Repository: [aidenybai/petite-react-grab](https://github.com/aidenybai/petite-react-grab)
- Inspected commit: `c013b3ac5318d45e2a68d39a738415f45685592c`
- Declared license: MIT

The repository is a compact reference for building a custom interface on React Grab primitives. It demonstrates isolated UI, capture-phase pointer handling, asynchronous context resolution, and excluding the tool's own UI.

It is a reference, not a Qraft dependency. Prefer an original implementation around the published primitives.

### Supporting direct dependencies

The following primary repositories and published packages were verified for the specific v0.1 roles below:

| Repository                                                                            | Inspected commit                              | Package pin                                                             | Detected/declared license                       | Boundary                                                                                    |
| ------------------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [facebook/react](https://github.com/facebook/react)                                   | `d9f4e76bd6582ef86048fefcedda9d5b041ae62f`    | `react@19.2.8`, `react-dom@19.2.8`                                      | MIT                                             | Runtime only; never copy internals.                                                         |
| [vitejs/vite](https://github.com/vitejs/vite)                                         | `8492422b8f110625a90c702f42f30784e8cf19dc`    | `vite@8.2.2`                                                            | MIT                                             | Public build/plugin/server/watcher APIs and official plugin documentation.                  |
| [radix-ui/primitives](https://github.com/radix-ui/primitives)                         | `f7ecd5ab16f5e1e820eb5786a1419a98a2d594ae`    | `@radix-ui/react-dialog@1.1.23`, `@radix-ui/react-focus-scope@1.1.16`   | MIT                                             | Published accessible primitives inside Qraft's ShadowRoot; no internal copying.             |
| [colinhacks/zod](https://github.com/colinhacks/zod)                                   | `7a00236683c79000dbab0d92f6faf0b7fba39f59`    | `zod@4.5.4`                                                             | MIT                                             | Runtime validation; Qraft retains its own domain model.                                     |
| [npm/write-file-atomic](https://github.com/npm/write-file-atomic)                     | `23e111d95367e1d987c1b4d7823791eaaf6b21df`    | `write-file-atomic@8.0.0`                                               | ISC                                             | Durable staging writes; Qraft owns the conditional final rename, revision checks and queue. |
| [lucide-icons/lucide](https://github.com/lucide-icons/lucide)                         | `4dc5b7ebaed733642fae0382238d71a147fb5c7d`    | `lucide-react@1.41.0`                                                   | ISC, with named Feather-derived icons under MIT | Sole icon family; notices must cover actually distributed icons/license files.              |
| [vitest-dev/vitest](https://github.com/vitest-dev/vitest)                             | `9e1166959e14bd32298d8a0e85352431c769ec7a`    | `vitest@5.0.0`                                                          | MIT                                             | Development test dependency.                                                                |
| [microsoft/playwright](https://github.com/microsoft/playwright)                       | `d1dcd6bc0a138ec0fd943df19e07458dc426ee22`    | `@playwright/test@1.62.1`                                               | Apache-2.0                                      | Development browser-test dependency.                                                        |
| [microsoft/TypeScript](https://github.com/microsoft/TypeScript)                       | `2bd066d87f5bafd315be9f40889d0a60b9e58e0b`    | `typescript@7.0.2`                                                      | Apache-2.0                                      | Development compiler and declaration emitter.                                               |
| [DefinitelyTyped/DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) | Published tarballs locked by `pnpm-lock.yaml` | `@types/node@26.4.1`, `@types/react@19.2.18`, `@types/react-dom@19.2.7` | MIT                                             | Development-only platform and peer type declarations.                                       |
| [vitejs/vite-plugin-react](https://github.com/vitejs/vite-plugin-react)               | `04cac5020e349f452d76c5a4f6d788ad4b38930a`    | `@vitejs/plugin-react@6.1.1`                                            | MIT                                             | Public React transform and refresh integration for the deterministic example.               |

Package pins were checked against their published registry metadata on the research date. The lockfile is the exact transitive graph authority.

### Additional structural reference

[shadcn-ui/ui](https://github.com/shadcn-ui/ui) at commit `7c9eaba1c0a6404c990c144a654792e3313c650d` is MIT-licensed and may be inspected only at `apps/v4/registry/bases/radix/ui/{button,dialog,textarea,progress,badge}.tsx`. Extract component/API patterns into smaller Qraft-owned components. Do not install shadcn, Tailwind, or Vaul and do not copy its Drawer/theme wholesale.

### Agentation

- Package reference: [agentation 3.0.2 on npm](https://www.npmjs.com/package/agentation)
- License shown at research time: PolyForm Shield 1.0.0

Agentation was consulted only for its publicly documented interaction concepts: activate, hover, select, annotate, and preserve element context for agents. Qraft's workflow, code, visual design, storage, and data model must be independently implemented.

## Implementation rules

1. Pin `react-grab@0.2.0` for the first implementation and commit the package lock.
2. Import the published primitives instead of reaching into unexported internal paths.
3. Add the React Grab MIT copyright and permission notice to `THIRD_PARTY_NOTICES.md` before completing picker work.
4. If React Grab or petite-react-grab source is copied or substantially adapted, preserve the applicable MIT notice in source/distribution as required and make the adaptation explicit in review.
5. Do not add `agentation` as a dependency.
6. Do not inspect for reuse or copy Agentation source, generated bundles, CSS, assets, icons, copy, or distinctive implementation details.
7. Implement generic interaction ideas in original Qraft code and an original visual system.
8. Do not claim Agentation compatibility.
9. Re-check package exports, versions, transitive license metadata, and upstream notices before dependency upgrades or external distribution.
10. Use `@Browser` for changed integrated behavior to validate the integrated behavior that the reused package or extracted pattern enabled; source resemblance is not evidence that it works inside Qraft's ShadowRoot.
11. Record structural provenance here when adding or changing a reference.

## Version policy

The primitives API is active and may change. The exact pin is intentional for v0.1. An upgrade requires:

- reviewing the public export and type changes;
- reviewing license/package metadata;
- updating this snapshot;
- running picker and editor-open unit/E2E tests;
- recording any persisted selector compatibility effect.

Do not silently float to a newer React Grab version during unrelated work.

## Project distribution status

The first-use illustration at `src/client/assets/checklist.png` was generated with the built-in
image-generation tool on 2026-09-06 at the owner's request. It is an original generated asset,
not copied from an upstream project or icon family. Its transparent output was resized to 192 px
for a 72 CSS px presentation and is bundled locally; it requires no remote image request.

Generation prompt: “Use case: stylized-concept. Asset type: small onboarding illustration for Qraft,
a minimal white React QA drawer with purple #6d4bd2 accents. Create one elegant small 3D paper
checklist icon: a softly rounded ivory sheet with three embossed rows, small purple checkmarks,
a subtly folded top corner, and one tiny purple pencil leaning at its lower edge. Tactile matte
paper and ceramic-like accents, restrained premium editorial look, gentle soft studio lighting,
very subtle natural shadow. Centered single object filling about 75% of a square composition,
genuinely transparent background. No words, no letters, no logos, no sparkles, no gradients in the
background, no surrounding UI. Must read clearly at 72 CSS pixels. Save a compact square image
suitable for a website asset.”

The owner selected the [MIT license](../LICENSE) on 2026-09-06 for Qraft's code, documentation,
and bundled skill. The package declares `MIT` and includes the license and third-party notices.
Dependencies retain their own licenses; Qraft's license does not replace those obligations.

The owner authorized public GitHub and npm distribution on 2026-09-06. The npm name is
`@qraft-dev/qa`; future registry releases still require explicit owner authorization.

## Agent workflow and repository tooling references

The owner approved an original portable checklist skill and explicit installation guidance on
2026-09-06. No third-party skill text or implementation is copied. These references are allowlisted
only for the described documentation and tooling roles:

| Source                                                             | Inspected revision or date                                           | Role and resulting Qraft files                                                                                          |
| ------------------------------------------------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [Agent Skills specification](https://agentskills.io/specification) | 2026-09-06                                                           | Portable frontmatter and self-contained guidance in `skills/qraft-review/SKILL.md`                                      |
| [Codex skills](https://learn.chatgpt.com/docs/build-skills)        | 2026-09-06                                                           | Project discovery documentation in `docs/agent-skill.md`; no runtime integration                                        |
| [Claude Code skills](https://code.claude.com/docs/en/skills)       | 2026-09-06                                                           | Project directory and explicit invocation documentation in `docs/agent-skill.md`                                        |
| [vercel-labs/skills](https://github.com/vercel-labs/skills)        | `435076e78988e1e6ec40d00b0b1d76bdbbc5419a`, `README.md`, MIT         | Optional local-directory installation command and snapshot semantics in `docs/agent-skill.md`; not a package dependency |
| [actions/checkout](https://github.com/actions/checkout)            | `3d3c42e5aac5ba805825da76410c181273ba90b1`, v7.0.1, `README.md`, MIT | Pinned source-checkout action in `.github/workflows/ci.yml`                                                             |
| [actions/setup-node](https://github.com/actions/setup-node)        | `820762786026740c76f36085b0efc47a31fe5020`, v7.0.0, `README.md`, MIT | Pinned Node setup action in `.github/workflows/ci.yml`                                                                  |

The actions execute only in repository CI and are not bundled in the npm artifact. The skill uses
no host-specific tool declarations, hooks, MCP service, external application calls or custom installer.

## Pre-release check

Before any public, commercial, or team-wide distribution beyond the internal development use assumed here:

1. Refresh upstream versions and licenses from primary sources.
2. Audit the dependency lockfile and built artifacts.
3. Confirm required notices ship with the relevant distribution.
4. Confirm no Agentation implementation material entered the repository.
5. Obtain owner/legal review appropriate to the intended distribution.

## Installed graph audit

The local release audit enumerates all installed pnpm package manifests against the exact lockfile, including build/test packages. MIT, ISC, Apache-2.0, BSD-2-Clause, BSD-3-Clause, 0BSD, and MPL-2.0 are the reviewed transitive license families. `lightningcss` and its platform binary are unmodified MPL-2.0 build tooling delivered with their own license; they are not bundled into Qraft. `@react-grab/cli@0.2.0` omits the manifest license field but ships an MIT `LICENSE` with Aiden Bai's notice, also confirmed against the allowlisted repository's [pinned root license](https://raw.githubusercontent.com/aidenybai/react-grab/ea4bbec9e80f4802e8ae19ad18431edb9ddbb670/LICENSE). Qraft imports only `react-grab/primitives`, never the CLI. The audit records this exact exception and rejects other unknown licenses. Platform-optional binaries not installed on the test host are outside this local artifact audit; external distribution still requires the pre-release check above.

The installed archives for `@rolldown/binding-darwin-arm64@1.2.6`, `react-remove-scroll-bar@2.3.8`, and `stackback@0.0.2` declare MIT in their manifests but omit standalone license files. The binding uses the notice shipped by its matching `rolldown@1.2.6` parent; the scroll-bar README also declares MIT. These exact archive omissions are recorded in the inventory. Qraft does not copy or bundle these packages into its tarball; any external redistribution review must revisit archive notice completeness.

## Next.js and maintenance tooling

Owner-approved additions: Next.js 16.3.3 (MIT), used through public App Router Node route handlers and client components; Prettier 3.6.2 (MIT), a development-only formatter. References: https://nextjs.org/docs/app/getting-started/route-handlers and https://prettier.io/docs/cli. No framework implementation code is copied. Exact artifacts and transitive licenses remain governed by package.json, pnpm-lock.yaml and audit:release.

Next.js brings unmodified framework dependencies that are installed by the consumer, not copied into Qraft's tarball: `caniuse-lite@1.0.30001810` ships CC-BY-4.0 text; `@img/sharp-libvips-darwin-arm64@1.3.3` declares LGPL-3.0-or-later and points to lovell/sharp-libvips. Its platform archive omits a standalone license file. `@next/env@16.3.3`, `@next/swc-darwin-arm64@16.3.3` and `client-only@0.0.1` declare MIT but also omit standalone files; Next's installed license.md carries the Vercel MIT notice. These exact metadata-only exceptions are recorded by the audit, alongside license-file evidence where present. The audit does not claim to clear redistribution of framework binaries; Qraft distributes only its own built modules and notices, with Next an optional consumer-owned peer.

## Launch hardening provenance

Re-inspected the installed `write-file-atomic@8.0.0` public implementation `lib/index.js` (the pinned npm/write-file-atomic commit above). Its API has no post-fsync/pre-rename revision hook. Qraft therefore uses that package to stage bytes, followed by its own conditional final rename in `src/markdown/replace-file.ts`; `store.ts` performs the revision/path check after staging. No upstream implementation was copied. The exclusive cooperative lock and read-only diagnostics are original Node-API code.

Consumer peer ranges now permit the tested maintenance/current framework lines listed in architecture. Development and direct runtime packages stay exactly pinned; Next.js is an explicit development pin so broadening its optional peer does not float the repository lockfile. Compatibility fixtures additionally install Vite 7.3.6, plugin-react 5.2.0 and Next.js 15.5.25 through the same allowlisted official packages. They are isolated consumer dependencies, not added runtime dependencies or copied framework code.

## Public distribution review — 2026-09-06

The public archive contains Qraft-owned modules, source maps, documentation and skill text, with
MIT and third-party notices. The build externalizes all runtime packages, including React Grab
primitives. Consumers obtain those unmodified dependencies from npm; Qraft does not redistribute
their archives or optional framework binaries. The exact archive-notice exceptions above therefore
remain installed-dependency observations, not missing notices for bundled third-party code.
Recheck this boundary if bundling changes. The final release audit records the installed license
inventory, and clean consumers verify the actual packed exports and notice files.

## Shared S3 backend — 2026-09-10

Owner-requested addition: `@aws-sdk/client-s3@3.984.0`, Apache-2.0, from
[aws/aws-sdk-js-v3](https://github.com/aws/aws-sdk-js-v3). Inspected the installed artifact's
`package.json`, `LICENSE`, public S3Client and ListObjectsV2/GetObject/PutObject command declarations.
Qraft uses public SDK calls in `src/server/s3-storage.ts`; no SDK implementation is copied.
The optional peer is installed by the backend consumer, externalized from Qraft, and never imported
by the browser. The exact lockfile and installed-license inventory cover its transitive packages.
AWS's official conditional-write and Lambda event specifications are linked from the shared guide.

The installed transitive archives `@aws-sdk/credential-provider-http@3.972.72`,
`@aws-sdk/credential-provider-login@3.972.77` and `@aws-sdk/nested-clients@3.997.44` declare
Apache-2.0 but omit standalone license files. Their public manifests identify the same SDK
repository; the S3 client's distributed LICENSE supplies the Apache text, also included in
Qraft's notices. These exact metadata-only omissions are recorded in the audit. The packages
remain unmodified consumer dependencies and are not redistributed inside Qraft's archive.
