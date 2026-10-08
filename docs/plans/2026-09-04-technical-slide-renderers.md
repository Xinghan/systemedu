# Technical Slide Renderers Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Render scientific course notation and diagrams with domain-appropriate, deterministic browser renderers instead of sparse hand-authored SVG or generated imagery.

**Architecture:** Add a typed `technical_visual` payload to slides. A client-side `TechnicalVisual` dispatcher will select KaTeX/mhchem, RDKit.js, JSXGraph, or 3Dmol.js from explicit structured data rather than from arbitrary generated HTML. Start with the already-installed KaTeX renderer and an RDKit.js SMILES-to-SVG renderer; leave JSXGraph and 3Dmol.js as lazy-loaded adapters until a lesson requires them.

**Tech Stack:** Next.js 16, React 19, TypeScript, KaTeX 0.16.46 (existing), mhchem (bundled with KaTeX), RDKit.js WebAssembly (`@rdkit/rdkit`, pinned and locally served).

---

### Task 1: Define a safe technical-visual data contract

**Files:**
- Modify: `packages/student-web/src/lib/types/api.ts:715-758`
- Modify: `packages/student-web/src/components/learning/teacher-scene-view.tsx:154-273`

**Step 1: Add discriminated payload types**

Define variants for `katex`, `rdkit-2d`, `jsxgraph`, and `molecule-3d`; only expose the exact, source-grounded parameters each renderer needs. Keep raw HTML out of the contract.

**Step 2: Add the optional payload field**

Add `technical_visual?: SlideTechnicalVisual` to `SlidePayload` and render it before optional orientation images / inline SVGs.

**Step 3: Verify TypeScript narrowing**

Run: `cd packages/student-web && npx tsc --noEmit`

Expected: no new errors reported from `api.ts` or `teacher-scene-view.tsx`.

### Task 2: Render formulas and chemical equations with the installed KaTeX runtime

**Files:**
- Create: `packages/student-web/src/components/learning/technical-visual.tsx`
- Modify: `packages/student-web/src/components/learning/teacher-scene-view.tsx:1-273`

**Step 1: Build the formula renderer**

Import KaTeX and `katex/contrib/mhchem` locally. Render `formula` with strict error handling, display mode, selectable DOM output, and an accessible plaintext fallback. Do not insert untrusted HTML; use `katex.renderToString` with trusted source course data and a stable fallback.

**Step 2: Replace the `theory` `<pre>` output**

Route existing `payload.formula` through the formula renderer, preserving non-LaTex plaintext as a readable fallback.

**Step 3: Add formula visual payload support**

Render explicit `technical_visual: { renderer: "katex", latex: "..." }` anywhere a visual is appropriate, including equations that accompany an image or diagram.

**Step 4: Verify source and browser behavior**

Run ESLint on the two touched files and inspect a known formula slide locally. Confirm that `\\ce{...}` produces subscripts and reaction arrows, while malformed input remains readable.

### Task 3: Add exact 2D molecular drawing through RDKit.js

**Files:**
- Modify: `packages/student-web/package.json`
- Modify: `packages/student-web/next.config.*` or build-copy script if required by the package assets
- Create: `packages/student-web/src/lib/rdkit.ts`
- Modify: `packages/student-web/src/components/learning/technical-visual.tsx`

**Step 1: Install a pinned RDKit.js release**

Install `@rdkit/rdkit` only after user approval (approved in this task). Pin the full version, do not use a CDN, and copy its JavaScript and WASM files together into served static assets.

**Step 2: Add one shared lazy singleton loader**

Load the WASM only in the browser. Configure `locateFile` for the local static asset, expose a typed `drawSmilesSvg(smiles, options)` helper, and free RDKit molecule objects in `finally` blocks.

**Step 3: Render the `rdkit-2d` technical-visual variant**

Generate exact SVG from SMILES, add source-grounded highlighted atom indices / SMARTS matches if present, and show the SMILES plus accessible description outside the drawing.

**Step 4: Verify asset deployment shape**

Run a production build or its scoped asset check. Confirm the browser requests no third-party renderer URL and reports an understandable fallback if WebAssembly fails.

### Task 4: Convert M04’s chemical comparison to exact evidence

**Files:**
- Modify: `projects_data/molecule-monster-hunter/knodes/M04-w0-module/slides.json`
- Modify: `docs/slide-image-prompts/molecule-monster-hunter-M04.md`
- Regenerate: `projects_data/molecule-monster-hunter/manifest.json` using the repository’s standard manifest tool

**Step 1: Preserve the teaching claim**

Keep the controlled comparison `CC` versus `CCO`, the only structural change (`H → OH`), and the recorded cLogP results `+1.0262` and `−0.0014`.

**Step 2: Map the exact renderer**

Use the RDKit variant for skeletal structures and KaTeX/mhchem for any reaction / molecular notation. Keep the generated 3D object image only as an orientation layer if it still independently teaches spatial structure.

**Step 3: Document the medium judgement**

Record why exact 2D structures are deterministic SVG/DOM, which details are source-derived, and the role of any optional 3D orientation image.

**Step 4: Regenerate and validate the manifest**

Run the repository’s manifest builder and verifier. Confirm every mapped asset path exists and hashes match.

### Task 5: Leave explicit extension points for mathematics and physics

**Files:**
- Modify: `packages/student-web/src/lib/types/api.ts`
- Modify: `packages/student-web/src/components/learning/technical-visual.tsx`
- Modify: `docs/slide-image-prompts/molecule-monster-hunter-M04.md` or a renderer guide

**Step 1: Keep the renderer discriminant extensible**

Add no JSXGraph or 3Dmol runtime until a source slide needs it, but reserve the typed variants and document their expected data.

**Step 2: State renderer selection policy**

- Formula / equation: KaTeX + mhchem.
- 2D structure / substructure evidence: RDKit.js.
- Mathematical or physics coordinate construction: JSXGraph.
- Spatial molecular model: 3Dmol.js.
- Real apparatus / specimen / product: raster image with deterministic overlays.

**Step 3: Final checks**

Run scoped lint, TypeScript validation, course manifest verification, and local visual inspection. Do not deploy without an explicit request.
