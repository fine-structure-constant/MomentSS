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

**FIRST VIEWPORT:** A cyan vertical rail holds the three global tools, a slim top bar names the current workspace and local state, a dominant canvas fills the center, and a right property workspace switches between Import, Layers, and Adjust. On mobile, the rail becomes bottom navigation and the canvas still leads.

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
