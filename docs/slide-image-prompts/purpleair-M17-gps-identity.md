# PurpleAir M17 — 节点身份与 GPS 定位图片清单

课程源：`purpleair-airquality-node/knodes/M17-w0-gps/slides.json`  
资产目录：`purpleair-airquality-node/knodes/M17-w0-gps/images/`

## Shared art direction

16:9 premium educational editorial illustration for 10–12 year olds. Friendly 3D clay plus clean vector hybrid, deep violet / indigo background, coral and lavender location paths, restrained sunflower-yellow highlights, rounded technically legible node hardware and map objects, generous negative space. Coordinates and identity are represented only with abstract pins, latitude/longitude bands, blank cards, and pictorial records—never readable values. Do not include words, letters, numbers, labels, code, file names, logos, watermarks, UI, or tiny pseudo-text.

## Slide mapping and prompts

### s1_intro — `s1.device-becomes-map-point.img_1.png`

Caption: 装好、命名并记下坐标后，桌上的设备就能成为地图上一个可被找到的真实点。

Prompt: Use case: scientific-educational. Asset type: course intro illustration. A 16:9 magical but technically grounded scene: a compact air-quality sensor node on a desk transforms through a glowing coral-and-lavender path into one bright pinpoint on a simplified unlabeled globe and map grid. Nearby, a blank identity card and a blank photo frame visually suggest a complete record without any writing. Deep violet background, friendly premium 3D clay plus clean vector hybrid, rounded forms, no text, letters, numbers, labels, UI, logos, or watermarks.

### s2_bullet — `s2.anonymous-node-problem.img_1.png`

Caption: 没有坐标、名字和安装照片，节点就像一颗在数据堆里认不出的匿名小点。

Prompt: Use case: scientific-educational. Asset type: concept illustration. A 16:9 scene of a compact sensor node surrounded by three visual absences: an unlabeled map grid with one uncertain unpinned spot, a tray of indistinguishable matching nodes, and an empty photo frame with a soft blank interior. In the foreground, a single completed glowing set—location pin, blank identity token, and photo frame—shows what is missing without checkmarks or symbols. Deep violet background, coral / lavender / sunflower accents, premium friendly 3D clay plus vector hybrid. No words, letters, numbers, question marks, labels, UI, logos, or watermarks.

### s3_theory_gps — `s3.globe-coordinate-lock.img_1.png`

Caption: 经度和纬度像两道全球通用的定位线，交叉的位置就能唯一锁定地球上的一个点。

Prompt: Use case: scientific-educational. Asset type: theory illustration. A 16:9 tactile miniature globe with elegant curved latitude bands and longitude bands, all completely unlabeled. Two distinct glowing coral and lavender locating arcs cross at one tiny sunflower point on the globe, then connect to a simplified map tile below. Add a small generic house silhouette off to the side as contrast between local address and global location, but do not include signs or marks. Deep violet background, friendly premium 3D clay plus clean vector hybrid, no words, letters, numbers, coordinate values, labels, UI, logos, or watermarks.

### s6_kit — `s6.installation-identity-kit.img_1.png`

Caption: 固定件、手机定位、安装照片和记录本把节点的位置与身份资料收在同一套档案里。

Prompt: Use case: scientific-educational. Asset type: maker kit overview illustration. A 16:9 tidy tabletop of a small sensor enclosure, rounded mounting strap and hook, a smartphone displaying only an abstract unlabeled map pin on a blank grid, a simple camera or photo frame with a blank image, and a plain notebook with empty unmarked pages. Thin coral and lavender paths connect all objects into one identity archive. Deep violet background, premium friendly 3D clay plus clean vector hybrid, no text, letters, numbers, app UI, labels, logos, or watermarks.

### s9_handson — `s9.install-name-locate-document.img_1.png`

Caption: 选好位置、稳固安装、起一个名字、抄全坐标、拍照存档，五步让节点成为可信的地图点。

Prompt: Use case: scientific-educational. Asset type: hands-on workflow illustration. A 16:9 five-stage pictorial progression without written arrows: choose an airy shaded exterior spot, fasten a small enclosure securely at breathing height, attach a blank colored identity tag, use a phone with an abstract pin on a blank map grid, and capture the installed node in a blank framed photo. The five stages are connected by one coral path and lavender location glow. Deep violet setting, friendly premium 3D clay plus clean vector hybrid, no text, letters, numbers, labels, UI, logos, or watermarks.

### s10_exercise — `s10.location-record-reasoning.img_1.png`

Caption: 全球坐标、完整精度、呼吸带高度和名字坐标照片三件套，共同决定这条数据能不能被正确理解和信任。

Prompt: Use case: scientific-educational. Asset type: concept recap illustration. A 16:9 balanced four-part visual without written labels: a tiny globe and local house comparison, nested precision rings converging on one map pin, a sensor mounted at a person’s breathing-zone height beside a wall, and a grouped blank identity token plus blank map card plus blank photo frame. Use visual consistency and calm learning cues, no question marks, letters, numerals, labels, UI, logos, or watermarks. Deep violet background, coral and lavender paths, sunflower highlights, premium 3D clay plus vector hybrid.

### s11_outro — `s11.verified-map-point.img_1.png`

Caption: 有名字、有完整坐标、也有安装照片的节点，正式成为地图上可追溯、可被信任的真实点。

Prompt: Use case: illustration-story. Asset type: lesson outro illustration. A 16:9 uplifting scene of a completed exterior sensor node glowing softly on a building wall while an elegant unlabeled globe and map grid behind it show one warm pinpoint. In the foreground, three linked blank artifacts—a small identity card, map tile with a simple pin, and framed installation photo—form a dependable archive. A young learner observes proudly from a nearby window. Deep violet / indigo background, coral and lavender location trails, sunflower accents, friendly premium 3D clay plus clean vector hybrid, no text, letters, numbers, labels, UI, logos, or watermarks.

## Batch record

- Status: published to production on 2026-08-07.
- Runtime mappings: all seven assets are mapped directly through `payload.images` in `M17-w0-gps/slides.json`.
- SVG retirement: all seven corresponding `inline_svg` values are removed.
- Verification: local mapping and manifest validation passed; production payload reports seven image mappings and `legacy_svg_count: 0`; sampled image responses returned `200 image/png`.
