# PurpleAir M06 — AQI 分段插值图片清单

课程源：`purpleair-airquality-node/knodes/M06-w0-aqi/slides.json`  
资产目录：`purpleair-airquality-node/knodes/M06-w0-aqi/images/`

## Shared art direction

16:9 educational editorial illustration for 10–12 year olds. Warm off-white paper background; coral-orange focal color, slate-blue secondary color, restrained sunflower-yellow accent; friendly simplified scientific and mathematical objects with soft grain and depth; modern Chinese science-textbook feel. Do not include words, letters, numbers, equations, logos, watermarks, UI chrome, or tiny unreadable labels. Leave clear visual breathing room for surrounding slide text.

## Slide mapping and prompts

### s1_intro — `s1.aqi-translation.img_1.png`

Caption: 传感器读到的颗粒浓度，沿着分段折线被翻译成人人能读懂的空气分数。

Prompt: Use case: scientific-educational. Asset type: course intro illustration. A 16:9 warm editorial scene of a small air sensor sending a coral measurement bead into a large clean segmented rising line, which transforms into a simple color-banded air-quality dial. Make the line visibly bend at several breakpoints to explain translation by segments; show no numerical scale. The visual should feel like looking inside the calculation behind an air-quality app. No text, letters, numbers, equations, logos, watermarks, or UI. Off-white paper texture, coral-orange focus, slate-blue secondary color, soft sunflower-yellow accents.

### s2_bullet — `s2.five-checkpoints.img_1.png`

Caption: 从浓度到 AQI 的计算，像依次通过定位、量进度和搬运比例的五个检查点。

Prompt: Use case: scientific-educational. Asset type: concept-card slide illustration. A 16:9 clear editorial board-game path with five distinct physical checkpoints: an air sample vial, a segmented lookup shelf, a short progress rail, a matching second rail, and a glowing final air-quality gauge. A learner's small marker travels through them in order. Communicate a repeatable calculation workflow without written labels, numbers, equations, logos, watermarks, or literal interface widgets. Warm off-white paper, coral-orange focal marker, slate-blue structures, sunflower-yellow highlights.

### s3_theory_piecewise — `s3.piecewise-journey.img_1.png`

Caption: AQI 关系由几段斜率不同的小直线接成，先定位所在的一段再计算。

Prompt: Use case: scientific-educational. Asset type: theory illustration. A 16:9 editorial math-and-science scene: a friendly tiny taxi travels along a clean slate-blue broken line with three visibly different slopes, each segment separated by a coral corner marker. Beneath the path are distinct colored roadway zones, making it obvious that each stretch follows a different rule. Add a subtle air-sensor measurement bead entering one chosen segment. No text, letters, numbers, formulas, labels, logos, watermarks, or UI. Warm off-white textured paper, coral-orange focal points, slate-blue line, sunflower-yellow accents.

### s4_theory_interp — `s4.synced-progress.img_1.png`

Caption: 浓度和 AQI 在各自的一段里同步走过相同的比例，两个滑块保持对齐。

Prompt: Use case: scientific-educational. Asset type: theory diagram illustration. A 16:9 clean editorial composition of two parallel physical progress rails of equal length. A coral slider on the upper concentration rail and a sunflower slider on the lower air-quality rail stop at exactly the same proportional position, connected by one vertical guide. Show start and end caps but no numerals or labels; a small translucent measuring ruler suggests interpolation. No text, equations, logos, watermarks, UI, or chart labels. Warm off-white paper, coral-orange focus, slate-blue rails, sunflower-yellow accents.

### s5_anim — `s5.interpolation-build.img_1.png`

Caption: 一个测量点先落入正确的折线段，再用同步进度条插出对应的 AQI 位置。

Prompt: Use case: scientific-educational. Asset type: animation cover illustration. A 16:9 left-to-right editorial sequence on one canvas: a segmented rising graph with one coral measurement point selected, a vertical guide descending to a pair of aligned progress rails, then a glowing final point appearing on the matching air-quality side. Use arrows and pure shapes only, not text or math symbols. The stages should be visually easy to animate in the learner's mind. No letters, numbers, formulas, labels, logos, watermarks, or UI. Off-white paper texture, coral-orange, slate-blue, and sunflower-yellow palette.

### s6_game — `s6.aqi-explorer.img_1.png`

Caption: 学生拖动浓度滑块，让光点沿分段折线移动并挑战关键 AQI 位置。

Prompt: Use case: scientific-educational. Asset type: interactive game cover. A 16:9 playful editorial tabletop scene: a learner's hand moves a coral slider along a physical rail; a linked glowing point travels on a raised segmented slate-blue graph. Include two celebratory glowing target rings on the graph, but no numbers, words, literal screen, UI widgets, or labels. Make the linkage between slider and point instantly obvious. Warm off-white paper, coral-orange focal color, slate-blue secondary color, sunflower-yellow accents.

### s_extra1 — `s_extra1.aqi-translator.img_1.png`

Caption: AQI 像一位翻译官，把专业浓度读数转换成大家都能理解的空气分数。

Prompt: Use case: scientific-educational. Asset type: explanatory concept illustration. A 16:9 warm editorial metaphor: a small air sensor and a jar of faint particles sit on the left; between them and the right is a friendly abstract translation machine made of a segmented folding path; on the right it produces a universally readable large color gauge with no marks or text. Emphasize that several linked segments do the translating. No letters, numbers, equations, logos, watermarks, or UI. Off-white paper texture, coral-orange focus, slate-blue secondary color, restrained sunflower-yellow accent.

### s9_outro — `s9.aqi-pencil-outro.img_1.png`

Caption: 学生用铅笔沿分段关系找到自己的空气分数，理解了每个空气应用背后的计算。

Prompt: Use case: illustration-story. Asset type: lesson outro slide. A 16:9 hopeful editorial scene of a young learner at a desk using a pencil and straightedge to trace from an air-sensor reading to a selected point on a clean multi-segment line, then to a simple glowing gauge. The student looks capable and curious; include warm window light and project notebook texture. No letters, numerals, equations, labels, logos, watermarks, or UI. Warm off-white paper texture, coral-orange focus, slate-blue secondary color, sunflower-yellow accents.

## Batch record

- Status: published to production on 2026-07-31.
- Runtime mappings: all eight assets are mapped directly through `payload.images` in `M06-w0-aqi/slides.json`.
- SVG retirement: all eight corresponding `inline_svg` values are removed.
- Verification: local mapping and manifest validation passed; production payload reports 8 image mappings and `legacy_svg_count: 0`; sampled image responses returned `200 image/png`.
