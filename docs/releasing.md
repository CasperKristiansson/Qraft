# Release Qraft

The public package is `@qraft-dev/qa`. The owner authorized the first GitHub and npm release on
2026-09-06. Publication is a separate action from merging code; the Checks workflow never publishes.
Future releases require explicit owner authorization.

## Prepare a candidate

1. Start from a clean branch and review its complete diff. Choose an unused version, update
   package.json and CHANGELOG.md, and confirm npm scope permissions with the authenticated account.
2. Verify the MIT license, third-party notices and archive contents. Review source and reachable
   Git history for credentials, private fixtures, internal project data and generated artifacts
   before exposing any previously private history.
3. Verify README screenshots, install instructions, repository metadata, issue forms and security
   reporting. Keep public access in publishConfig; do not add installation hooks.
4. Follow [testing and acceptance](testing-and-acceptance.md) in a clean source copy containing the
   final candidate, with a frozen install. Run check, test:browser, audit:release, verify:consumer
   and verify:next. Run both consumer scripts with --maintenance under the documented Node 22
   runtime. Preserve source fingerprints, package digests, logs and browser evidence locally.
5. Merge the reviewed candidate after CI passes. Verify that the tested source matches the merge
   and publish the exact tested archive, not a new unverified working-directory build.

The GitHub Checks workflow runs the current Node profile on Ubuntu with pinned actions and
read-only permissions. The local license inventory and maintenance profile are separate gates.
A Linux CI pass does not establish other platforms or native coding-agent activation.

## Publish and verify

Authenticate locally with `npm login --auth-type=web`. Complete npm's browser authentication and
publishing verification directly; never place credentials in release notes, commits or logs.

```sh
npm publish /absolute/path/to/tested-package.tgz --access public --registry=https://registry.npmjs.org/
```

For the initial launch, make GitHub public after the history review and before npm publication;
enable private vulnerability reporting and verify the source, README and assets while signed out.
Do not rewrite history or bypass branch protections to release.

After publication, run `corepack pnpm verify:consumer --registry` and
`corepack pnpm verify:next --registry`. These download the exact registry version and install it by
version in fresh projects, exercise setup/doctor/guide, production exclusion and removal, and record
the downloaded archive digest. Compare that digest with the published candidate. Inspect both
running integrations using the integrated browser. Verify the public npm listing and instructions,
then create the GitHub release and matching v-prefixed tag at the verified main commit.

Keep generated archives, fingerprints and test evidence in ignored artifacts/release. Approved
README assets remain tracked documentation. A successful publish is immutable for that name and
version; fixes use a new version. If any step fails, record the exact registry and Git state before
continuing. Do not claim a release is usable until fresh registry installations pass.
