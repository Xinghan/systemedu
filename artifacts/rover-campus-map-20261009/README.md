# Rover campus map — implementation and review

## Result

The rover mission center and expanded in-lesson map now use an illustrated engineering campus. Eight HTML station buttons follow the actual eight course modules, with a directional route and a selected task card showing the original deliverable. The existing three stages, lessons, reference/video sections, workbench, assignments and record scopes are unchanged.

- Desktop mouse drag; mobile native touch pan; 100–175% zoom that preserves the viewport center; current-task recenter.
- HTML buttons and links, Left/Right/Home/End station navigation, visible focus, reduced motion support.
- Submitted, draft, unknown and current states reuse existing record readers. Selecting stations makes no learning-record writes and does not claim mastery or physical delivery.
- The full original directory remains available and opens automatically when the background fails.
- Cached image completion is checked on hydration, so a pre-hydration load event cannot leave a permanent loading overlay.

## Image provenance

Generated **one** original asset with the built-in `image_gen` tool in generate mode. No further image-generation calls were made. This is a fictional learning campus, not a photograph of an actual site or a requirement that students access such facilities.

- Exact final generation prompt: `prompt.txt`.
- Saved original: `campus-original.png`, 1536 × 1024.
- Deployment asset: `packages/student-web/public/mission/rover/campus-map-v1.webp`, 1536 × 1024, 565,036 bytes (about 552 KiB), WebP quality 83.
- The compressed image retains the original composition. All station labels, progress and route arrows are HTML/SVG, not baked into the image.

## Verification

`node artifacts/rover-campus-map-20261009/verify-browser.mjs` passed against localhost:4000. See `verification.json` for checks and final screenshots alongside this document.

Covered desktop at 1440px, mobile at 390px and 320px (including the narrower in-lesson container), eight correct original node links/deliverables, mouse/touch pan, zoom, current recenter, keyboard navigation, cached record restoration, original lesson inputs/workbench/media, STL download, unknown account progress and failed-image fallback. Tests use isolated browser contexts and synthetic records. There were no browser page errors.

Scoped ESLint and `git diff --check` passed. Full student-web TypeScript still reports six pre-existing errors, two in `src/app/(home)/slide-demo/page.tsx` and four in `src/components/learning/course-content-view.tsx`; no errors reference the changed map files. This is not a claim that the full repository build passes.

Local review: http://localhost:4000/explore/space-exploration/assemble-a-rover#mission-map

Not deployed in this batch.
