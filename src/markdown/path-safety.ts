import { lstat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

export async function validateFilePath(root: string, file: string): Promise<void> {
  const child = relative(root, file);
  if (!child || child === ".." || child.startsWith(`..${sep}`) || isAbsolute(child))
    throw new Error("File is outside the project.");
  const parts = child.split(sep);
  let current = root;
  for (const [index, part] of parts.entries()) {
    current = resolve(current, part);
    try {
      const entry = await lstat(current);
      if (
        entry.isSymbolicLink() ||
        (index < parts.length - 1 ? !entry.isDirectory() : !entry.isFile())
      )
        throw new Error("Unsupported file path.");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT" && index === parts.length - 1) return;
      throw error;
    }
  }
}
