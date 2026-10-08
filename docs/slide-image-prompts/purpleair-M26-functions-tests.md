# PurpleAir M26「函数与单元测试」— 逐图 Prompt

- 项目 slug：`purpleair-airquality-node` ｜ 节点：`M26-w0-module`
- 共 9 张必做：不为已有动画、视频或互动资源额外生成静态封面。
- 统一视觉：16:9、暖象牙纸、水彩与水粉科学教材插图、细铅笔描线、自然木桌面；石板蓝为结构色、珊瑚橙为重点、赭黄少量提示、蓝色数据珠。拒绝写实照片、塑料 3D、扁平矢量、任何文字/代码/数字/Logo/水印/UI。

| slide_id | filename | caption |
|---|---|---|
| s1_intro | `s1.handwork-to-functions.v2.webp` | 把纸上的两段手算变成能反复工作的两台小机器，再用测试确认它们算对。 |
| s2_bullet | `s2.hand-vs-machine.v2.webp` | 手算又慢又容易抄错；步骤写对一次后，机器能快速稳定地重复处理。 |
| s3_theory | `s3.function-input-output.v2.webp` | 函数把输入送进固定步骤，再把可继续使用的结果送出。 |
| s4_bullet | `s4.modular-workflow.v2.webp` | 模块化让同一台小机器能反复调用、集中修改，并让主流程更清楚。 |
| s5_theory | `s5.assert-caliper.v2.webp` | 单元测试用已知答案当卡尺，发现能运行却算错的隐蔽 bug。 |
| s6_bullet | `s6.tolerance-window.v2.webp` | 小数结果允许落在很窄的容差窗口内，既抓大错也不误伤微小尾差。 |
| s8_game | `s8.code-detective.v2.webp` | 孩子喂入数据、比较输出，并用测试揪出藏在机器里的错误步骤。 |
| s11_handson | `s11.two-functions-tests.v2.webp` | 两个函数各自通过测试，最后汇成一份可交付、可复跑的代码成果。 |
| s12_outro | `s12.correct-then-nowcast.v2.webp` | 校正机器在前、NowCast 机器在后，组成未来能搬上节点的可靠流水线。 |

## Prompts

### s1 — 从手算到函数

Use case: scientific-educational. Asset type: course intro illustration. A learner’s handwritten but unmarked calculation cards and loose blue data beads sit on the left of a workbench; on the right, two compact labeled-free processing machines receive those beads and return orderly glowing result beads, while a small check-caliper rests beside them. Convey handwork becoming repeatable, tested functions with no words or numbers. Use the shared visual contract.

### s2 — 手算与机器

Use case: scientific-educational. Asset type: concept illustration. A split workbench: on the left a child’s hand slowly sorts many loose blue beads across scattered blank cards, with one bead rolling away; on the right one simple slate-blue machine processes a steady stream of identical beads into a neat result row. The contrast is slow/error-prone versus repeatable/stable, not human-versus-machine competition. Use the shared visual contract.

### s3 — 输入、处理、返回

Use case: scientific-educational. Asset type: theory illustration. One friendly compact slate-blue processing machine has a clear inlet receiving two blue input beads, three visible but abstract internal processing chambers, and an outlet returning one coral-highlighted result bead into a waiting tray. The output must be visibly reusable, not merely displayed. Use the shared visual contract.

### s4 — 模块化

Use case: scientific-educational. Asset type: concept illustration. One small coral-accented function machine is mounted in a tidy workbench slot and serves three different paths of blue beads; a single adjustable amber dial on the machine changes all paths together. A simple main path then connects two named-free machines in order. Show reuse, one-place change and clear flow without labels. Use the shared visual contract.

### s5 — assert 卡尺

Use case: scientific-educational. Asset type: theory illustration. A known reference result bead rests in a circular measuring cradle; a second bead exits a small slate-blue function machine and is checked by a coral-orange caliper. One correct pair aligns and glows calmly, while a nearby wrong result bead is clearly stopped by a red-orange barrier. Use the shared visual contract.

### s6 — 容差窗口

Use case: scientific-educational. Asset type: concept illustration. A horizontal measuring rail has a very narrow soft green-blue acceptance window around a centered reference bead. Two nearly overlapping small blue beads fall safely within it; two distant coral beads sit far outside and are blocked. Explain numerical tolerance visually without ticks, labels, equations or numbers. Use the shared visual contract.

### s8 — 代码侦探

Use case: scientific-educational. Asset type: interactive game cover. Two child hands feed a pair of blue input beads into a compact table-top machine. On the other side, a coral magnifying glass and a simple check-caliper compare its output with a reference bead; one removable internal gear is slightly misaligned and a small coral alert glow reveals the bug. Use the shared visual contract.

### s11 — 两函数与全绿测试

Use case: scientific-educational. Asset type: hands-on task illustration. Two compact slate-blue function machines sit side by side on a workbench, each with its own small check-caliper and a row of glowing green-blue pass tokens. Their outputs flow to two neat blank code cards in a tray, ready for another person to run. Keep all cards completely unmarked. Use the shared visual contract.

### s12 — 校正后再算 AQI

Use case: illustration-story. Asset type: lesson outro. A line of raw blue data beads first travels through a compact coral-accented correction machine and becomes clean pale-blue beads, then flows into a second slate-blue weighted-processing machine and exits as one confident warm-gold result bead. A small weatherproof node waits in the background, ready to receive this reliable two-stage pipeline. Use the shared visual contract.

## Batch record

- Status: nine images generated, reviewed and mapped locally on 2026-08-24; pending the next production content deployment.
- Runtime mappings: every visual M26 slide maps directly to one file under `images/remake-v2/` in `M26-w0-module/slides.json`.
- Verification: all nine files are WebP with captions and are 115–215 KB; the regenerated PurpleAir course manifest has no missing or mismatched files.
- SVG retirement: retain legacy `inline_svg` until the node’s mapped images and production image URLs have been verified.
