import { ChevronRight } from "lucide-react";
import type { QAFileCatalog } from "./storage";

interface FileChooserProps {
  id: string;
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
  return (
    <section className="qraft-file-chooser">
      <h2>Choose a checklist</h2>
      <p>Select a Markdown file from this project. Your choice is remembered in this browser.</p>
      <label htmlFor={`${id}-search`}>Find a Markdown file</label>
      <input
        id={`${id}-search`}
        value={search}
        maxLength={200}
        onChange={(event) => setSearch(event.target.value)}
      />
      {catalogError ? (
        <p role="alert" className="qraft-banner error">
          {catalogError}
        </p>
      ) : null}
      {!catalog && !catalogError ? <p role="status">Loading files…</p> : null}
      {catalog?.files
        .filter((file) => file.label.toLowerCase().includes(search.toLowerCase()))
        .map((file) => (
          <button
            className="qraft-file"
            key={file.id}
            disabled={pending}
            onClick={() => onChoose(file.id)}
          >
            {file.label}
            <ChevronRight size={16} />
          </button>
        ))}
      {catalog?.files.length === 0 ? (
        <p>
          No Markdown files yet. Ask your coding editor to create a checklist with ## section
          headings and - [ ] tasks, then refresh the file list.
        </p>
      ) : null}
      {catalog?.truncated ? (
        <p>
          The file list was limited. Configure qraft's file option to include a specific checklist.
        </p>
      ) : null}
      <button className="qraft-secondary" onClick={() => onRefresh()}>
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
