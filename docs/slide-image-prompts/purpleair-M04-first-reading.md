# PurpleAir M04 — 第一个真实读数图片清单

课程源：`purpleair-airquality-node/knodes/M04-w0-module/slides.json`  
资产目录：`purpleair-airquality-node/knodes/M04-w0-module/images/`

## Shared art direction

16:9 educational editorial illustration for 10–12 year olds. Warm off-white paper background; coral-orange focal color, slate-blue secondary color, restrained sunflower-yellow accent; friendly simplified scientific objects with soft grain and depth; modern Chinese science-textbook feel. Do not include words, letters, numbers, logos, watermarks, UI chrome, or tiny unreadable labels. Leave clear visual breathing room for surrounding slide text.

## Slide mapping and prompts

### s1 — `s1.first-reading.img_1.png`

Caption: 学生在家中第一次从空气传感器读到属于自己的真实数据。

Prompt: Use case: illustration-story. Asset type: course intro slide. A 16:9 warm editorial scene of a Chinese middle-school learner near a bright apartment window watching a compact air-quality sensor settle into its first stable glowing reading. Tiny airborne particles travel gently into the sensor; a simple blank-like display glow, notebook, and houseplants make the moment feel personal and real. The mood is a first scientific discovery, not a product advertisement. Off-white paper texture, coral-orange focal color, slate-blue secondary color, sunflower-yellow accents; no readable text, numerals, logos, watermarks, or UI.

### s2 — `s2.concentration-scale.img_1.png`

Caption: 同一个颗粒浓度读数通过颜色档位变成开窗与活动的生活判断。

Prompt: Use case: scientific-educational. Asset type: concept-card slide illustration. A 16:9 editorial science still life showing three transparent air jars with sparse, medium, and dense particle clouds, arranged along a smooth green-to-warm-color band without labels or numbers. A small air sensor points toward the jars, and a child at a nearby window chooses between open and closed windows based on the visual scale. Make concentration density and practical judgment obvious. Warm off-white paper, coral-orange and slate-blue palette, restrained sunflower-yellow accent; no text, letters, numbers, logos, watermarks, or interface.

### s3 — `s3.air-box-concentration.img_1.png`

Caption: 把同样大小的一盒空气中的颗粒总量称出来，就是浓度。

Prompt: Use case: scientific-educational. Asset type: theory diagram illustration. A 16:9 clear editorial diagram of one large transparent cube of room air, about washing-machine size, containing a visible cloud of tiny particles. The cube gently rests on a simple laboratory balance while a small sensor and open window show that particle density can change. Emphasize that the volume stays fixed and only the total particles change; no written units or numerical display. Warm off-white textured paper, coral-orange focus, slate-blue secondary color, sunflower-yellow highlights; no text, labels, logos, watermarks, or UI.

### s4 — `s4.reading-reveal.img_1.png`

Caption: 看不见的颗粒进入传感器后变成稳定读数，再落入空气质量颜色档。

Prompt: Use case: scientific-educational. Asset type: animation cover illustration. A 16:9 sequence-like editorial visual flowing left to right: a cloud of tiny invisible particles is drawn into an air sensor, the sensor produces one bright stable abstract display glow, and that glow slides onto a clean curved color spectrum from clear air to hazy air. Include a sense of reveal and measurement without any printed digits, labels, or UI. Warm off-white paper, coral-orange focal color, slate-blue secondary color, sunflower-yellow accent; no readable text, logos, watermarks, or interface panels.

### s5 — `s5.air-reading-game.img_1.png`

Caption: 改变颗粒浓度后，房间空气状态与判断刻度同步变化。

Prompt: Use case: scientific-educational. Asset type: interactive game cover. A 16:9 playful editorial cutaway of a small room with an air sensor, cooking pan steam, an open window, and an air purifier. A large friendly physical slider with a round handle changes the room from clear to gently hazy, while a nearby simple color dial moves in sync. Convey cause and effect, but do not make a literal app interface or use any text or numerals. Warm off-white background, coral-orange focus, slate-blue secondary color, sunflower-yellow accents; no logos, watermarks, or UI chrome.

### s_extra1 — `s_extra1.particles-behind-reading.img_1.png`

Caption: 一个浓度读数背后，是固定体积空气里有多少颗粒。

Prompt: Use case: scientific-educational. Asset type: explanatory concept illustration. A 16:9 elegant editorial illustration of two equal-sized transparent air cubes side by side: one holds a few widely spaced particles, the other holds many dense particles. A small precision balance and an air sensor connect them to the idea of a measurement, while the equal cube outlines make fixed volume unmistakable. Use no words, numbers, labels, or symbols that resemble equations. Warm off-white paper texture, coral-orange focal color, slate-blue secondary color, sunflower-yellow accent; no logos, watermarks, or UI.

### s_extra2 — `s_extra2.first-data-point.img_1.png`

Caption: 第一条亲手测到的数据，成为以后所有比较的起点。

Prompt: Use case: illustration-story. Asset type: reflective concept slide. A 16:9 editorial illustration of a learner recording a first glowing measurement mark in the opening page of a project notebook. The first mark begins a long gentle timeline that fades toward future measurement points, with an air sensor visible by the window. It should feel like a transition from guessing to evidence, with no visible writing, numerals, dates, logos, watermarks, or UI.

### s8 — `s8.measure-air-outro.img_1.png`

Caption: 学生把第一条空气读数记进项目本，成为能测空气的人。

Prompt: Use case: illustration-story. Asset type: lesson outro slide. A 16:9 warm editorial illustration of a proud young learner placing a small sensor beside an open project notebook, then drawing one bright first data mark. The room is calm, sunlight enters a window, and a faint future graph shape appears as a translucent thought-like visual. Celebrate practical scientific agency without text, numbers, logos, watermarks, or UI. Off-white paper texture, coral-orange focus, slate-blue secondary color, sunflower-yellow accents.

## Batch record

- Status: published to production on 2026-07-30.
- Runtime mappings: all eight assets are mapped directly through `payload.images` in `M04-w0-module/slides.json`.
- SVG retirement: all eight corresponding `inline_svg` values are removed.
- Verification: local mapping and manifest validation passed; production payload reports 8 image mappings and `legacy_svg_count: 0`; sampled image responses returned `200 image/png`.
