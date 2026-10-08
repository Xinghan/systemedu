# PurpleAir M08 — Pi 联网与校时图片清单

课程源：`purpleair-airquality-node/knodes/M08-w0-pi-zero-wifi-ntp/slides.json`  
资产目录：`purpleair-airquality-node/knodes/M08-w0-pi-zero-wifi-ntp/images/`

## Shared art direction

16:9 educational editorial illustration for 10–12 year olds. Warm off-white paper background; coral-orange focal color, slate-blue secondary color, restrained sunflower-yellow accent; friendly simplified hardware and science objects with soft grain and depth; modern Chinese science-textbook feel. Do not include words, letters, numbers, terminal commands, logos, watermarks, UI chrome, or tiny unreadable labels. Leave visual breathing room for surrounding slide text.

## Slide mapping and prompts

### s1_intro — `s1.pi-ready.img_1.png`

Caption: 一块小型 Pi 装上系统、接入无线网络并对准时钟，成为能独立工作的空气节点大脑。

Prompt: Use case: scientific-educational. Asset type: course intro illustration. A 16:9 warm editorial scene of a compact single-board computer resting beside an inserted SD card, surrounded by three gentle halos: a stack of layered system sheets, soft Wi-Fi waves, and a precise glowing analog clock. Thin light paths join all three to the Pi, showing it is being prepared to work independently. No screen attached. No text, letters, numbers, terminal commands, logos, watermarks, or UI. Off-white paper texture, coral-orange focus, slate-blue secondary color, sunflower-yellow accents.

### s2_bullet — `s2.pi-setup-trio.img_1.png`

Caption: 写入系统、接上 Wi‑Fi、校准时间，是让空白 Pi 正式就位的三步。

Prompt: Use case: scientific-educational. Asset type: concept-card slide illustration. A 16:9 clear top-down editorial triptych of three tactile stations connected in order: an SD card receiving layered system tiles, a Pi receiving slate-blue wireless waves from a home router, and a small clock aligning its hands to a bright reference clock. One coral progress token moves between stations. No literal app screens, text, letters, numbers, logos, watermarks, or UI. Warm off-white paper, coral-orange focus, slate-blue structures, sunflower-yellow highlights.

### s3_theory — `s3.ntp-time-call.img_1.png`

Caption: Pi 通过网络向精确时间源询问时间，并把消息来回的延迟也算进去。

Prompt: Use case: scientific-educational. Asset type: theory illustration. A 16:9 friendly editorial scene of a small Pi with a visibly misaligned analog clock sending a paired request-and-reply pulse through a slate-blue network line to a tall precise reference clock with subtle atomic-orbit motifs. A small round-trip arc and two moving light tokens make network delay compensation intuitive; the Pi clock becomes aligned at the end. No text, letters, numerals, equations, logos, watermarks, or UI. Warm off-white paper texture, coral-orange selected token, slate-blue secondary color, sunflower-yellow time glow.

### s4_bullet — `s4.headless-checklist.img_1.png`

Caption: 没有屏幕和键盘的 Pi 需要在烧录前一次配齐网络、远程入口和当地时间。

Prompt: Use case: scientific-educational. Asset type: explanatory concept illustration. A 16:9 editorial tabletop scene with a headless Pi, SD card, wireless router, lock key, and clock configuration tokens arranged as a preflight kit. Three subtly separated caution vignettes show an unconnected Wi-Fi wave, a closed lock, and mismatched clock hands; a final complete kit glows gently. Use visual contrast but no warning words, text, letters, numbers, logos, watermarks, literal app panels, or UI. Warm off-white paper, coral-orange focus, slate-blue secondary color, sunflower-yellow accents.

### s5_animation — `s5.ntp-clock-sync.img_1.png`

Caption: Pi 开机时钟混乱，联网请求精确时间、补偿延迟后，指针稳定对准。

Prompt: Use case: scientific-educational. Asset type: animation cover illustration. A 16:9 left-to-right editorial sequence on one canvas: a small Pi beside a confused skewed clock, a glowing request traveling through Wi-Fi waves to a precise reference clock, then a reply returning and the Pi's clock hands settling exactly aligned. Use arrows, moving light dots, and purely visual stages. No text, letters, numbers, labels, logos, watermarks, or UI. Warm off-white textured paper, coral-orange focal signal, slate-blue secondary color, sunflower-yellow time highlights.

### s6_game — `s6.pi-config-puzzle.img_1.png`

Caption: 学生在模拟配置拼图中补全 Pi 的网络、远程入口和时区设置，体验漏项后果。

Prompt: Use case: scientific-educational. Asset type: interactive game cover. A 16:9 playful editorial tabletop puzzle: two hands fit physical configuration tiles—wireless waves, a lock, a location-pin clock, and an SD-card system tile—into matching slots around a tiny Pi. One missing slot creates a dim connection while the completed set glows. Do not depict a literal computer interface, words, letters, numbers, forms, logos, watermarks, or UI widgets. Warm off-white paper, coral-orange focal tile, slate-blue board, sunflower-yellow success glow.

### s7_bullet — `s7.time-verified.img_1.png`

Caption: 本地时钟与网络时间源相连并对齐，说明时间同步服务正在可靠工作。

Prompt: Use case: scientific-educational. Asset type: explanatory concept illustration. A 16:9 elegant editorial image of a small Pi, a local analog clock, and a distant precise clock linked by two clean parallel light paths. Their hands align perfectly, and a pair of soft glowing confirmation dots sits beside the Pi. Add faint Wi-Fi waves and a calm stable composition. No text, letters, numbers, terminal commands, logos, watermarks, UI, or checkmark symbols. Warm off-white paper texture, coral-orange focus, slate-blue secondary color, sunflower-yellow accents.

### s10_outro — `s10.pi-on-duty.img_1.png`

Caption: 装好系统、连上网络、对准时间的 Pi 已准备好承接下一节真正的 Python 程序。

Prompt: Use case: illustration-story. Asset type: lesson outro slide. A 16:9 hopeful editorial scene of a compact Pi on a project desk, its SD card inserted, wireless link softly glowing toward a window, and a small accurate clock beside it. A student places the finished board next to an open project notebook, ready for the next coding step. No monitor needed; no text, letters, numbers, logos, watermarks, or UI. Warm off-white paper texture, coral-orange focus, slate-blue secondary color, sunflower-yellow accents.

## Batch record

- Status: published to production on 2026-07-31.
- Runtime mappings: all eight assets are mapped directly through `payload.images` in `M08-w0-pi-zero-wifi-ntp/slides.json`.
- SVG retirement: all eight corresponding `inline_svg` values are removed.
- Verification: local mapping and manifest validation passed; production payload reports eight image mappings and `legacy_svg_count: 0`; sampled image responses returned `200 image/png`.
