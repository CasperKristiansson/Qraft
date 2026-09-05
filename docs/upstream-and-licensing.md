# Upstream research and licensing boundary

This document records the sources inspected for the v0.1 design and the rules agents must follow when implementing element selection. It is an engineering boundary, not legal advice.

Research snapshot: 2026-09-04

The exact implementation allowlist, inspected commits, package pins, source paths, and permitted roles are also embedded in [the Goal-mode implementation plan](implementation-plan.md#exact-open-source-reuse-allowlist), as required for self-contained agent execution. Both files must change together if the allowlist changes.

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

`getElementContext()` exposes component/source/selector information plus richer DOM, stack, Fiber, HTML, and style context. Qraft deliberately persists only the limited fields in [Architecture](architecture.md).

`openFile()` first attempts the host dev server's editor endpoint. The Qraft design relies on that published behavior and handles failure in UI.

### petite-react-grab

- Repository: [aidenybai/petite-react-grab](https://github.com/aidenybai/petite-react-grab)
- Inspected commit: `c013b3ac5318d45e2a68d39a738415f45685592c`
- Declared license: MIT

The repository is a compact reference for building a custom interface on React Grab primitives. It demonstrates isolated UI, capture-phase pointer handling, asynchronous context resolution, and excluding the tool's own UI.

It is a reference, not a Qraft dependency. Prefer an original implementation around the published primitives.

### Supporting direct dependencies

The following primary repositories and published packages were verified for the specific v0.1 roles below:

| Repository | Inspected commit | Package pin | Detected/declared license | Boundary |
| --- | --- | --- | --- | --- |
| [facebook/react](https://github.com/facebook/react) | `d9f4e76bd6582ef86048fefcedda9d5b041ae62f` | `react@19.2.8`, `react-dom@19.2.8` | MIT | Runtime only; never copy internals. |
| [vitejs/vite](https://github.com/vitejs/vite) | `8492422b8f110625a90c702f42f30784e8cf19dc` | `vite@8.2.2` | MIT | Public build/plugin/server/watcher APIs and official plugin documentation. |
| [radix-ui/primitives](https://github.com/radix-ui/primitives) | `f7ecd5ab16f5e1e820eb5786a1419a98a2d594ae` | `@radix-ui/react-dialog@1.1.23`, `@radix-ui/react-focus-scope@1.1.16` | MIT | Published accessible primitives inside Qraft's ShadowRoot; no internal copying. |
| [colinhacks/zod](https://github.com/colinhacks/zod) | `7a00236683c79000dbab0d92f6faf0b7fba39f59` | `zod@4.5.4` | MIT | Runtime validation; Qraft retains its own domain model. |
| [npm/write-file-atomic](https://github.com/npm/write-file-atomic) | `23e111d95367e1d987c1b4d7823791eaaf6b21df` | `write-file-atomic@8.0.0` | ISC | Final atomic write mechanics; Qraft retains revision checks and complete transaction queue. |
| [lucide-icons/lucide](https://github.com/lucide-icons/lucide) | `4dc5b7ebaed733642fae0382238d71a147fb5c7d` | `lucide-react@1.41.0` | ISC, with named Feather-derived icons under MIT | Sole icon family; notices must cover actually distributed icons/license files. |
| [vitest-dev/vitest](https://github.com/vitest-dev/vitest) | `9e1166959e14bd32298d8a0e85352431c769ec7a` | `vitest@5.0.0` | MIT | Development test dependency. |
| [microsoft/playwright](https://github.com/microsoft/playwright) | `d1dcd6bc0a138ec0fd943df19e07458dc426ee22` | `@playwright/test@1.62.1` | Apache-2.0 | Development browser-test dependency. |
| [microsoft/TypeScript](https://github.com/microsoft/TypeScript) | `2bd066d87f5bafd315be9f40889d0a60b9e58e0b` | `typescript@7.0.2` | Apache-2.0 | Development compiler and declaration emitter. |
| [DefinitelyTyped/DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) | Published tarballs locked by `pnpm-lock.yaml` | `@types/node@26.4.1`, `@types/react@19.2.18`, `@types/react-dom@19.2.7` | MIT | Development-only platform and peer type declarations. |
| [vitejs/vite-plugin-react](https://github.com/vitejs/vite-plugin-react) | `04cac5020e349f452d76c5a4f6d788ad4b38930a` | `@vitejs/plugin-react@6.1.1` | MIT | Public React transform and refresh integration for the deterministic example. |

Package pins were checked against their published registry metadata on the research date. The lockfile created in M1 becomes the exact transitive graph authority.

The TypeScript, DefinitelyTyped, and Vite React plugin pins above close an implementation-plan omission discovered in M1: the required TypeScript typecheck and documented React/Vite example cannot be built from the original dependency table alone. They add build-time tooling only and do not expand Qraft's runtime architecture.

### Additional structural reference

[shadcn-ui/ui](https://github.com/shadcn-ui/ui) at commit `7c9eaba1c0a6404c990c144a654792e3313c650d` is MIT-licensed and may be inspected only at the button, dialog, textarea, progress, and badge source paths named in the implementation plan. Extract component/API patterns into smaller Qraft-owned components. Do not install shadcn, Tailwind, or Vaul and do not copy its Drawer/theme wholesale.

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
10. Use `@Browser` in every implementation milestone to validate the integrated behavior that the reused package or extracted pattern enabled; source resemblance is not evidence that it works inside Qraft's ShadowRoot.
11. Record structural provenance in the implementation plan's OSS log.

## Version policy

The primitives API is active and may change. The exact pin is intentional for v0.1. An upgrade requires:

- reviewing the public export and type changes;
- reviewing license/package metadata;
- updating this snapshot;
- running picker and editor-open unit/E2E tests;
- recording any persisted selector compatibility effect.

Do not silently float to a newer React Grab version during unrelated work.

## Project distribution status

Qraft is currently private and internal. No project-wide public distribution license has been selected. Agents must not add a public license, npm publish configuration, or public registry release without an explicit owner decision.

The absence of a Qraft public license does not remove third-party notice obligations for incorporated dependencies or copied MIT-licensed material.

## Pre-release check

Before any public, commercial, or team-wide distribution beyond the internal development use assumed here:

1. Refresh upstream versions and licenses from primary sources.
2. Audit the dependency lockfile and built artifacts.
3. Confirm required notices ship with the relevant distribution.
4. Confirm no Agentation implementation material entered the repository.
5. Obtain owner/legal review appropriate to the intended distribution.
