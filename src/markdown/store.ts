import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import writeFileAtomic from "write-file-atomic";
import type { QACommand } from "../domain/commands";
import { qaCommandSchema } from "../domain/commands";
import type { QADocument } from "../domain/model";
import { QraftError } from "../domain/validation";
import type { IdFactory } from "./ids";
import { patchMarkdown, type PatchOptions } from "./patch";
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
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new QraftError("validation", "QA.md is not valid UTF-8.");
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

  constructor(filePath: string, root: string = dirname(filePath), dependencies: StoreDependencies = {}) {
    this.filePath = resolve(filePath);
    this.root = resolve(root);
    this.#dependencies = dependencies;
  }

  async read(): Promise<QADocument> {
    try {
      return parseMarkdown(decode(await readExact(this.filePath))).document;
    } catch (error) {
      if (error instanceof QraftError) throw error;
      throw new QraftError("io", "Qraft could not read the QA file. Check its permissions and retry.", true);
    }
  }

  subscribe(listener: (document: QADocument) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  execute(command: QACommand, baseRevision: string): Promise<QADocument> {
    const previous = queues.get(this.filePath) ?? Promise.resolve();
    const operation = previous.then(() => this.#execute(command, baseRevision));
    queues.set(this.filePath, operation.then(() => undefined, () => undefined));
    return operation;
  }

  async #execute(input: QACommand, baseRevision: string): Promise<QADocument> {
    try {
      const command = qaCommandSchema.parse(input);
      const initialBytes = await readExact(this.filePath);
      const initialSource = decode(initialBytes);
      const parsed = parseMarkdown(initialSource);
      if (baseRevision !== parsed.document.revision) {
        throw conflict("The QA file changed. Review the latest version and retry.", parsed.document);
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
      const latestBytes = await readExact(this.filePath);
      const latestRevision = sha256(latestBytes);
      if (latestRevision !== parsed.document.revision) {
        throw conflict("The QA file changed before Qraft could save. Review and retry.", parseMarkdown(decode(latestBytes)).document);
      }
      const atomicWrite = this.#dependencies.atomicWrite ?? writeFileAtomic;
      await atomicWrite(this.filePath, Buffer.from(nextSource, "utf8"));
      const document = parseMarkdown(nextSource).document;
      for (const listener of this.#listeners) listener(document);
      return document;
    } catch (error) {
      if (error instanceof QraftError) throw error;
      if (error && typeof error === "object" && "issues" in error) {
        throw new QraftError("validation", "The command contains invalid or unsupported values.");
      }
      throw new QraftError("io", "Qraft could not save the QA file. The original was left unchanged.", true);
    }
  }
}
