# PurpleAir M13 — CSV 与第一张数据图图片清单

课程源：`purpleair-airquality-node/knodes/M13-w0-csv/slides.json`  
资产目录：`purpleair-airquality-node/knodes/M13-w0-csv/images/`

## Shared art direction

16:9 educational editorial illustration for 10–12 year olds. Warm off-white paper background; coral-orange focal color, slate-blue secondary color, restrained sunflower-yellow accent; friendly physical data objects, axes, and graph lines with soft paper grain; modern Chinese science-textbook feel. Treat values as abstract colored tokens: these are visual explanations, never claimed measurements. Do not include words, letters, numbers, labels, units, code, file names, logos, watermarks, UI chrome, or tiny pseudo-text.

## Slide mapping and prompts

### s1_intro — `s1.data-to-line.img_1.png`

Caption: 一列抽象数据标记被依次放上坐标位置并连成折线，让变化趋势第一次一眼可见。

Prompt: Use case: scientific-educational. Asset type: course intro illustration. A 16:9 warm editorial scene of a tall slate-blue column of unlabeled colored data beads transforming across the page into a clean coral line that rises and dips through a simple unlabeled coordinate grid. Show a few beads lifting from the column to become points on the graph, then connecting. Make it clearly conceptual rather than a real measurement chart. No text, letters, numbers, labels, units, code, file names, logos, watermarks, or UI. Off-white paper texture, coral-orange focal line, slate-blue secondary color, sunflower-yellow accents.

### s2_bullet — `s2.table-point-line-trio.img_1.png`

Caption: 先从数据表读出一列，再把每项放成坐标点，最后连点成线，才能清楚看见趋势。

Prompt: Use case: scientific-educational. Asset type: concept-card slide illustration. A 16:9 editorial triptych connected left to right: a small unlabeled sheet with neat colored rows and one coral highlighted column, a simple grid receiving those colored items as individual dots, and a coral line joining the dots into a readable rise-and-dip shape. All data must be abstract beads with no real values, legends, or labels. No text, letters, numbers, units, code, logos, watermarks, UI, or pseudo-text. Warm off-white paper, coral-orange focus, slate-blue secondary color, sunflower-yellow highlights.

### s3_theory — `s3.csv-column-picker.img_1.png`

Caption: CSV 像一张按行记录、按列分类的数据表；读取时从中挑出一整列，装进程序可用的列表。

Prompt: Use case: scientific-educational. Asset type: theory illustration. A 16:9 editorial tabletop metaphor: an open paper data sheet contains an unlabeled grid of colored round tokens, with one vertical coral column gently lifted by a transparent ruler-like guide into a slate-blue tray of evenly spaced beads. Include several horizontal row bands to explain records, but no printed table headers or numbers. No text, letters, digits, file names, code, labels, logos, watermarks, or UI. Warm off-white paper texture, coral-orange selected column, slate-blue secondary color, sunflower-yellow accents.

### s4_theory — `s4.points-to-line.img_1.png`

Caption: 列表中的每个数据项对应一个坐标点，按顺序把相邻点连起来，就能得到数据变化的形状。

Prompt: Use case: scientific-educational. Asset type: theory illustration. A 16:9 clear editorial explanation of plotting without labels: a slim slate-blue tray holds a sequence of colored data beads at left; curved coral guide paths carry them one by one onto successive positions of a blank coordinate grid at right. The placed dots connect into one clean undulating coral polyline. Use arrows and motion paths only, no digits, axes labels, legends, code, real readings, logos, watermarks, or UI. Warm off-white paper texture, coral-orange focal line, slate-blue secondary color, sunflower-yellow point highlights.

### s9_handson — `s9.first-plot-workflow.img_1.png`

Caption: 从准备工具、挑出数据列、画成折线、补足说明到保存成图，五个物理步骤串成第一次绘图流程。

Prompt: Use case: scientific-educational. Asset type: hands-on workflow illustration. A 16:9 playful but clean editorial sequence of five tactile cards connected by a single coral path: a small tool kit, a data sheet with one abstract column lifted out, a grid with dots joined into a line, a blank title-tag and two blank axis-tag tokens being placed around it, and a framed finished graph sheet sliding into a folder. Keep tags completely blank and the chart unlabeled; use abstract data tokens only. No text, letters, numbers, code, file names, logos, watermarks, UI, or checkmark symbols. Warm off-white paper, coral-orange focus, slate-blue secondary color, sunflower-yellow accents.

### s10_outro — `s10.first-data-graph.img_1.png`

Caption: 学生把一串原始数据变成自己的第一张趋势图，终于能用图形讲出数据正在怎样变化。

Prompt: Use case: illustration-story. Asset type: lesson outro slide. A 16:9 hopeful editorial scene of a young learner pinning a clean unlabeled graph sheet to a project board. The sheet contains only a coral rise-and-dip line with simple unlabeled dots and blank axes; a nearby slate-blue tray holds the original abstract data beads, making the transformation visible. Celebrate insight without claiming the values are real. No text, letters, numbers, labels, units, code, file names, logos, watermarks, or UI. Warm off-white paper texture, coral-orange focus, slate-blue secondary color, sunflower-yellow window-light accents.

## Batch record

- Status: published to production on 2026-08-06.
- Runtime mappings: all six assets are mapped directly through `payload.images` in `M13-w0-csv/slides.json`.
- SVG retirement: all six corresponding `inline_svg` values are removed.
- Verification: local mapping and manifest validation passed; production payload reports six image mappings and `legacy_svg_count: 0`; sampled image responses returned `200 image/png`.
