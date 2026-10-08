# M02/M03 teacher-slide decisions — recorded before implementation

Mode for every row: `presentation_mode: readonly`. Source is the active consecutive-v2 course, the original slide ID/title/narration and existing validated model. No personal completion signals or stored records are read.

## M02 · RDKit environment (8 slides)

| Source | Learning question / misconception | Evidence and method | Nearest alternative / boundary check |
|---|---|---|---|
| s1 goal | What must this stage hand to M03? A browser diagram is not a local installation check. | DOM input→environment→version/log deliverables, all visible. | No machine illustration: the actual boundary is runtime location. No automatic “my environment ready” label. |
| s2 places | Where do installation commands and Python statements run? | Side-by-side terminal and notebook commands with separate install/import rows. | A toggled card hides half of the comparison; show both. Commands are examples, never executed. |
| s3 library | What does the library return for valid and invalid SMILES? | Existing RDKit.js computes/draws ethanol and water; fixed invalid ring example has no mass. Input/output table plus exact Python code. | Raster cannot own exact connectivity/mass; all three outcomes visible without choosing. Browser version ≠ learner Python version. |
| s4 binding | What survives restart? | Three state-model snapshots: installed, imported, restarted; package and name columns. | Static evidence is sufficient; no controls needed. Restart clears binding but preserves installed package. |
| s5 trace | How does each statement change state? | Existing runtimeTrace, timed row highlight + current state, all seven rows always present. | Not a real Python interpreter. Fixed version is marked teaching value. Pause/replay outside slide. |
| s6 terminal | NameError or ModuleNotFoundError: which layer failed? | Three derived model cases, prerequisite/action/error/repair table, no terminal input. | Explicit worked diagnosis is clearer than trial-and-error buttons. Wrong environment is distinct from missing import. |
| s7 evidence | What does a useful runtime record contain? | Exact CHECK_SCRIPT plus field→meaning→verification-boundary table. | No fake personal JSON. No form, download, save, or real installation. |
| s8 next | How does runtime evidence support the next stage? | M02 record→same interpreter/import→M03 structure evidence. | A task explanation, not progress inspection; no localStorage lookup. |

## M03 · molecular structure (10 slides)

| Source | Learning question / misconception | Evidence and method | Nearest alternative / boundary check |
|---|---|---|---|
| s1 overview | Connectivity vs spatial arrangement? Methane is not a planar cross. | Existing PubChem computed methane coordinates in Three.js; automatic spatial/face/edge camera presets, RDKit connectivity and computed H–C–H angle. | A static 2D graph hides depth; a generated molecule cannot establish geometry. Camera changes no chemical state. |
| s2 vocabulary | Which atoms connect to which in ethanol? | Three.js fixed ethanol highlights C/C/O in sequence; complete atom-neighbor/element counts table + RDKit exact structure. | No selection or H toggle needed. 3 heavy + 6 H = 9 total remains explicit. |
| s3 mass | Why count invisible H? | Water/ethanol exact formulas and element-count × mass table, KaTeX worked totals. | Static deterministic comparison, not a cosmetic animation or image. Da vs dimensionless relative mass retained. |
| s4 bonds | Bond order vs number of connections? | Keep existing readonly ethane/ethene/ethyne RDKit + KaTeX comparison. | No 3D benefit for this counting relationship; restrict carbon valence claim to examples. |
| s5 skeleton | Same formula, different graph? | Keep existing readonly butane/isobutane/cyclohexane comparison. | Diagram answers graph topology; do not claim drawn hexagon proves planarity or aromaticity. |
| s6 aromatic | What does front/edge geometry establish, and what not? | Existing benzene coordinates, timed face/edge views; plane deviation and C–C distance range, RDKit aromatic-ring count. | Electron circulation is not depicted; planarity alone does not prove aromaticity. Complete numerical evidence stays visible. |
| s7 scan | How does reading a fixed structure accumulate counts? | Preset ethanol atom highlighting, synchronized count, complete neighbor/reading-order table. | Model is pre-existing, not atom creation or chemical reaction. Timed demonstration, not hands-on selection. |
| s8 lab | How should four reference observations be recorded? | Four RDKit structures, exact complete counts and one source-grounded observation each. | Replace personal form with clearly marked reference cards, not fabricated student work. |
| s9 report | Which operation changes the counting convention? | Exact Python excerpt includes Chem.AddHs, full 4-molecule expected-count table and environment metadata requirements. | No download/upload tool inside slide. Expected results are not proof of a user's execution. |
| s10 handoff | How do structure reports support functional-group comparison? | Existing exact ethane/ethanol comparison plus M03 report→M04 question. | Retain comparison, remove personal completion checks. Not a reaction scheme. |

## Shared acceptance

Acceptance requirements: all in-slide buttons, selects, inputs, forms, editable areas and downloads absent from rendered markup. M03 read-only WebGL has no OrbitControls or pick listeners attached. Existing interactive viewer use elsewhere remains backward-compatible. Preset camera changes, selection highlights and all counts must be tested. All source IDs, kinds, anchors and geometry hashes retained. New assets: no new raster; real existing RDKit/Three.js objects remain runtime renderings. Candidate, integrated, browser-verified and production status recorded separately.

## Actual verification — 2026-09-14

- Local candidates: `M02-readonly-v1.json` (8), `M03-readonly-v1.json` (10). Before snapshots and exact hashes: `artifacts/readonly-m02-m03-20260914/candidate.json`. Only four source JSON files plus manifest changed. Lesson, assignments, source links, slide IDs/kinds/anchors and geometric data untouched.
- SSR: all 18 actual routed components have no in-slide action controls, edit forms or formula errors. M02 trace keeps all seven states, M03 scan all nine atom rows, vocabulary all three heavy-atom neighbor rows. Old interactive callers still retain their original viewer controls.
- Frontend regression: 157 tests pass. Touched TSX files pass ESLint. Full TypeScript check still reports 20 existing errors in unrelated slide-demo/assignment/capstone/course-content files, none in this batch; this is not a clean full-build claim.
- Independently executed the exact M03 Python excerpt with RDKit 2026.03.3 using `scripts/releases/verify-readonly-science.py`. All four rows match retained geometry fixtures: water 1/3/2/0/0/18.015, methane 1/5/4/0/0/16.043, ethanol 3/9/8/0/0/46.069, benzene 6/12/12/1/1/78.114 (heavy/all-atoms/all-bonds/rings/aromatic-rings/mass). Inputs use the same Kekulé spelling as the table.
- Desktop in-app browser viewport 956×1039: visited all 18 pages; no in-slide controls. M02 has no overflow and actual WASM returns 46.069 / 18.015 g/mol; invalid `C1CC` has no mass. M03 mass had a long equation: changed to aligned multiline derivation and rechecked all four equation containers (scrollWidth equals clientWidth, no horizontal scroll). Other content-block checks were clear; clipped accessibility-only MathML is excluded from visual-overflow claims.
- Actual Three.js/WebGL readiness and automatic reset→edge view progression observed for M03 s1 (methane) and s6 (benzene). Screenshots inspected the light background, exact RDKit companion diagrams, count/angle/plane evidence. Read-only canvas has no OrbitControls or pick listeners; touch scrolling remains browser-owned.
- M02 outer pause held step 3 with all seven rows visible; replay reset to step 0. No audio produced; source audio_path remains null.
- **Incomplete browser checks:** a final pass on M03 s2/s7 highlighting/count accumulation was blocked by browser security auto-review returning `Selected model is at capacity`. The read-only retry was also denied; no alternative control channel was used. Those two final-motion checks, mobile/responsive emulation, actual reduced-motion setting and forced WebGL-loss fallback remain unverified. Do not claim full browser acceptance or production readiness from this record.
- No production commands executed; all four local read-only nodes M01/M02/M03/M08 remain pending deployment. Next read-only conversion is M04; next entirely new generation remains M09.
