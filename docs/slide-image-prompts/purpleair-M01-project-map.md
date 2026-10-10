# PurpleAir M01 — 项目全景图片清单

课程源：`purpleair-airquality-node/knodes/M01-w0-module/slides.json`  
资产目录：`purpleair-airquality-node/knodes/M01-w0-module/images/`

## Shared art direction

16:9 educational editorial illustration for 10–12 year olds. Warm off-white paper background; coral-orange focal color, slate-blue secondary color, restrained sunflower-yellow accent; friendly simplified scientific objects with soft grain and depth; modern Chinese science-textbook feel. Do not include words, letters, numbers, logos, watermarks, UI chrome, or tiny unreadable labels. Leave clear visual breathing room for surrounding slide text.

## Slide mapping and prompts

### s1 — `s1.project-journey.img_1.png`

Caption: 从一台窗边空气节点到公共地图上的真实数据点。

Prompt: A 16:9 educational editorial illustration. A curious Chinese middle-school learner stands at a window beside a small Raspberry-Pi-style air-quality sensor node with a tiny intake tube. A warm visual path travels from floating air particles to the node, then through a cable to a glowing world map with one bright local data point and a small clean data chart, showing a real project reaching a public map. Hopeful beginning-of-journey mood. Use the shared art direction; no text, numbers, logos, watermarks, or interface panels.

### s2 — `s2.project-deliverables.img_1.png`

Caption: 项目终点的四个真实成果：节点、数据、报告与可引用发布物。

Prompt: A 16:9 educational editorial science illustration showing four concrete project outcomes arranged as a balanced tabletop composition: a weatherproof air-sensor node, a stack of clean data sheets with a small rising-and-falling chart, a verification report clipboard with a magnifying glass, and a permanent-publishing token represented by a durable archive box and linked metal tag. Connect the four objects with a subtle path to show they belong to one project. Use the shared art direction; no readable text, numerals, logos, watermark, or UI.

### s3 — `s3.six-milestones.img_1.png`

Caption: 从理解空气到公开发布数据的六个项目驿站。

Prompt: A 16:9 educational editorial illustration of a single winding expedition trail with six distinct milestone stations. The stations visually progress from a magnifying glass over airborne particles, to hands assembling electronics, to a calibrated sensor, to a map pin transmitting data, to a notebook with comparison chart, to an open archive with a celebratory beacon. A young learner walks forward with a small toolkit. Use the shared art direction; no text, numbers, labels, logos, watermark, or UI.

### s4 — `s4.citizen-science-network.img_1.png`

Caption: 社区里的许多人各测一点，汇成覆盖更广的科学数据网络。

Prompt: A 16:9 warm editorial science illustration explaining citizen science. Several diverse children and families in different homes and neighborhood settings use small outdoor air-sensor nodes; thin glowing lines connect their observations to one shared regional map made of dots. One professional scientist studies the combined pattern, emphasizing that many small observations create strong evidence. Use the shared art direction; no text, numbers, logos, watermark, or UI.

### s5 — `s5.project-roadmap.img_1.png`

Caption: 六大关连成一条从空气问题到公开数据的项目路线图。

Prompt: A 16:9 educational infographic-style editorial illustration of an end-to-end air-quality project roadmap. A continuous coral path crosses six pictorial stations: observe particles, plan a question, assemble a sensor node, install it outdoors, analyze and compare data, publish a trustworthy community result. The line should clearly flow left to right and end at a bright public map beacon, with small friendly tools at each station. Use the shared art direction; no text, numbers, labels, logos, watermark, or app interface.

### s6 — `s6.project-map-game.img_1.png`

Caption: 把项目产物卡放到正确的六关路线中。

Prompt: A 16:9 playful educational editorial illustration for a drag-and-drop project-planning game. Two youthful hands arrange six colorful illustrated cards along a winding six-stop project path; cards depict particles, a plan notebook, electronics, an outdoor sensor, a data chart, and an open archive. A few stations glow softly to indicate correct placement, but there are no words or numbers. Use the shared art direction; no readable text, logos, watermarks, or UI widgets.

### s_extra1 — `s_extra1.three-stage-journey.img_1.png`

Caption: 先懂空气，再搭节点，最后让数据真正上线。

Prompt: A 16:9 educational editorial illustration divided organically into three connected scenes, not boxed panels: first, a learner observes invisible airborne particles with a magnifying glass; second, the learner assembles a small sensor and protective box at a workbench; third, the finished outdoor node sends a signal to a bright public map. A single path joins the three scenes and makes the progression immediately clear. Use the shared art direction; no text, numbers, labels, logos, watermark, or UI.

### s9 — `s9.project-map-outro.img_1.png`

Caption: 学生已经看清整条路线，准备画出自己的项目地图。

Prompt: A 16:9 hopeful educational editorial illustration for a lesson outro. A young maker sits at a desk sketching a broad project map on paper while, through the window, their finished sensor node hangs safely outdoors. The sketch visually echoes a path from tiny particles to a glowing map pin in the distance, suggesting a plan ready to become real. Calm sense of achievement and next-step momentum. Use the shared art direction; no text, numbers, logos, watermarks, UI, or readable writing.

## Batch record

- Status: completed and published to production on 2026-07-29.
- Assets: 8 PNG files, all 1672 × 941, stored in `knodes/M01-w0-module/images/`.
- Runtime mappings: one `payload.images` entry was added for each of `s1`, `s2`, `s3`, `s4`, `s5`, `s6`, `s_extra1`, and `s9`.
- SVG retirement: the eight corresponding `inline_svg` values were removed after local asset validation.
- Local validation: all target mappings, captions, and files passed; regenerated course manifest passed complete hash validation.
- Production: `deploy-student.sh course purpleair-airquality-node` returned `publish:200`; the published M01 payload reports the eight image mappings and `legacy_svg_count: 0`; standard production health checks passed.
