# Blender + Three.js mechanical hand implementation plan

**Goal:** Rebuild one inspectable five-finger mechanical hand with original Blender geometry, articulated joints and a browser preview.

**Architecture:** Blender authors named joint hierarchies, shells, pins, pads, actuators and a sample closing animation. Three.js loads the GLB and applies a shared kinematic model from finger controls; tendon paths and geometric contact limits update from the same pose. Exact angles and ideal tendon take-up remain in HTML.

**Tech stack:** Existing Blender 4.5.4 LTS, Three.js, Next.js / React and Playwright. No new npm dependency.

## Scope and teaching decision

The existing `bionics-scene.tsx` demonstrates a single printed gripper; M42's `torque-object-3d.tsx` illustrates a five-finger load budget. This sample provides a more detailed independently controlled five-finger assembly at `/standalone/mechanical-hand`. It does not replace either activity or their records, add a course or deploy.

Question: how do a winding drum, tendon routing and a serial chain of joints produce finger flexion? 3D is selected for inspecting hidden routing and thumb opposition. A flat diagram remains useful for formulas but cannot provide the same spatial inspection; a prerecorded render cannot respond to per-finger inputs. Use a hybrid model plus exact DOM readouts and a Blender-rendered fallback.

Original geometry: 4 fingers × 3 flexion joints; thumb × 2 flexion joints plus a simplified opposition pivot. Five drive drums represent independently commanded tendons. This is a purpose-built teaching mechanism, not a replica of a commercial hand or a medically validated prosthesis.

Reference: Yale OpenHand https://www.eng.yale.edu/grablab/openhand/ and Model T https://www.eng.yale.edu/grablab/openhand/model_t.html establish tendon-driven underactuation and contact-dependent behavior. No CAD or mesh is copied. Our prescribed joint ratios are not a force-equilibrium solver and do not reproduce Model T's pulley differential.

## Implementation batches

1. `scripts/mechanical-hand/build_hand.py`, shared `rig.json`, public `.blend`, `.glb`, poster and manifest. Beveled link shells, axle pins, palm framework, five drives, named guide points and joint hierarchy. A sample 4-second Blender closing clip is included for editing; interactive controls evaluate poses directly. Opening is prescribed; a return mechanism is not simulated.
2. `src/components/learning/mechanical-hand/`: pure kinematics, GLB scene controller, accessible React controls and responsive layout. Controls: five fingers, opposition, linked closing, three presets, shell inspection, tendon visibility, part selection, camera presets and reset. Reference-ball mode limits motion at first capsule/sphere contact; state is geometric only, without force/friction/holding claims.
3. `src/app/standalone/mechanical-hand/page.tsx`: direct preview, clear model assumptions, source links, downloadable editable assets. Pale workshop palette, orange tendons and teal reference object; large model viewport with compact controls.
4. `scripts/tests/mechanical-hand.cjs` and browser test: shared-model/GLB agreement, joint continuity, constraints, reversible posing, tendon take-up, sphere clearance, control effects, fallback/retry, mobile layout and actual visual review. Check scoped lint and record existing full-project typecheck baseline.
5. Exact-path commit/push and verify remote. No production deployment.

## Model assumptions

Model unit = 10 mm. Link lengths and angles are chosen teaching dimensions. For constant moment arms, ideal take-up is Δl = Σ rᵢθᵢ, with θ in radians; drum angle is Δl/R. Joint-angle ratios are prescribed. Tendon geometry illustrates routing and is not an elastic cable simulation. Ball collision uses conservative link capsules and halts the coupled finger at first contact; it does not predict adaptation of remaining joints, grip force or successful lifting.

## Status

Implementation and local verification complete. Original Blender model, animated source tendons/drums, GLB, rendered fallback and the reusable viewer are integrated at `/standalone/mechanical-hand`. Model tests pass: 210 GLB/analytic endpoint comparisons, 456 animated source-tendon endpoint checks, 58 contact cases and enclosure of 93,660 rendered finger vertices. Browser controls, fallback/retry/context loss and 390px layout pass. Actual desktop and mobile screenshots reviewed.

Scoped ESLint passes. Full-project TypeScript still reports the same six existing errors in unchanged `slide-demo/page.tsx` and `course-content-view.tsx`; no new component errors. No production build or deployment claimed. Evidence and reproduction commands: `artifacts/mechanical-hand-20261110/README.md`.

## Appearance revision 02 — user review

The user rejected the square, plate-like palm as visually implausible. Rebuilt the Blender geometry with a sampled asymmetric palm outline, curved front/dorsal panels, thenar/hypothenar contact regions, a narrower wrist, thumb opposition saddle, staggered knuckle supports and tapered rounded phalanges. Replaced the square internal frame with metacarpal spars. Five drives now sit inside a contoured wrist enclosure in a staggered arrangement; palm tendons route beneath the front shell.

Visual references: Shadow Hand official June 2024 technical specification, page 4, and Open Bionics Hero Arm product images. These are shape/assembly references, not copied CAD or a claim of product equivalence. Existing articulation and source IDs remain; asset manifest records appearance revision 2. Controls default to the assembled exterior; removing shells reveals tendons automatically.

Rebuilt `.blend`, GLB, poster and manifest. Scoped lint, geometric/model checks and desktop/mobile browser checks pass. The same six pre-existing full-project type errors remain. Revision evidence, before/after screenshots and commands: `artifacts/mechanical-hand-form-v2-20261110/README.md`. Not deployed.
