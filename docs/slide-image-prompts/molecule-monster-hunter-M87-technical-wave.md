# M87 · 归一化与加权评分

Course: `molecule-monster-hunter`, node: `M87-w0-top10`.

| Slide (1-based) | Source | Teaching relationship | Medium |
| --- | --- | --- | --- |
| 4 / `normalize_before_sum` | Original narration + SVG: 10, 30, 50; `(x-min)/(max-min)`; toxicity direction must flip. | Raw values → 0, 0.5, 1 → reversed safety score when lower is better. | KaTeX + selectable evidence + three learner-controlled states. |
| 5 / `weighted_scoring_rank` | Original SVG: normalized scores 0.9, 0.6, 0.7, 1.0 and weights 0.5, 0.2, 0.2, 0.1. | Named scores and weights → four contributions → checkable sum 0.81 → ranking contract. | KaTeX + selectable evidence + three learner-controlled states. |

These lessons need exact arithmetic, not generated imagery. The safety score
is explicitly distinguished from raw toxicity; the final 0.81 is a weighted
score, not a probability or proof of rank. The normalization example has a
non-zero range. No competitor scores or new performance claims are invented.

Original narration, titles, activity links, audio, and old SVG fallback remain
unchanged. The typed visual takes precedence over that fallback in the player.
