# M87 weighted ranking slide replacement implementation plan

**Goal:** Replace all 10 M87 teaching slides with source-aligned exact and interactive ranking evidence, preview only.

**Architecture:** Reuse M86 deterministic candidates and hard-filter survivors. A pure ranking model adds an explicitly synthetic activity field, fits common min/max ranges once per dataset, orients the risk score, preserves binary Lipinski pass, normalizes nonnegative weights, then sorts unrounded scores with ID tie-break. A typed React renderer owns 10 distinct teaching scenes. Reuse the approved one-slide player and floating fit view.

**Tech Stack:** Existing React, TypeScript, KaTeX/MathML, deterministic DOM tables and contribution charts. No dependency installation, image generation, speech synthesis or production deployment.

1. Read and hash the original slides, lesson, theories, assignment, sections and narration; inspect legacy activity semantics. Save snapshots without altering sources.
2. Write failing tests for normalization direction/units/outliers/constant columns, weight validation, score bounds, tie handling, stable M86 survivors and traceable downloads.
3. Implement `packages/student-web/src/lib/ranking-evidence.ts` and ten scenes in `ranking-evidence-visual.tsx`; preserve theme tokens, keyboard labels, pause/step/reset, meaningful learner outcomes.
4. Build versioned M87 draft and per-slide registry under `course_factory/fixtures/molecule-monster-hunter`. Keep stable normalizer fallback IDs and theory/activity source anchors; remove obsolete audio references.
5. Add `/slide-preview/m87`, one slide at a time, page shortcuts and the approved slideshow window. No gallery and no fixed embedded height.
6. Verify formulas, model invariants, all page mappings/source hashes, local lint/types, 10 browser pages and key interactions/download gating. Record limitations and update the existing course progress ledger.

## Semantic decisions and corrections

- Pages: overview; hard-filter handoff; conflicting scales/directions; normalization trace; 0.81 worked score; unit-change counterexample; live weight sensitivity lab; five-step execution; boundary-case audit; report and M88 handoff.
- Exact relationships and changing ranks justify DOM/KaTeX. An image or 3D molecule does not explain a weighting decision; no media quota.
- Existing real-compound-labelled toy safety/activity values are not RDKit truth and are not reused. No claim of experimental toxicity, efficacy or clinical safety.
- Min/max is one mapping, not proof that two 0.8 values have equal scientific desirability. Same-column constant data carry no discrimination. Lipinski pass stays a binary constant, not a divide-by-zero normalization.
- Changing normalized weights can change ranks but need not; a favorable candidate's absolute score need not rise. Hard rejections cannot be resurrected by ranking.
- Use a common fitted range for all candidates; no per-row fitting, no silent missing-value coercion, no rounded-score sorting. Out-of-range future data are flagged rather than silently clipped.
- Keep revised narration separate from old audio. Original related prose/exercises must be aligned before a later release.

## Completion — 2026-09-08

All six implementation steps are complete for local review. All 10 versioned slides, source snapshots and hashes, narration scripts, per-page registry, pure model tests and preview integration are in place. The six related test suites pass 52 tests; scoped ESLint passes. Full TypeScript checking still reports existing errors outside this change. Browser QA visited all 10 scenes and verified the normalization steps, 0.81 accumulation, unit counterexample, real rank changes, A/B export gating, execution steps, boundary examples and fitted player. No browser console errors were observed.

Detailed evidence: `docs/slide-image-prompts/molecule-monster-hunter-M87-ranking-v1.md`. Next content node is M88; production release and new narration audio remain out of scope.
