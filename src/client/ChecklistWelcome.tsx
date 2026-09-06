import { useState } from "react";
import { ArrowUpRight, Copy } from "lucide-react";
import checklistImage from "./assets/checklist.png";

const starterPrompt = `Help me create a focused QA checklist for this app using Qraft.
Ask what I want to review if the scope is unclear. If you can access the project, read node_modules/@qraft-dev/qa/skills/qraft-review/SKILL.md for guidance. Otherwise, ask me for the app context you need.
Use short, outcome-focused - [ ] tasks, grouped under ## headings where useful. Add a two-space-indented description only when a task needs instructions or an expected result. Leave feedback notes for the person doing the review.
Save it as a new .md file in this project at an agreed location; preserve existing reviews. If you cannot write files, return the Markdown for me to save.`;

export function ChecklistWelcome({ id }: { id: string }) {
  const [copyMessage, setCopyMessage] = useState("");

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(starterPrompt);
      setCopyMessage("Prompt copied. Paste it into your agent or chat.");
    } catch {
      setCopyMessage("Could not copy. Select the prompt above and copy it manually.");
    }
  }

  return (
    <>
      <div className="qraft-welcome">
        <img src={checklistImage} width={72} height={72} alt="" />
        <h2>Start your first review</h2>
        <p>Check your app, leave feedback, and keep it all in a Markdown checklist.</p>
      </div>
      <div className="qraft-checklist-help">
        <h3>Create a checklist</h3>
        <p>
          Ask Codex, Claude Code, or ChatGPT what to check. Save the result as a{" "}
          <strong>.md</strong> file in this project, then choose it below.
        </p>
        <details className="qraft-starter-prompt">
          <summary>Show a starter prompt</summary>
          <label htmlFor={`${id}-prompt`}>Give this to your agent or chat</label>
          <textarea id={`${id}-prompt`} readOnly value={starterPrompt} rows={6} />
          <button className="qraft-secondary" onClick={() => void copyPrompt()}>
            <Copy size={14} aria-hidden="true" /> Copy prompt
          </button>
          <p role="status">{copyMessage}</p>
        </details>
        <a
          href="https://github.com/CasperKristiansson/Qraft/blob/main/docs/creating-checklists.md"
          target="_blank"
          rel="noopener noreferrer"
        >
          Checklist guide on GitHub <ArrowUpRight size={14} aria-hidden="true" />
        </a>
      </div>
    </>
  );
}
