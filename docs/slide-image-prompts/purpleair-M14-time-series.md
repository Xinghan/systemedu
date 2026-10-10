# PurpleAir M14 — 24 小时时间序列图片清单

课程源：`purpleair-airquality-node/knodes/M14-w0-24h/slides.json`  
资产目录：`purpleair-airquality-node/knodes/M14-w0-24h/images/`

## Shared art direction

16:9 educational editorial illustration for 10–12 year olds. Warm off-white paper background; coral-orange focal color, slate-blue secondary color, restrained sunflower-yellow accent; friendly physical clocks, data beads, and graph objects with soft paper grain. Curves and peaks are abstract teaching patterns, never asserted as actual readings. Do not include words, letters, numbers, time labels, units, code, file names, logos, watermarks, UI chrome, or tiny pseudo-text.

## Slide mapping and prompts

### s1_intro — `s1.day-rhythm-line.img_1.png`

Caption: 当每个数据点带上真实时刻并排到一天的时间轴上，折线就能显出一天中高低变化的节奏。

Prompt: Use case: scientific-educational. Asset type: course intro illustration. A 16:9 warm editorial landscape of one complete day: a gentle dawn-to-daylight-to-evening color sweep surrounds a simple unlabeled horizontal timeline, where abstract data beads form a coral rise-and-fall line. A small sunrise, sun, and crescent moon act as purely pictorial time landmarks, and the highest and lowest points glow subtly without numbers. Make this an instructional pattern, not a real air-quality record. No text, letters, numbers, clock faces with numerals, units, code, logos, watermarks, or UI. Off-white paper texture, coral-orange focus, slate-blue secondary color, sunflower-yellow daylight accents.

### s2_bullet — `s2.index-vs-time-spacing.img_1.png`

Caption: 序号轴把每个点排得一样远，而时间轴会按真实间隔留出不同距离，才能看出一天发生的顺序。

Prompt: Use case: scientific-educational. Asset type: concept-card slide illustration. A 16:9 editorial split comparison. On the left, seven colored data beads sit at perfectly equal gaps on a slate-blue rail. On the right, the same seven beads sit along a time rail with visibly varied gaps, each paired with tiny unlabeled clock silhouettes whose hand positions differ. A coral thread connects the same sequence in both panels. No text, letters, numbers, clock numerals, labels, units, code, logos, watermarks, or UI. Warm off-white paper, coral-orange focus, slate-blue secondary color, sunflower-yellow accents.

### s3_theory — `s3.timestamp-bead-chain.img_1.png`

Caption: 时间序列把每个数据珠子都拴上一枚时刻牌，再按早到晚的顺序串起来。

Prompt: Use case: scientific-educational. Asset type: theory illustration. A 16:9 tactile editorial scene of seven colored measurement beads arranged on a slate-blue string. Each bead hangs from a small blank clock medallion with only hands, no numerals; the medallions progress visibly from early morning through daylight toward night by hand position and subtle sun-to-moon cues. A coral thread joins the sequence left to right. Keep data symbolic and no values. No text, letters, numbers, clock numerals, labels, units, code, logos, watermarks, or UI. Warm off-white paper texture, coral-orange focal beads, slate-blue secondary color, sunflower-yellow accents.

### s4_theory — `s4.equal-versus-real-time.img_1.png`

Caption: 同一串数据用均匀序号摆放和按真实间隔摆放会呈现不同节奏，后者才保留时间信息。

Prompt: Use case: scientific-educational. Asset type: theory illustration. A 16:9 clear editorial two-panel comparison of the exact same abstract seven-dot line. Left panel uses a perfectly even slate-blue grid with equal horizontal dot spacing; right panel uses an uncluttered time rail with uneven gaps between the same seven dots, including one clearly long gap and one short gap. Coral curves follow the dots in both panels and subtle unlabeled clock icons sit below the right rail. Do not use written labels, digits, time values, axes names, real data, code, logos, watermarks, or UI. Warm off-white paper, coral-orange focus, slate-blue secondary color, sunflower-yellow highlights.

### s9_handson — `s9.time-series-workflow.img_1.png`

Caption: 读出时间列、把它认成时间、摆上横轴、找出高低峰并保存成图，是完成 24 小时图的五步。

Prompt: Use case: scientific-educational. Asset type: hands-on workflow illustration. A 16:9 playful but clean sequence of five tactile cards connected by a coral path: a data sheet with a column of blank clock tokens, a tray where clock tokens align with data beads, a graph with beads placed along a varied-gap time rail, a graph with its highest and lowest dots gently highlighted, and a framed chart sheet sliding into a folder. All tags and charts must be blank and abstract. No text, letters, numbers, time labels, units, code, file names, logos, watermarks, UI, or checkmark symbols. Warm off-white paper, coral-orange focus, slate-blue secondary color, sunflower-yellow accents.

### s10_outro — `s10.day-story-graph.img_1.png`

Caption: 学生完成第一张带时间轴的 24 小时趋势图，能用一眼看见的高低变化讲出一天的故事。

Prompt: Use case: illustration-story. Asset type: lesson outro slide. A 16:9 hopeful editorial scene of a young learner placing an unlabeled time-series graph on a project board. The graph has a coral line with a clear peak and trough over a simple dawn-to-evening visual arc; its axis has no writing or numbers. A tray of abstract data beads and small blank clock medallions sits nearby to show where the graph came from. No text, letters, numbers, units, code, file names, logos, watermarks, or UI. Warm off-white paper texture, coral-orange focus, slate-blue secondary color, sunflower-yellow window-light accents.

## Batch record

- Status: published to production on 2026-08-07.
- Runtime mappings: all six assets are mapped directly through `payload.images` in `M14-w0-24h/slides.json`.
- SVG retirement: all six corresponding `inline_svg` values are removed.
- Verification: local mapping and manifest validation passed; production payload reports six image mappings and `legacy_svg_count: 0`; sampled image responses returned `200 image/png`.
