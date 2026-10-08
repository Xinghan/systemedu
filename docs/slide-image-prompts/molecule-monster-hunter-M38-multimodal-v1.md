# M38 · LogP · 多媒介讲课视觉 v1

Source: `systemeduidea/projects_data/molecule-monster-hunter/knodes/M38-w0-rdkit-logp/lesson.md`, original 10-page `slides.json`.

## Raster semantic brief and final prompt

Original claim: cooking oil disperses when stirred into water, then collects at the top and separates after standing. This is an intuition-building observation, not a measurement of an individual solute's LogP.

Entities: same transparent vessel, clear water, pale golden cooking oil; two physical states. No person is needed.

Decision: generated material illustration + exact DOM captions. Plain boxes or a lone beaker icon lose the droplet/interface distinction; a generated image must not carry numeric concentrations, formulas or labels. Three.js is reserved for the next scene's inspectable model.

Use case: scientific-educational.
Asset type: 16:9 raster comparison for a Chinese science teaching slide, no text in image.
Primary request: show a clear physical comparison of the SAME cooking-oil-and-water system in TWO moments: just after stirring, then after standing and separating. The relationship must be visible without any labels.
Composition: two equally sized transparent straight-sided laboratory-style drinking glasses on one warm-white tabletop, aligned at the same height, identical perspective, equal total liquid height, ample separation. Left: clear water with many visible translucent pale-gold oil droplets of varied sizes dispersed through the water, a few droplets collecting near the top; not foam, not bubbles, not a uniform opaque emulsion. Right: the same total amount of liquid and oil, now a distinct thin pale-gold upper oil layer with a clean horizontal interface above clear water; no droplets remaining in the lower water. Glasses occupy most of each half, framed completely.
Style: high-fidelity educational product illustration with believable transparent glass, soft restrained shadows, warm ivory #faf8f2 background, slate-gray edges and pale amber oil; calm technical presentation, no cinematic effects.
Text: none. No letters, numbers, captions, labels, measurement ticks, arrows, symbols, logos, watermarks, people, hands, food props or decorative objects. Exact stage names and scientific caveats will be separate HTML text.
Constraints: maintain identical vessels and overall liquid volume; the change is dispersed droplets versus a separated upper layer. This is an illustrative comparison, not experimental photography. Do not depict chemical bonds or molecular structures.

Generation mode: built-in image_gen (not a CLI/provider fallback). One selected raster, reused rather than counted twice.

## Saved asset

- Original: `/Users/xinghan/.codex/generated_images/019f64e5-f1b9-7430-ab89-463020bc7bdc/exec-877ba3c0-f709-43e0-b6de-2cb90483a5f0.png`
- Course web asset: `packages/student-web/public/slide-assets/molecule-monster-hunter/M38/oil-water-comparison-v1.webp`
- Served URL: `/slide-assets/molecule-monster-hunter/M38/oil-water-comparison-v1.webp`
- 1600 × 900; 66,218 bytes (64.7 KiB), Sharp WebP quality 80; SHA-256 `7b20055c49d6fa51bf364c4b50f8229b41bd59c9449f2d6e01f1b501d9eb0e74`.
- Visual inspection: identical glass silhouettes, left dispersed oil droplets, right a continuous upper oil layer; light project-compatible background, no people, no generated formulas or labels. DOM captions and disclosure accompany both uses. It is a qualitative illustration, not an experimental photograph or quantitative volume measurement.

## Slide mapping — all 10 pages are new

Project: **molecule-monster-hunter / 分子猎人**. Node: **M38-w0-rdkit-logp / 用 RDKit 算 LogP**.

| Page / original ID | New teaching expression | Actual medium |
|---|---|---|
| 1 / s1 | Dispersed droplets vs separated layer; distinguish observation from LogP definition | Generated WebP + DOM captions |
| 2 / s2 | Inspect vessel interior and liquid-volume geometry; equal concentrations can have unequal amounts | Three.js WebGL object + model readouts |
| 3 / s3 | Change logP and phase volume; compare amount, concentration and conserved total | Three.js + KaTeX + interactive controls |
| 4 / s4 | Convert logP −1/0/1 to concentration ratios 0.1/1/10 | KaTeX + exact data table |
| 5 / s5 | Add three source molecules to a shared computed-value scale | RDKit 2D + playable/stepwise HTML |
| 6 / s6 | Parse SMILES, calculate descriptor, append result to the same row | Python template + progressive calculation record |
| 7 / s7 | Order three molecules using comparable computed values | HTML exercise with correctness/duplicate feedback |
| 8 / s8 | Count exact values into four disclosed intervals | HTML source table + histogram |
| 9 / s9 | Distinguish calculated descriptor, generated illustration and real measurement | Reused WebP + selectable RDKit structure + evidence table |
| 10 / s10 | Keep molecular weight and cLogP as separate columns for the same molecule | HTML evidence table + JSON export |

Draft: `course_factory/fixtures/molecule-monster-hunter/M38-multimodal-v1.json`.
Registry: `course_factory/fixtures/molecule-monster-hunter/M38-multimodal-v1.registry.json`.
Draft SHA-256: `b9ebc4b1dba9fba8d97f7afc8d5b3561493c72d6f4ae7c9b4e5537abbe1f858d`.
Preview: `http://127.0.0.1:4173/slide-preview/m38-multimodal` (development only; default page 2).

## Skill routing review

`course-slide-visuals` was applied source-first, not as an HTML default or image quota. The material distinction between droplets and a continuous liquid layer benefits from generated imagery. Vessel rotation, wall cutaway and volume-proportional heights give the 3D object a concrete inspection task. Numeric log ratios, molecular connectivity, code and records require exact renderers; they are not baked into generated pixels. Animation adds one computed record at a time and stops at the end, rather than spinning an object decoratively. Page 9 reuses the image intentionally to explain its evidentiary limit.

The formal two-phase model is a teaching construction: same neutral dilute solute, fixed conditions, equilibrium already reached, no chemical reaction/association. `P=10^logP`, `n_water=n_total/(1+P*V_organic/V_water)`, `n_organic=n_total−n_water`, `c=n/V`. With µmol and mL, concentration is mM. The 100 tracer dots show rounded fractions, not 100 actual molecules; the model is not fluid simulation, molecular dynamics or a prediction of equilibration time. Water/organic colors are semantic. Solvent laboratory work is not a children's home activity.

Official definition references checked: [OECD 107](https://www.oecd.org/en/publications/test-no-107-partition-coefficient-n-octanol-water-shake-flask-method_9789264069626-en.html), [IUPAC partition ratio](https://goldbook.iupac.org/terms/view/P04440/plain). Actual renderer APIs: [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html), [OrbitControls](https://threejs.org/docs/pages/OrbitControls.html).

## Verification — 2026-09-09

- `node --test scripts/test-*.cjs`: **87 passed**, including **8 new M38 tests**. Tests independently recompute all 27 logP/volume control states, mass conservation and concentration ratios; use actual installed RDKit for the 3 descriptors; compile the two real KaTeX templates; SSR all 10 scenes; check source hashes, IDs, WebP header/hash/size and Three.js resource cleanup.
- Targeted ESLint on all new TS/TSX: **0 errors, 0 warnings**. Full repository TypeScript still has **20 known pre-existing diagnostics**, no new errors in M38 files; this is not a claim that the entire repository passes type-checking.
- Browser canvas reports `three.js r184`. Page 2 at logP=0 and organic volume 20mL: amounts 6.667/3.333µmol, concentrations 0.333/0.333mM, tracer counts 67/33. Full-wall toggle changes cutaway state; top/front/reset views and explicit fallback/retry work.
- Page 3 at logP=−2: concentrations 0.010/0.990mM and dots 1/99; at +2: 0.990/0.010mM and dots 99/1. Reset restores logP=1, 10mL per phase and 9.091/0.909µmol. Display values are rounded; tests check unrounded calculations.
- Browser checks all 10 pages × 4 content widths (480/720/960/1152): **40 cases**, no root/table horizontal overflow or formula errors. Pages 1/9 load the actual 1600px WebP.
- All 10 pages in the maximized floating player at 1280×720: fitted within the slide viewport, no clipped edges or inner vertical scroll. Page 5 final state at 480px also checked with all three labels and the real RDKit SVG visible.
- Page 5 autoplay reaches all three records and stops; manual next/reset work. Page 7 incorrect and correct selections produce distinct, correct feedback. Molecular structure results are associated with their SMILES, preventing a delayed old SVG from briefly being paired with a new label.
- Browser warning/error logs remained empty during the above checks.

**Release state:** local-verified-awaiting-user-review. No production writes, no canonical course replacement, no old audio reused. New narration is present but audio has not been generated. Prior deployed M87–M89 status is retained; the project is not complete and M90 remains the next planned node.
