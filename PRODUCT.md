# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + TypeScript + Vite. The application is a static, client-only web app suitable for GitHub Pages or Netlify. The stack choice was confirmed by the user on 2026-10-04.

## Users

People returning from a trip who have many photos and want to prepare polished WeChat Moments posts on either a phone or a computer.

## Product Purpose

Help users turn travel photos into share-ready compositions without sending personal images to a server. Success means a user can import photos, edit a composition, preview the social thumbnail, and download final files entirely in the browser.

## Positioning

One private, browser-local workspace combines three jobs that are usually fragmented across mobile apps: long-image composition with typographic inserts, center-square thumbnail control, and 4/6/9-tile social-grid slicing.

## Operating Context

- Used after travel, often with a large camera roll and limited patience for complex mobile editing.
- Used on touch phones and pointer-based desktop browsers.
- Exports are downloaded locally and then shared through WeChat by the user.
- Work-in-progress projects should survive page refreshes through browser storage.

## Capabilities and Constraints

- Import common browser-readable image formats from the local device.
- Decode HEIC / HEIF / HIF photos locally through Resources or the grid tool; the cover tool selects imported resources. Normalize to an editable PNG resource, keep the filename and pixel dimensions, and load the codec on demand. Multi-image containers use the first decoded still image; original metadata and dynamic/HDR information are not retained in the normalized resource.
- Reorder images in a long composition.
- Insert editable text blocks between any two images, with color, font, size, alignment, spacing, and rotation controls.
- Offer a shared offline Emoji picker for text cards and photo text, with categories, Chinese/English search and locally remembered recent choices. Insert at the caret or replace the selection, then return focus for continued typing. Preserve joined emoji as complete graphemes in shared preview/export wrapping; emoji are saved as part of the text. Native glyph appearance depends on the device's fonts.
- Save a long composition as an independent structured snapshot in Resources, then view it, continue editing a copy, or download it as PNG / JPG.
- Select a saved structured long composition and a single imported photo, crop the photo to a square, and insert it between complete layers. Parameterize the insertion boundary, surrounding spacing and blank background; automatically balance outer whitespace so the square occupies the output's center-square region. Do not split a flattened image to make the cover.
- Save a cover's original layers, settings and photo recipe as an independent resource; export it from Resources and allow its parameters to be restored even after the original sources are deleted.
- Crop one image into 4, 6, or 9 downloadable tiles in social-post reading order.
- Store projects locally. Images must not be uploaded to an application server.
- Keep imported photos and text assets in a separate local attachment library; clearing a collage keeps the library, and deleting a library asset keeps existing canvas layers.
- Resources groups content creation, imported templates and saved compositions; each resource supports structured viewing, individual deletion, and PNG / JPG export. Drafts, imported templates and saved snapshots have independent lifecycles. Read failures must not overwrite existing browser data.
- Save text formatting, photo crop parameters and structured text overlays back to the matching library template as users edit. Reusing an asset restores those edits; existing placed copies remain independent.
- Preview a structured, interactive long collage and enlarge an individual layer while adjusting it; use shared layout data for the final image export.
- Offer Simplified Chinese, Traditional Chinese, and English interfaces, with editable copy centralized by locale and the choice persisted locally.
- Handle large-image memory limits with clear recovery guidance rather than silently failing.
- Exact WeChat thumbnail behavior may vary by client version; the product presents a center-square preview as the working model, not as a guarantee about an external platform.

## Brand Commitments

- Bright, clean, Instagram-referenced visual tone.
- Typography should feel designed rather than like a default utility interface.
- Working product name is “留白拼图” until the user supplies a final name.
- The English interface uses “Liubai Collage” as the readable product rendering; it does not introduce a separate brand.

## Evidence on Hand

No logo, production photography, testimonials, benchmarks, or commercial claims were supplied. Demo content must be labeled as illustrative and user images remain local.

## Product Principles

1. Private by construction: editing and persistence stay on the device.
2. Preview the social result, not only the source canvas.
3. Make the next action obvious on both touch and desktop.
4. Preserve output quality while making memory limits visible.
5. Keep the workflow expressive without turning it into a professional design suite.

## Accessibility & Inclusion

Keyboard operability, visible focus, readable contrast, semantic labels, touch targets of at least 44px, and reduced-motion support are required. Export actions must not rely on color alone.
