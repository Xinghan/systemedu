# Space Mission Curriculum Implementation Plan

**Goal:** Implement the approved eight-station Mars observation mission using existing lessons, records and media.

**Architecture:** An additive curriculum configuration references stable course/node IDs. A mission query context changes navigation and task framing, never original learning scopes. The existing map and classroom remain; a versioned mission dossier stores learner goals and explicit references to submitted work through the existing learning-record API. No production deployment or legacy-record migration in this batch.

**Tech Stack:** Next.js / React / TypeScript, existing learning-record sessions, existing Python API, Playwright.

## 1. Source configuration and invariants
- Add `packages/student-web/src/lib/project-lines/space-curriculum.json` and `space-curriculum.ts`.
- Map all 85 source nodes once; distinguish lessons, support, optional material and replaced metal-chassis instructions.
- Preserve station IDs where meaningful; retain Lightkurve as optional research, outside rover requirements.
- Test cross-course navigation, optional exclusions, replaced M24, all refs, DAG and stable versions.

## 2. Mission hub and evidence
- Update `space-journey.ts` and `components/mission/space-journey.tsx` to display station tasks instead of full independent projects.
- Add `space-mission-progress.ts`: individual guided reflections and explicit full-course completion IDs; never infer earlier completion from last visited.
- Add a dossier model/component using an additive record scope. Link immutable submission IDs and body hashes; do not overwrite source artifacts or import guests into accounts implicitly. Report stale references and failed reads.
- Retain all seven existing course deliveries and three micro experiences as accessible work.

## 3. Unified classroom navigation
- Add mission context/outline/footer; integrate `guided-project-course.tsx`, `learn-page.tsx`, and library enrollment return path.
- Carry mission context through login/enrollment, node links, previous/next and cross-course transitions.
- Merge repeat assignments into their designated source work/dossier, retaining standalone original classroom/history.
- Distinguish old metal-chassis lesson references from the current printed vehicle; explicitly flag unverified hardware/navigation bridges.
- Existing media and lecture/download interfaces remain.

## 4. Map and film consistency
- Reuse eight map locations with new station bindings and a continuous route.
- Bind only semantically compatible existing stage films. Retain the older branching film only as an optional research introduction, not the main mission ending. Do not show contradictory voiceover as the new final brief.

## 5. Verification and source handoff
- Typecheck and targeted lint; test data coverage, progress/account isolation, hashes/version staleness, navigation and record restoration.
- Playwright desktop/mobile checks: map, first entry, cross-course navigation, dossier save/reload and account mocks; original media/notebook and standalone mode.
- Write implementation status and runtime configuration in the idea repository's existing proposal directory. Design-only bridges remain explicitly unverified; no fabricated physical results.
- Stage only this batch, commit and push both current branches, verify remote SHAs.

The approved design is already recorded in systemeduidea. Work stays on the current experiment branch to preserve the user's active local review environment. Existing unrelated artifacts and authoring edits remain untouched.
