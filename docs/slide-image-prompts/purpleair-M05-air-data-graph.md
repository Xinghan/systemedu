# PurpleAir M05 — 空气数据图图片清单

课程源：`purpleair-airquality-node/knodes/M05-w0-aqi/slides.json`  
资产目录：`purpleair-airquality-node/knodes/M05-w0-aqi/images/`

## Shared art direction

16:9 educational editorial illustration for 10–12 year olds. Warm off-white paper background; coral-orange focal color, slate-blue secondary color, restrained sunflower-yellow accent; friendly simplified scientific objects with soft grain and depth; modern Chinese science-textbook feel. Do not include words, letters, numbers, logos, watermarks, UI chrome, or tiny unreadable labels. Leave clear visual breathing room for surrounding slide text.

## Slide mapping and prompts

### s1 — `s1.data-line.img_1.png`

Caption: 空气浓度和 AQI 成对落在坐标纸上，长成一条会说话的趋势线。

Prompt: Use case: scientific-educational. Asset type: course intro slide. A 16:9 warm editorial illustration of a large clean coordinate grid growing out of a learner's project notebook. Several coral and sunflower data points rise together into a simple slate-blue diagonal trend line; nearby are a small air sensor and faint particles, clearly connecting the graph to air quality. No labels, axis numbers, letters, equations, logos, watermarks, or UI. Off-white paper texture, coral-orange focal color, slate-blue secondary color, soft sunflower-yellow accents.

### s2 — `s2.two-values-one-point.img_1.png`

Caption: 横向和纵向的两条投影线一起确定一个数据点的位置。

Prompt: Use case: scientific-educational. Asset type: concept-card slide illustration. A 16:9 clear editorial top-down scene of a square coordinate grid with one glowing data point. A coral horizontal guide and a slate-blue vertical guide meet at the point; a physical pair of theater-seat-like tokens at the grid edge suggests that two positions identify one location. Avoid text, numbers, axis labels, letters, logos, watermarks, and UI. Warm off-white paper, coral-orange focus, slate-blue secondary color, sunflower-yellow accent.

### s3 — `s3.coordinate-seat.img_1.png`

Caption: 坐标系像找座位，先横向再纵向才能准确找到一个位置。

Prompt: Use case: scientific-educational. Asset type: theory illustration. A 16:9 friendly editorial illustration blending a small theater seating plan with a coordinate grid: a young learner follows one row direction then one seat direction to a single glowing empty chair, which visually transforms into a graph point on a clean grid. Emphasize two independent directions and even spacing without any written signs, labels, numbers, logos, watermarks, or UI. Warm off-white paper texture, coral-orange and slate-blue palette, sunflower-yellow accents.

### s4 — `s4.linear-slope.img_1.png`

Caption: 每次横向增加相同一步、纵向也增加相同步数时，点会排成直线。

Prompt: Use case: scientific-educational. Asset type: theory diagram illustration. A 16:9 editorial science-math scene of evenly spaced data points climbing a straight slate-blue diagonal line over a blank coordinate grid. A small right-angle step triangle shows the same horizontal and vertical movement repeating; beside it, equal apple baskets subtly illustrate a steady repeated increase. No equations, words, numerals, labels, logos, watermarks, or UI. Warm off-white paper, coral-orange focal points, slate-blue line, restrained sunflower-yellow highlights.

### s5 — `s5.graph-build.img_1.png`

Caption: 空白坐标系先出现数据点，再连成一条可以读出规律的直线。

Prompt: Use case: scientific-educational. Asset type: animation cover illustration. A 16:9 left-to-right editorial sequence on one canvas: an empty coordinate grid, then several bright points appearing one by one, then a clean diagonal line joining them, with a small slope triangle at the end. A learner's hand holds a pencil just outside the composition, suggesting construction in progress. No writing, numerals, axis labels, logos, watermarks, or interface chrome. Warm off-white textured paper, coral-orange, slate-blue, and sunflower-yellow palette.

### s6 — `s6.plotter-game.img_1.png`

Caption: 学生把数据点拖到正确位置，再调出穿过它们的规律直线。

Prompt: Use case: scientific-educational. Asset type: interactive game cover. A 16:9 playful editorial illustration of two hands placing colorful round point tokens onto a blank coordinate board; a transparent ruler-like straight line pivots until it passes through the points. Include simple physical controls like a round dial, but not a literal screen or user interface. Use no words, numerals, labels, logos, watermarks, or UI widgets. Warm off-white paper, coral-orange focus, slate-blue secondary color, sunflower-yellow accents.

### s_extra1 — `s_extra1.numbers-to-line.img_1.png`

Caption: 一串分散的读数经过坐标和连线，变成一眼可读的趋势。

Prompt: Use case: scientific-educational. Asset type: concept illustration. A 16:9 editorial transformation scene: on the left, a loose trail of unlabeled colored measurement beads; in the center, the beads become evenly positioned points on a clean grid; on the right, they connect into one expressive rising and falling slate-blue line. An air sensor sits subtly nearby. No text, numeric marks, logos, watermarks, or UI. Warm off-white paper, coral-orange focal color, slate-blue secondary color, sunflower-yellow accents.

### s9 — `s9.data-eyes-outro.img_1.png`

Caption: 学生用坐标纸画出第一条空气数据线，获得看懂数据的眼睛。

Prompt: Use case: illustration-story. Asset type: lesson outro slide. A 16:9 hopeful editorial scene of a young learner at a desk drawing a clean diagonal trend line through colorful plotted points on large graph paper. A small air sensor, pencil, and warm window light make it feel connected to real measurements; the child looks pleased at recognizing a pattern. No letters, numbers, labels, logos, watermarks, or UI. Warm off-white paper texture, coral-orange focus, slate-blue secondary color, sunflower-yellow accents.

## Batch record

- Status: published to production on 2026-07-30.
- Runtime mappings: all eight assets are mapped directly through `payload.images` in `M05-w0-aqi/slides.json`.
- SVG retirement: all eight corresponding `inline_svg` values are removed.
- Verification: local mapping and manifest validation passed; production payload reports 8 image mappings and `legacy_svg_count: 0`; sampled image responses returned `200 image/png`.
