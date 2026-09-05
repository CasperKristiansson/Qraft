import type { QACommand } from "../domain/commands";
import type { QADocument } from "../domain/model";

export interface QAStorage {
  getDocument(signal?: AbortSignal): Promise<QADocument>;
  execute(command: QACommand, baseRevision: string): Promise<QADocument>;
  subscribe(onChange: () => void): () => void;
}

export interface QAFileCatalog {
  projectId: string;
  files: { id: string; label: string }[];
  truncated: boolean;
}
