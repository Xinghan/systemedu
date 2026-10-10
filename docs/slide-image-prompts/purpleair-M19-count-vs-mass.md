# PurpleAir M19 — 粒子计数与质量浓度图片清单

课程源：`purpleair-airquality-node/knodes/M19-w0-module/slides.json`  
资产目录：`purpleair-airquality-node/knodes/M19-w0-module/images/`

## Shared art direction

16:9 premium educational editorial illustration for 10–12 year olds. Friendly 3D clay plus clean vector hybrid, deep violet / indigo scientific background, coral count beads, lavender inference paths, restrained sunflower-yellow highlights, rounded sensor and laboratory objects, generous negative space. All values, scales, and outputs remain abstract teaching cues rather than real data. Do not include words, letters, numbers, units, labels, equations, hardware markings, code, file names, logos, watermarks, UI, or tiny pseudo-text.

## Slide mapping and prompts

### s1_intro — `s1.count-and-mass-streams.img_1.png`

Caption: 同一台传感器会给出两类结果：一类是激光数出来的颗粒，另一类是依据假设推算出的总质量。

Prompt: Use case: scientific-educational. Asset type: course intro illustration. A 16:9 opened particulate sensor sends one coral stream of individual glowing count beads toward a tidy tray, and one lavender stream through a transparent inference lens toward a balanced mass bowl filled with abstract particles. Both outputs originate from the same sensor, making clear they are related but not identical. Deep violet scientific backdrop, friendly premium 3D clay plus clean vector hybrid, no readout displays. Avoid words, letters, numbers, labels, scales with marks, UI, logos, or watermarks.

### s2_bullet — `s2.counting-versus-weighing-beads.img_1.png`

Caption: 数颗粒是在点清有多少颗；质量浓度是在推断这些颗粒合起来有多重，两者回答的是不同问题。

Prompt: Use case: scientific-educational. Asset type: comparison illustration. A 16:9 tactile split scene without text. Left: a tray neatly holds many individual colored beads arranged into small size groups, suggesting counting. Right: similar beads collect in a smooth unmarked balance bowl with one softly glowing mass cloud, suggesting total weight. In the center, a compact sensor and transparent lens connect the two views. Deep violet background, coral bead accents, lavender inference path, sunflower highlights, premium friendly 3D clay plus clean vector hybrid. No words, letters, numbers, labels, scale ticks, UI, logos, or watermarks.

### s3_theory — `s3.no-scale-assumption-lens.img_1.png`

Caption: 传感器里没有秤；它先数闪光，再经过一枚装着粒径和密度假设的推断镜头，才得到质量浓度。

Prompt: Use case: scientific-educational. Asset type: theory mechanism illustration. A 16:9 clear story of a compact laser sensor with a small side detector producing a coral chain of count beads. The beads pass through a large transparent lavender inference lens containing abstract unmarked density and size shapes, then gather as a warm sunflower mass cloud in a plain bowl. Emphasize that no literal weighing scale sits inside the sensor. Deep violet / indigo background, friendly premium 3D clay plus vector hybrid. No words, letters, numbers, equations, labels, UI, logos, or watermarks.

### s4_bullet — `s4.humidity-swells-particles.img_1.png`

Caption: 潮湿时颗粒会吸水变胖、散射更亮；若固件仍按干燥颗粒的假设换算，质量浓度就容易被算高。

Prompt: Use case: scientific-educational. Asset type: concept illustration. A 16:9 two-stage moisture story without text. Left: small dry particles pass a coral laser beam with moderate sunflower glints. Right: the same particles have absorbed translucent lavender water droplets, become visibly larger, and make brighter scattering glows before entering the unchanged inference lens and mass bowl. Gentle cloud and dew motifs indicate humidity, but no rain labels or numerical values. Deep violet setting, friendly premium 3D clay plus clean vector hybrid. No text, letters, numbers, labels, UI, logos, or watermarks.

### s9_handson — `s9.sort-count-and-inference-workflow.img_1.png`

Caption: 找出两类字段、分成计数与浓度两栏、圈出区别、写下换算来历再讲给家人听，才能真正分清证据和推断。

Prompt: Use case: scientific-educational. Asset type: hands-on workflow illustration. A 16:9 five-stage tactile learning sequence with no writing: a blank data sheet represented by abstract rows of dots, two separate trays where coral count beads and lavender mass clouds are sorted, a transparent lens between them, a blank note card with a simple visual connection, and a young learner explaining the two object groups to a family silhouette. Link stages with a coral and lavender path. Deep violet background, premium friendly 3D clay plus clean vector hybrid. No words, letters, numbers, labels, UI, logos, or watermarks.

### s10_bullet — `s10.evidence-and-inference-bridge.img_1.png`

Caption: 原始计数更像直接证据，质量浓度则要跨过一座由假设搭成的桥；看清这座桥，才知道为什么后面需要校正。

Prompt: Use case: scientific-educational. Asset type: concept recap illustration. A 16:9 visual metaphor: on the left, individual coral count beads form a solid evidence path from a sensor; on the right, a warm mass cloud represents derived concentration. Between them, a translucent lavender bridge or lens is made of abstract density and size shapes, showing assumptions transform one into the other. In the far distance, a small gentle tuning glow suggests future calibration without icons or text. Deep violet background, friendly premium 3D clay plus clean vector hybrid. No words, letters, numbers, equations, labels, UI, logos, or watermarks.

### s11_outro — `s11.ready-for-calibration.img_1.png`

Caption: 学生把“计数是证据、浓度是推断”放进同一张理解图，也为下一步学习校正做好了准备。

Prompt: Use case: illustration-story. Asset type: lesson outro illustration. A 16:9 optimistic project-desk scene: a young learner places a compact sensor beside two elegant blank project cards—one with tactile coral beads and one with a smooth lavender mass cloud—joined by a transparent inference lens. A small warm tuning glow appears beyond the lens, hinting that the estimate can be improved. Deep violet / indigo setting, sunflower highlights, friendly premium 3D clay plus clean vector hybrid. No text, letters, numbers, labels, UI, logos, or watermarks.

## Batch record

- Status: published to production on 2026-08-07.
- Runtime mappings: all seven assets are mapped directly through `payload.images` in `M19-w0-module/slides.json`.
- SVG retirement: all seven corresponding `inline_svg` values are removed.
- Verification: local mapping and manifest validation passed; production payload reports seven image mappings and `legacy_svg_count: 0`; sampled image responses returned `200 image/png`.
