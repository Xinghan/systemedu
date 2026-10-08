# PurpleAir M27「三值仪表盘与 AQI 颜色编码」— 逐图 Prompt

- 项目 slug：`purpleair-airquality-node` ｜ 节点：`M27-w0-vs-vs-nowcast`
- 共 9 张必做：不为已有动画、视频或互动资源额外生成静态封面。
- 统一视觉：16:9、暖象牙纸、水彩与水粉科学教材插图、细铅笔描线、自然木桌面；石板蓝为结构色、珊瑚橙为重点、赭黄少量提示、蓝色数据珠。拒绝写实照片、塑料 3D、扁平矢量、任何文字/代码/数字/Logo/水印/UI。

| slide_id | filename | caption |
|---|---|---|
| s1_intro | `s1.data-to-dashboard.v2.webp` | 同一串原始数据被整理成三张并排的颜色卡片，让人直接看见校正带来的差异。 |
| s2_bullet | `s2.visible-s3-evidence.v2.webp` | 藏在计算步骤里的结果，首次变成可以展示、比较和分享的可见证据。 |
| s3_theory | `s3.three-web-layers.v2.webp` | 骨架、外观和数据三层各自完成工作，合成一张真正可见的数据卡片。 |
| s4_bullet | `s4.flex-layout.v2.webp` | 同样的三张卡片从竖向堆放变成横向平分，说明布局只由样式层决定。 |
| s5_theory | `s5.aqi-color-language.v2.webp` | 颜色把连续的空气质量读数翻译成孩子能一眼读懂的安全提示。 |
| s6_bullet | `s6.shared-color-helper.v2.webp` | 一台查色小机器同时服务三张卡片，体现写一次、复用三次。 |
| s8_game | `s8.humidity-color-flip.v2.webp` | 孩子转动湿度旋钮，观察原始卡翻黄而校正卡仍保持绿色。 |
| s11_handson | `s11.shareable-three-card-page.v2.webp` | 三张颜色卡装进一张可带走、可分享的网页成果板。 |
| s12_outro | `s12.visible-trust-chain.v2.webp` | 从节点读数到校正、再到可见仪表盘，整条可信数据链第一次显形。 |

## Prompts

### s1 — 数据变成仪表盘

Use case: scientific-educational. Asset type: course intro illustration. On a warm ivory paper workbench, a small weatherproof air-quality sensor node sends a stream of loose blue data beads toward three sturdy blank display cards arranged side by side. The left card carries a warm yellow color patch, the middle card a calm green-blue patch, and the right card a soft yellow patch; a coral-orange organising guide gently directs the beads into the three cards. Clearly convey one hard-to-read stream becoming an instantly comparable three-card dashboard, with no writing, numbers, screens, UI, labels, logos, or charts. Use the shared visual contract.

### s2 — S3 成果第一次可见

Use case: scientific-educational. Asset type: concept illustration. A child’s hand lifts a translucent slate-blue calculation ribbon from a tabletop; it transforms across the scene into three upright, tactile color cards that can be placed on a small wooden display stand. Under the translucent ribbon, blue beads and small abstract gears imply hidden computation; on the stand, yellow, green-blue and yellow color patches make the result easy to compare. Show hidden math becoming shareable visual evidence, without text, code, numbers, interfaces, logos, or charts. Use the shared visual contract.

### s3 — 三层分工

Use case: scientific-educational. Asset type: theory illustration. Three distinct physical layers assemble one small data card on a workbench: a slate-blue wire-frame card skeleton at the back, a watercolor color-and-border layer in the middle, and a coral-accented blue data bead entering a final front layer. The finished card glows gently with a green-blue color patch, while the three parts remain visibly separable like transparent workshop templates. Explain structure, appearance, and data filling through physical layers—no writing, code, digits, browsers, UI, labels, logos, or charts. Use the shared visual contract.

### s4 — flex 横排

Use case: scientific-educational. Asset type: concept illustration. A tabletop transformation scene: at left, three small blank data cards stand stacked vertically on a slender slate-blue holder; a simple coral-orange layout rail with three equal slots guides an identical set of three cards into a clean horizontal row on the right. All cards are unmarked and equal size, with tiny muted color patches only. Make the change from vertical stacking to evenly spaced horizontal layout unmistakable, without text, code, browser windows, UI, logos, or charts. Use the shared visual contract.

### s5 — AQI 的颜色语言

Use case: scientific-educational. Asset type: theory illustration. A child-friendly air-quality color path made of six tactile watercolor swatches runs across a warm ivory workbench: calm green-blue, soft yellow, amber orange, coral red, muted violet, and deep reddish brown. Blue data beads arrive at the beginning and a small slate-blue sorter gently places them onto the appropriate swatch; a child’s hand can compare two neighboring green-blue and yellow results at a glance. Convey discrete threshold-based color encoding without any words, numerical scales, ticks, diagrams, logos, or interface elements. Use the shared visual contract.

### s6 — 一次查色，三次复用

Use case: scientific-educational. Asset type: concept illustration. One compact slate-blue color-sorting machine, with a single adjustable amber dial, receives blue beads and sends three identical flexible colored ribbons to three separate blank dashboard cards. Each card gains an appropriate small color patch from the same source; the three paths visibly share the one machine. Emphasize reuse and one-place change, not automation spectacle. No labels, code, digits, UI, logos, charts, or text. Use the shared visual contract.

### s8 — 拖湿度，看颜色翻转

Use case: scientific-educational. Asset type: interactive game cover. Two child hands operate a simple tactile humidity dial beside a miniature three-card dashboard made of cardboard and watercolor. As the dial turns upward, the left raw-reading card visibly changes from calm green-blue to soft yellow, while the center corrected card remains calm green-blue; the third card rests beside them with a gentle yellow patch. A few blue data beads and a small weather-drop token make the cause clear. No text, digits, sliders, screens, UI, labels, logos, or charts. Use the shared visual contract.

### s11 — 可分享的三卡网页成果

Use case: scientific-educational. Asset type: hands-on task illustration. A learner’s hands fit three tidy, equal-sized blank data cards into a single wide, portable ivory presentation board on a wooden desk. The cards sit side by side with a yellow patch, a green-blue patch, and a yellow patch, and a small coral connector joins their blue data beads beneath the board. A second pair of hands on the other side reaches to receive the finished board, conveying a local webpage that another person can open and understand. No written title, code, digits, screen UI, labels, logos, or charts. Use the shared visual contract.

### s12 — 可信数据链看得见

Use case: illustration-story. Asset type: lesson outro. At a warm dusk window, a small weatherproof air-quality node sends raw blue data beads through a compact coral-accented correction box, then to a neat three-card tabletop display: a warm yellow raw card, a calm green-blue corrected card, and a soft yellow forecast card. A young learner and family silhouette look toward the clear cards together. Convey the full chain from measurement to trustworthy visible evidence, and hint that it is ready for longer observation. No text, numbers, dashboards on screens, UI, labels, logos, or charts. Use the shared visual contract.

## Batch record

- Status: nine images generated, reviewed and mapped locally on 2026-08-24; pending the next production content deployment.
- Runtime mapping: every visual M27 slide maps directly to one versioned file under `images/remake-v2/` in `M27-w0-vs-vs-nowcast/slides.json`.
- Verification: all nine files are WebP with captions and are 88–223 KB; the regenerated PurpleAir course manifest has no missing or mismatched files.
- SVG retirement: retain legacy `inline_svg` until the node’s mapped images and production image URLs have been verified.
