import { validateFilePath } from "./path-safety";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import writeFileAtomic from "write-file-atomic";
import type { QACommand } from "../domain/commands";
import { qaCommandSchema } from "../domain/commands";
import type { QADocument } from "../domain/model";
import { QraftError } from "../domain/validation";
import type { IdFactory } from "./ids";
import { normalizeElement, patchMarkdown, type PatchOptions } from "./patch";
import { parseMarkdown, sha256 } from "./parse";

export interface StoreDependencies {
  atomicWrite?: typeof writeFileAtomic;
  beforeCommitCheck?: () => void | Promise<void>;
  idFactory?: IdFactory;
}

export interface StoreConflict extends QraftError {
  document?: QADocument;
}

const queues = new Map<string, Promise<void>>();

async function readExact(path: string): Promise<Buffer> {
  try {
    return await readFile(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return Buffer.alloc(0);
    throw error;
  }
}

function decode(bytes: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new QraftError("validation", "The selected Markdown file is not valid UTF-8.");
  }
}

function conflict(message: string, document: QADocument): StoreConflict {
  const error = new QraftError("conflict", message, true) as StoreConflict;
  error.document = document;
  return error;
}

export class MarkdownDocumentStore {
  readonly filePath: string;
  readonly root: string;
  readonly #dependencies: StoreDependencies;
  readonly #listeners = new Set<(document: QADocument) => void>();

  constructor(
    filePath: string,
    root: string = dirname(filePath),
    dependencies: StoreDependencies = {},
  ) {
    this.filePath = resolve(filePath);
    this.root = resolve(root);
    this.#dependencies = dependencies;
  }

  #document(source: string): QADocument {
    const document = parseMarkdown(source).document;
    for (const task of document.sections.flatMap((section) => section.tasks)) {
      for (const finding of task.notes) {
        const element = finding.element;
        if (element)
          finding.element = {
            ...normalizeElement({ ...element, component: null, selector: null }, this.root)!,
            component: element.component,
            selector: element.selector,
          };
      }
    }
    return document;
  }

  async read(): Promise<QADocument> {
    try {
      await validateFilePath(this.root, this.filePath);
      return this.#document(decode(await readExact(this.filePath)));
    } catch (error) {
      if (error instanceof QraftError) throw error;
      throw new QraftError(
        "io",
        "Qraft could not read the QA file. Check its permissions and retry.",
        true,
      );
    }
  }

  subscribe(listener: (document: QADocument) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  execute(command: QACommand, baseRevision: string): Promise<QADocument> {
    const previous = queues.get(this.filePath) ?? Promise.resolve();
    const operation = previous.then(() => this.#execute(command, baseRevision));
    const settled = operation.then(
      () => undefined,
      () => undefined,
    );
    queues.set(this.filePath, settled);
    void settled.then(() => {
      if (queues.get(this.filePath) === settled) queues.delete(this.filePath);
    });
    return operation;
  }

  async #execute(input: QACommand, baseRevision: string): Promise<QADocument> {
    try {
      const command = qaCommandSchema.parse(input);
      await validateFilePath(this.root, this.filePath);
      const initialBytes = await readExact(this.filePath);
      const initialSource = decode(initialBytes);
      const parsed = parseMarkdown(initialSource);
      if (baseRevision !== parsed.document.revision) {
        throw conflict(
          "The QA file changed. Review the latest version and retry.",
          this.#document(initialSource),
        );
      }
      const patchOptions: PatchOptions = { root: this.root };
      if (this.#dependencies.idFactory) patchOptions.idFactory = this.#dependencies.idFactory;
      let nextSource: string;
      try {
        nextSource = patchMarkdown(parsed, command, patchOptions);
      } catch (error) {
        if (error instanceof QraftError && error.code === "not-found") {
          (error as StoreConflict).document = parsed.document;
        }
        throw error;
      }
      await this.#dependencies.beforeCommitCheck?.();
      await validateFilePath(this.root, this.filePath);
      const latestBytes = await readExact(this.filePath);
      const latestRevision = sha256(latestBytes);
      if (latestRevision !== parsed.document.revision) {
        throw conflict(
          "The QA file changed before Qraft could save. Review and retry.",
          this.#document(decode(latestBytes)),
        );
      }
      const atomicWrite = this.#dependencies.atomicWrite ?? writeFileAtomic;
      const document = this.#document(nextSource);
      await validateFilePath(this.root, this.filePath);
      await atomicWrite(this.filePath, Buffer.from(nextSource, "utf8"));
      for (const listener of this.#listeners) listener(document);
      return document;
    } catch (error) {
      if (error instanceof QraftError) throw error;
      if (error && typeof error === "object" && "issues" in error) {
        throw new QraftError("validation", "The command contains invalid or unsupported values.");
      }
      throw new QraftError(
        "io",
        "Qraft could not save the QA file. The original was left unchanged.",
        true,
      );
    }
  }
}
