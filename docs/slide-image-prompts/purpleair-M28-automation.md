# PurpleAir M28「无人值守自动采集」— 逐图 Prompt

- 项目 slug：`purpleair-airquality-node` ｜ 节点：`M28-w0-7`
- 共 8 张必做：不为已有动画、视频或互动资源额外生成静态封面。
- 统一视觉：16:9、暖象牙纸、水彩与水粉科学教材插图、细铅笔描线、自然木桌面；石板蓝为结构色、珊瑚橙为重点、赭黄少量提示、蓝色数据珠。拒绝写实照片、塑料 3D、扁平矢量、任何文字/代码/数字/Logo/水印/UI。

| slide_id | filename | caption |
|---|---|---|
| s1_intro | `s1.always-awake-caretaker.v2.webp` | 定时管家接过采集节点的重复工作，让它不分昼夜自动记录。 |
| s2_bullet | `s2.manual-to-unattended.v2.webp` | 人手留下断续记录，定时采集则把七天观测连成可用的连续证据。 |
| s3_theory | `s3.scheduler-alarm.v2.webp` | 一个永不睡觉的闹钟按照固定节律触发采集，并把每次结果存进记录。 |
| s4_bullet | `s4.two-scheduler-tools.v2.webp` | 两种不同的定时工具都把同一份时刻表转换为稳定的采集节律。 |
| s5_bullet | `s5.seven-day-quality-check.v2.webp` | 用连续记录检查断档，再用放大镜找出孤立异常，完成一周彩排验收。 |
| s7_game | `s7.schedule-sandbox.v2.webp` | 孩子亲手调节采样节律，比较手动留下的窟窿和定时形成的连续。 |
| s10_handson | `s10.seven-day-deliverable.v2.webp` | 节点、定时管家和完整的七天记录组合成可被别人查看的稳定性成果。 |
| s11_outro | `s11.node-keeps-working.v2.webp` | 孩子休息时节点仍持续采集，朝未来的官方校准与长期数据集迈进。 |

## Prompts

### s1 — 永不睡觉的管家

Use case: scientific-educational. Asset type: course intro illustration. A small weatherproof air-quality sensor node sits on a natural wood workbench beside a compact slate-blue mechanical caretaker clock. A child’s hand has just placed one blue data bead manually at the far left, while the clock now regularly releases a neat stream of blue beads into a long recording tray that continues beneath a sun-and-moon paper backdrop. Convey the machine taking over repetitive sampling day and night, with no text, numbers, code, computer UI, labels, logos, or charts. Use the shared visual contract.

### s2 — 从手动到无人值守

Use case: scientific-educational. Asset type: concept illustration. A split seven-segment paper recording strip on a warm ivory workbench: on the left, a child hand contributes a few scattered blue data beads with large blank gaps; on the right, a compact slate-blue timer sends evenly spaced beads across every segment of a complete strip. A small coral divider marks the transition from manual dependence to unattended rhythm. No literal calendar marks, words, numbers, charts, UI, logos, or labels. Use the shared visual contract.

### s3 — 电脑里的闹钟

Use case: scientific-educational. Asset type: theory illustration. One friendly compact slate-blue alarm clock with a visible but unmarked repeating gear mechanism sits beside a weatherproof sensor node. At each evenly spaced notch on a simple unmarked circular rhythm wheel, a blue bead is released into a clear collection vial; a small moon token and sun token sit calmly behind, showing the rhythm ignores day and night. Make the trigger–collect–repeat loop tangible without text, digits, code, browser UI, charts, labels, logos, or decorative clutter. Use the shared visual contract.

### s4 — 两个常见定时工具

Use case: scientific-educational. Asset type: concept illustration. Two small purposeful tabletop timing tools sit side by side on warm ivory paper: at left an older simple slate-blue schedule wheel feeds a blue bead to a collection tray; at right a modern pair of neatly coupled slate-blue modules, one with a tiny clock face and one with a tiny work gear, feed an identical bead to another tray. Both output paths merge into one row of evenly spaced blue records. Show different setups with the same reliable result; no writing, code, digits, app windows, UI, arrows, charts, labels, logos, or watermarks. Use the shared visual contract.

### s5 — 七天验收

Use case: scientific-educational. Asset type: theory illustration. A long unmarked seven-part paper record ribbon filled with evenly spaced blue data beads stretches across a natural wood workbench. One short empty gap is clearly visible and a single coral-orange outlier bead rises above an otherwise calm blue row. A child-safe coral magnifying glass inspects the outlier while a small slate-blue measuring frame spans the whole ribbon, conveying completeness and anomaly checks. No numbers, axes, gridlines, labels, written notes, code, UI, logos, or charts. Use the shared visual contract.

### s7 — 定时调度沙盒

Use case: scientific-educational. Asset type: interactive game cover. A child’s hand turns a tactile sampling-interval knob on a slate-blue scheduling toy. Two parallel paper tracks extend from it: the upper track has a few blue beads separated by obvious empty gaps, and the lower track has a tidy rhythm of evenly spaced blue beads running continuously through a small night-moon token and sun token. Make hands-on comparison the focus, with no text, numbers, sliders, computer screens, UI, charts, labels, logos, or watermarks. Use the shared visual contract.

### s10 — 七天稳定性成果

Use case: scientific-educational. Asset type: hands-on task illustration. A weatherproof air-quality node, a compact slate-blue caretaker clock, and a portable ivory evidence board form one clear delivery set on a wooden desk. The board contains a long unmarked seven-part continuous ribbon full of blue data beads, a tiny empty-gap inspection window now shown complete, and one coral checked-outlier token set aside. Two child hands present the board outward for another person to inspect. No written reports, digits, code, screen UI, charts, labels, logos, or watermarks. Use the shared visual contract.

### s11 — 节点继续工作

Use case: illustration-story. Asset type: lesson outro. At a warm dusk window, a weatherproof air-quality node and its compact slate-blue timer work steadily on a natural wood sill, releasing blue data beads into a long, fully filled paper record ribbon. A young learner sleeps quietly in the softly suggested room while a small early-dawn glow appears beyond the window, making day-and-night continuity clear. A tiny clean evidence board with a continuous blue bead row rests nearby, ready for future comparison. No text, numbers, UI, charts, labels, logos, watermarks, or extraneous props. Use the shared visual contract.

## Batch record

- Status: eight images generated, reviewed and mapped locally on 2026-08-24; pending the next production content deployment.
- Runtime mapping: every visual M28 slide maps directly to one versioned file under `images/remake-v2/` in `M28-w0-7/slides.json`.
- Verification: all eight files are WebP with captions and are 35–237 KB; the regenerated PurpleAir course manifest has no missing or mismatched files.
- SVG retirement: retain legacy `inline_svg` until the node’s mapped images and production image URLs have been verified.
