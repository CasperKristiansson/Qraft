import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";

/** Loopback protocol fixture, never a deployable S3/auth implementation. */
export async function createS3Fixture() {
  const objects = new Map();
  let writes = 0;
  const etag = (body) => `"${createHash("md5").update(body).digest("hex")}"`;
  const xml = (value) =>
    value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      assert.match(request.headers.authorization ?? "", /^AWS4-HMAC-SHA256 /);
      assert.match(url.pathname, /^\/qraft-fixture(?:\/|$)/);
      const key = decodeURIComponent(url.pathname.replace(/^\/qraft-fixture\/?/, ""));
      if (request.method === "GET" && url.searchParams.get("list-type") === "2") {
        response.setHeader("Content-Type", "application/xml");
        response.end(
          `<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><IsTruncated>false</IsTruncated>${[
            ...objects,
          ]
            .filter(([key]) => key.startsWith(url.searchParams.get("prefix")))
            .map(
              ([key, body]) =>
                `<Contents><Key>${xml(key)}</Key><Size>${body.length}</Size></Contents>`,
            )
            .join("")}</ListBucketResult>`,
        );
      } else if (request.method === "GET" && objects.has(key)) {
        const body = objects.get(key);
        response.setHeader("ETag", etag(body));
        response.setHeader("Content-Length", body.length);
        response.end(body);
      } else if (request.method === "PUT" && objects.has(key)) {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        assert.equal(
          request.headers["content-encoding"],
          undefined,
          "fixture expects a bounded non-streaming SDK body",
        );
        if (request.headers["if-match"] !== etag(objects.get(key))) {
          response.writeHead(412, { "Content-Type": "application/xml" });
          response.end("<Error><Code>PreconditionFailed</Code></Error>");
          return;
        }
        const body = Buffer.concat(chunks);
        objects.set(key, body);
        writes++;
        response.setHeader("ETag", etag(body));
        response.end();
      } else {
        response.writeHead(404, { "Content-Type": "application/xml" });
        response.end("<Error><Code>NoSuchKey</Code></Error>");
      }
    } catch (error) {
      response.writeHead(500, { "Content-Type": "application/xml" });
      response.end("<Error><Code>FixtureFailure</Code></Error>");
      console.error(error.message);
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    endpoint: `http://127.0.0.1:${server.address().port}`,
    set: (name, body) => objects.set(`launch/${name}`, Buffer.from(body)),
    read: (name) => objects.get(`launch/${name}`).toString("utf8"),
    writes: () => writes,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
