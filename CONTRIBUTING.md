# Contributing to Qraft

Qraft is a small local review tool for React apps. A reproducible bug, a clearer checklist example,
or a focused improvement to the existing workflow is a good place to start. Describe the problem
before investing in a new integration or large feature. The [product contract](docs/product-requirements.md)
defines the current scope.

## Work locally

Use Node 24.19.0 and the pinned pnpm version through Corepack:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm demo
```

`demo` starts a five-check review and preserves `examples/vite-react/review.local.md` on restart.
`dev` starts the automated test fixture and resets its separate `QA.local.md` each time. Do not use
that fixture for a review you want to keep. Local reviews and test artifacts are ignored by Git.

Read [AGENTS.md](AGENTS.md), the [docs index](docs/README.md), and the contract for the area you
change. Use small, reviewable changes. Do not reformat existing review files, discard unknown
Markdown, or introduce a whole-document serializer. Every Markdown mutation needs full-file
before/after preservation tests.

## Check the change

Use focused tests while editing, then run:

```sh
corepack pnpm check
corepack pnpm exec playwright install
corepack pnpm test:browser
corepack pnpm audit:release
corepack pnpm verify:consumer
corepack pnpm verify:next
```

`check` includes formatting, source boundaries, types, unit/integration tests and build. Browser
tests cover Chromium, Firefox and WebKit. Consumer checks install a packed archive in temporary
apps, verify development and production boundaries, and build after removing the integration.
The dependency/license audit records the packages installed on the local platform.

For user-visible changes, also try the actual integrated app and record its URL, viewport, source
revision, actions and result. Automated browser tests and hands-on review establish different
evidence. The [acceptance contract](docs/testing-and-acceptance.md) owns complete candidate checks.

## Open a pull request

Explain the problem, resulting behavior and checks actually run. Include a small screenshot for
visual changes and the relevant preservation fixture for Markdown changes. Keep generated output,
local reviews, credentials and test reports out of Git. Report unverified behavior plainly.

The repository is currently private and the package unpublished. Repository visibility, licensing,
and registry releases require the owner's explicit decision; a pull request does not publish Qraft.
