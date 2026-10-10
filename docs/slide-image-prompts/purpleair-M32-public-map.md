# PurpleAir M32「把你的传感器变成全球地图上一个真实的点」— 逐图 Prompt

- 项目 slug：`purpleair-airquality-node` ｜ 节点：`M32-w0-purpleair`
- 共 7 张必做：动画、视频与互动资源已有独立载体，不额外生成静态封面。
- 统一视觉：16:9、暖象牙纸、水彩与水粉科学教材插图、细铅笔描线、自然木桌面；石板蓝为结构色、珊瑚橙为重点、赭黄少量提示、蓝色数据珠。拒绝写实照片、塑料 3D、扁平矢量、任何文字/代码/数字/Logo/水印/UI。

| slide_id | filename | caption |
|---|---|---|
| s1_intro | `s1.global-dot.v2.webp` | 孩子把自己的空气节点接入世界地图，地图上一个新点温暖地亮起来。 |
| s2_bullet | `s2.private-to-public.v2.webp` | 数据从房间里的节点跨过门槛，进入所有人都能看见的公共地图。 |
| s3_bullet2 | `s3.register-and-report.v2.webp` | 身份牌先安在地图边缘，规律抵达的数据珠让新点持续保持鲜活。 |
| s4_theory_location | `s4.location-matters.v2.webp` | 节点图钉准确嵌进自家屋顶，放错位置的橙色图钉被隔在很远处。 |
| s6_bullet3 | `s6.citizen-contributor.v2.webp` | 孩子把自己的绿色观测点补进一张由普通人共同完成的空气地图。 |
| s7_game | `s7.place-the-dot.v2.webp` | 孩子把绿色点拖向屋顶标记，放大镜显出附近地图仍有大片空白。 |
| s10_outro | `s10.public-two-paths.v2.webp` | 同一个节点沿全球地图或本地公开展示两条路径，都将数据带出房间。 |

## Prompts

### s1 — 全球地图上亮起的新点

Use case: scientific-educational. Asset type: course intro illustration. On a warm ivory paper workbench, a child gently connects their compact weatherproof air-quality node to the edge of a large hand-painted raised globe map. A single fresh green-blue point blooms on the map among a sparse constellation of small muted colored points, while one blue data bead travels from the child’s node along a simple slate-blue path to that new point. Make the child’s node and its new map point the unmistakable focus; convey a private invention joining a worldwide public network. No text, digits, labels, interface panels, charts, logos, or watermarks. Use the shared visual contract.

### s2 — 从房间走进公共空间

Use case: illustration-story. Asset type: learning-path concept illustration. A warm child’s workbench sits just inside a simple open doorway at left, holding a compact air-quality node. One continuous slate-blue data ribbon carries blue beads out through the doorway toward a broad communal map table on the right, where several tiny house-and-school landmarks are connected by real observation points. A child steps alongside the ribbon, looking from the private workbench to the shared map. Make the outward movement clear and celebratory, with a calm, uncluttered composition. No text, digits, charts, screen UI, logos, or watermarks. Use the shared visual contract.

### s3 — 注册加持续上报

Use case: scientific-educational. Asset type: concept illustration. On one warm ivory workbench, show a clear two-part physical sequence without any words: first, the child sets a small blank identity tile with a tiny location-pin shape into a receiving slot beside a map edge; second, the same weatherproof sensor sends evenly spaced blue data beads along a single neat channel to a glowing map point. The identity tile and the recurring beads must be visibly different but connected parts of one process. Include one dull inactive spare point off to the side with no incoming beads, only as a subtle contrast. No text, numbers, code, UI, charts, logos, or watermarks. Use the shared visual contract.

### s4 — 位置决定意义

Use case: scientific-educational. Asset type: theory illustration. A hand-painted miniature neighborhood map made of interlocking puzzle pieces rests on a warm ivory workbench. On the left, a small slate-blue node pin clicks precisely into the roof-shaped cutout of the child’s real house, making the surrounding street-and-park pieces align cleanly in calm green-blue. On the far right, the same kind of pin is clearly misplaced on a distant unrelated neighborhood piece, colored coral-orange and separated by a long empty gap. A child’s hand carefully positions the accurate pin. Explain spatial truth through fitting physical pieces, not through labels or screens. No text, digits, coordinates, maps with words, UI, logos, or watermarks. Use the shared visual contract.

### s6 — 我是数据贡献者

Use case: scientific-educational. Asset type: concept illustration. A child places one glowing green observation bead into an open empty socket on a large tactile city-and-world map mosaic spread across a warm wood table. Around it are a modest number of other small blue, amber, and green observation beads supplied by tiny homes, a school roof, and a community building, each visually independent but peacefully part of one shared pattern. Let the child’s newly placed bead gently brighten its previously blank local area. Show contribution, equality, and citizen science through one clear action; do not make it a dense chart or a generic globe. No text, digits, UI, logos, or watermarks. Use the shared visual contract.

### s7 — 把点放到正确位置

Use case: scientific-educational. Asset type: interactive game cover. A child’s hand moves one large green map pin across a simple raised neighborhood map toward a tiny roof-shaped target ring. A round magnifying lens, physically resting over part of the map, reveals a few widely spaced existing observation beads and ample blank space; farther away a small clustered group remains outside the lens. Keep the correct roof target, movable pin, and spatial scarcity obvious in a playful but restrained tabletop scene. No words, numbers, arrow labels, chart axes, screen UI, logos, or watermarks. Use the shared visual contract.

### s10 — 公开亮相的两条成功路径

Use case: scientific-educational. Asset type: lesson outro illustration. On a warm ivory workbench, one child-built weatherproof node at the center sends identical blue data beads into two graceful, equally solid paths. The left path rises to a tactile world-map display with a new glowing point; the right path reaches a simple open community viewing stand with a round gauge-like public display and two small onlookers. Both paths end in the same calm green-blue success glow, while a small open doorway behind the node shows the data leaving the room. Make the two routes clearly equal and uncluttered, with no product logos or literal interface. No text, digits, charts, code, UI, labels, or watermarks. Use the shared visual contract.

## Batch record

- Status: seven images generated, visually reviewed, and mapped locally on 2026-08-29; pending the next production content deployment.
- Runtime mapping target: one versioned WebP per visual slide under `images/remake-v2/` in `M32-w0-purpleair/slides.json`.
- SVG retirement: retain legacy `inline_svg` until the mapped images, regenerated manifest, and production image URLs have been verified.
- Verification: all seven assets are 1600×900 WebP with captions (216–261 KiB); the regenerated project manifest has no missing or mismatched files.
