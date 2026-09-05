# Dev-server protocol

This document owns the same-origin browser-to-Vite interface and its local-development safeguards. The command types are owned by [Architecture](architecture.md), and mutation semantics by [Markdown storage](markdown-storage.md).

## Transport choice

Qraft uses:

- JSON HTTP for reads and commands;
- Server-Sent Events for invalidation notifications;
- the Vite development server's existing file watcher for external edits.

SSE is intentionally used instead of a custom WebSocket protocol or Vite's private HMR client surface. Events carry only a new revision; clients refetch the document.

The default endpoint prefix is `/__qraft` and can be changed only through trusted Vite plugin configuration.

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

| Status | Meaning | Body |
| --- | --- | --- |
| `200` | Command applied | New `QADocument` |
| `400` | Invalid JSON, schema, value, or target structure | Safe error object |
| `404` | Referenced entity no longer exists | Safe error object plus current revision |
| `409` | Revision conflict or duplicate-ID ambiguity | Safe error and latest document when readable |
| `413` | Request exceeds 32 KiB | Safe error object |
| `415` | Wrong content type | Safe error object |
| `500` | Filesystem/read/write failure | Safe error object without stack |

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
Connection: keep-alive
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
- The browser refetches only when the event revision differs from its current revision.
- Reconnect with exponential backoff capped at 10 seconds and refetch after reconnect.

## Request safeguards

Qraft has no authentication because the endpoint exists only inside the local Vite development server. It still applies these safeguards:

- Register routes only for `vite serve`, never build or preview.
- Match the exact configured prefix and paths; otherwise call the next middleware.
- Allow only the documented methods.
- Do not add CORS headers.
- Accept a request only when `Origin` is absent or matches the effective request origin.
- Prefer Vite's resolved server origin/host configuration rather than trusting forwarded headers from arbitrary clients.
- Require JSON content type for commands.
- Enforce size before fully buffering a command body.
- Set `Cache-Control: no-store` on document and command responses.
- Accept no filesystem path, editor command, shell command, or complete Markdown body from the browser.

These are local-development safeguards, not a claim that Qraft is safe to expose publicly. Documentation must tell consumers not to bind a Qraft-enabled dev server to an untrusted network.

## Command execution and duplicates

The server executes commands through the Markdown store's per-file queue. It keeps a bounded in-memory map of recently completed `commandId` values for the current process:

- same ID and same request returns the stored successful response;
- same ID with a different request returns `409`;
- entries can expire after five minutes or a bounded count;
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
