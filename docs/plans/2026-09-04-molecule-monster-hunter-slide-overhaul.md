# Molecule Monster Hunter Slide Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the molecule-monster-hunter course’s sparse slide SVGs with source-grounded technical visuals, dynamic teaching surfaces, and only those raster/3D assets that add real instructional value.

**Architecture:** Build a course-wide semantic registry from every `slides.json`, then choose a renderer or image treatment per slide using the updated `course-slide-visuals` skill. The student web `technical_visual` contract remains a safe, typed dispatcher; course JSON supplies only structured, source-derived values. Process the 47 nodes in conceptually coherent waves and regenerate/verify the manifest after each completed wave.

**Tech Stack:** Course JSON and prompt records; Next.js/React; KaTeX + mhchem; RDKit.js; JSXGraph; existing lesson animation/game HTML; source-grounded WebP only where a raster orientation layer passes review.

---

### Task 1: Make technical visual routing reusable

**Files:**
- Modify: `/Users/xinghan/.codex/skills/course-slide-visuals/SKILL.md`
- Create: `/Users/xinghan/.codex/skills/course-slide-visuals/references/technical-renderers.md`

**Step 1:** Record the renderer decision table and the dynamic/3D gates.

**Step 2:** Validate the skill with `quick_validate.py`.

**Step 3:** Confirm the instructions route exact formula, chemistry, graph, matrix, 3D, and raster needs without imposing an image quota.

### Task 2: Produce the course-wide semantic registry before bulk replacement

**Files:**
- Create: `course_factory/fixtures/molecule-monster-hunter/audit_slide_visuals.py`
- Create: `docs/slide-image-prompts/molecule-monster-hunter-visual-registry.json`

**Step 1:** Read every source slide’s title, script, kind, payload, existing SVG/image, and linked animation/game id.

**Step 2:** For every slide, record teaching claim, entities, relationship/state change, selected medium, renderer family, and a concise reason.

**Step 3:** Mark existing animation/game slides as retained unless their runtime is broken; never replace their interaction with a decorative still.

**Step 4:** Write tests that enforce 47 modules / 437 slides are represented, every slide has a medium decision, and every image/3D/dynamic decision has an explicit justification.

### Task 3: Expand deterministic renderer coverage only for justified patterns

**Files:**
- Modify: `packages/student-web/src/lib/types/api.ts`
- Modify: `packages/student-web/src/components/learning/technical-visual.tsx`
- Create/modify: focused renderer helpers under `packages/student-web/src/lib/`

**Step 1:** Map recurring source patterns to safe, typed renderer variants: exact structures and comparisons (RDKit), equations/reactions (KaTeX/mhchem), tables/matrices/algorithm traces (DOM), and coordinate/time relationships (JSXGraph).

**Step 2:** Add 3Dmol.js / Three.js only if a selected slide contains a validated model and the semantic registry passes all three 3D gate questions.

**Step 3:** Add a scoped test or browser smoke check for each new renderer; reject generic fallback diagrams.

### Task 4: Replace foundations and molecular-representation wave

**Scope:** M01–M28, including RDKit installation, atoms/bonds, molecular graphs, SMILES, canonical SMILES, and the Stage 1 handoff.

**Step 1:** Preserve existing strong dynamic lesson surfaces; replace only sparse / duplicated static SVGs.

**Step 2:** Use RDKit for exact source-supported molecular structures, DOM/code traces for installation or SMILES transformations, and WebP/3D only where a spatial source-backed orientation layer is independently useful.

**Step 3:** Update the relevant `docs/slide-image-prompts/molecule-monster-hunter-M*.md` records with semantic briefs and mappings.

**Step 4:** Render and inspect each completed node locally; validate JSON and file paths.

### Task 5: Replace descriptors, similarity, scaffold, and ML waves

**Scope:** M32–M74, including pandas data flow, molecular descriptors, LogP/HBD, Tanimoto, scaffold split, bagging, boosting, and Stage 2/3 handoffs.

**Step 1:** Prefer matrices, feature tables, state traces, and plots with actual source fields/values.

**Step 2:** Use visuals that distinguish training data, calculation, model decision, and evidence; do not turn algorithms into human stories.

**Step 3:** Generate raster images only for real apparatus/object orientation or non-redundant stage artifact context; compress each mapped asset to the project’s size budget.

**Step 4:** Inspect at real slide size and reject empty, dark, or low-information candidates.

### Task 6: Replace evaluation and final workbench wave

**Scope:** M78–M90, including ROC, Lipinski, top-10, ranking, decision gates, and final workbench delivery.

**Step 1:** Use exact axes, thresholds, ranking tables, and decision criteria in DOM/JSXGraph rather than generated labels.

**Step 2:** For final artifact slides, pair a source-grounded project/compound orientation image only when it adds evidence beyond the deterministic decision surface.

**Step 3:** Verify stage outputs retain the child-completable progression defined by the course.

### Task 7: Package validation and release readiness

**Files:**
- Regenerate: `projects_data/molecule-monster-hunter/manifest.json`
- Verify: `packages/library-app/src/library/manifest.py`

**Step 1:** Parse every changed `slides.json`; verify every mapped image path, structured renderer payload, and prompt-record mapping.

**Step 2:** Run scoped web lint / TypeScript checks and inspect representative technical, dynamic, raster, and 3D candidates in the local preview.

**Step 3:** Regenerate the manifest and run its hash verifier. Do not deploy production until the user explicitly requests deployment.
