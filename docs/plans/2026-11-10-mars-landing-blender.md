# Blender + Three.js Mars landing implementation plan

**Goal:** Build one inspectable, original Blender-authored Perseverance landing demonstration, with a browser preview and editable source.

**Architecture:** A reproducible Blender Python script creates the rover, descent stage, aeroshell, parachute, suspension cables, terrain and prescribed animation. Export one GLB with named groups, extras and animation; Three.js GLTFLoader and AnimationMixer play/scrub the exported animation. React provides accessible Chinese narration, stage navigation, selection, camera presets and fallback.

**Tech stack:** Blender 4.5.4 (temporary official macOS binary); installed Three.js 0.184; Next.js/React; Playwright.

## Scope and decisions

Reference: existing `land-a-probe` (`public/project-lines/space-exploration/land-a-probe/index.html`), a vertical thrust game. This new sample describes the actual component sequence rather than changing that game's model or saved records. Preview `/standalone/mars-landing`; the viewer remains reusable as a learning component. No new course, classroom tabs, migration or deployment.

- Primary teaching question: why are the protective shell, parachute, rocket stage and rover separate objects, and when/how do they separate?
- 2D sequence is a useful fallback; a prerecorded render would constrain inspection. Selected hybrid: Blender geometry/keyframes + live Three.js spatial inspection + DOM exact facts.
- Qualitative schematic, not flight dynamics or NASA CAD. Distances and durations compressed; no fabricated live altitude/velocity telemetry. Source numbers are explicitly historical reference facts.
- Model assembly and timeline both reveal part/whole relationships. Controls alter timeline, camera, selected part and shell visibility. Reset and fallback preserve access.
- Source mapping: old `land-a-probe` kept as reference; new asset ID `mars2020-descent-v1`.

## Source facts

NASA: https://science.nasa.gov/resource/powered-descent-for-perseverance-illustration/
NASA: https://science.nasa.gov/resource/perseverance-heat-shield-separation-illustration/
NASA: https://science.nasa.gov/resource/perseverance-touching-down-on-mars-illustration/
NASA video: https://www.youtube.com/watch?v=4czjS9h4Fpg

About 11 km: parachute deployed; heat shield discarded before backshell separation. About 2.1 km: rover/descent stage separate from backshell/parachute. About 20 m: skycrane lowers rover on approximately 6.4 m cables. Wheels touch, cables cut, stage flies away. Rover is six-wheeled and mast is stowed during descent. Geometry is our idealization; do not label it an official replica.

## Implementation

1. `scripts/mars-landing/build_scene.py`: authored mesh functions, semantic groups, materials, keyframes, GLB/.blend/poster/manifest. Verify dimensions/part counts, animation channels, ground contact and output size; save a reproducible command.
2. `src/components/learning/mars-landing/`: scene lifecycle, animation seek, selection and accessible controls. Respect reduced motion, suspend offscreen/hidden rendering, dispose GPU resources, show recoverable load/WebGL fallback.
3. `src/app/standalone/mars-landing/page.tsx`: direct preview entry; responsive frame with Chinese explanatory copy and NASA sources. No technical library labels in primary learner controls.
4. `scripts/tests/mars-landing.cjs`: structural asset tests, exported animation endpoints, reversible seeking and lifecycle/browser checks. Desktop/mobile screenshots, play/pause, phase jumps, camera, part selection, shell toggle, fallback, download checks, no console/page errors.
5. Review actual rendered appearance; fix clipping and physically misleading geometry. Stage only these new paths; commit/push current branch, verify remote. Record candidate/integrated/browser-verified separately. Do not deploy.

## Initial status

Research and design complete. Blender download in progress. Implementation and visual verification pending.
