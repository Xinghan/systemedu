# PurpleAir M16 — 会呼吸的防水盒与选址图片清单

课程源：`purpleair-airquality-node/knodes/M16-w0-module/slides.json`  
资产目录：`purpleair-airquality-node/knodes/M16-w0-module/images/`

## Shared art direction

16:9 premium educational editorial illustration for 10–12 year olds. Friendly 3D clay plus clean vector hybrid, deep violet / indigo background, coral and lavender airflow paths, restrained sunflower-yellow highlights, rounded technically legible sensor modules, generous negative space. All signals are abstract teaching cues, never real measurements. Do not include words, letters, numbers, labels, hardware pin labels, code, file names, logos, watermarks, UI, or tiny pseudo-text.

## Slide mapping and prompts

### s1_intro — `s1.breathing-rainproof-box.img_1.png`

Caption: 朝下的进气口和挡板让空气能拐弯进入盒子，而落下的雨水被挡在外面。

Prompt: Use case: scientific-educational. Asset type: course intro illustration. A 16:9 hopeful cutaway scene of a small weatherproof sensor enclosure mounted outside a window. Soft rain falls from above; a louvered intake points downward under a rounded baffle. Coral and lavender airflow ribbons bend upward through the sheltered opening toward a compact sensor inside, while rain drops fall past the opening and the electronics remain dry. Deep violet setting, friendly premium 3D clay plus clean vector hybrid, rounded forms, no text or labels.

### s2_bullet — `s2.sealed-versus-flooded-box.img_1.png`

Caption: 盒子封得太死时空气进不来，洞开得太大时雨水会直扑电路；两种极端都不合格。

Prompt: Use case: scientific-educational. Asset type: concept comparison illustration. A 16:9 side-by-side visual without divider text. Left, a completely sealed enclosure holds still dim air bubbles around its sensor, with no incoming flow. Right, an enclosure with oversized open holes receives visible falling rain droplets that stop outside a safely stylized internal board. In the middle, a small neutral balance of protected airflow hints at the needed middle ground. Deep violet background, coral and lavender flow, sunflower accent, friendly 3D clay plus vector hybrid. No words, letters, numbers, warning symbols, labels, UI, logos, or watermarks.

### s3_theory_tradeoff — `s3.air-turns-rain-falls.img_1.png`

Caption: 空气可以绕着挡板拐弯进入，雨水受重力向下落；同一个朝下开口因此既通风又防雨。

Prompt: Use case: scientific-educational. Asset type: theory cutaway illustration. A 16:9 clear enlarged cross-section of a weatherproof sensor box with a downward-facing intake and curved inner baffle. Show soft coral and lavender air ribbons naturally turning around the baffle into the sensor chamber; show rain droplets falling vertically down outside and unable to make the turn. A small balanced pair of airflow and rain motifs reinforce engineering trade-off without literal scales or text. Deep violet / indigo palette, rounded premium 3D clay and clean vector hybrid, no text, labels, numerical markings, arrows, UI, logos, or watermarks.

### s6_kit — `s6.weatherproof-test-kit.img_1.png`

Caption: 防水盒、挡板、风扇、喷壶和产生颗粒的香一起组成验证“空气进得来、雨进不来”的测试套件。

Prompt: Use case: scientific-educational. Asset type: hardware kit overview illustration. A 16:9 tidy maker tabletop: a small weatherproof enclosure with downward sheltered intake and removable baffle, a compact desk fan blowing a soft lavender airflow ribbon, a plain unlabeled hand spray bottle making a gentle rain mist, and a small incense-like source creating abstract coral particle wisps. Arrange components around a compact sensor module, with no real flame emphasized. Deep violet background, friendly premium 3D clay plus vector hybrid, clean separated objects, no text, labels, markings, UI, logos, or watermarks.

### s9_theory_siting — `s9.good-site-versus-microclimates.img_1.png`

Caption: 节点只会测它身边那一小团空气；避开热风、直晒和贴墙死角，才能让数据代表真正想观察的环境。

Prompt: Use case: scientific-educational. Asset type: theory location illustration. A 16:9 outdoor building-side scene with three pictorial placement choices. Center, the good sensor enclosure is shaded, elevated, open to gentle moving air and mounted away from obstacles. Around it, misleading micro-environments appear visually: one device too near a warm exhaust plume, one in harsh direct sun, and one trapped close against a wall with stagnant bubbles. Make the appropriate central placement glow softly without checkmarks or text. Deep violet landscape with warm coral heat cue, lavender airflow, sunflower sun, friendly 3D clay plus vector hybrid. No words, letters, numbers, labels, UI, logos, or watermarks.

### s10_handson — `s10.enclosure-test-workflow.img_1.png`

Caption: 做盒、装上传感器、吹风测气流、喷水测防雨、最后选好位置，五步让节点准备挂到窗外。

Prompt: Use case: scientific-educational. Asset type: hands-on workflow illustration. A 16:9 sequence of five clear tactile scenes arranged left to right without borders or written arrows: assemble a small box with a downward baffle, place a sensor inside, fan airflow carrying particle wisps into the intake, spray mist staying outside while the interior remains dry, and mount the completed unit at an airy shaded wall position. Use connected coral flow and lavender air paths to suggest order. Deep violet background, friendly premium 3D clay plus clean vector hybrid, no text, letters, numbers, symbols, UI, logos, or watermarks.

### s11_outro — `s11.window-ready-node.img_1.png`

Caption: 通过气流和喷水测试的节点，终于有了能在窗外长期呼吸、持续记录的身体。

Prompt: Use case: illustration-story. Asset type: lesson outro illustration. A 16:9 optimistic exterior window scene at gentle twilight: a finished compact sensor enclosure hangs securely outside, its downward intake protected from a light passing shower while a quiet lavender airflow ribbon enters. Inside the room, a young learner is softly visible admiring the successful installation. The unit looks dry, stable, and ready for long observation. Deep violet / indigo setting, coral and lavender accents, premium friendly 3D clay plus vector hybrid, no text, labels, numbers, UI, logos, or watermarks.

## Batch record

- Status: published to production on 2026-08-07.
- Runtime mappings: all seven assets are mapped directly through `payload.images` in `M16-w0-module/slides.json`.
- SVG retirement: all seven corresponding `inline_svg` values are removed.
- Verification: local mapping and manifest validation passed; production payload reports seven image mappings and `legacy_svg_count: 0`; sampled image responses returned `200 image/png`.
