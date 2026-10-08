# Editor surface brief

## Scope and mode

- Primary target: `src/App.tsx`
- Visitor mode: Operate
- Audience: travelers preparing image posts on phone or desktop
- Job: compose, preview, and export without uploading personal images
- Approved reference: `design/src/previews/editor-direction-2.png`

## Direction contract

**THESIS:** A seaside print studio with a cyan tool rail, a dominant warm canvas, and a professional white property workspace. It borrows Adobe's tool–canvas–properties clarity without inheriting desktop-suite complexity.

**OWN-WORLD:** Cyan owns the global tool rail, deep navy owns selection and primary action, warm gray owns the canvas, and white owns properties. Rectangular imagery, precise dividers, 8–10px controls, and one soft canvas shadow form the component language.

**STORY:** The user sees that images stay local, chooses one of three jobs, adds source images, works directly against a large result preview, and downloads a social-ready output. Empty, loading, saved, error, and memory-limit states explain recovery in plain Chinese.

**FIRST VIEWPORT:** A cyan vertical rail holds the three global tools, a slim top bar names the current workspace and local state, a dominant canvas fills the center, and a right property workspace switches between Resources, Layers, and Adjust. On mobile, the rail becomes bottom navigation; collage editing starts with the canvas, and cover composition starts with resource selection.

**FORM:** Direction 2 was explicitly selected by the user on 2026-10-08 and supersedes direction 1. The supplied preview is the visual authority.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved facts

- WeChat thumbnail behavior is represented as a center-square approximation and must be labeled as such.
- Browser canvas limits vary; export must scale down safely and report when it does.

## Historical finish review — superseded

The Impeccable engine binary and automated comp-diff detector were unavailable, so the installed skill's degraded finish-review role was performed inline against the approved comp, live desktop render, 390px mobile render, product truth, and implementation source.

- **disposition:** superseded by direction 2 on 2026-10-08
- **persistence:** pass — `PRODUCT.md`, the approved comp and approval sidecar, this surface brief, `DESIGN.md`, and `.impeccable/design.json` exist.
- **fidelity:** faithful — three-zone workbench, dominant result canvas, warm ground, ink type, coral action, pool-blue state, precise dividers, and center-square geometry are retained. Placing export inside each tool's contextual action panel is an acceptable responsive adaptation of the comp's header action because it remains visible beside the output settings and becomes sticky in the mobile long-image flow.
- **ceiling:** reached — native devices include the rectangular photo canvas, square aperture/grid, flat editing panels, restrained ambient depth, designed Chinese hierarchy, and short state motion with reduced-motion support.
- **material fixes:** none after the 4-image order sample was corrected to 2 columns × 2 rows.
- **keep:** preserve the canvas-first hierarchy and the distinct coral-action / pool-blue-state roles.

## Refinement verification — 2026-10-07

- Desktop stitch mode now locks the three columns to the viewport and gives sequence, canvas, and inspector their own scroll ownership.
- The left add controls remain above a dedicated sequence-list scroller.
- Photo text opens in a protected-focus editor with a real image preview, draggable normalized coordinates, keyboard nudging, width controls, and matching Canvas export geometry.
- Verified at 1280×720 and 390×844; no horizontal overflow or browser console errors. Geometry tests: 9 passed. Production build: passed.

## Internationalization — 2026-10-08

- The complete interface, including tool states, modals, errors, accessibility labels, metadata, and download filenames, is available in Simplified Chinese, Traditional Chinese, and English.
- A compact header selector persists the chosen locale in browser storage and updates the document language, title, and description.
- Copy lives in three typed locale files. Existing draft text remains user content; only newly created text blocks use the active language default.
- Mobile controls retain 16px input text, and flexible labels accommodate longer English copy. Localization and interpolation tests: 3 added, 12 total passed. Production build: passed.

## Direction 2 redesign verification — 2026-10-08

- Desktop now uses an 86px cyan global tool rail, 72px project bar, central warm canvas, and 392px white property workspace.
- The right workspace has fixed Import, Layers, and Adjust tabs plus a fixed save/export footer. Object properties and canvas properties remain separately grouped.
- Photo containers now support frame height, internal zoom, and horizontal/vertical focal position; the same Canvas renderer drives preview and export.
- At 1440×900 the document has no page overflow; the canvas and property workspace own scrolling. At 390×844 the rail becomes bottom navigation and horizontal overflow remains zero in Simplified Chinese and English.
- Automated browser evidence: switching the photo frame from 100% to 50% changed rendered canvas height from 398px to 199px. Tests: 12 passed. Production build: passed.

## Container and layer refinement — 2026-10-08

- Photo text now renders text, background, padding, border, and radius inside one rotated geometry in both the visual editor and Canvas export. Browser evidence verified a 10° transform with dashed border, 20px radius, and 42px padding.
- Import actions are compact; imported photos and text containers appear in a three-column asset grid on desktop and 390px mobile.
- Layer rows use compact 3px corners. Repeated between-layer text actions were removed; text and two-photo-row actions live once at the bottom.
- Adjacent photos can be grouped into one two-column row, adjusted independently, given row height and gap values, and split back into vertical layers.
- Desktop canvas and property content both report independent `overflow: auto`; 1440×900 and 390×844 have no horizontal overflow. Tests: 16 passed. Production build: passed.

## Independent library and interactive preview — 2026-10-08

- The latest user request supersedes the Canvas-preview behavior above. Preserve direction 2 and use a structured HTML/SVG preview backed by shared layout, crop and text-wrap data; Canvas remains the export renderer.
- Imported assets persist in their own IndexedDB store. Clearing a draft keeps them, removing an asset keeps existing layers, and repeated insertion creates independently editable layers. A real v1 database upgrade and deliberately empty library were checked in the browser.
- Canvas-wide settings belong to Layers. Adjust begins with the selected object's thumbnail, name, layer number and two-photo child number. Adding photos/text preserves the active panel.
- Clicking a preview part opens inline enlarged inspection with the existing adjustment workspace, back/neighbor controls and Escape. Keyboard sliders update the same layout, and downloaded image dimensions match it.
- Evidence: 23 unit tests, production build and 13 browser scenarios passed; no browser errors. Reviewed 1440×900 desktop and 390×844 mobile/English captures, batch-fixed selection contrast, mobile blank space and group spacing, then confirmed once.
- The Impeccable context launcher could not write/download its missing engine, so context and visual review were completed directly from the existing project files and actual browser captures. Real phone touch and production-photo acceptance remain device/content checks.

## Structured resource edit persistence — 2026-10-08

- Editing text content/appearance or photo crops/overlays now updates the matching library template. Reinserted layers retain all editable fields; already placed copies stay independent.
- Photo tiles show a compact text annotation, and the library hint describes automatic edit saving in all three locales. Preserve direction 2 and the existing three-column library.
- Recover unsynchronized legacy draft edits once; do not restore deliberately removed resources or overwrite newer templates with older copies on subsequent loads. Legacy drafts have no per-copy edit times, so the last changed copy in canvas order wins only during migration.
- Evidence: 28 unit tests and production build passed; 11 isolated Edge browser scenarios verified real IndexedDB records, refresh, clear/reuse, nested photo edits, removal, independent copies and migration. No browser errors or 390px horizontal overflow. Desktop and mobile captures reviewed.

## Apple photo import — 2026-10-08

- Keep direction 2. All three tools share local HEIC / HEIF / HIF normalization to PNG via an on-demand heic-to codec. The original filename remains visible in the resource library.
- Upload actions show localized reading text, expose aria-busy and disable repeat file selection until decoding finishes. Existing formats retain their original blobs and never load the HEIF codec.
- Evidence: 34 unit tests, production build and 12 isolated Edge production-browser scenarios passed using libheif's official example.heic. Checked empty/generic MIME, previews, photo text, IndexedDB resource persistence, clear/reuse, cover and four-tile downloads, corrupt-input recovery and same-origin-only requests. Reviewed the desktop capture; no page errors. Original metadata, HDR and dynamic content are not retained in the normalized still image.

## Unified Resources and structured cover — 2026-10-08

- The user's latest request replaces Import with Resources and supersedes the old flattened-image cover workflow. Resources groups creation, imported templates, saved collage snapshots and saved covers; all have direct structured viewing and PNG / JPG export. The collage footer saves a snapshot instead of downloading.
- Preserve direction 2, the three-column imported grid and existing object editing. Saved compositions live in independent IndexedDB records and contain their own layers/settings/blobs. Clearing drafts or deleting original sources preserves snapshots. A storage read failure blocks editing rather than writing empty data over the library.
- Cover composition selects a saved long collage and a single imported photo, inserts a full-width square at a complete-layer boundary and balances outer whitespace. Crop, boundary, surrounding spacing and background are parameterized. Saved covers retain the exact source-photo version and can be edited/exported after deleting the original sources.
- Shared structured layout drives preview and export. Resource viewers trap keyboard focus, restore the opener, and use Escape first to leave local zoom then to close. Cover mobile flow starts with source selection; focused preview scrolls into view above bottom navigation.
- Evidence: 39 unit tests, production build and 20 isolated Edge production-browser scenarios passed with no page errors. Verified PNG/JPG files, edited text, independent snapshots, restore/reopen/delete, storage-read errors and real HEIC import/export. A 1080×2421 exported cover has the expected solid-cover pixels at 15 points across its center square. Reviewed desktop and 390px mobile captures; English has no horizontal overflow. Illustrative sources are synthetic SVGs; real WeChat client behavior and phone touch remain external device checks.
