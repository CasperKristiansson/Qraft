# Release preparation

The repository is private and `package.json` deliberately retains `private: true`. There is no
publish script, release workflow, registry release, or deployment. Passing checks does not change
visibility or authorize publication. The owner must explicitly approve those actions separately.

## Verify a candidate

Follow [testing and acceptance](testing-and-acceptance.md), including a clean source copy containing
the intended uncommitted changes, frozen installation, packed consumers, production exclusion,
removal, and a hands-on browser pass. Retain source fingerprints and package digests with receipts.
Keep generated archives, screenshots and evidence out of source control unless an internal consumer
intentionally vendors a verified archive.

The GitHub Checks workflow runs the current Node profile on Ubuntu: formatting, boundaries, types,
unit/integration tests, build, three browsers and packed Vite/Next consumers. It has read-only token
permissions, pinned actions, and no publishing step. The local dependency/license audit and the
maintenance Node/framework profile remain separate release gates. A Linux CI pass is not evidence
for other platforms or for the locally installed dependency-license inventory.

## Before the first public release

- Confirm the owner's license choice and include the license in the repository and package, with
  third-party notices intact. Revisit upstream archive notice exceptions for the intended distribution.
- Inspect source and reachable Git history for credentials, private fixtures, internal project
  details and committed generated artifacts. Resolve actual findings before making history public.
- Verify the GitHub description, topics, links, issue forms and private security-reporting route.
  GitHub private vulnerability reporting may require a public repository; enable and verify it as
  part of the explicitly authorized visibility change before directing public users to that route.
- Add the separately approved demonstration media. The README currently works without a placeholder.
- Confirm npm namespace access and choose the release version. Remove `private: true` only in the
  approved publication change, add the intended scoped-package access setting, update the release
  audit's current private-distribution assertion for that approved boundary, and rerun artifact
  checks against the exact final manifest. Do not claim an npm install works before publication.
- After an authorized release succeeds, replace archive-only setup with the verified registry install
  command, move Unreleased notes into the actual version entry, and verify all public links while signed out.

Do not treat this checklist as authorization to create public resources, change repository visibility,
publish a package or send promotional messages.
