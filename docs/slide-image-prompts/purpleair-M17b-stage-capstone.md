# PurpleAir M17b「阶段成品：总装与自检」— 逐图 Prompt

- 项目 slug：`purpleair-airquality-node` ｜ 节点：`M17b-w0-stage-capstone`
- 共 8 张必做；每张对应一个真实 slide，落地时直接写入该页的 `payload.images`。
- 统一视觉：16:9、暖象牙纸、水彩与水粉的科学教材插图、细铅笔描线；石板蓝为结构色、珊瑚橙为焦点、赭黄少量提示、自然木色。拒绝写实照片、塑料 3D 渲染、扁平矢量、文字、代码、数字、Logo、界面与水印。

| slide_id | filename | caption |
|---|---|---|
| s1 | `s1.parts-to-autonomous-node.v2.webp` | 从散落零件到一台通电后能自己采集数据的完整空气节点。 |
| s2 | `s2.weak-connection-system.v2.webp` | 零件单测正常不等于系统可靠；一个松动接头就能让整条链掉线。 |
| s3 | `s3.incremental-integration.v2.webp` | 以 Pi 为中心逐个接入传感器，每接一个就检查前面的仍然正常。 |
| s4 | `s4.evidence-checklist.v2.webp` | 自检清单只认看得见的证据：供电、出数、落盘、重启自动运行和通气。 |
| s5 | `s5.node-assembly-overview.v2.webp` | 防水盒里的 Pi、传感器与电源共同构成一台完整节点。 |
| s6 | `s6.power-budget-game.v2.webp` | 先接对接口，再错峰上电，才不会让整机功耗越过安全线。 |
| s7 | `s7.assemble-check-deliver.v2.webp` | 总装、通电自检和录制演示共同组成可交付的阶段成果。 |
| s8 | `s8.independent-machine-outro.v2.webp` | 第一台能独立运转的节点完成，下一步让它学会把读数算成 AQI。 |

## Prompts

### s1 — 总装成一台机器

Use case: scientific-educational. Asset type: course intro illustration. A child at a wooden workbench sees scattered but orderly Raspberry Pi, air-sensor modules, cables and a small weatherproof enclosure on the left; on the right, the same parts are assembled into one tidy window-mounted air-quality node with a soft blue data-bead path emerging from it. Convey transformation from separate parts to an autonomous machine through composition only. No labels or text. Use the shared visual contract.

### s2 — 最弱接头

Use case: scientific-educational. Asset type: concept-card illustration. A physical chain of five connected hardware modules on a workbench—sensor, cable, small board, storage card, power plug—with one loose coral-highlighted connector clearly not seated, while the other links are sound slate blue. Show that one weak joint interrupts the whole system; no literal chain links or writing. Use the shared visual contract.

### s3 — 增量系统集成

Use case: scientific-educational. Asset type: theory illustration. A central Raspberry Pi inside an open weatherproof enclosure receives three or four distinct sensor modules one by one along a gentle curved assembly path. Earlier connected modules glow softly blue; the next module is held above its socket and a small coral check token sits beside each completed connection. Make interfaces and incremental verification legible without labels. Use the shared visual contract.

### s4 — 只认证据的自检

Use case: scientific-educational. Asset type: theory illustration. A child’s hand uses a pencil to place check marks on a blank, unlabelled checklist beside a working enclosure. Each line has only a simple observable icon: power lamp, three sensor dots, a growing row of data beads, a restart arrow, and an airflow opening. The five items look individually verified, not decorative. Use the shared visual contract.

### s5 — 完整节点结构总览

Use case: scientific-educational. Asset type: animation cover illustration. A clear cutaway view of one small weatherproof enclosure mounted near a window: a Raspberry Pi in the center, four compact sensor modules placed around it, gently separated cable routes, one power cable entering from below, and air flowing through a protected vent. It must read as a single hardware system, not a data-flow chart. Use the shared visual contract.

### s6 — 供电预算游戏

Use case: scientific-educational. Asset type: interactive game cover. A hands-on tabletop with a central Pi power hub and four sensor plugs. Two hands connect one sensor at a time; above the hub is a simple, wordless segmented power gauge staying in a calm blue-green safe region, while an unused high-power amber module waits beside it. Communicate "connect correctly, then stagger power" without numbers, labels or interface chrome. Use the shared visual contract.

### s7 — 总装到交付的三件事

Use case: scientific-educational. Asset type: concept-card illustration. A three-step physical progression arranged left-to-right on one workbench: assembled enclosure with neatly routed wires, a paper checklist receiving a check mark, and a small phone on a stand recording the powered node’s first blue data bead. Three scenes belong to one coherent process and leave generous empty margin. Use the shared visual contract.

### s8 — 第一台独立运转的机器

Use case: illustration-story. Asset type: lesson outro illustration. A proud child views a completed weatherproof air-quality node operating by itself beside a window at dusk; a gentle line of blue data beads flows into a small storage card, while a subtle coral-orange glowing chip near the next open notebook suggests the next lesson will add intelligence. The node is clearly independent, stable and ready for its next capability. Use the shared visual contract.

## Batch record

- Status: eight images generated, reviewed and mapped locally on 2026-08-24; pending the next production content deployment.
- Runtime mappings: every visual M17b slide maps directly to one file under `images/remake-v2/` in `M17b-w0-stage-capstone/slides.json`.
- Verification: all eight files are WebP with captions and are 74–241 KB; the regenerated PurpleAir course manifest has no missing or mismatched files.
- SVG retirement: retain legacy `inline_svg` until the node’s mapped images and production image URLs have been verified.
