export { QA, type QAProps, type QABackend } from "./client/QA";
export { HttpQAStorage, QAStorageError, type HttpQAStorageOptions } from "./client/http-storage";
export type { QAStorage, QAFileCatalog } from "./client/storage";
export type {
  ElementReference,
  QADiagnostic,
  QADocument,
  TaskStatus,
  QANote,
  NoteObservation,
  QASection,
  QATask,
} from "./domain/model";
