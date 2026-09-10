import { readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { extname, relative, resolve } from "node:path";
import { validateFilePath } from "../markdown/path-safety";

export interface FileChoice {
  id: string;
  label: string;
}

export interface FileListing {
  projectId: string;
  files: FileChoice[];
  truncated: boolean;
}

const MAX_FILES = 2_000;
const MAX_ENTRIES = 10_000;
const IGNORED_DIRECTORIES = new Set(["node_modules", "dist", "coverage", "artifacts"]);
const MARKDOWN_EXTENSIONS = new Set([".md", ".markdown"]);

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export class FileCatalog {
  readonly projectId: string;
  readonly paths = new Map<string, string>();

  constructor(
    readonly root: string,
    readonly configuredFile?: string,
    projectId?: string,
  ) {
    this.projectId = hash(projectId ?? root);
  }

  async #choice(path: string): Promise<FileChoice> {
    await validateFilePath(this.root, path);
    const label = relative(this.root, path).replaceAll("\\", "/");
    const id = hash(`${this.projectId}\0${label}`);
    this.paths.set(id, path);
    return { id, label };
  }

  async list(): Promise<FileListing> {
    if (this.configuredFile) {
      return {
        projectId: this.projectId,
        files: [await this.#choice(this.configuredFile)],
        truncated: false,
      };
    }

    const files: FileChoice[] = [];
    const directories = [this.root];
    let visited = 0;
    let truncated = false;

    discovery: while (directories.length > 0) {
      const directory = directories.pop()!;
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        visited += 1;
        if (visited > MAX_ENTRIES || files.length >= MAX_FILES) {
          truncated = true;
          break discovery;
        }
        if (
          entry.name.startsWith(".") ||
          IGNORED_DIRECTORIES.has(entry.name) ||
          entry.isSymbolicLink()
        )
          continue;

        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) {
          directories.push(path);
        } else if (entry.isFile() && MARKDOWN_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
          files.push(await this.#choice(path));
        }
      }
    }

    // Retain known IDs after deletion so an open checklist can recover.
    while (this.paths.size > MAX_FILES) this.paths.delete(this.paths.keys().next().value!);
    files.sort((left, right) => left.label.localeCompare(right.label));
    return { projectId: this.projectId, files, truncated };
  }
}
