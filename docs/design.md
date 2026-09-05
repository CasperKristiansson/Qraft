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

Rotate the compact grip, QA and completed/total group 90 degrees clockwise so it runs vertically down the right edge, as clarified by the owner on 2026-09-05. Keep the tab 26 px wide with 11 px sideways text and a rotated six-dot grip. The grip target is at least 24 × 24 CSS pixels to meet WCAG 2.2 target-size requirements. Use concave junctions where the tab meets the viewport edge. The grip moves the tab only vertically; pointer capture prevents losing drag outside its bounds. Dragging does not open the drawer. Persist a normalized vertical position, clamp using the rendered tab height on resize or count changes, and tolerate unavailable browser storage. Arrow keys move the focused grip; Home/End reach the limits. The separate QA button opens the drawer and receives focus on close.

### Checklist

Keep progress at the top, followed by sections, task rows and Add task. Pin Add section to a separate bottom action area; the list fills the remaining space and scrolls independently even with hundreds of tasks. The section form opens in that bottom area, with its errors and controls remaining reachable on short screens. Display a separate skipped count. The status control and task title are separate buttons. Single status activation cycles open/completed/skipped/open; double-click sets skipped without racing a first-click mutation. A delayed single-click decision must be canceled on unmount. Retain explicit accessible state names and control tooltips, but omit the visible status-gesture instructions. Skipped task titles are struck through. Show total notes per task, never open findings. Do not show a local-sync/revision footer.

### Details and notes

Replace the Qraft header icon/title with a generously sized Back to checklist button; retain Close. No progress bar in details. Show title and explicit Not completed / Completed / Skipped controls. Do not auto-advance or show a completion card.

Always show a labeled note textarea with Submit and Attach element. Enter submits unless composing text with an IME; Shift+Enter inserts a line break. Submitting clears only the saved draft and keeps composer focus. Notes form a file-ordered timeline and have Edit controls. Editing changes note body only, preserving its attachment and unknown Markdown. Escape cancels editing; unsaved composer text survives navigation and background refresh. Picker activation retains the note draft; selection adds context to it, and cancellation restores the composer. An attachment can be removed before submission. Existing notes display concise context, an expandable full context view, and Open source when available.

### File choice and empty state

First use opens a file chooser with project-relative display labels, search, and Refresh files. Remember the selected server-issued ID per project; revalidate it against the catalog on reload. Change file appears as a small text button beside Qraft in the checklist header; the selected filename is available in its tooltip. File selection affects only that browser's storage instance. Preserve drafts per selected file during the mounted session. No default filename is chosen or created. If no file exists, instruct the tester to ask their coding agent to create a Markdown checklist, then refresh. An explicitly configured missing file can be selected and created by Add section.

### Errors and accessibility

Keep current safe conflict, disconnected, parse warning, read-only ambiguity, write error, and source-opening error feedback. Retain input after failures. Removed tasks retain a copyable draft. Use a polite live region for success, without large persistent success banners. Keep native labeled inputs/buttons, visible focus, text status, and reduced-motion support.

The drawer remains fixed at width min(380px,100vw), height 100dvh and the right edge. Soften the shadow to a subtle boundary. Styles remain in Shadow DOM, with no host layout or global style changes. At 768–800 px use modal semantics and keyboard containment without body scroll locking. Escape closes the drawer unless an edit/form or picker consumes it. On desktop, outside interaction can dismiss the drawer while retaining drafts.

### Element identification

Use the existing published React Grab primitives. Capture bounded identifying attributes and ancestor structure even when React context fails. Include the selected element's short visible text only after explicit selection; exclude form values, editable content, scripts/styles and hidden descendants. Do not claim selectors or source are infallible. Show when source context is unavailable. See [architecture](architecture.md) for exact bounds and [Markdown](markdown-storage.md) for persistence.

The picker tracks the rendered target while the page animates or scrolls, including scrolling inside same-origin frames. Pointer selection locks before asynchronous context resolution; hover cannot supersede a click. A short selected state precedes return to the note, with no extra confirmation. Context lookup times out to identifying context after three seconds. Escape cancels even during lookup. Host pointer/mouse activation is suppressed during selection.

Keyboard focus previews a host control without requiring pointer movement. Arrow Up selects a parent and Arrow Down returns toward the original target; Enter attaches. Parent/child controls and a bounded clickable element trail provide the same actions. Parent navigation holds the target until Resume picking, so moving to the toolbar cannot change the refined selection. A compact label shows element/component and dimensions. Optional faint edge guides are off by default. Keep the toolbar within the viewport, preserve reduced-motion behavior and announce held/attaching states.
