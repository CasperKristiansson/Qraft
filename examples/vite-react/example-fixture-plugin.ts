import { appendFile, chmod, copyFile, rm, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

export function exampleFixturePlugin(): Plugin {
  let externalEdit = 0;
  let failSourceOpen = false;
  return {
    name: "qraft-example-fixture",
    apply: "serve",
    async configureServer(server) {
      const originalMode = (await stat(server.config.root)).mode & 0o777;
      let restoreTimer: ReturnType<typeof setTimeout> | undefined;
      const restore = async () => {
        clearTimeout(restoreTimer);
        await chmod(server.config.root, originalMode);
      };
      server.httpServer?.once("close", () => void restore());
      const fixture = resolve(server.config.root, "QA.md");
      const malformed = resolve(server.config.root, "QA.malformed.md");
      const local = resolve(server.config.root, "QA.local.md");
      await copyFile(fixture, local);
      server.middlewares.use(async (request, response, next) => {
        if (
          request.method === "GET" &&
          request.url?.startsWith("/__open-in-editor") &&
          failSourceOpen
        ) {
          failSourceOpen = false;
          response.statusCode = 500;
          response.end("Editor opening failed in the deterministic example.");
          return;
        }
        if (request.method !== "POST" || !request.url?.startsWith("/__qraft-example/")) {
          next();
          return;
        }
        response.setHeader("Content-Type", "application/json");
        response.setHeader("Cache-Control", "no-store");
        if (request.url === "/__qraft-example/external-edit") {
          externalEdit += 1;
          await appendFile(local, `\n<!-- external edit ${externalEdit} -->\n`, "utf8");
          response.end(JSON.stringify({ message: "External edit written." }));
          return;
        }
        if (request.url === "/__qraft-example/delete") {
          await rm(local, { force: true });
          response.end(JSON.stringify({ message: "Local fixture deleted." }));
          return;
        }
        if (request.url === "/__qraft-example/restore-writes") {
          await restore();
          response.end("{}");
          return;
        }
        if (request.url === "/__qraft-example/recreate") {
          await restore();
          await copyFile(fixture, local);
          response.end(JSON.stringify({ message: "Local fixture recreated." }));
          return;
        }
        if (request.url === "/__qraft-example/legacy") {
          await writeFile(local, "## Main\n- [ ] Legacy task\n- [ ] Next task\n");
          response.end("{}");
          return;
        }
        if (request.url === "/__qraft-example/checklist") {
          await writeFile(
            local,
            "# Keyboard review\n\n- [ ] Check quantity with keyboard\n\n- [ ] Review the menu\n\n## Other checks\n- [ ] Review the footer\n",
          );
          response.end("{}");
          return;
        }
        if (request.url === "/__qraft-example/long-review") {
          const tasks = Array.from(
            { length: 50 },
            (_, index) => `- [ ] Check ${String(index + 1).padStart(2, "0")}`,
          ).join("\n");
          await writeFile(local, `# Long review\n\n## Interface\n${tasks}\n`);
          response.end("{}");
          return;
        }
        if (request.url === "/__qraft-example/malformed") {
          await copyFile(malformed, local);
          response.end(JSON.stringify({ message: "Malformed fixture loaded." }));
          return;
        }
        if (request.url === "/__qraft-example/fail-next") {
          await chmod(server.config.root, 0o500);
          restoreTimer = setTimeout(() => void restore(), 10_000);
          restoreTimer.unref();
          response.end(
            JSON.stringify({
              message: "Writes are blocked for 10 seconds; permissions auto-restore.",
            }),
          );
          return;
        }
        if (request.url === "/__qraft-example/fail-open") {
          failSourceOpen = true;
          response.end(
            JSON.stringify({ message: "The next source-open request and fallback will fail." }),
          );
          return;
        }
        response.statusCode = 404;
        response.end(JSON.stringify({ message: "Unknown example control." }));
      });
    },
  };
}
