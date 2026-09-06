import { useRef } from "react";

export function SettingsView({
  pushPage,
  pending,
  clearing,
  togglePushPage,
  hide,
  setClearing,
  clear,
}: {
  pushPage: boolean;
  pending: boolean;
  clearing: boolean;
  togglePushPage: () => void;
  hide: () => void;
  setClearing: (value: boolean) => void;
  clear: () => void;
}) {
  const clearButton = useRef<HTMLButtonElement>(null);

  return (
    <div className="qraft-settings">
      <section aria-labelledby="qraft-settings-layout">
        <h3 id="qraft-settings-layout">Layout</h3>
        <label className="qraft-setting-toggle">
          <input
            type="checkbox"
            checked={pushPage}
            onChange={togglePushPage}
            aria-describedby="qraft-push-help"
          />
          <span>Push page content</span>
        </label>
        <p id="qraft-push-help">
          Make room for the drawer and keep it open on wider screens. Below 1024 px, Qraft overlays
          the page.
        </p>
      </section>
      <section aria-labelledby="qraft-settings-session">
        <h3 id="qraft-settings-session">Saved session</h3>
        <p>Drafts and your place in this checklist are saved in this browser tab.</p>
        <button ref={clearButton} disabled={pending} onClick={() => setClearing(true)}>
          Clear saved session…
        </button>
        {clearing ? (
          <div
            className="qraft-settings-confirm"
            role="group"
            aria-label="Confirm clearing session"
          >
            <p>
              Discard this file’s unsaved drafts and saved view state? Your Markdown file stays
              unchanged.
            </p>
            <div>
              <button
                onClick={() => {
                  setClearing(false);
                  clearButton.current?.focus();
                }}
              >
                Cancel
              </button>
              <button disabled={pending} onClick={clear}>
                Discard unsaved session
              </button>
            </div>
          </div>
        ) : null}
      </section>
      <section aria-labelledby="qraft-settings-visibility">
        <h3 id="qraft-settings-visibility">Visibility</h3>
        <p>Hide the drawer and edge tab for now. Reload the page to bring Qraft back.</p>
        <button disabled={pending} onClick={hide}>
          Hide Qraft until reload
        </button>
      </section>
    </div>
  );
}
