# README screenshots

These are direct viewport captures of Qraft in a synthetic local React cart, taken in the integrated
browser on macOS on 2026-09-06 at 100% zoom and device-pixel ratio 1. They are documentation media,
not evidence of a deployed app or a physical mobile device. No pixels, controls or feedback were
added or rearranged after capture. The browser supplied JPEG images, retained at native dimensions.

| File                                   | CSS viewport and image size | State                                                                                           |
| -------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------- |
| [checklist.jpg](checklist.jpg)         | 1366 × 650                  | Checklist beside the cart with Push page content enabled, one completed task and its saved note |
| [attached-note.jpg](attached-note.jpg) | 1366 × 800                  | Task details with the saved note, component/source attachment and visible navigation            |
| [mobile-review.jpg](mobile-review.jpg) | 390 × 844                   | Compact task strip below the cart; the page-space preference falls back at narrow widths        |

Capture URL: `http://localhost:5291/`. The cart is a small presentation fixture adapted from
`examples/vite-react`: Northstar branding, one chair, quantity controls and an intentionally fixed
total. It uses Qraft's actual built client and Vite adapter. The review was selected through the
chooser; the note and attachment were created through the UI, then the task was completed. The
written Markdown was inspected to confirm the handoff. The note correctly retains its original
1366 × 650 observation viewport when viewed in the taller or narrower screenshots.

Qraft runtime source revision: `c5d46ab264edc68cbc234555df34a52f211edd02`. The follow-up changes
affect licensing, documentation and verification, with no runtime edits. Captured `dist/index.js`
SHA-256: `6e91702d03a888f0caa8f0585933affe17910f155c126417fef9f43cc1815d88`.

All three captures passed dimension/encoding checks and visual inspection. Document and body widths
stayed within the viewport, and the inspected browser reported no console errors. Local receipts,
the disposable fixture and final package fingerprint/digest are retained in ignored
`artifacts/release/public-preparation`; they are not bundled as application state.

When the interface changes, recapture the real workflow at these sizes and update these notes.
Do not scale a full-page image down or manufacture a screenshot from a mockup.
