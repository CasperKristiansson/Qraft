# README media

The root [README](../../README.md) uses two owner-approved screenshots of Qraft in an original,
fictional headphone storefront. They show the running Qraft interface, framed for presentation;
they do not depict an integration with an external retailer or a deployed product.

## Desktop presentation images

| File                                     | State                                                                                              | Export          |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------- |
| [checklist.png](checklist.png)           | Checklist with Push page content enabled: two of seven checks complete and one saved note          | 3360 × 2320 PNG |
| [element-picker.png](element-picker.png) | Pointer over the product headline: component label, outline, optional guides and selection toolbar | 3360 × 2320 PNG |

The underlying captures are 2880 × 1800 pixels, rendered at a 1440 × 900 CSS viewport and device
pixel ratio 2 on 2026-09-06. Both preserve the current viewport rather than shrinking a full-page
capture. The presentation adds a macOS-style title bar, rounded window corners, shadow and sage
background. It does not add application controls, change feedback or rearrange the captured UI.
The screenshot interior was compared pixel-for-pixel with the original; only the outer bottom
corners are masked by the frame. These are presentation assets, not raw acceptance screenshots.

The checklist was captured through Chrome's native DevTools screenshot export. The picker was
captured in an independent local Playwright Chromium context using actual pointer hover. Both
journeys were also inspected in the integrated browser at 1440 × 900. The picker screenshot starts
from a task with a note draft; Qraft hides the drawer during selection and preserves the draft on
cancellation. It does not show the note composer and picker simultaneously.

Capture URL: `http://localhost:5291/`. The storefront and checklist are illustrative fixtures;
the headphone photograph was generated with OpenAI's image-generation tool. No owner project,
retailer branding or third-party website assets were used. The smaller cart started by `pnpm demo`
is a separate runnable example.

Qraft source revision: `e2051e11c665d7a2c1acb033b0ceb057cf32336b`.
Captured `dist/index.js` SHA-256:
`6e91702d03a888f0caa8f0585933affe17910f155c126417fef9f43cc1815d88`.
The two presentation exports were approved by the owner before inclusion in the README.
The README centers both images at 80% width. Their outer presentation backgrounds have an
80-pixel corner radius with transparency, so rounding works in GitHub's light and dark themes
without custom CSS. This later presentation change preserves the screenshot and window frame.

## Mobile example

[mobile-review.jpg](mobile-review.jpg) is the earlier direct integrated-browser capture of the
Northstar cart at 390 × 844 CSS and image pixels, device pixel ratio 1, on macOS. It shows the
compact task strip; the page-space preference falls back at narrow widths. The browser supplied
JPEG, retained at native dimensions without presentation framing.

This capture was made on 2026-09-06 at `http://localhost:5291/`, using runtime source
`c5d46ab264edc68cbc234555df34a52f211edd02`. Its client bundle has the same SHA-256 as the desktop
captures above. Later changes affected documentation, licensing and verification, not the runtime.

## Updating the media

Keep original captures, fixture source, image-generation provenance and render receipts in ignored
`artifacts/release`. The current desktop material is under `high-resolution-media`; the earlier
mobile material is under `public-preparation`. Commit only the approved documentation exports.

When the interface changes, recapture the real workflow and update this record. Preserve readable
text and actual product behavior. A decorative frame may surround a screenshot; it must not
manufacture controls or combine mutually exclusive interface states.
