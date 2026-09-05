import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { MarkdownDocumentStore, MAX_DOCUMENT_BYTES } from "../../src/markdown/store";
import { sha256 } from "../../src/markdown/parse";
import { acquireFileLock } from "../../src/markdown/transaction-lock";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "qraft-lock-"));
  directories.push(directory);
  const file = join(directory, "QA.md");
  await writeFile(file, "# QA\n");
  return { file, directory };
}

describe("cooperative writer and file bounds", () => {
  it("excludes a writer in another OS process and cleans up after release", async () => {
    const { file, directory } = await fixture();
    const module = pathToFileURL(resolve("src/markdown/transaction-lock.ts")).href;
    const child = spawn(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
      import { acquireFileLock } from ${JSON.stringify(module)};
      const release = await acquireFileLock(${JSON.stringify(file)});
      process.send('locked');
      process.once('message', async () => { await release(); process.exit(0); });
    `,
      ],
      { stdio: ["ignore", "ignore", "pipe", "ipc"] },
    );
    let stderr = "";
    child.stderr?.on("data", (data) => {
      stderr += String(data);
    });
    const exited = once(child, "exit");
    try {
      await Promise.race([
        once(child, "message"),
        exited.then(() => {
          throw new Error(stderr || "Lock worker exited before readiness");
        }),
      ]);
      const store = new MarkdownDocumentStore(file, directory);
      await expect(
        store.execute({ type: "createSection", title: "Blocked" }, sha256("# QA\n")),
      ).rejects.toMatchObject({ code: "locked" });
      expect(await readFile(file, "utf8")).toBe("# QA\n");
      child.send("release");
      await exited;
      expect(await readdir(directory)).toEqual(["QA.md"]);
      await store.execute({ type: "createSection", title: "Allowed" }, sha256("# QA\n"));
      expect(await readFile(file, "utf8")).toContain("## Allowed");
      expect(await readdir(directory)).toEqual(["QA.md"]);
    } finally {
      if (child.exitCode === null) {
        child.kill();
        await exited;
      }
    }
  });

  it("does not steal stale or replaced locks", async () => {
    const { file } = await fixture();
    const release = await acquireFileLock(file);
    await writeFile(`${file}.qraft.lock`, JSON.stringify({ token: "different-owner", pid: 0 }));
    await release();
    await expect(acquireFileLock(file)).rejects.toThrow("Another Qraft writer");
    expect(await readFile(`${file}.qraft.lock`, "utf8")).toContain("different-owner");
  });

  it("bounds oversized reads and leaves the complete original intact", async () => {
    const { file, directory } = await fixture();
    const bytes = Buffer.alloc(MAX_DOCUMENT_BYTES + 1, 97);
    await writeFile(file, bytes);
    const store = new MarkdownDocumentStore(file, directory);
    await expect(store.read()).rejects.toThrow("exceeds 2 MiB");
    await expect(
      store.execute({ type: "createSection", title: "Blocked" }, sha256(bytes)),
    ).rejects.toThrow("exceeds 2 MiB");
    expect(await readFile(file)).toEqual(bytes);
    expect(await readdir(directory)).toEqual(["QA.md"]);
  });

  it("does not turn a committed write into an error when an observer throws", async () => {
    const { file, directory } = await fixture();
    const store = new MarkdownDocumentStore(file, directory);
    store.subscribe(() => {
      throw new Error("Subscriber failed");
    });
    const next = await store.execute({ type: "createSection", title: "Saved" }, sha256("# QA\n"));
    expect(next.revision).toBe(sha256(await readFile(file)));
    expect(await readdir(directory)).toEqual(["QA.md"]);
  });
});
