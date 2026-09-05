import { readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { extname, relative, resolve } from "node:path";
import { validateFilePath } from "../markdown/path-safety";

export interface FileChoice { id: string; label: string }
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const ignored = new Set(["node_modules", "dist", "coverage", "artifacts"]);

export class FileCatalog {
  readonly projectId: string;
  readonly paths = new Map<string, string>();
  constructor(readonly root: string, readonly configuredFile?: string) { this.projectId = hash(root); }

  async list(): Promise<{ projectId: string; files: FileChoice[]; truncated: boolean }> {
    const files: FileChoice[] = [];
    let visited = 0;
    let truncated = false;
    const add = async (path: string) => {
      await validateFilePath(this.root, path);
      const label = relative(this.root, path).replaceAll("\\", "/");
      const id = hash(`${this.projectId}\0${label}`);
      this.paths.set(id, path);
      files.push({ id, label });
    };
    const visit = async (directory: string): Promise<void> => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (++visited > 10_000 || files.length >= 2_000) { truncated = true; return; }
        if (entry.name.startsWith(".") || ignored.has(entry.name) || entry.isSymbolicLink()) continue;
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) await visit(path);
        else if (entry.isFile() && [".md", ".markdown"].includes(extname(entry.name).toLowerCase())) await add(path);
        if (truncated) return;
      }
    };
    if (this.configuredFile) await add(this.configuredFile);
    else await visit(this.root);
    // Keep previously discovered IDs for deletion recovery, with a bounded catalog.
    while (this.paths.size > 2_000) this.paths.delete(this.paths.keys().next().value as string);
    return { projectId: this.projectId, files: files.sort((a, b) => a.label.localeCompare(b.label)), truncated };
  }
}
