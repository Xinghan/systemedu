# PurpleAir M15 — 冗余传感器与互校图片清单

课程源：`purpleair-airquality-node/knodes/M15-w0-pms7003-mq-135/slides.json`  
资产目录：`purpleair-airquality-node/knodes/M15-w0-pms7003-mq-135/images/`

## Shared art direction

16:9 educational editorial illustration for 10–12 year olds. Warm off-white paper background; coral-orange focal color, violet/slate-blue secondary colors, restrained sunflower-yellow accent; friendly, technically legible sensor modules and data paths with soft paper grain. All curves and values are abstract teaching signals, never real measurements. Do not include words, letters, numbers, hardware pin labels, code, file names, logos, watermarks, UI chrome, or tiny pseudo-text.

## Slide mapping and prompts

### s1_intro — `s1.dual-pm-crosscheck.img_1.png`

Caption: 两个颗粒物传感器同时吸入同一股空气，送出贴合的两条趋势线，让彼此成为可靠的参照。

Prompt: Use case: scientific-educational. Asset type: course intro illustration. A 16:9 warm editorial scene of a gentle cloud of abstract particles splitting evenly into two similar particulate-sensor modules, each feeding a Pi board. Above them, two unlabeled coral-and-violet trend lines run nearly together across a blank grid, visibly cross-checking one another. Add a small third gas-sensor module quietly beside the pair to suggest an extra sensing dimension. No text, letters, numbers, labels, real readings, code, logos, watermarks, or UI. Off-white paper texture, coral-orange focus, violet and slate-blue secondary colors, sunflower-yellow accents.

### s2_bullet — `s2.single-versus-paired-sensors.img_1.png`

Caption: 单个传感器悄悄偏移时很难察觉；有了第二个传感器，曲线拉开就能立刻发现异常。

Prompt: Use case: scientific-educational. Asset type: concept-card slide illustration. A 16:9 editorial split comparison. Left panel: one lone sensor sends one unlabeled coral line that drifts upward with no reference. Right panel: two matching sensor modules receive the same particle cloud and their two abstract lines begin close together then visibly separate; a soft sunflower alert glow appears at their growing gap. Use no warning text or real values. No text, letters, numbers, labels, units, code, logos, watermarks, or UI. Warm off-white paper, coral-orange focus, violet/slate-blue secondary color, sunflower-yellow alert accent.

### s3_theory — `s3.backup-and-crosscheck.img_1.png`

Caption: 冗余同时带来两层保护：一个传感器失效时另一个仍能工作，两条读数不一致时又能及时暴露问题。

Prompt: Use case: scientific-educational. Asset type: theory illustration. A 16:9 tactile editorial two-part explanation. Left, twin particulate sensor modules feed a Pi; one module is dimmed while the other continues to deliver a steady stream of beads. Right, both modules are active and their paired bead streams pass through a comparison lens that emits a calm glow when aligned and an amber glow when separated. Keep all modules unlabeled and all data abstract. No text, letters, numbers, labels, code, logos, watermarks, UI, or literal error symbols. Warm off-white paper texture, coral-orange focus, violet and slate-blue secondary colors, sunflower-yellow accents.

### s6_kit — `s6.three-sensor-kit.img_1.png`

Caption: 两个颗粒物传感器、一个气体传感器和一块模数转换板共同接入 Pi，形成三路同步采样的硬件组合。

Prompt: Use case: scientific-educational. Asset type: hardware kit overview illustration. A 16:9 technically legible top-down editorial layout: a Pi board in the center, a primary particulate sensor and matching backup particulate sensor on the left, a compact gas sensor module on the upper right, and a small analog-to-digital converter board between the gas sensor and Pi. Show neatly routed colored jumper wires: two sensor data paths and one gas path passing through the converter. Use shape and color only, no labels, letters, numbers, connector text, code, logos, watermarks, literal wiring diagram typography, or UI. Warm off-white paper, coral-orange focus, violet/slate-blue secondary colors, sunflower-yellow details.

### s9_handson — `s9.three-sensor-workflow.img_1.png`

Caption: 接入备份颗粒物、接入气体通道、同时读取三路、比较两条 PM，再把它们装进同一条记录，是可靠采样的五步。

Prompt: Use case: scientific-educational. Asset type: hands-on workflow illustration. A 16:9 playful but precise sequence of five tactile cards connected by a coral path: a second particle-sensor module joins a Pi, a gas sensor connects through a small converter board, three streams of colored beads arrive together, two particulate bead streams pass through a comparison lens, and all three streams settle into one blank record sheet. No text, letters, numbers, labels, real data, code, file names, logos, watermarks, UI, or checkmark symbols. Warm off-white paper, coral-orange focus, violet/slate-blue secondary color, sunflower-yellow accents.

### s10_outro — `s10.reliable-node-online.img_1.png`

Caption: 三个传感器同时采样、两路颗粒物相互印证，让空气节点第一次具备了发现故障并持续工作的可靠性。

Prompt: Use case: illustration-story. Asset type: lesson outro slide. A 16:9 hopeful editorial project-desk scene: a Pi stands at the center of a finished small sensor setup with twin matching particle-sensor modules and one gas sensor connected through a tiny converter. Two parallel data streams remain visibly close as they enter the Pi, while a third stream joins them; three gentle confirmation glows make the system feel dependable. A learner observes proudly in the background without touching wires. No text, letters, numbers, labels, real readings, code, file names, logos, watermarks, or UI. Warm off-white paper texture, coral-orange focus, violet/slate-blue secondary colors, sunflower-yellow confirmation glow.

## Batch record

- Status: published to production on 2026-08-07.
- Runtime mappings: all six assets are mapped directly through `payload.images` in `M15-w0-pms7003-mq-135/slides.json`.
- SVG retirement: all six corresponding `inline_svg` values are removed.
- Verification: local mapping and manifest validation passed; production payload reports six image mappings and `legacy_svg_count: 0`; sampled image responses returned `200 image/png`.
