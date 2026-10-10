# Read-only teacher slides

**Goal:** Teacher slides explain with complete evidence, without requiring form entry, choices, downloads, or experimental actions. Keep page/audio/presentation playback controls outside the teaching surface.

**Scope:** First correction covers M01 (8 pages) and M08 (8 pages), the currently reviewed and newly released nodes. Other existing interactive renderers still require explicit conversion; do not claim this batch fixes every node. No production deployment in this turn.

**Architecture:** Replace the M01 lecture renderer with read-only examples derived from its existing teaching data. Preserve its genuine generated image and RDKit structure. Convert M08 to a timed read-only code trace with a permanent complete state table, so no evidence depends on clicking. A shared presentation clock respects visibility and reduced motion; its pause/replay controls belong to the outer player. Do not read or write students' saved work from a lecture.

**Checks:** SSR tests assert all 16 surfaces have no inputs/buttons/forms/editable content; worked-example counts and exact code states remain valid. Browser-check animation, outer controls, mobile overflow, and unchanged saved data. Correct narration that previously instructed in-slide interaction; old mismatching audio must stay unbound. Update only these nodes' manifest entries and keep before snapshots.

## Implementation sequence

1. Write tests for read-only markup and evidence coverage; confirm failing cases.
2. Implement shared presentation clock and M01/M08 lecture surfaces.
3. Align current source and preview copy, retaining source IDs and lesson anchors.
4. Run focused/full frontend tests, layout and browser checks. Document actual local verification and remaining rollout.

## Verification result

- M01/M08 all 16 actual browser surfaces: zero button/input/select/textarea/form/editable controls inside the slide; no measured horizontal overflow on the desktop preview.
- M01 automatic funnel reaches state 5, outer pause holds the state, replay returns to state 1. All five evidence rows stay visible.
- M08 all 35 original execution states remain directly readable in the static trace tables; two independent Python trace tests pass.
- 155 frontend tests pass; touched components pass ESLint. Full TypeScript check still reports existing errors in other files; no errors in the changed presentation components.
- Current course manifest fully verifies. Stable slide IDs/kinds/anchors retained. Only M01/M08 slide/lecture-script files plus manifest changed; no student storage or production writes.
- Not yet verified: narrow/mobile and reduced-motion browser emulation; no claim of production verification. No production deployment requested for this correction.
