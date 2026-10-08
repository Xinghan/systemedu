# PurpleAir M11 — PMS5003 串口接线图片清单

课程源：`purpleair-airquality-node/knodes/M11-w0-pms5003/slides.json`  
资产目录：`purpleair-airquality-node/knodes/M11-w0-pms5003/images/`

## Shared art direction

16:9 educational editorial illustration for 10–12 year olds. Warm off-white paper background; coral-orange focal color, slate-blue secondary color, restrained sunflower-yellow accent; friendly, technically legible sensor and wiring objects with soft grain and modest dimensionality; modern Chinese science-textbook feel. Data is represented by abstract light beads and unlabeled block structures rather than readable code or numbers. Do not include words, letters, numbers, binary digits, connector labels, logos, watermarks, UI chrome, or tiny unreadable text.

## Slide mapping and prompts

### s1_intro — `s1.sensor-first-message.img_1.png`

Caption: PMS5003 把空气读数变成一颗颗数据光点，经由连线逐个送进树莓派。

Prompt: Use case: scientific-educational. Asset type: course intro illustration. A 16:9 warm editorial scene of a compact air-particle sensor module on the left and a small single-board computer on the right, joined by a neat three-wire ribbon. A stream of tiny coral and sunflower light beads leaves the sensor, follows the wire one at a time, and enters the Pi; faint translucent airborne dots drift near the sensor intake. Make the modules recognizable by shape only, with no lettering or pin labels. No text, letters, numbers, binary digits, logos, watermarks, or UI. Off-white paper texture, coral-orange focus, slate-blue secondary color.

### s2_bullet — `s2.uart-task-trio.img_1.png`

Caption: 接好交叉通信线、让双方用同一节奏、从连续字节中认出完整一帧，是读到第一行数据的三步。

Prompt: Use case: scientific-educational. Asset type: concept-card slide illustration. A 16:9 clear editorial triptych: three colored wires crossing cleanly between a sensor and Pi with a shared ground path, two synchronized abstract metronome discs connected by a pulse, and a flowing bead stream that is neatly gathered into one framed packet. Connect the stations with a thin path. Keep all structures unlabeled; avoid literal terminals or diagrams with text. No text, letters, numbers, binary digits, logos, watermarks, UI, or readable connector markings. Warm off-white paper, coral-orange focus, slate-blue secondary color, sunflower-yellow accents.

### s3_theory — `s3.uart-single-file.img_1.png`

Caption: 串口像一条单车道，数据光点按起始、内容和结束的节奏一个接一个地通过。

Prompt: Use case: scientific-educational. Asset type: theory illustration. A 16:9 friendly editorial transport metaphor: a narrow slate-blue single-lane path runs between a sensor transmitter and Pi receiver. Along it travels a clearly ordered procession of small light beads: one distinct start bead, a run of eight alternating coral and blue beads, and one distinct stop bead. Show only shape and color rhythm, no 0 or 1 characters, labels, or symbols. No text, letters, numbers, binary digits, logos, watermarks, or UI. Warm off-white paper texture, coral-orange focal bead, slate-blue secondary color, sunflower-yellow timing accents.

### s4_theory — `s4.data-frame-envelope.img_1.png`

Caption: 连续到来的字节只有按固定的开头、数据区和校验尾部装进同一个“信封”，才能被可靠读懂。

Prompt: Use case: scientific-educational. Asset type: theory illustration. A 16:9 editorial analogy of a flowing river of small abstract data beads entering a large open envelope-shaped frame. The frame has three unlabeled, visibly different compartments: a small coral seal at the front, a long slate-blue middle compartment filled with ordered beads, and a sunflower-yellow seal at the end; a soft circular verification glow checks the finished packet. Make it intuitive that the packet has a fixed shape, but include no written headers, numeric values, checksum symbols, code, or UI. Warm off-white paper texture, coral-orange focus, slate-blue secondary color.

### s7_image — `s7.pms5003-pi-wiring.img_1.png`

Caption: 传感器与 Pi 的四根关键线清晰分开：两根通信线交叉、地线共用、供电线稳定接入。

Prompt: Use case: scientific-educational. Asset type: hardware wiring illustration. A 16:9 technically legible top-down editorial illustration of a rectangular air-particle sensor module on the left and a compact Pi board on the right. Four thick, neatly routed color-coded jumper wires connect them: two signal wires cross once in the center, one dark grounding wire stays straight underneath, and one power wire follows a separate calm route. Show connector holes and cable plugs without labels, letters, numbers, pin text, logos, or literal wiring diagrams. Keep spacing generous so the crossing is unmistakable. Warm off-white paper, coral-orange and slate-blue signal wires, sunflower-yellow details.

### s10_outro — `s10.sensor-online-dataflow.img_1.png`

Caption: 接线和串口节奏都对上后，传感器终于能把第一串稳定的空气读数送进 Pi。

Prompt: Use case: illustration-story. Asset type: lesson outro slide. A 16:9 hopeful editorial project-desk scene of a correctly connected air-particle sensor and Pi. A calm, steady line of glowing data beads travels from the sensor through the crossed wires into a small open slate-blue record tray beside the Pi; in the background, a learner watches with hands safely off the wiring. Suggest a first successful log with orderly unlabeled tokens, never a screen or readable file. No text, letters, numbers, binary digits, logos, watermarks, terminal, or UI. Warm off-white paper texture, coral-orange focus, slate-blue secondary color, sunflower-yellow confirmation glow.

## Batch record

- Status: published to production on 2026-08-01.
- Runtime mappings: all six assets are mapped directly through `payload.images` in `M11-w0-pms5003/slides.json`.
- SVG retirement: all six corresponding `inline_svg` values are removed.
- Verification: local mapping and manifest validation passed; production payload reports six image mappings and `legacy_svg_count: 0`; sampled image responses returned `200 image/png`.
