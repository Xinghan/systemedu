# Mission Center Research Room Design

**Goal:** Make the existing mission center feel like a contemporary rover research facility while retaining its five clear modules and all task/record behavior.

**Direction:** A seated research-control-room viewpoint, framed by instrument panels: charcoal blue structure, quiet cyan indicators, warm desert light, and a pale electronic task sheet. The environment provides presence; real task progress provides the information. Avoid decorative fake telemetry, blinking dashboards, neon overload, and illegible overlaid text.

**Alternatives considered:** A purely dark UI changes palette but does not create a place. A full 3D navigable room adds loading and navigation complexity. Use one generated photographic environment plus a lightweight CSS instrument frame instead.

## Scope
- Generate one original, text-free fictional Mars-analog research control room image, with no people, logos or fake readings. Save a compressed responsive WebP in `packages/student-web/public/mission/space/` and keep generation provenance in this batch's artifacts.
- Modify `space-mission-control.tsx`: separate the scene, title and real current-station indicator; add instrument-panel headings and a dynamic current-station rail without changing task state, scope or timing.
- Modify `space-mission-control.module.css`: dark room framing, pale task-reading surface, restrained cyan accents, warm amber blockers, clear focus states and responsive layout. Scope immersive rules to `.center`; shared classroom work strips keep their existing presentation.
- Preserve homepage, classroom layout, map behavior, all five center modules, original media and records. No backend or curriculum changes.
- Use a brief one-time entrance motion; disable it under prefers-reduced-motion. No autoplay video or persistent scene animation.

## Verification and delivery
- Inspect generated image and desk/map/schedule/log/dossier at desktop and 390/320px, including form labels, long text and focused controls.
- Reuse meaningful existing browser checks for saved state and navigation; add visual QA for reduced-motion and responsive scene loading, not implementation-mirroring unit tests.
- ESLint and TypeScript comparison against `f927e62d`, production build, focused diff review.
- Commit and push only this batch on the current branch; leave production deployment for an explicit request.
