import { Readable } from "node:stream";
import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { expect, it, vi } from "vitest";
import { createS3StorageWithClient } from "../../src/server/s3-storage";
import { createQraftBackend, createQraftLambdaHandler } from "../../src/backend";
import type { QACommand } from "../../src/domain/commands";
const options = {
  bucket: "review-bucket",
  prefix: "launch/",
  region: "eu-north-1",
  projectId: "launch-1",
};
const taskId = "task_11111111-1111-4111-8111-111111111111";
const seed = `\uFEFF# Review\r\n\r\n- [ ] Send mail <!-- qraft:id=${taskId} -->\r\n\r\n<!-- preserve -->`;
const status: QACommand = { type: "setTaskStatus", taskId, status: "completed" };
function fixture() {
  const objects = new Map<string, { body: Buffer; etag: string }>([
    ["launch/01-email.md", { body: Buffer.from(seed), etag: '"original"' }],
  ]);
  let puts = 0;
  let failAfterWrite = false;
  let barrier: (() => Promise<void>) | undefined;
  const send = vi.fn(async (command: unknown) => {
    if (command instanceof ListObjectsV2Command)
      return {
        Contents: [...objects.keys()]
          .filter((Key) => Key.startsWith(command.input.Prefix!))
          .map((Key) => ({ Key })),
      };
    if (command instanceof GetObjectCommand) {
      const object = objects.get(command.input.Key!);
      if (!object) throw { $metadata: { httpStatusCode: 404 } };
      const body = Buffer.from(object.body);
      return {
        ETag: object.etag,
        ContentLength: body.length,
        Body: { transformToWebStream: () => Readable.toWeb(Readable.from([body])) },
      };
    }
    if (command instanceof PutObjectCommand) {
      puts++;
      await barrier?.();
      const { Key, Body, IfMatch } = command.input;
      if (objects.get(Key!)?.etag !== IfMatch) throw { $metadata: { httpStatusCode: 412 } };
      objects.set(Key!, { body: Buffer.from(Body as string), etag: `"revision-${puts}"` });
      if (failAfterWrite) throw new Error("lost response");
      return {};
    }
    throw new Error("Unexpected operation");
  });
  const storage = () =>
    createS3StorageWithClient(options, { send } as unknown as Pick<S3Client, "send">);
  return {
    objects,
    send,
    storage,
    puts: () => puts,
    fail: () => {
      failAfterWrite = true;
    },
    barrier: (fn: () => Promise<void>) => {
      barrier = fn;
    },
  };
}
async function selected(f: ReturnType<typeof fixture>) {
  const storage = f.storage();
  const catalog = await storage.list();
  return (await storage.open(catalog.files[0]!.id))!;
}
it("conditionally saves exact Markdown bytes and keeps opaque IDs stable across instances", async () => {
  const f = fixture();
  const first = await selected(f);
  const document = await first.read();
  await first.execute(status, document.revision);
  expect(f.objects.get("launch/01-email.md")!.body.toString()).toBe(seed.replace("- [ ]", "- [x]"));
  expect(await f.storage().list()).toEqual(await f.storage().list());
  expect((await (await selected(f)).read()).sections[0]!.tasks[0]!.status).toBe("completed");
  const put = f.send.mock.calls.find(
    ([command]) => command instanceof PutObjectCommand,
  )![0] as PutObjectCommand;
  expect(put.input.IfMatch).toBe('"original"');
});
it("two independent Lambda stores cannot overwrite concurrent updates", async () => {
  const f = fixture();
  const a = await selected(f),
    b = await selected(f);
  let arrive = 0;
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  f.barrier(async () => {
    if (++arrive === 2) release();
    await ready;
  });
  const rev = (await a.read()).revision;
  const results = await Promise.allSettled([
    a.execute(status, rev),
    b.execute({ ...status, status: "skipped" }, rev),
  ]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(results.find((result) => result.status === "rejected")).toMatchObject({
    reason: { code: "conflict", document: { revision: expect.any(String) } },
  });
});
it("an uncertain committed write is never retried and stale replay after cold start cannot duplicate a note", async () => {
  const f = fixture(),
    store = await selected(f);
  const rev = (await store.read()).revision;
  f.fail();
  const command: QACommand = { type: "addNote", taskId, body: "One note", element: null };
  await expect(store.execute(command, rev)).rejects.toThrow("lost response");
  expect(f.puts()).toBe(1);
  await expect((await selected(f)).execute(command, rev)).rejects.toMatchObject({
    code: "conflict",
  });
  expect(
    f.objects
      .get("launch/01-email.md")!
      .body.toString()
      .match(/Note: One note/g),
  ).toHaveLength(1);
});
it("lists only Markdown within the trusted prefix and rejects invalid bytes before writing", async () => {
  const f = fixture();
  for (const key of [
    "other/private.md",
    "launch/.secret.md",
    "launch/../escape.md",
    "launch/file.json",
  ])
    f.objects.set(key, { body: Buffer.from("private"), etag: '"x"' });
  expect((await f.storage().list()).files.map((file) => file.label)).toEqual(["01-email.md"]);
  const store = await selected(f);
  f.objects.set("launch/01-email.md", { body: Buffer.from([255]), etag: '"invalid"' });
  await expect(store.read()).rejects.toMatchObject({ code: "validation" });
  expect(f.puts()).toBe(0);
});
it("the Lambda v2 bridge preserves cookies and base64 commands through authorization and S3", async () => {
  const f = fixture();
  const backend = createQraftBackend({
    projectId: options.projectId,
    storage: f.storage(),
    origin: "https://qa.example.com",
    endpoint: "/api/qa",
    authorize: (request) => request.headers.get("cookie") === "session=test",
  });
  const handler = createQraftLambdaHandler(backend);
  const event = {
    version: "2.0",
    rawPath: "/api/qa/files",
    headers: { origin: "https://qa.example.com" },
    cookies: ["session=test"],
    requestContext: { domainName: "internal.execute-api.example", http: { method: "GET" } },
  };
  const list = await handler(event);
  expect(list.statusCode).toBe(200);
  const id = JSON.parse(list.body).files[0].id;
  const doc = await handler({ ...event, rawPath: `/api/qa/files/${id}/document` });
  const result = await handler({
    ...event,
    rawPath: `/api/qa/files/${id}/commands`,
    requestContext: { ...event.requestContext, http: { method: "POST" } },
    headers: { ...event.headers, "content-type": "application/json" },
    isBase64Encoded: true,
    body: Buffer.from(
      JSON.stringify({
        commandId: "lambda",
        command: status,
        baseRevision: JSON.parse(doc.body).revision,
      }),
    ).toString("base64"),
  });
  expect(result.statusCode).toBe(200);
  expect((await handler({ ...event, cookies: [] })).statusCode).toBe(403);
  expect(f.objects.get("launch/01-email.md")!.body.toString()).toBe(seed.replace("- [ ]", "- [x]"));
});
