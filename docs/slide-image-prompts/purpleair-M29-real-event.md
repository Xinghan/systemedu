# PurpleAir M29「真实空气事件对照」— 逐图 Prompt

- 项目 slug：`purpleair-airquality-node` ｜ 节点：`M29-w0-or`
- 共 8 张必做：不为已有动画、视频或互动资源额外生成静态封面。
- 统一视觉：16:9、暖象牙纸、水彩与水粉科学教材插图、细铅笔描线、自然木桌面；石板蓝为结构色、珊瑚橙为重点、赭黄少量提示、蓝色数据珠。拒绝写实照片、塑料 3D、扁平矢量、任何文字/代码/数字/Logo/水印/UI。

| slide_id | filename | caption |
|---|---|---|
| s1_intro | `s1.catch-a-real-event.v2.webp` | 节点持续记录平静空气和真实事件，让变化不再只是猜测。 |
| s2_bullet | `s2.steady-to-sensitive.v2.webp` | 稳定采集只是开始；节点还要在空气变化时记录出连贯的证据。 |
| s3_bullet2 | `s3.need-a-baseline.v2.webp` | 单独一段高读数无法解释，平时的背景记录才是判断变化的尺子。 |
| s4_theory | `s4.controlled-comparison.v2.webp` | 条件尽量相同的两段记录只差空气事件，才能公平归因变化。 |
| s5_bullet3 | `s5.mountain-not-needle.v2.webp` | 真实事件是连续爬升、到峰、回落的山；孤立尖刺只是需要剔除的针。 |
| s7_game | `s7.event-detective.v2.webp` | 孩子框出平静背景和真实事件，并用工具剔除干扰的异常针。 |
| s10_handson | `s10.event-evidence-report.v2.webp` | 背景、事件、异常检查和对比结论汇成一张别人能复查的事件证据板。 |
| s11_outro | `s11.node-sees-change.v2.webp` | 节点既能长期守候，也能抓住真实空气变化，向官方校准迈进一步。 |

## Prompts

### s1 — 抓一场真实事件

Use case: scientific-educational. Asset type: course intro illustration. A weatherproof air-quality sensor node on a natural wood windowsill steadily feeds blue data beads into two connected physical record strips: the left strip is low and calm, while the right strip rises into a broad, continuous bead hill beneath a softly suggested smoky or dusty outdoor cloud. A small child’s hand holds the beginning of the shared record ribbon, showing patient observation rather than instant prediction. Convey waiting for and capturing a real event, without text, numbers, charts, UI, logos, or watermarks. Use the shared visual contract.

### s2 — 从采得稳到抓得住变化

Use case: scientific-educational. Asset type: concept illustration. A compact slate-blue sensor and steady timer feed a calm row of blue beads along a paper track; further along, the same track becomes a smooth tall cluster of beads as it passes under one translucent grey-coral event cloud, then settles back down. A small coral inspection frame rests at the event cluster, showing the instrument notices a genuine change instead of merely running continuously. No labels, numbers, graphs, code, UI, logos, watermarks, or extraneous props. Use the shared visual contract.

### s3 — 背景是尺子

Use case: scientific-educational. Asset type: concept illustration. Two equal, unmarked ivory measuring trays sit side by side on a wooden workbench. The left tray holds a low even row of blue data beads and has a calm slate-blue baseline rail behind it; the right tray holds a noticeably higher but similarly tidy row of beads. A child’s hand places a small coral comparison caliper between the two trays, showing that the high row is meaningful only when compared with the usual row. No text, digits, scales, tick marks, charts, UI, logos, or watermarks. Use the shared visual contract.

### s4 — 对照实验

Use case: scientific-educational. Asset type: theory illustration. Two matching miniature air-sampling stations sit on one shared wooden base, each with the same weatherproof node and the same kind of paper record ribbon. Everything about the two stations is visibly matched except one: the right station is beneath a small translucent smoky-grey event cloud and its bead ribbon rises into a broad hill, while the left station has clear air and a low calm ribbon. A coral bracket gently groups the shared conditions. Explain a fair comparison with no text, numbers, equations, charts, UI, labels, logos, or watermarks. Use the shared visual contract.

### s5 — 山不是针

Use case: scientific-educational. Asset type: theory illustration. One long simple unmarked physical data ribbon runs across a warm ivory workbench. In its center, many blue beads form a smooth broad mountain that rises gradually and descends gradually; at one edge, a single tall coral-orange bead stands alone between two low blue beads. A small coral tweezers tool is poised to remove only the isolated bead, while a slate-blue curved guide follows the broad hill. Make the difference between a continuous event and an isolated sensor glitch immediate. No writing, digits, axes, chart grids, UI, logos, or watermarks. Use the shared visual contract.

### s7 — 事件侦探

Use case: scientific-educational. Asset type: interactive game cover. A child’s two hands work over one long paper data ribbon: a slate-blue rectangular viewing frame cleanly surrounds a low calm section, a coral rectangular viewing frame surrounds a wide continuous blue bead hill, and a small pair of coral tweezers lifts one isolated high coral bead away from the ribbon. The hands visibly choose background, choose event and remove the needle. No text, numbers, graph axes, computer UI, labels, logos, or watermarks. Use the shared visual contract.

### s10 — 事件证据报告

Use case: scientific-educational. Asset type: hands-on task illustration. A child holds a single portable ivory evidence board toward another learner. The board has three tidy physical panels: a low calm blue bead baseline ribbon, a broad blue bead event hill under a small smoky-grey token, and a coral-outlined small tray containing one removed anomaly bead. A small slate-blue comparison caliper connects the first two panels, making the evidence understandable at a glance. Keep the board as a clear real-world project deliverable with no written report, numbers, charts, screen UI, labels, logos, or watermarks. Use the shared visual contract.

### s11 — 节点看见变化

Use case: illustration-story. Asset type: lesson outro. At a warm twilight window, a weatherproof air-quality sensor node records blue data beads into a long paper ribbon. Outside, a soft distant smoky or dusty cloud passes over a quiet landscape; on the ribbon a low calm section becomes a broad smooth hill and then returns low again. A child and family member gently look at a small evidence board with the same baseline-versus-event pattern. Convey that the node now captures real changes honestly and is ready for the next official comparison, without text, numbers, charts, UI, labels, logos, or watermarks. Use the shared visual contract.

## Batch record

- Status: eight images generated, reviewed and mapped locally on 2026-08-24; pending the next production content deployment.
- Runtime mapping: every visual M29 slide maps directly to one versioned file under `images/remake-v2/` in `M29-w0-or/slides.json`.
- Verification: all eight files are WebP with captions and are 80–211 KB; the regenerated PurpleAir course manifest has no missing or mismatched files.
- SVG retirement: retain legacy `inline_svg` until the node’s mapped images and production image URLs have been verified.
