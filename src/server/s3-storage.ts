import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";
import type { QraftBackendStorage } from "../backend";
import { qaCommandSchema, type QACommand } from "../domain/commands";
import { QraftError } from "../domain/validation";
import type { QADocument } from "../domain/model";
import { normalizeElement, patchMarkdown } from "../markdown/patch";
import { parseMarkdown } from "../markdown/parse";

export interface QraftS3Options {
  bucket: string;
  /** Dedicated campaign prefix, ending with a slash. Never supplied by the browser. */
  prefix: string;
  projectId: string;
  region: string;
}
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 2_000;
const MAX_PAGES = 10;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
function errorStatus(error: unknown): number | undefined {
  return (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
}
function labelAllowed(label: string): boolean {
  return (
    /\.(md|markdown)$/iu.test(label) &&
    label.length <= 1_024 &&
    !/[\x00-\x1f\x7f\\]/u.test(label) &&
    label
      .split("/")
      .every(
        (part) =>
          part.length > 0 &&
          !part.startsWith(".") &&
          !["node_modules", "dist", "coverage", "artifacts"].includes(part),
      )
  );
}
function documentFrom(source: string): QADocument {
  const document = parseMarkdown(source).document;
  for (const task of document.sections.flatMap((section) => section.tasks))
    for (const note of task.notes)
      if (note.element) note.element = normalizeElement(note.element, "/qraft-source");
  return document;
}
function conflict(document: QADocument): QraftError & { document: QADocument } {
  return Object.assign(
    new QraftError("conflict", "The checklist changed. Review the latest version and retry.", true),
    { document },
  );
}

/** Default credentials come from the Lambda role. Mutations are never retried automatically. */
export function createS3Storage(options: QraftS3Options): QraftBackendStorage {
  return createS3StorageWithClient(
    options,
    new S3Client({ region: options.region, maxAttempts: 1 }),
  );
}

/** Internal composition seam used by tests; not a package export. */
export function createS3StorageWithClient(
  options: QraftS3Options,
  client: Pick<S3Client, "send">,
): QraftBackendStorage {
  if (
    !options.bucket ||
    !options.region ||
    !options.projectId?.trim() ||
    options.projectId.length > 200 ||
    !options.prefix.endsWith("/") ||
    options.prefix.startsWith("/") ||
    !labelAllowed(`${options.prefix}check.md`)
  )
    throw new Error(
      "Configure a bucket, region, stable campaign ID and dedicated relative prefix ending in /.",
    );
  const { bucket: Bucket, prefix: Prefix } = options;
  const projectId = hash(options.projectId);

  async function catalog() {
    const files: { id: string; label: string }[] = [];
    let token: string | undefined;
    let truncated = false;
    const signal = AbortSignal.timeout(10_000);
    for (let page = 0; page < MAX_PAGES; page++) {
      const response = await client.send(
        new ListObjectsV2Command({
          Bucket,
          Prefix,
          MaxKeys: 1_000,
          ...(token ? { ContinuationToken: token } : {}),
        }),
        { abortSignal: signal },
      );
      for (const item of response.Contents ?? []) {
        if (!item.Key?.startsWith(Prefix)) continue;
        const label = item.Key.slice(Prefix.length);
        if (!labelAllowed(label)) continue;
        if (files.length === MAX_FILES) {
          truncated = true;
          break;
        }
        files.push({ id: hash(`${projectId}\0${label}`), label });
      }
      if (truncated || !response.IsTruncated) break;
      token = response.NextContinuationToken;
      if (!token) throw new Error("Incomplete S3 listing.");
      if (page === MAX_PAGES - 1) truncated = true;
    }
    files.sort((a, b) => a.label.localeCompare(b.label));
    return { projectId, files, truncated };
  }

  async function readObject(Key: string) {
    let response;
    try {
      response = await client.send(new GetObjectCommand({ Bucket, Key }), {
        abortSignal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      if (errorStatus(error) === 404)
        throw new QraftError("not-found", "This checklist was removed. Refresh the menu.");
      throw error;
    }
    const body = response.Body;
    if (!body) throw new Error("Missing S3 body.");
    const stream = body.transformToWebStream();
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      void reader.cancel().catch(() => undefined);
    }, 10_000);
    let complete = false;
    try {
      if (!response.ETag || (response.ContentLength ?? 0) > MAX_BYTES)
        throw new QraftError("validation", "The checklist is unavailable or exceeds 2 MiB.");
      while (true) {
        const next = await reader.read();
        if (next.done) {
          complete = true;
          break;
        }
        size += next.value.byteLength;
        if (size > MAX_BYTES) throw new QraftError("validation", "The checklist exceeds 2 MiB.");
        chunks.push(next.value);
      }
      if (timedOut) throw new Error("S3 read timed out.");
      if (response.ContentLength !== undefined && size !== response.ContentLength)
        throw new Error("Incomplete S3 body.");
      let source: string;
      try {
        source = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
          Buffer.concat(chunks),
        );
      } catch {
        throw new QraftError("validation", "The checklist is not valid UTF-8.");
      }
      return { source, etag: response.ETag };
    } finally {
      clearTimeout(timer);
      if (!complete) await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  }
  return {
    list: catalog,
    async open(id) {
      if (!/^[a-f0-9]{64}$/u.test(id)) return null;
      // Discover from the trusted prefix each time; no process-local catalog is authority.
      const file = (await catalog()).files.find((file) => file.id === id);
      if (!file) return null;
      const Key = `${Prefix}${file.label}`;
      const read = async () => documentFrom((await readObject(Key)).source);
      return {
        read,
        async execute(input: QACommand, baseRevision: string) {
          const command = qaCommandSchema.parse(input);
          const initial = await readObject(Key);
          const parsed = parseMarkdown(initial.source);
          if (baseRevision !== parsed.document.revision)
            throw conflict(documentFrom(initial.source));
          const source = patchMarkdown(parsed, command, { root: "/qraft-source" });
          if (Buffer.byteLength(source, "utf8") > MAX_BYTES)
            throw new QraftError("validation", "The checklist exceeds 2 MiB.");
          try {
            await client.send(
              new PutObjectCommand({
                Bucket,
                Key,
                Body: source,
                ContentType: "text/markdown; charset=utf-8",
                IfMatch: initial.etag,
              }),
              { abortSignal: AbortSignal.timeout(10_000) },
            );
          } catch (error) {
            if ([409, 412].includes(errorStatus(error) ?? 0)) throw conflict(await read());
            // A timeout/lost response is uncertain. Never retry a write automatically.
            throw error;
          }
          return documentFrom(source);
        },
      };
    },
  };
}
