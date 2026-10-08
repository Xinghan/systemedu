# PurpleAir M31「拿官方站验证自己的 AQI」— 逐图 Prompt

- 项目 slug：`purpleair-airquality-node` ｜ 节点：`M31-w0-airnow`
- 共 8 张必做：不为已有动画、视频或互动资源额外生成静态封面。
- 统一视觉：16:9、暖象牙纸、水彩与水粉科学教材插图、细铅笔描线、自然木桌面；石板蓝为结构色、珊瑚橙为重点、赭黄少量提示、蓝色数据珠。拒绝写实照片、塑料 3D、扁平矢量、任何文字/代码/数字/Logo/水印/UI。

| slide_id | filename | caption |
|---|---|---|
| s1_intro | `s1.official-compare.v2.webp` | 孩子把自己节点算出的读数与官方站的独立读数并排，开始一次诚实的对照。 |
| s2_bullet | `s2.validation-watershed.v2.webp` | 前期的传感、算法与仪表盘汇向一次官方对照，成为后续真实发布的可信地基。 |
| s3_theory_loop | `s3.end-to-end-check.v2.webp` | 传感、计算和展示组成一条链，最终结果与权威参照相对照，一次检查覆盖整条链。 |
| s4_bullet2 | `s4.pipeline-total-answer.v2.webp` | 五个连续小站都把数据珠送向同一个总出口，出口的对照牌检查整个流程。 |
| s5_theory_agree | `s5.close-not-identical.v2.webp` | 两条不完全重合的读数轨迹落在同一颜色判断带，说明接近并不等于复制。 |
| s6_bullet3 | `s6.difference-clues.v2.webp` | 空间、时间与仪器差异像三张线索卡，帮助孩子解释差距而不是篡改结果。 |
| s8_game | `s8.agreement-explorer.v2.webp` | 孩子移动时段滑块，看到早高峰两条轨迹分开、深夜重新贴近。 |
| s11_outro | `s11.check-not-calibrate.v2.webp` | 先用官方参照做不动手的体检，校准工具安静收在以后才会打开的工具盒中。 |

## Prompts

### s1 — 自己的数与官方数第一次并排

Use case: scientific-educational. Asset type: course intro illustration. On a warm ivory paper workbench, a child gently places two separate rounded result tiles side by side: the left tile is fed by their compact weatherproof air-quality node and a small slate-blue processing path, while the right tile is fed by a tall, unbranded professional reference station. Both tiles hold a single close-but-not-identical blue data bead and sit inside one calm green-blue agreement frame. Keep the two sources visibly independent and the comparison honest. No text, digits, screen UI, charts, logos, labels, or watermarks. Use the shared visual contract.

### s2 — 验证是项目的分水岭

Use case: scientific-educational. Asset type: concept illustration. A child’s completed miniature path of physical learning objects—sensor, data ribbon, small weighting machine, and simple round gauge—travels from left toward one central comparison stand. On the comparison stand, the child’s final blue bead is checked beside a separate bead arriving from a dignified unbranded reference-station tower. Beyond the stand, the now-trusted path becomes a sturdy slate-blue foundation leading toward a small weatherproof outdoor node and an open evidence board. Convey preparation becoming credible real-world work, without text, numbers, code, UI, logos, or watermarks. Use the shared visual contract.

### s3 — 端到端闭环验证

Use case: scientific-educational. Asset type: theory illustration. Across one natural wood workbench, five compact physical stations form one continuous left-to-right path: a weatherproof sampler, a reader tray, a gentle weighting wheel, a calculation box, and a tiny gauge. One blue data bead travels through all five and reaches a central round comparison cradle. A separate gold-edged reference bead arrives from an unbranded official station at the top right; the cradle glows soft green-blue when the two lie close together. Make one final comparison visibly check the entire connected path. No labels, digits, charts, UI, logos, or watermarks. Use the shared visual contract.

### s4 — 总出口检查整条链

Use case: scientific-educational. Asset type: concept illustration. Five small slate-blue workbench modules are connected in a single uninterrupted line by one narrow channel carrying blue beads. At the far right, all work reaches one large ivory total-output tray. A child holds a coral-orange check caliper above the tray while a separate reference bead rests nearby in the same calm green-blue window. The five modules must feel like dependent steps, not unrelated decorations. Explain that checking the total result reveals large mistakes in any earlier step, with no text, numbers, code, screen UI, logos, or watermarks. Use the shared visual contract.

### s5 — 接近不是相同

Use case: scientific-educational. Asset type: theory illustration. On an ivory workbench, two separate rows of blue beads travel along two slim winding guides: one row is slightly higher and a little uneven, the other is close but never perfectly overlapping. Both rows pass through one wide translucent green-blue decision band, while a distant coral-orange row clearly falls outside that band. A child’s fingertip points to the two close rows, emphasizing same practical category rather than identical copies. No written scales, numbers, graphs, screens, UI, logos, or watermarks. Use the shared visual contract.

### s6 — 差异是可解释的线索

Use case: scientific-educational. Asset type: concept illustration. A child studies two nearby but separated blue data beads with a small coral magnifying glass. Three neat physical clue tokens fan out beside them: a tiny street-and-window scene for location, a sun-to-moon clock arc for timing, and two differently sized instrument silhouettes for measurement grade. A closed coral correction knob is sealed under a clear protective cover, while an honest blank observation card remains open. Show that differences invite investigation, never forced adjustment. No text, digits, equations, charts, code, screen UI, logos, or watermarks. Use the shared visual contract.

### s8 — 不同时段的吻合度探索

Use case: scientific-educational. Asset type: interactive game cover. A child’s hands move one plain physical time slider along a workbench rail with a small sun token at one end and a moon token at the other. Above the sun end, two bead trails are clearly separated near a tiny roadside traffic cloud; above the moon end, the same two trails run closely together under a calm night breeze ribbon. Keep the slider and cause-and-effect extremely clear, but include no words, numeric labels, chart axes, computer UI, logos, or watermarks. Use the shared visual contract.

### s11 — 验证不是校准

Use case: illustration-story. Asset type: lesson outro. At a tidy warm workbench, a child compares their node’s blue result bead with a reference-station bead in a simple green-blue measuring cradle, with both the node and its processing path visibly untouched. On the far side rests a closed coral-orange tool box containing adjustment tools, softly set aside for a future step; a small clear divider separates the present check from the later repair tools. Convey “first inspect honestly, adjust only later” without words, numbers, charts, code, UI, logos, or watermarks. Use the shared visual contract.

## Batch record

- Status: eight images generated, visually reviewed, and mapped locally on 2026-08-29; pending the next production content deployment.
- Runtime mapping target: one versioned WebP per visual slide under `images/remake-v2/` in `M31-w0-airnow/slides.json`.
- SVG retirement: retain legacy `inline_svg` until the mapped images, regenerated manifest, and production image URLs have been verified.
- Verification: all eight assets are 1600×900 WebP with captions (93–195 KiB); the regenerated project manifest has no missing or mismatched files.
