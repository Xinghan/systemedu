# PurpleAir M20 — arithmetic and weighted means

## Shared art direction

Wide 16:9 premium friendly 3D educational illustrations with a small amount of clean vector clarity. Use a deep violet / indigo background, coral for readings, lavender for supporting objects, and sunflower yellow for the balance point or conclusion. The visual must teach through objects and position rather than embedded copy: no words, letters, labels, numbers, equations, axes, legends, logos, watermarks, or fake UI.

## Target mappings

### s1_intro — `s1.many-readings-one-summary.img_1.png`

Caption: 一整天高高低低的许多读数可以被收拢成一个代表性结果；接下来要比较每个读数同等重要和有些读数更重要两种办法。

Prompt: Use case: scientific-educational. A 16:9 conceptual wide scene: many small coral measurement beads at varied heights flow from a long lavender ribbon toward one luminous sunflower summary orb at center, while two elegant paths branch ahead—one path made of equal-sized beads and one path made of progressively heavier beads. Friendly premium 3D teaching illustration, deep violet backdrop, no text or symbols.

### s2_bullet — `s2.mean-as-balance-point.img_1.png`

Caption: 把每个读数当成同样的小砝码摆在刻度梁上，支点放在能让两边恰好平衡的位置，就是算术平均的直观意义。

Prompt: Use case: scientific-educational. A 16:9 tactile balance-beam scene with five equal coral beads placed at varied positions along a clean unmarked horizontal beam. A sunflower-yellow triangular fulcrum at the central balancing position holds the beam perfectly level; small lavender redistribution ribbons gently imply high values sharing with low values. No tick labels, numerals, text, or scale markings.

### s3_theory — `s3.equal-share-average-workflow.img_1.png`

Caption: 算术平均先把所有读数汇成一份，再平均分给同样大小的五只容器；每个读数的发言权完全相等。

Prompt: Use case: scientific-educational. A 16:9 wordless workflow: five coral value beads pour into one glowing shared basin, then divide evenly into five identical small lavender cups around a single sunflower result orb. Make all cups identical to express equal influence. Premium friendly 3D teaching illustration on deep violet, no written numbers or math symbols.

### s4_theory — `s4.weighted-mean-heavy-pulls.img_1.png`

Caption: 加权平均会给不同读数配不同重量；靠高值一侧的重砝码更多时，平衡点就会被拉向高值。

Prompt: Use case: scientific-educational. A 16:9 physical balance beam with coral measurement beads at varied locations and clearly different stacked lavender weights beneath them. The heaviest stacks sit toward the high-value side and visibly pull the sunflower fulcrum rightward compared with a faint earlier central ghost fulcrum. Deep violet background, friendly precise 3D education style, no text or numbers.

### s5_bullet — `s5.equal-weights-special-case.img_1.png`

Caption: 当所有读数都配上完全一样的砝码时，加权平均就回到了算术平均；重要的是权重之间的比例，而不是砝码的绝对大小。

Prompt: Use case: scientific-educational. A 16:9 visual proof without writing: five varied-position coral beads each sit above identical lavender weight blocks on a balanced beam. Two translucent groups of weight blocks, small and large but proportional, align to the same sunflower fulcrum, showing that equal weights give the same center. Premium 3D science illustration, deep violet, no text or numerals.

### s10_handson — `s10.compare-two-averages-workflow.img_1.png`

Caption: 先抄下读数，再并排算出等权与加权两种结果，比较它们为什么不同，最后把这个区别讲给别人听。

Prompt: Use case: scientific-educational. A 16:9 hands-on learning workflow on a maker desk: a blank dotted data card, an equal-share tray with identical cups, a weighted-balance tray with different stacks, two unmarked result orbs at slightly different positions, and a learner explaining the comparison to family silhouettes. Connect stages with a gentle coral ribbon. No writing, letters, numbers, UI, or symbols.

### s11_outro — `s11.means-foundation-for-nowcast.img_1.png`

Caption: 学生已经掌握了两种把许多读数收拢成一个结果的方式，也为理解 NowCast 后续如何选择权重打下基础。

Prompt: Use case: illustration-story. A 16:9 optimistic maker-desk scene: a young learner places two elegant result orbs side by side—one reached by identical coral bead paths and one reached by a lavender weighted balance path. A small glowing sensor and a distant gentle sunrise-like tuning glow suggest the next NowCast lesson. Deep violet, warm coral/lavender/sunflower palette, no text or logos.

## Batch record

- Status: published to production on 2026-08-07.
- Runtime mappings: all seven assets are mapped directly through `payload.images` in `M20-w0-module/slides.json`.
- SVG retirement: all seven corresponding `inline_svg` values are removed.
- Verification: local mapping and manifest validation passed; production payload reports seven image mappings and `legacy_svg_count: 0`; sampled image responses returned `200 image/png`.
