# PurpleAir M18 — 激光散射与颗粒计数图片清单

课程源：`purpleair-airquality-node/knodes/M18-w0-pms5003/slides.json`  
资产目录：`purpleair-airquality-node/knodes/M18-w0-pms5003/images/`

## Shared art direction

16:9 premium educational editorial illustration for 10–12 year olds. Friendly 3D clay plus clean vector hybrid, deep violet / indigo scientific background, fine coral-red laser beams, lavender airflow, restrained sunflower-yellow scattering glows, rounded technically legible sensor modules, generous negative space. Light and particle patterns are abstract teaching cues, not real readings. Do not include words, letters, numbers, units, labels, equations, hardware markings, code, file names, logos, watermarks, UI, or tiny pseudo-text.

## Slide mapping and prompts

### s1_intro — `s1.laser-counts-particles.img_1.png`

Caption: 空气里的微小颗粒穿过细激光束时会闪出散射光，侧面的探测器就能把这些闪光一颗颗记下来。

Prompt: Use case: scientific-educational. Asset type: course intro illustration. A 16:9 dramatic cutaway of a compact particulate sensor as a friendly black box opened to reveal a fine coral-red laser beam crossing a dark chamber. A soft lavender airflow carries tiny glowing particles through the beam; each particle creates a sunflower scattering sparkle that reaches a round side detector. Keep the circuit and enclosure rounded and technically readable, with no data readouts. Deep violet scientific background, premium 3D clay plus clean vector hybrid, no text or labels.

### s2_bullet — `s2.dust-in-light-beam.img_1.png`

Caption: 光碰到小颗粒会向四周散开，一部分散射光飞进探测器，让原本看不见的灰尘露出痕迹。

Prompt: Use case: scientific-educational. Asset type: concept illustration. A 16:9 dark-room teaching scene: a clean narrow coral-red light beam crosses a chamber while several tiny dust-like particles drift through it. Each particle gently sends radial sunflower glints in many directions; a single round detector at one side catches only the sideways glints, while the straight beam passes onward. Include a small abstract red laser source and soft lavender airflow ribbon. Deep violet background, friendly premium 3D clay plus clean vector hybrid. No words, letters, numbers, arrows, labels, UI, logos, or watermarks.

### s3_theory — `s3.airflow-laser-detector-chain.img_1.png`

Caption: 风扇把空气送过激光，颗粒把光散开，侧面探测器收到一次闪光就留下一个计数脉冲。

Prompt: Use case: scientific-educational. Asset type: theory mechanism illustration. A 16:9 transparent sensor chamber with three visibly distinct physical elements: a small fan drawing lavender airflow across the chamber, a thin coral-red laser beam crossing the flow, and a round side photodetector angled away from the direct beam. A sequence of particles passing one at a time creates small sunflower flashes that enter the detector; a gentle bead-like pulse trail exits toward a tiny blank processor block. Deep violet / indigo background, friendly premium 3D clay plus clean vector hybrid. No text, letters, numerals, labels, UI, code, logos, or watermarks.

### s4_theory — `s4.scattering-sweet-spot.img_1.png`

Caption: 颗粒和光波的尺度接近时最容易把光散开；太小或太大时，散射都没有那么强。

Prompt: Use case: scientific-educational. Asset type: theory comparison illustration. A 16:9 tactile three-part visual with no words. Left: a tiny speck meets a broad soft wave and produces only a faint glint. Center: a particle about the same visual scale as repeating coral light-wave crests produces the brightest sunflower scattering halo. Right: a much larger rounded particle blocks and redirects the beam with a different broad reflection. Keep the three cases differentiated by shape, scale, and glow only; no axes, numbers, or formulas. Deep violet background, premium 3D clay plus clean vector hybrid, no text, labels, UI, logos, or watermarks.

### s7_bullet — `s7.sensor-light-path-cutaway.img_1.png`

Caption: 传感器里面有激光源、吸气风扇和偏在一侧的探测器；探测器专门等着接收散射光而不是直射光。

Prompt: Use case: scientific-educational. Asset type: hardware cutaway illustration. A 16:9 clean layered cutaway of a compact particulate sensor module: outer shell partly lifted, inside a small coral laser emitter sends a straight beam across a dark scattering chamber; a tiny fan produces a lavender one-way air path carrying particles across it; a round detector sits at an offset side angle catching sunflower scattered glints but not the straight laser beam. Show visible components and routes without labels or arrows. Deep violet lab background, friendly 3D clay plus clean vector hybrid, no text, code, logo, or watermark.

### s9_handson — `s9.draw-the-principle-workflow.img_1.png`

Caption: 从读资料到画出气流、激光、散射、计数和最亮的匹配尺度，五步就能讲清这只盒子如何看见颗粒。

Prompt: Use case: scientific-educational. Asset type: hands-on workflow illustration. A 16:9 sequence of five tactile visual stages without written arrows: a blank reference card with a simple sensor silhouette, a chamber drawing with lavender airflow, a coral laser crossing it, sunflower scattering glints reaching a side detector and becoming bead-like pulses, and a final center particle with the strongest glow among three abstract sizes. Link stages with a gentle coral ribbon. Deep violet background, premium friendly 3D clay plus clean vector hybrid. No words, letters, numbers, labels, equations, UI, logos, or watermarks.

### s10_outro — `s10.opened-sensor-black-box.img_1.png`

Caption: 学生打开了传感器的黑盒：每次小小的散射闪光，都有了从空气到数字的物理来历。

Prompt: Use case: illustration-story. Asset type: lesson outro illustration. A 16:9 optimistic maker-desk scene: a young learner looks proudly at an opened compact sensor, where a safe fine coral-red light beam and tiny sunflower particle glints illuminate the dark chamber. Lavender air gently passes through; a subtle string of luminous counting beads leads outward to a blank project board. Deep violet / indigo setting with warm sunflower highlights, friendly premium 3D clay plus clean vector hybrid, no text, labels, numbers, UI, logos, or watermarks.

## Batch record

- Status: published to production on 2026-08-07.
- Runtime mappings: all seven assets are mapped directly through `payload.images` in `M18-w0-pms5003/slides.json`.
- SVG retirement: all seven corresponding `inline_svg` values are removed.
- Verification: local mapping and manifest validation passed; production payload reports seven image mappings and `legacy_svg_count: 0`; sampled image responses returned `200 image/png`.
