# PurpleAir M12 — I²C 与 BME280 图片清单

课程源：`purpleair-airquality-node/knodes/M12-w0-i2c-bme280/slides.json`  
资产目录：`purpleair-airquality-node/knodes/M12-w0-i2c-bme280/images/`

## Shared art direction

16:9 educational editorial illustration for 10–12 year olds. Warm off-white paper background; coral-orange focal color, slate-blue secondary color, restrained sunflower-yellow accent; friendly but technically legible Pi boards, compact sensor breakouts, and physical signal paths with soft paper grain. Explain I²C through unlabeled colors, shapes, and light pulses. Do not include words, letters, numbers, addresses, code, connector labels, logos, watermarks, or UI chrome.

## Slide mapping and prompts

### s1_intro — `s1.i2c-sensor-voice.img_1.png`

Caption: 树莓派通过一对共享信号线点名 BME280，让环境传感器开始送回温湿气压信息。

Prompt: Use case: scientific-educational. Asset type: course intro illustration. A 16:9 warm editorial scene of a compact Pi board on the left sending two parallel slate-blue signal lines across a desk to three small sensor modules. One coral-accented BME280-like module responds with three gentle output tokens: a warm thermometer shape, a water droplet, and a round pressure dial, while the other modules remain softly quiet. Use a single coral calling pulse along the shared pair of wires. No text, letters, numbers, addresses, code, logos, watermarks, or UI. Off-white paper texture, coral-orange focus, slate-blue secondary color, sunflower-yellow highlights.

### s2_bullet — `s2.i2c-three-steps.img_1.png`

Caption: 两根线共用、主设备点名、确认应答后再读取，是让 BME280 正常工作的三步。

Prompt: Use case: scientific-educational. Asset type: concept-card slide illustration. A 16:9 clear top-down editorial triptych of three connected stations: a pair of parallel slate-blue cables branching to several tiny modules, a Pi sending one coral call token toward a selected sensor badge, and the selected sensor returning three small environment tokens to a neat tray. Keep all objects unlabeled and avoid literal terminals. No text, letters, digits, addresses, code, logos, watermarks, UI, or readable pin markings. Warm off-white paper, coral-orange focal token, slate-blue structure, sunflower-yellow response glow.

### s3_theory — `s3.shared-i2c-bus.img_1.png`

Caption: I²C 像共享频道：Pi 负责打节拍和发起呼叫，多块传感器共用两根线，只有被点到的那一块回应。

Prompt: Use case: scientific-educational. Asset type: theory illustration. A 16:9 clear editorial bus diagram rendered as tactile objects: a Pi board at left connects to two long parallel slate-blue rails, with three different small sensor modules branching down from the rails. A coral call pulse and a sunflower reply pulse travel only to and from the center selected sensor, while the other two stay dim. Add a small rhythmic tick motif above the upper rail without symbols or text. No text, letters, numbers, address labels, code, logos, watermarks, or UI. Warm off-white paper texture, coral-orange focus, slate-blue secondary color.

### s4_theory — `s4.address-scan-grid.img_1.png`

Caption: Pi 挨个发出点名脉冲扫描整条总线，只有 BME280 所在的位置亮起，表示接线和地址都已确认。

Prompt: Use case: scientific-educational. Asset type: theory illustration. A 16:9 editorial visual metaphor for device discovery: a Pi board sends a coral scanning light across a neat grid of small blank rounded address tiles. Most tiles stay slate-blue and quiet; one central sunflower-yellow tile lights up and connects by a thin line to a small BME280-like sensor. Include a sequence of faint ghost pulses showing the scan sweeping through the grid, but no printed grid coordinates, labels, text, digits, terminal windows, logos, or UI. Warm off-white paper texture, coral-orange scanner, slate-blue secondary color.

### s7_image — `s7.bme280-pi-wiring.img_1.png`

Caption: BME280 与 Pi 用四根清晰分开的线连接：两根并行的 I²C 信号线，加上一根供电线和一根共地线。

Prompt: Use case: scientific-educational. Asset type: hardware wiring illustration. A 16:9 technically legible top-down editorial illustration of a compact Pi board on the left and a small square BME280 breakout module on the right. Four neat jumper wires run between them: two parallel slate-blue signal wires centered and never crossed, one coral power wire above, and one dark grounding wire below. Show connector plugs and pins by shape only, without labels or typography. Keep spacing generous so it is unmistakable that the two I²C lines stay parallel. No text, letters, numbers, pin text, logos, watermarks, literal wiring diagrams, or UI. Warm off-white paper, coral-orange power wire, slate-blue signal wires, sunflower-yellow details.

### s10_outro — `s10.environment-sensor-online.img_1.png`

Caption: 接线和点名都正确后，BME280 把温度、湿度和气压的第一串环境信息稳定送进 Pi。

Prompt: Use case: illustration-story. Asset type: lesson outro slide. A 16:9 hopeful editorial project-desk scene of a Pi and compact BME280 module correctly connected by four tidy wires. Three clean abstract environment tokens—a warm thermometer silhouette, a water droplet, and a pressure dial—travel as glowing beads from the sensor to a slate-blue record tray beside the Pi. A learner watches in the background with hands safely away from wiring. Do not show a screen, numeric readings, real data, file names, text, letters, logos, watermarks, or UI. Warm off-white paper texture, coral-orange focus, slate-blue secondary color, sunflower-yellow confirmation glow.

## Batch record

- Status: published to production on 2026-08-06.
- Runtime mappings: all six assets are mapped directly through `payload.images` in `M12-w0-i2c-bme280/slides.json`.
- SVG retirement: all six corresponding `inline_svg` values are removed.
- Verification: local mapping and manifest validation passed; production payload reports six image mappings and `legacy_svg_count: 0`; sampled image responses returned `200 image/png`.
