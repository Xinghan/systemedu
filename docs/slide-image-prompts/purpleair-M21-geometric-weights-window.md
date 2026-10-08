# PurpleAir M21 — geometric weights and rolling window

## Shared art direction

Wide 16:9 premium friendly 3D educational illustrations with clean spatial metaphors. Use deep violet / indigo backgrounds, coral for the newest reading, lavender for older readings and structures, and sunflower yellow for the current focus or conclusion. Teach through size, spacing, and movement only: no words, letters, labels, numbers, equations, axes, legends, logos, watermarks, or fake UI.

## Target mappings

### s1_intro — `s1.precise-recentness-rule.img_1.png`

Caption: 要让越近的数据越重要，不能凭感觉挑砝码；可以从最新读数开始，每往前一步都乘同一个固定比例。

Prompt: Use case: scientific-educational. A 16:9 conceptual scene: a row of glowing time beads recedes from a bright coral newest bead on the right toward small lavender older beads on the left, each shrinking by the same visible ratio. A transparent rule-like lens spans the row to signal one consistent rule, not arbitrary choices. Deep violet, premium friendly 3D, no labels or numerals.

### s2_bullet — `s2.multiplying-decay-chain.img_1.png`

Caption: 几何级数不是每一步加同样多，而是每一步乘同一个小于一的比例，所以权重会越来越快地缩小。

Prompt: Use case: scientific-educational. A 16:9 tactile sequence of six coral-to-lavender blocks in a descending chain, each one visibly a fixed fraction of the previous block. Between blocks place matching transparent multiplier lenses rather than written symbols; contrast with a faint equal-step stairway fading in the background. Friendly scientific 3D illustration, no text, numbers, arithmetic signs, or axes.

### s3_theory — `s3.halving-geometric-bars.img_1.png`

Caption: 取折半比例时，每根权重条都是前一根的一半；越久的读数越轻，却始终保留一点点影响。

Prompt: Use case: scientific-educational. A 16:9 row of physical upright weight bars starting very tall at a bright coral newest bead on the right and halving repeatedly toward the left into tiny but still visible lavender bars. Add a soft floating cake-like ribbon that is repeatedly halved into smaller pieces as an intuitive echo. Deep violet premium 3D teaching illustration, no labels, numbers, graphs, or text.

### s4_theory — `s4.rolling-twelve-hour-window.img_1.png`

Caption: 滚动窗口始终只保留最近十二个读数：右边的新读数进入，左边最老的读数退出，窗口本身的宽度不变。

Prompt: Use case: scientific-educational. A 16:9 cinematic train-window metaphor: a translucent lavender rectangular viewing frame moves right across a long ribbon of hourly beads. A fresh bright coral bead enters from the right edge while a faded old bead slips out on the left; exactly twelve bead spaces appear inside the frame but carry no numbering. Deep violet friendly 3D science illustration, no text or arrows.

### s5_bullet — `s5.stable-versus-responsive-knob.img_1.png`

Caption: 同一个权重旋钮可以让旧数据保留得更久、结果更平稳，也可以让权重快速衰减、结果更灵敏地跟随最新变化。

Prompt: Use case: scientific-educational. A 16:9 clean side-by-side comparison controlled by one central tactile knob: left path has many nearly equal-height lavender bars leading to a calm stable sunflower orb; right path has a steep cascade from one tall coral newest bar to tiny old bars leading to a quick responsive coral orb. Communicate stable versus sensitive solely through forms and motion ribbons, no text or labels.

### s10_handson — `s10.draw-decaying-weights-workflow.img_1.png`

Caption: 学生把十二个权重按固定比例排成递减条，检查每根都比前一根小却仍然大于零，再把这条规律讲清楚。

Prompt: Use case: scientific-educational. A 16:9 hands-on maker desk: a learner arranges twelve physical coral-to-lavender bars from tall newest at the right to tiny-but-visible oldest at the left on a blank board. A transparent magnifier checks the bars; a family silhouette watches the learner explain the pattern. Use a gentle path through the stages. Deep violet premium 3D, no text, numbers, checkmarks, or UI.

### s11_outro — `s11.nowcast-heart-components.img_1.png`

Caption: 几何衰减权重和固定宽度的滚动窗口共同组成了 NowCast 的核心，让最近空气变化更有发言权。

Prompt: Use case: illustration-story. A 16:9 optimistic closing scene: a young learner holds a glowing compact sensor beside two fitting physical components—a row of rapidly shrinking weight bars and a transparent moving window framing a limited bead ribbon. The components click together into one calm luminous NowCast-style core orb, with a warm next-step glow beyond. Deep violet, coral/lavender/sunflower, no text, numbers, logos, or UI.

## Batch record

- Status: published to production on 2026-08-07.
- Runtime mappings: all seven assets are mapped directly through `payload.images` in `M21-w0-module/slides.json`.
- SVG retirement: all seven corresponding `inline_svg` values are removed.
- Verification: local mapping and manifest validation passed; production payload reports seven image mappings and `legacy_svg_count: 0`; sampled image responses returned `200 image/png`.
