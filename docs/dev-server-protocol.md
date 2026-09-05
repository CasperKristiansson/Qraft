# Dev-server protocol

This document owns the same-origin browser-to-development-server interface and its local-development safeguards. The command types are owned by [Architecture](architecture.md), and mutation semantics by [Markdown storage](markdown-storage.md).

## Transport choice

Qraft uses:

- JSON HTTP for reads and commands;
- Server-Sent Events for invalidation notifications;
- the Vite development server's watcher or the Next.js adapter's bounded polling for external edits.

SSE is intentionally used instead of a custom WebSocket protocol or Vite's private HMR client surface. Events carry a revision or an unavailable notification; clients refetch the document.

The default endpoint prefix is `/__qraft` and can be changed only through trusted adapter configuration.

## `GET /__qraft/document`

Returns `200 OK` with the current `QADocument`.

Required headers:

```text
Content-Type: application/json; charset=utf-8
Cache-Control: no-store
ETag: "<revision>"
```

A missing file returns an empty document and the SHA-256 revision of zero bytes. The read does not create the file.

## `POST /__qraft/commands`

Accepts the `CommandRequest` defined in [Architecture](architecture.md).

Required request properties:

- `Content-Type: application/json`;
- body no larger than 32 KiB;
- valid command discriminant and exact required fields;
- opaque `commandId` no longer than 200 characters;
- valid 64-character lowercase hexadecimal `baseRevision`.

Unknown object keys may be rejected to catch client/server drift early.

### Responses

| Status | Meaning                                                  | Body                                         |
| ------ | -------------------------------------------------------- | -------------------------------------------- |
| `200`  | Command applied                                          | New `QADocument`                             |
| `400`  | Invalid JSON, schema, value, or target structure         | Safe error object                            |
| `404`  | Referenced entity no longer exists                       | Safe error object plus current revision      |
| `409`  | Revision conflict, writer lock or duplicate-ID ambiguity | Safe error and latest document when readable |
| `413`  | Request exceeds 32 KiB                                   | Safe error object                            |
| `415`  | Wrong content type                                       | Safe error object                            |
| `503`  | Active file, stream or command capacity reached          | Retryable safe error object                  |
| `500`  | Filesystem/read/write failure                            | Safe error object without stack              |

Error shape:

```ts
export interface QAErrorResponse {
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
  revision?: string;
  document?: QADocument;
}
```

Messages must be suitable for display. Server paths and stack traces must not be returned.

## `GET /__qraft/events`

Returns an SSE stream:

```text
Content-Type: text/event-stream
Cache-Control: no-cache
X-Accel-Buffering: no
```

Document event:

```text
event: document-changed
data: {"revision":"<sha256>"}

```

Rules:

- Send a comment heartbeat every 20 seconds.
- An event is an invalidation signal, not the document payload.
- Coalesce store and watcher notifications with the same revision.
- Close and remove client resources on connection close or plugin shutdown.
- A `document-unavailable` event clears the client revision and triggers a read so invalid UTF-8, oversized files and permission errors become visible. Restoring the original bytes triggers another read and clears the read error.
- For healthy invalidations, refetch only when the event revision differs from the current revision.
- Reconnect with exponential backoff capped at 10 seconds and refetch after reconnect.

## Request safeguards

Qraft has no authentication because the endpoint exists only inside the local development server. It still applies these safeguards:

- Register routes only for `vite serve`, never build or preview.
- Match the exact configured prefix and paths; otherwise call the next middleware.
- Allow only the documented methods.
- Do not add CORS headers.
- Require a loopback/localhost request URL and Host by default. Reject cross-site Fetch Metadata and mismatched Origin even if forwarded headers suggest otherwise.
- An explicit trusted adapter origin can allow that exact browser gateway origin and hostname; validate HTTP(S), no path, credentials or query. Missing Origin does not bypass Host validation.
- Prefer Vite's resolved server origin/host configuration rather than trusting forwarded headers from arbitrary clients.
- Require JSON content type for commands.
- Enforce size before fully buffering a command body.
- Set `Cache-Control: no-store` on document and command responses.
- Accept no filesystem path, editor command, shell command, or complete Markdown body from the browser.

These are local-development safeguards, not a claim that Qraft is safe to expose publicly. Documentation must tell consumers not to bind a Qraft-enabled dev server to an untrusted network.

## Command execution and duplicates

The server executes commands through the Markdown store's per-file queue and cooperative sibling lock. See Markdown storage for lock recovery and the boundary with external editors. It keeps a bounded in-memory map of recently completed `commandId` values for the current process:

- same ID and same request returns the stored successful response;
- same ID with a different request returns `409`;
- entries expire after five minutes, 500 successes or 4 MiB of cached document payloads;
- at most 64 unique commands may be pending per selected file;
- deduplication does not survive server restart and must not be described as durable.

This prevents a browser retry from duplicating an appended task/note without introducing persistent command state.

## Client behavior

`HttpQAStorage`:

- fetches the initial document;
- keeps the latest confirmed revision;
- assigns a fresh command ID for each user submission;
- returns the confirmed document from a successful command;
- preserves draft input on conflict and displays the latest document;
- maintains one SSE subscription per mounted Qraft client;
- aborts reads and closes SSE during unmount;
- bounds reads and saves to 15 seconds, rejects redirects and explains successful HTML fallbacks as likely endpoint/proxy misconfiguration; timeouts retain drafts and require checking the latest file before retry;
- never performs an optimistic file-status change that is presented as confirmed.

## Vite watcher behavior

- Add the configured Markdown file to Vite's watcher even when it does not yet exist, using its parent directory when required.
- React to add, change, and unlink.
- Read and hash after the filesystem event settles.
- Publish only if the revision differs from the last published revision.
- A deletion publishes the empty-file revision and updates the UI to the missing state.
- Do not trigger a browser full-page reload for `QA.md`.

## Editor opening

Opening source is not a Qraft mutation endpoint. The client makes a same-origin GET to Vite's `__open-in-editor` with the stored file, line and column. Redirects and requests lasting more than five seconds fail safely. Never open an external fallback website or new browser window.

Only normalized repository-relative source paths returned through the domain model should be offered. Failures remain client-side UI errors and never write `QA.md`.

## Protocol tests

The normative verification list lives in [Testing and acceptance](testing-and-acceptance.md). At minimum, cover every response status, origin/content-type/body constraints, stale revisions, duplicate command IDs, SSE cleanup/reconnect, watcher add/change/unlink, and absence from build/preview.

## Owner-approved file selection extension — 2026-09-05

GET `/__qraft/files` returns `{ projectId, files: [{ id, label }], truncated }`. IDs are opaque 64-character hashes and labels are project-relative paths for display. Only same-origin GET is accepted; no absolute paths are exposed. Without an explicit trusted file option, document/commands/events require `/__qraft/files/<id>` as their endpoint prefix. With an explicit file option, the legacy unscoped routes remain available to bound storage adapters, while the default UI still asks for a selection. Unknown IDs return a safe 404. No browser-supplied paths or document bodies are accepted. File endpoints apply the same method, origin, JSON, size, revision, deduplication, and production-absence rules as existing routes.

Catalog and file selection do not write Markdown. Each selected file gets its own events and deduplication scope. Changing one browser selection never redirects another browser's pending command. Deleted/replaced/symlinked paths are revalidated before access; symlink escape is rejected. No file chooser or file route is registered in production preview.

Attachment Context may include the bounded optional sourceTrail defined in architecture. Apply the same project-relative source normalization to each entry on commands, document reads and conflicts; omit outside-root/dependency paths. Existing attachments without a trail remain valid. No endpoint or body-size limit changes.

## Next.js adapter

Next.js App Router exposes the same protocol through a Node-runtime route handler. It returns 404 outside development before initializing storage. Origin checks use the request URL/Host, never forwarded headers; no CORS headers are added. Native watchFile polling observes selected files every 750 ms, including atomic replacement, deletion and recreation. Watchers are non-persistent and disposed with their runtime. Client abort closes SSE subscriptions. Source opening remains a Vite-only capability; stored source context is available in both frameworks.

Next.js local gateway setups can configure one exact browser `origin` in the route factory. This participates in the hot-reload project identity; forwarded headers never determine the allowed origin. Without this option, compare the browser origin to the request protocol and Host.

## Resource and failure bounds

A document read or resulting write is limited to 2 MiB of UTF-8 bytes. Invalid UTF-8 and oversized reads return `400 invalid_document`; the UI retains drafts. A process owns at most 32 active file runtimes per project. Opening another file evicts an idle runtime and disposes its watcher; if every runtime has live streams, return `503 active_file_limit`. Each runtime accepts at most 32 streams and disconnects slow readers after a bounded output queue. Abort, cancellation and shutdown release timers and clients.

`409 write_locked` means another Qraft process owns the sibling write lock; retry after it finishes. `500 write_failed` means the server could not confirm the save, so the UI asks the user to inspect the latest file before retrying. It must not claim the original is unchanged when a failure may have occurred after rename. Host/Origin checks are browser safeguards, not network authentication: never expose a Qraft-enabled development server to an untrusted network.
