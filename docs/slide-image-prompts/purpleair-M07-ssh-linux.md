# PurpleAir M07 — SSH 与 Linux 文件树图片清单

课程源：`purpleair-airquality-node/knodes/M07-w0-ssh-linux/slides.json`  
资产目录：`purpleair-airquality-node/knodes/M07-w0-ssh-linux/images/`

## Shared art direction

16:9 educational editorial illustration for 10–12 year olds. Warm off-white paper background; coral-orange focal color, slate-blue secondary color, restrained sunflower-yellow accent; friendly simplified scientific and computing objects with soft grain and depth; modern Chinese science-textbook feel. Do not include readable terminal commands, words, letters, numbers, logos, watermarks, UI chrome, or tiny unreadable labels. Show computing ideas through objects, paths, folders, keys, lights, and clear spatial metaphors. Leave clear visual breathing room for surrounding slide text.

## Slide mapping and prompts

### s1_intro — `s1.remote-pi.img_1.png`

Caption: 学生的笔记本通过一条受保护的发光连线，远程操控窗边的小型树莓派电脑。

Prompt: Use case: scientific-educational. Asset type: course intro illustration. A 16:9 warm editorial scene of a learner at a laptop sending a coral command token through a braided, softly glowing slate-blue cable of light to a tiny Raspberry-Pi-like single-board computer by a window. Put a small lock-shaped light in the connection to convey secure remote access. The Pi has no monitor or keyboard. No text, terminal glyphs, letters, numbers, logos, watermarks, or UI. Off-white paper texture, coral-orange focus, slate-blue secondary color, sunflower-yellow accents.

### s2_bullet — `s2.remote-control-path.img_1.png`

Caption: 从本地电脑到远程操控，五个清晰的站点连成第一次登录树莓派的路线。

Prompt: Use case: scientific-educational. Asset type: concept-card slide illustration. A 16:9 playful editorial journey board: a laptop on the left connects through five physical stepping stones to a tiny bare single-board computer on the right. The stones use recognizable non-text objects for address, key, lock, folder tree, and project folder; a young learner's marker advances along the route. Avoid literal interface screens, written commands, letters, numbers, logos, watermarks, or UI. Warm off-white paper, coral-orange focal token, slate-blue secondary structures, sunflower-yellow accents.

### s3_theory_ssh — `s3.secure-command-line.img_1.png`

Caption: SSH 像两台电脑之间加密的电话线，命令出去、结果再安全地返回。

Prompt: Use case: scientific-educational. Asset type: theory illustration. A 16:9 friendly editorial metaphor of two simple computers facing each other across space, joined by a braided slate-blue illuminated line passing through a coral lock. Small abstract command blocks travel one direction while round result lights travel back, all inside the protected line. Include a tiny network-address house icon and a key token as visual ingredients, but no readable text, code, terminal characters, letters, numbers, logos, watermarks, or UI. Warm off-white paper texture, coral-orange focus, slate-blue secondary color, sunflower-yellow accent.

### s4_theory_fs — `s4.folder-tree.img_1.png`

Caption: 文件夹像倒着生长的树，知道当前位置后才能看清周围并走到下一层。

Prompt: Use case: scientific-educational. Asset type: theory illustration. A 16:9 elegant editorial image of an upside-down tree whose branches are clean physical folder shapes. A small glowing explorer marker stands at one folder; three simple visual gestures show look-upward to see the full path, look-around to see neighboring folders, and move into a child folder. Use no written folder names, command symbols, letters, numbers, logos, watermarks, or UI. Warm off-white paper, coral-orange explorer marker, slate-blue folder branches, sunflower-yellow path highlights.

### s5_animation — `s5.terminal-tree-walk.img_1.png`

Caption: 光标沿倒置文件树移动，当前位置、周围文件夹和下一步路径随之显现。

Prompt: Use case: scientific-educational. Asset type: animation cover illustration. A 16:9 editorial split scene: a clean dark-slate terminal-like panel with only abstract glowing blocks and a gold cursor, linked to an upside-down folder tree on paper. A golden marker moves from one folder to the next along a highlighted path while child folders softly appear. It must convey command-line navigation without real commands, letters, numbers, text, logos, watermarks, or UI chrome. Warm off-white texture, coral-orange and slate-blue palette, sunflower-yellow motion highlight.

### s6_game — `s6.folder-quest.img_1.png`

Caption: 学生在安全的模拟文件树里亲手建立项目文件夹、走进去并创建数据记录文件。

Prompt: Use case: scientific-educational. Asset type: interactive game cover. A 16:9 playful editorial tabletop puzzle: two hands place a new coral folder piece into a slate-blue upside-down folder-tree board, then add a tiny blank record-sheet token inside it. A glowing path shows the correct navigation route, with a small cheerful success sparkle. Do not show a literal terminal screen, written commands, text, letters, filenames, numerals, logos, watermarks, or UI. Warm off-white paper, coral-orange focus, slate-blue secondary color, sunflower-yellow accents.

### s_extra1 — `s_extra1.no-monitor-remote.img_1.png`

Caption: 小小的树莓派不接显示器，也能由另一台电脑通过加密连接远程指挥。

Prompt: Use case: scientific-educational. Asset type: explanatory concept illustration. A 16:9 warm editorial scene with a bare compact single-board computer on one side, no monitor or keyboard attached, and a learner's laptop on the other. Between them, a single braided cable of light carries a coral command token through a lock-shaped glow. Make the contrast between tiny unattended computer and comfortable remote workstation unmistakable. No text, letters, numbers, logos, watermarks, terminal glyphs, or UI. Off-white paper texture, coral-orange focus, slate-blue secondary color, sunflower-yellow accents.

### s9_outro — `s9.remote-key-outro.img_1.png`

Caption: 学生完成首次远程登录，拿到进入后续硬件和代码实践的钥匙。

Prompt: Use case: illustration-story. Asset type: lesson outro slide. A 16:9 hopeful editorial scene of a young learner holding a glowing coral key-shaped token beside a laptop and a small connected single-board computer. Behind them, a softly lit folder tree and a protected connection suggest new practical powers. Use warm window light and an uncluttered composition for surrounding slide copy. No text, terminal characters, letters, numbers, logos, watermarks, or UI. Warm off-white paper texture, coral-orange focus, slate-blue secondary color, sunflower-yellow accents.

## Batch record

- Status: published to production on 2026-07-31.
- Runtime mappings: all eight assets are mapped directly through `payload.images` in `M07-w0-ssh-linux/slides.json`.
- SVG retirement: all eight corresponding `inline_svg` values are removed.
- Verification: local mapping and manifest validation passed; production payload reports 8 image mappings and `legacy_svg_count: 0`; sampled image responses returned `200 image/png`.
