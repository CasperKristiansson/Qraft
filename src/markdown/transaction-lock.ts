import { randomUUID } from "node:crypto";
import { open, readFile, unlink } from "node:fs/promises";

export class FileBusyError extends Error {}

/** Cooperative lock only: arbitrary editors do not participate. Never steal a stale lock. */
export async function acquireFileLock(path: string): Promise<() => Promise<void>> {
  const lockPath = `${path}.qraft.lock`;
  const token = randomUUID();
  let handle;
  try {
    handle = await open(lockPath, "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new FileBusyError(
        "Another Qraft writer holds this file. Wait and retry. If a server stopped unexpectedly, run qraft doctor for lock recovery instructions.",
      );
    }
    throw error;
  }

  try {
    await handle.writeFile(
      JSON.stringify({ version: 1, pid: process.pid, token, createdAt: new Date().toISOString() }),
    );
    await handle.sync();
  } catch (error) {
    await handle.close();
    await unlink(lockPath).catch(() => undefined);
    throw error;
  }
  await handle.close();

  return async () => {
    try {
      const owner = JSON.parse(await readFile(lockPath, "utf8")) as { token?: unknown };
      if (owner.token === token) await unlink(lockPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  };
}
