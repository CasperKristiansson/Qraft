import { randomUUID } from "node:crypto";
import { open, rename, stat, unlink } from "node:fs/promises";
import writeFileAtomic from "write-file-atomic";

/** Stage durable bytes first; run the revision check immediately before the final rename. */
export async function replaceFile(
  target: string,
  bytes: Buffer,
  beforeRename: () => Promise<void>,
  atomicWrite: typeof writeFileAtomic = writeFileAtomic,
): Promise<void> {
  const staging = `${target}.qraft-stage-${randomUUID()}`;
  const original = await stat(target).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  const handle = await open(staging, "wx", 0o600);
  try {
    await handle.close();
    await atomicWrite(staging, bytes, {
      mode: original ? original.mode & 0o7777 : 0o666 & ~process.umask(),
      ...(original ? { chown: { uid: original.uid, gid: original.gid } } : {}),
    });
    await beforeRename();
    await rename(staging, target);
  } finally {
    await handle.close().catch(() => undefined);
    await unlink(staging).catch(() => undefined);
  }
}
