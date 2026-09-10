import { ChevronRight, FileText, RefreshCw } from "lucide-react";
import { ChecklistWelcome } from "./ChecklistWelcome";
import type { QAFileCatalog } from "./storage";

interface FileChooserProps {
  id: string;
  shared?: boolean;
  catalog: QAFileCatalog | null;
  catalogError: string;
  search: string;
  pending: boolean;
  fileId: string | null;
  setSearch: (value: string) => void;
  onChoose: (id: string) => void;
  onRefresh: () => void;
  onCancel: () => void;
}
export function FileChooser({
  id,
  shared = false,
  catalog,
  catalogError,
  search,
  pending,
  fileId,
  setSearch,
  onChoose,
  onRefresh,
  onCancel,
}: FileChooserProps) {
  const files = catalog?.files.filter((file) =>
    file.label.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <section className="qraft-file-chooser">
      {!fileId && !shared ? <ChecklistWelcome id={id} /> : null}
      <h2 className="qraft-choose-heading">Choose a checklist</h2>
      <p>
        {shared
          ? "Choose a shared checklist. Saved progress and notes are visible to your team."
          : "Pick the file with your review tasks. Qraft remembers your choice in this browser."}
      </p>
      <label htmlFor={`${id}-search`}>Find a Markdown file</label>
      <input
        id={`${id}-search`}
        value={search}
        placeholder="Search project files…"
        maxLength={200}
        onChange={(event) => setSearch(event.target.value)}
      />
      {catalogError ? (
        <p role="alert" className="qraft-banner error">
          {catalogError}
        </p>
      ) : null}
      {!catalog && !catalogError ? <p role="status">Loading files…</p> : null}
      {files?.map((file) => (
        <button
          className="qraft-file"
          key={file.id}
          disabled={pending}
          onClick={() => onChoose(file.id)}
        >
          <FileText size={18} aria-hidden="true" />
          <span>{file.label}</span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      ))}
      {catalog?.files.length === 0 ? (
        <p>
          {shared
            ? "No shared checklists yet. Ask the review owner to add the Markdown files, then refresh."
            : "No Markdown files yet. Save your checklist in this project, then refresh to find it here."}
        </p>
      ) : null}
      {catalog && catalog.files.length > 0 && files?.length === 0 ? (
        <p role="status">No files match your search. Try another name or clear the search.</p>
      ) : null}
      {catalog?.truncated ? (
        <p>
          The file list was limited. Configure qraft's file option to include a specific checklist.
        </p>
      ) : null}
      <button className="qraft-secondary" onClick={() => onRefresh()}>
        <RefreshCw size={14} aria-hidden="true" />
        Refresh files
      </button>
      {fileId ? (
        <button className="qraft-add" onClick={() => onCancel()}>
          Cancel file change
        </button>
      ) : null}
    </section>
  );
}
