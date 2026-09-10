# Shared Markdown backend

Use this when several testers review one private deployed application. Qraft provides the drawer
and a small Lambda-compatible service; your application supplies authentication, review access and
hosting. No Qraft account or database is required. Existing local integrations keep working.

## Browser

Install `@qraft-dev/qa` as a runtime dependency when the private QA build includes it. Render the
drawer only after your host session confirms review access:

```tsx
import { QA } from "@qraft-dev/qa";

// reviewSession comes from your host application's session controller.
// generation is non-secret and changes on logout or account/session replacement.
return reviewSession.canReview ? (
  <QA
    backend={{
      endpoint: "/api/qa",
      sessionKey: reviewSession.generation,
      pollIntervalMs: 3000,
      headers: () => ({ "X-CSRF-Token": reviewSession.csrfToken }),
    }}
  />
) : null;
```

The optional headers callback supplies fresh host headers. It is not a place for a service API key
or AWS credentials. The endpoint must be a same-origin path without query parameters. Route a
separately hosted service through your application origin and preserve the browser Origin and
host authentication. The backend does not enable cross-origin browser access.

The menu lists the campaign's Markdown files. A tester selects one, reviews its tasks, and uses
Change file to return to the menu. Saved status and notes are shared; unsaved drafts remain in that
tab and session. A checked task means reviewed, not that its feedback is fixed. Statuses remain
open/completed/skipped. Batch ownership and pass/fail outcomes can be written in the checklist
instructions and notes; this release does not add structured assignments or reviewer attribution.

Unmount Qraft when the host session ends. Changing `sessionKey` remounts the drawer and isolates
unsaved state from the replacement account. It must not contain a session cookie or bearer token.
A backend denial clears the displayed document on the next read or command. The host owns immediate
logout behavior; polling is not a substitute for the host session boundary.

## Lambda and private S3

Install the optional server-side peer `@aws-sdk/client-s3` alongside Qraft. The SDK is external to
Qraft's archive and browser bundle. Use the Lambda execution role for credentials. Initialize the
client/backend once outside the invocation:

```ts
import { createQraftBackend, createQraftLambdaHandler } from "@qraft-dev/qa/backend";
import { createS3Storage } from "@qraft-dev/qa/s3";

const projectId = "launch-2026-09-candidate-1";
const review = createQraftBackend({
  storage: createS3Storage({
    bucket: process.env.QRAFT_BUCKET!,
    prefix: "launch-2026-09/",
    region: process.env.AWS_REGION!,
    projectId,
  }),
  projectId,
  endpoint: "/api/qa",
  origin: "https://qa.example.com",
  authorize: async (request) => {
    // Supply these functions from your application's server-side session service.
    const session = await readHostSession(request);
    return session !== null && (await hasCurrentReviewAccess(session));
  },
});

export const handler = createQraftLambdaHandler(review);
```

The bridge accepts [HTTP payload v2 events](https://docs.aws.amazon.com/lambda/latest/dg/urls-invocation.html)
from API Gateway HTTP APIs or Lambda Function URLs, including cookies and base64 request bodies.
It does not treat gateway headers or a browser-supplied identity as authentication. The functions
`readHostSession` and `hasCurrentReviewAccess` are host-owned, not Qraft exports. Validate the current
session AND review access on every request; never deploy an always-true callback.

The consuming application provisions:

- One private general-purpose S3 bucket with Block Public Access enabled, default encryption and
  versioning. A dedicated prefix contains only checklists accessible to this review group.
- One Node Lambda, with the packaged Qraft and SDK dependencies, bucket/region configuration and
  the application's session validation. Start with a 30-second request timeout; align gateway and
  application timeouts. Qraft bounds S3 calls and reads and never retries writes automatically.
- A same-origin `/api/qa/*` route to that Lambda, preserving path, Origin and host session credentials.
  Disable response caching on this route, including at a CDN. Keep it disabled outside private QA.
- A Lambda role granting `s3:ListBucket` on that bucket, restricted by `s3:prefix` to the configured
  prefix, and `s3:GetObject`/`s3:PutObject` on objects under that prefix. No bucket-public access,
  object deletion, account-wide S3 permissions or AWS credentials in the browser are needed.

The host owns HTTPS, request limits, session/CSRF checks, logging, review membership and recovery.
Use distinct trusted configurations for separate review groups; never derive bucket, prefix or
campaign identity solely from browser input. If you use a customer-managed KMS key, provision its
required permissions in the consuming infrastructure. Qraft does not provision resources.

## Files and concurrent changes

Seed the campaign prefix with the review files using your existing AWS deployment tooling:

```text
s3://your-private-review-bucket/launch-2026-09/
  01-workspace.md
  02-onboarding.md
  03-mailbox-access.md
  ...
  12-visual-review.md
```

The menu discovers `.md`/`.markdown` files in ordinary subdirectories and exposes opaque IDs. Hidden
paths and dependency/output folders are excluded. The catalog is bounded to 2,000 eligible files
and ten listing pages; documents are limited to 2 MiB of valid UTF-8. There is no upload/delete-file
API: the review owner seeds and manages campaign files. Use a new stable projectId for a new
campaign; use the same projectId for the backend and storage. Downloading the prefix exports the
Markdown, including feedback, for coding agents. Unsaved drafts are never uploaded.

S3 owns the authoritative bytes. Each command checks the full-file SHA-256 revision, patches the
smallest Markdown span, then uses the ETag read with those bytes in a conditional `PutObject`.
[AWS's If-Match operation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html)
rejects writes when the object changed in the meantime. Independent Lambda instances therefore
cannot silently overwrite one another's edits. No database, process-local lock, persistent container
or filesystem mount is required. Unknown Markdown, UTF-8 BOM and newline style are preserved.

Shared mode polls the selected file every three seconds and on focus; no SSE or WebSocket is needed.
A conflict returns the latest document and retains the draft for explicit review and retry. If the
write response is lost, inspect the latest checklist before retrying. Neither browser nor SDK
replays mutations automatically. There is no durable command-receipt ledger: sending an old command
against changed bytes conflicts, rather than providing cross-invocation exactly-once semantics.
Owner edits should also use conditional writes during an active review. S3 version history provides
recovery from an accidental owner overwrite; Qraft has no restore-version operation.

## Other backend hosts

`createQraftBackend` also accepts a dedicated persistent `root` directory instead of `storage`.
That optional filesystem mode reuses local locking and atomic replacement; run one active service
process and follow [lock recovery](markdown-storage.md#cooperative-writers-and-bounded-documents).
It is not the Lambda persistence option. Never store the campaign in Lambda `/tmp`.

A Web Request/Response host can call `review.handle` directly. An existing Node HTTP service can
use `nodeMiddleware(review.handle)` from the backend export and call `review.dispose()` at shutdown.
A custom `QraftBackendStorage` supplies `list()` and `open(id)` with `read()` and
`execute(command, baseRevision)`; it must enforce revision concurrency and the same document contract.
The local `./next` and `./vite` adapters retain independent development-only guards.

## Validation and host acceptance

`corepack pnpm verify:shared` installs the candidate archive in a clean consumer and runs a production
browser build through the Lambda v2 bridge and real AWS SDK against a loopback S3 protocol fixture.
It checks independent browser sessions, shared status/notes, retained drafts, file switching, fresh
backend instances and revoked access in Chromium, Firefox and WebKit. Unit tests separately cover
competing conditional writes and a lost response after commit. `--registry` installs the exact
published version. `--serve` keeps the isolated fixture available for hands-on review; its login is
strictly test-only and must never become deployed authentication.

These checks do not establish a deployed AWS service. The consuming repository must provision the
bucket/route/Lambda, connect real session authorization, and verify allowed and denied users,
concurrent saves, cold-start persistence, version recovery and route cache behavior in its stage.
Element attachments retain bounded DOM context, but optimized React builds may omit component/source
information. Shared mode uses manual source navigation; plain notes remain available.
