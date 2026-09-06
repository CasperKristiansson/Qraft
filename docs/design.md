# Interaction and interface design

This document owns interaction and presentation. See [product requirements](product-requirements.md).

## Visual system

The written interaction and styling contracts below reflect the owner-approved interface. Historical mockups have been retired; inspect the running application when reviewing changes.

### Styling

- Light theme only for the internal package, isolated from the host application.
- White canvas and surfaces, cool neutral hierarchy, and near-black primary ink.
- Purple `#6d4bd2` for principal action, focus, selection, progress, the edge tab, and picker identity.
- Purple hover/strong `#5b36b3`, pale purple `#f4f1ff`, pale-purple hover `#ece7ff`, and focus `#7c5ce7`.
- Green only for passed/resolved, amber only for unresolved attention, and red only for genuine errors or destructive intent.
- Approximately 10 px control radii, 40 px ordinary controls, 16 px larger panel radii, thin cool-gray borders, shallow control shadows, and deeper shadow only for floating overlays.
- Compact Inter-like system typography. Do not bundle a font in the internal package unless browser comparison demonstrates that the platform stack materially misses the approved direction.
- List-first task presentation with separators; do not turn every task into an independent card.
- No gradients, glassmorphism, neon/glow effects, confetti, decorative illustration, or large purple surface fills.

Inspect changed user-visible surfaces in the browser at the viewports required by acceptance.

## Current interaction contract — owner feedback 2026-09-05

Retain neutral typography, restrained purple accents, list-first hierarchy, and local-only behavior.

### Closed tab

Rotate the compact grip, QA and completed/total group 90 degrees clockwise so it runs vertically down the right edge, as clarified by the owner on 2026-09-05. Keep the tab 26 px wide with 11 px sideways text and a rotated six-dot grip. The grip target is at least 24 × 24 CSS pixels to meet WCAG 2.2 target-size requirements. Use concave junctions where the tab meets the viewport edge. The grip moves the tab only vertically; pointer capture prevents losing drag outside its bounds. Clicking the grip opens the drawer, including Enter/Space activation; vertical movement of at least 5 px starts a drag and suppresses opening. Canceled drags do not open the drawer. Persist a normalized vertical position, clamp using the rendered tab height on resize or count changes, and tolerate unavailable browser storage. Arrow keys move the focused grip; Home/End reach the limits. The separate QA button opens the drawer and receives focus on close.

### Checklist

Place a compact completed/total count and short progress bar in the header beside Qraft. Follow directly with sections, task rows and Add task; omit the document title, search, filters and handoff tools. Keep 4 px of checklist top padding, no extra top margin on its first section, and 8 px of bottom padding. Use 8 px vertical footer padding and a 4 px gap before its secondary actions. Pin Add section to a separate bottom action area; the list fills the remaining space and scrolls independently even with hundreds of tasks. The section form opens in that bottom area, with its errors and controls remaining reachable on short screens. Display a separate skipped count. The status control and task title are separate buttons. Single status activation cycles open/completed/skipped/open; double-click sets skipped without racing a first-click mutation. Show the chosen circle state immediately, while coalescing pointer clicks over 300 ms into one write. Cancel an uncommitted gesture on unmount. Keep the confirmed document authoritative and restore its status if saving fails; show the existing actionable error. Navigation and other mutations wait for the gesture and save to settle, so opening details cannot cancel a just-chosen status. Keep keyboard focus on the status circle while saving; temporarily unavailable status actions announce aria-disabled and reject activation. Saving must not fade the surrounding drawer. Keep row widths and the header progress footprint stable across status changes. Retain explicit accessible state names and control tooltips, but omit the visible status-gesture instructions. Skipped task titles are struck through. Show total notes per task, never open findings. Do not show a local-sync/revision footer.

### Details and notes

Show the task's recognized indented text as a read-only Description section below its title and before Notes, preserving line breaks. Omit that section when empty. Keep descriptions out of the checklist rows and note counts. Add task includes an optional three-row description textarea below Title, with the placeholder "What to check and what should happen." Enter inserts a line break there; Save creates the task. Keep both form fields through reload and failures, and expose both as recovery text when their section becomes ambiguous. Descriptions are limited to 2,000 Unicode characters. Existing descriptions are edited in the Markdown file.

New notes display their capture pathname and CSS viewport dimensions separately from optional element context. Capture when composition or attachment begins and retain that context through navigation and editing.

Replace the Qraft header icon/title with a generously sized Back to checklist button; retain Close; pin and settings controls appear only in the checklist footer. No progress bar in details. Show an 18 px task title without a bottom rule, with one 24 px circular status control beside it. Reuse the checklist status behavior: open → green checked/completed → muted minus/skipped → open, with a struck-through skipped title. Each change stays on the task; the accessible name identifies the current state. A sticky detail navigation area contains a single row: an icon-only Previous chevron, Complete and next, and an icon-only Next chevron. Give both chevrons accessible names and tooltips. Omit section/task-position text and Next unfinished. The last task's action reads Complete task and stays put. Navigation never changes status by itself. Alt+Left/Right works only inside Qraft and outside editable controls. Pending saves disable navigation. Do not show a completion card.

Always show a labeled note textarea with Submit and Attach element. Enter submits unless composing text with an IME; Shift+Enter inserts a line break. Submitting clears only the saved draft and keeps composer focus. Notes form a file-ordered timeline and have Edit controls. Editing changes note body only, preserving its attachment and unknown Markdown. Escape cancels editing; unsaved composer text survives navigation and background refresh. Picker activation retains the note draft; selection adds context to it, and cancellation restores the composer. An attachment can be removed before submission. Existing notes display concise context, an expandable full context view, and Open source when available.

### File choice and empty state

First use opens a file chooser with project-relative display labels, search, and Refresh files. Remember the selected server-issued ID per project; revalidate it against the catalog on reload. Change file appears as a small text button with a decorative folder icon in the sticky checklist footer, below Add section alongside Keep open and the settings icon; the selected filename is available in its tooltip. File selection affects only that browser's storage instance. Preserve drafts per selected file during the mounted session. No default filename is chosen or created. If no file exists, instruct the tester to ask their coding agent to create a Markdown checklist, then refresh. An explicitly configured missing file can be selected and created by Add section.

### Errors and accessibility

Keep current safe conflict, disconnected, parse warning, read-only ambiguity, write error, and source-opening error feedback. Retain input after failures. Removed tasks retain a copyable draft. Use a polite live region for success, without large persistent success banners. Keep native labeled inputs/buttons, visible focus, text status, and reduced-motion support.

Above 600 px, the drawer remains fixed at width min(380px,100vw), height 100dvh and the right edge. At 600 px and below, it is a full-width bottom sheet with height min(85dvh,800px), leaving room for the host. Use a subtle shadow. Opening slides in from the right over 180 ms with a gentle ease-out; closing slides back over 140 ms. The mobile sheet slides from/to the bottom. Keep exit content mounted until its animation finishes, with pointer interaction disabled while closing. Reduced-motion preferences disable both animations. Styles remain in Shadow DOM. Default overlay mode does not change host layout or global styles. At 800 px and below, an unpinned expanded drawer has modal semantics and keyboard containment without body scroll locking. Pinning removes the focus trap at every width. Escape closes the drawer unless an edit/form or picker consumes it. Unpinned desktop outside interaction dismisses the drawer while retaining drafts.

At 800 px and below, task details offer Collapse to task strip. The bottom strip shows the current task and explicit complete, next, expand and hide controls. It does not trap focus. Hide restores the edge tab; expand returns to the same draft. Picker entry hides the sheet and picker exit restores the composer. All controls stay reachable at 360 px width and short heights.

Sections can collapse. Preserve collapse, scroll and the selected task in the saved session. Retired saved filter fields are discarded without losing drafts. Pin is project-scoped local storage; drafts/view state use tab-scoped session storage, versioned and bounded to 512,000 characters per file and 20 files per tab. Never evict unsaved drafts silently. Storage failure is visible. Clearing asks for an explicit discard action. Invalid saved data is retained until cleared.

### Settings

The footer Settings action opens a dedicated view replacing the checklist and its footer. The header shows Back to checklist, Settings and Close, without progress. Group controls into Layout (Push page content), Saved session (clear with explicit discard confirmation), and Visibility (Hide Qraft until reload). Use neutral sections with separators, concise help and no enclosing colored card. Settings scrolls independently on short screens. Returning restores checklist scroll, forms and drafts; move focus to the view heading. Clearing returns to the checklist and does not change Markdown.

### Optional page space

Settings offers Push page content, off by default and saved per project. At viewport widths of at least 1024 px, an open drawer reserves its measured CSS width on the right and stays open during host interaction. Below 1024 px, retain the preference but use the existing overlay/sheet layout. Close, hide, disabling the setting, resizing below the breakpoint, or unmount restores owned host styles. Keep the space while picking so element positions stay stable. Pin remains an independent preference.

Reserve normal-flow space through temporary document-root width, box-sizing and right-padding overrides; preserve existing padding and original inline values/priorities. Do not reparent the application or lock scroll. Do not overwrite host changes made to those properties during review. Viewport-fixed elements and explicit viewport-width layouts can still overlap the drawer; this setting does not emulate a narrower browser viewport or change media-query breakpoints.

### Element identification

Use the existing published React Grab primitives. Capture bounded identifying attributes and ancestor structure even when React context fails. Include the selected element's short visible text only after explicit selection; exclude form values, editable content, scripts/styles and hidden descendants. Do not claim selectors or source are infallible. Show when source context is unavailable. See [architecture](architecture.md) for exact bounds and [Markdown](markdown-storage.md) for persistence.

The picker tracks the rendered target while the page animates or scrolls, including scrolling inside same-origin frames. Pointer selection locks before asynchronous context resolution; hover cannot supersede a click. A short selected state precedes return to the note, with no extra confirmation. Context lookup times out to identifying context after three seconds. Escape cancels even during lookup. Host pointer/mouse activation is suppressed during selection.

Keyboard focus previews a host control without requiring pointer movement. Arrow Up selects a parent and Arrow Down returns toward the original target; Enter attaches. Parent/child controls and a bounded clickable element trail provide the same actions. Parent navigation holds the target until Resume picking, so moving to the toolbar cannot change the refined selection. A compact label shows element/component and dimensions. Optional faint edge guides are off by default. Keep the toolbar within the viewport, preserve reduced-motion behavior and announce held/attaching states.
