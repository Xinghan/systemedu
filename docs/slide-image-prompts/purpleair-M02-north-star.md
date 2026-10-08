# PurpleAir M02 — 北极星目标图片清单

课程源：`purpleair-airquality-node/knodes/M02-w0-module/slides.json`  
资产目录：`purpleair-airquality-node/knodes/M02-w0-module/images/`

## Shared art direction

16:9 educational editorial illustration for 10–12 year olds. Warm off-white paper background; coral-orange focal color, slate-blue secondary color, restrained sunflower-yellow accent; friendly simplified scientific objects with soft grain and depth; modern Chinese science-textbook feel. Do not include words, letters, numbers, logos, watermarks, UI chrome, or tiny unreadable labels. Leave clear visual breathing room for surrounding slide text.

## Slide mapping and prompts

### s1 — `s1.north-star-air.img_1.png`

Caption: 一颗北极星把学生关心的社区空气与长期项目方向连在一起。

Prompt: Use case: scientific-educational. Asset type: course intro slide. A 16:9 warm editorial illustration of a curious Chinese middle-school learner standing on a rooftop at dusk, looking up at one bright guiding star while also looking across their real neighborhood: home windows, a school, trees, a road, and faint airborne particles in the air. A gentle coral path links the star, the learner, and one small future air-sensor location, conveying a personal reason to protect local air. Off-white paper texture, coral-orange focus, slate-blue secondary color, soft sunflower-yellow accent. No words, letters, numbers, logos, watermarks, UI, or readable labels.

### s2 — `s2.guiding-reason.img_1.png`

Caption: 真正在乎的问题会成为遇到困难时继续前进的方向。

Prompt: Use case: scientific-educational. Asset type: explanatory slide illustration. A 16:9 editorial scene of a young learner travelling on a small uphill science-project path through three gentle obstacles: a tangled cable, a tiny error-shaped storm cloud, and an uncooperative sensor. A warm star above acts as a compass, while a faint line points onward toward a finished outdoor air node and a measured chart. The visual should communicate motivation, direction, and a standard for checking progress without using text or symbols that look like words. Warm off-white paper, coral-orange, slate blue, sunflower-yellow accents, friendly science textbook style; no readable text, numbers, logos, watermarks, or UI.

### s3 — `s3.answerable-question.img_1.png`

Caption: 具体地点、可测量的空气指标和比较对象拼成一个可回答的问题。

Prompt: Use case: scientific-educational. Asset type: theory diagram illustration. A 16:9 clear editorial science illustration showing three physical puzzle pieces locking together on a desk: a miniature balcony with a map pin for a specific place, a small air sensor with floating particles for a measurable quantity, and two side-by-side weather scenes with a comparison arrow for a comparison. When joined, the pieces form one glowing question-card shape with a small magnifying glass, but include no words or written marks. Warm off-white paper, coral-orange focal accents, slate-blue secondary color, sunflower-yellow highlights; no text, numbers, labels, logos, watermarks, or UI.

### s4 — `s4.goal-card.img_1.png`

Caption: 一张好目标卡把地点、测量和比较三要素放在同一个方向上。

Prompt: Use case: scientific-educational. Asset type: animation cover illustration. A 16:9 educational editorial scene centered on a blank oversized goal card pinned to a soft board under a glowing star. Around the card float three vivid pictorial tokens: a neighborhood balcony, an air-quality sensor measuring particles, and a comparison pair of two outdoor scenes. Fine luminous lines connect the tokens to the card, making the structure of a good goal obvious without words. Warm off-white paper texture, coral-orange and slate-blue palette with sunflower-yellow accents; no readable writing, letters, numerals, logos, watermarks, or UI.

### s5 — `s5.question-workshop.img_1.png`

Caption: 学生把地点、测量和比较三张图卡组合成科学问题。

Prompt: Use case: scientific-educational. Asset type: interactive game cover. A 16:9 playful top-down editorial illustration of two young hands assembling three illustrated cards on a small workshop table. The cards show a location map pin, an air sensor with particles, and two comparable outdoor conditions; the cards snap together into a clean glowing science-question shape. Scattered nearby are a magnifying glass, pencil, and small circuit board, but no textual cards or interface widgets. Warm off-white paper background, coral-orange focus, slate-blue secondary color, sunflower-yellow accents; no words, numbers, logos, watermarks, or UI.

### s_extra1 — `s_extra1.good-question.img_1.png`

Caption: 好问题把测量放在具体场景中，并且能和另一种条件公平比较。

Prompt: Use case: scientific-educational. Asset type: concept-card slide illustration. A 16:9 editorial science illustration with one learner's balcony air-sensor setup in the center and two clearly distinct comparison scenes branching out: a busier roadside and a rain-washed neighborhood. A compact calendar-like arc and a small stable sensor show that the scope is manageable over time. The composition should make specificity, comparison, and a realistic project scale visually obvious, without text or numbers. Warm off-white paper, coral-orange focus, slate-blue secondary tones, sunflower-yellow accents; no labels, logos, watermarks, or UI.

### s_extra2 — `s_extra2.goal-card-kit.img_1.png`

Caption: 北极星目标卡用守护对象、一个问题和成功样子三件事钉住方向。

Prompt: Use case: scientific-educational. Asset type: concept-card slide illustration. A 16:9 warm editorial still life of an open project folder containing three richly visual tokens: a miniature local neighborhood under clean and hazy air for what to protect, a sensor-plus-magnifying-glass token for the question to answer, and a small finished outdoor node beside a simple success badge for what success looks like. A single star-shaped pin holds the set together. Off-white textured paper background, coral-orange focal color, slate-blue secondary color, sunflower-yellow accents; no readable text, numerals, logos, watermarks, or UI.

### s8 — `s8.promise-card.img_1.png`

Caption: 学生写下并贴好自己的北极星目标卡，准备开始空气项目。

Prompt: Use case: illustration-story. Asset type: lesson outro slide. A 16:9 hopeful editorial illustration of a young Chinese learner at a tidy desk placing a freshly drawn, mostly pictorial goal card on a wall beneath a glowing star pin. Through the window are their neighborhood and a small future air-sensor spot; faint tiny particles in a sunbeam hint at the next lesson. Calm commitment and readiness to begin. Warm off-white paper texture, coral-orange focus, slate-blue secondary color, sunflower-yellow accents. No readable writing, letters, numbers, logos, watermarks, or UI.

## Batch record

- Status: completed and published to production on 2026-07-30.
- Assets: 8 PNG files, all 1672 × 941, stored in `knodes/M02-w0-module/images/`.
- Runtime mappings: one `payload.images` entry was added for each of `s1`, `s2`, `s3`, `s4`, `s5`, `s_extra1`, `s_extra2`, and `s8`.
- SVG retirement: the eight corresponding `inline_svg` values were removed after local asset validation.
- Local validation: all target mappings, captions, and files passed; regenerated course manifest passed complete hash validation.
- Production: `deploy-student.sh course purpleair-airquality-node` returned `publish:200`; the published M02 payload reports the eight image mappings and `legacy_svg_count: 0`; standard production health checks passed. Three representative files returned `200 image/png` from the library service.
