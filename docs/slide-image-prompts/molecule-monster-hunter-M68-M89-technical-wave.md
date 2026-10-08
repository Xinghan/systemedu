# Molecule Monster Hunter · M68–M90 technical visual wave

This record is the source-to-renderer mapping for this batch. It deliberately
contains no raster-image prompt: all four claims require exact values, API
names, or program output, so deterministic DOM surfaces are more accurate.

| Node / slide | Source-grounded claim | Renderer | Observable states | Why not raster / simple SVG |
| --- | --- | --- | --- | --- |
| `M68-w0-vs-scaffold / s1` | With model, molecules, and features fixed, changing the split changes the course example from `0.92` to `0.71`; `Δ = 0.21`. | `formula-sequence` | fixed variables → random score → scaffold score and delta | The causal comparison is numerical and ordered. A bar chart would hide the experimental control and cannot keep the arithmetic selectable. |
| `M78-w0-roc / s10` | `roc_curve(y_true, y_score)` returns `fpr, tpr, thresholds`; ROC uses FPR as x-axis and TPR as y-axis; `roc_auc_score` gives a threshold-independent `0–1` value. | `code-trace` | inputs / returned arrays → correct axes → AUC summary | Exact Python API names and axis names must remain text. No numeric AUC is invented because the source does not provide one. |
| `M89-w0-module / s4` | A reject reason names its rule, gives the exceeded value, then may state its consequence; the source example is `MW = 612 > 500`. | `formula-sequence` | reason schema → verifiable inequality → readable report | The relationship is a structured evidence chain, not an object or scene. A generated picture could not reliably typeset the inequality. |
| `M89-w0-module / s10` | The template prints a reason for each rejected molecule. Source records: `mol_07 MW 612 > 500`, `mol_12 logP 5.2 > 5`, and `mol_23 HBD 7 > 5`. | `code-trace` | input batch → one function call → full, inspectable output list | The code/output pairing shows the actual transformation and the short-circuit reporting principle; a still would be less teachable. |
| `M90-w0-workbench-go-no-go / s4` | SMILES must flow through structure, features, model, funnel/ranking, and an evidence-bearing report. The model input must use the training feature columns in exactly the same order. | `pipeline-contract` | inspect the emitted feature row → align the training and inference contracts → swap `MW`/`LogP` and expose the silent semantic failure | This is a data-interface lesson, so generated art or a static arrow chain would conceal the crucial “runs but is wrong” failure mode. |

## Source integrity notes

- M68 uses the course’s illustrative pair `0.92` and `0.71`; it labels the
  difference as a split-comparison result and does not present it as a general
  model law.
- M78 contains no source dataset or actual curve coordinates. The renderer
  therefore exposes the real API and axis contract but does not fabricate a
  plotted AUC.
- M89’s `MW = 612 > 500` example is kept separate from the source’s generic
  discussion of consequences. The visual does not claim that this particular
  molecular-weight rule causes the “too oily / insoluble” consequence.
- M90 reuses the course’s fixed eight-feature order from M44 (`MW`, `LogP`,
  `HBD`, `HBA`, `TPSA`, `RotB`, `Rings`, `AromaticRings`). The only simulated
  faulty state is the source-described `MW`/`LogP` order swap; it is labelled
  as a silent wrong prediction, not as a runtime exception.
- Existing animation and game slides are retained. These deterministic
  surfaces replace only the sparse explanatory slides adjacent to them.
