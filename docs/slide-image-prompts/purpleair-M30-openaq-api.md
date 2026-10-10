# PurpleAir M30「联网取 OpenAQ 数据」— 逐图 Prompt

- 项目 slug：`purpleair-airquality-node` ｜ 节点：`M30-w0-python-openaq`
- 共 8 张必做：不为已有动画、视频或互动资源额外生成静态封面。
- 统一视觉：16:9、暖象牙纸、水彩与水粉科学教材插图、细铅笔描线、自然木桌面；石板蓝为结构色、珊瑚橙为重点、赭黄少量提示、蓝色数据珠。拒绝写实照片、塑料 3D、扁平矢量、任何文字/代码/数字/Logo/水印/UI。

| slide_id | filename | caption |
|---|---|---|
| s1_intro | `s1.request-data-home.v2.webp` | 孩子从自己的节点发出只读请求，把远方公开空气数据带回工作台。 |
| s2_bullet | `s2.local-to-public-network.v2.webp` | 本地节点不再是孤岛：它通过网络连接到公开数据站，获得更多对照证据。 |
| s3_theory_rest | `s3.request-response-pair.v2.webp` | 程序递出一份清楚的请求，服务器按要求送回一份数据包。 |
| s4_bullet2 | `s4.read-or-write.v2.webp` | GET 只打开、查看、带走副本；POST 才会把新东西写进服务器。 |
| s5_theory_json | `s5.nested-json-boxes.v2.webp` | 数据包按标签装进层层嵌套的盒子与队列，顺着结构才能取出读数。 |
| s6_bullet3 | `s6.check-before-open.v2.webp` | 先确认请求成功，再按一字不差的标签拆包，避免把错误包当数据。 |
| s8_game | `s8.request-builder.v2.webp` | 孩子亲手组合请求、等回包、检查状态并在嵌套盒子中取出数据珠。 |
| s11_outro | `s11.network-door-open.v2.webp` | 节点连接公开数据网络，孩子第一次能把远方真实读数带回自己的研究。 |

## Prompts

### s1 — 请求把数据带回家

Use case: scientific-educational. Asset type: course intro illustration. On a warm ivory paper workbench, a child’s small weatherproof air-quality node at left releases a sealed slate-blue request capsule into a simple glowing blue connection line. At right, a distant public data station—an unbranded, friendly slate-blue cabinet filled with many neat blue data beads—sends back a nested ivory data parcel containing one highlighted blue bead. Make the return journey toward the child’s open collection tray unmistakable. No text, code, browser or phone UI, logos, numbers, charts, or watermarks. Use the shared visual contract.

### s2 — 从本地点到公开网络

Use case: scientific-educational. Asset type: concept illustration. A compact weatherproof node on one side of a natural wood workbench has a small tray with only a short row of blue beads. A graceful slate-blue connection bridge reaches across to a larger unbranded public data archive on the other side, where many separate bead trays are gathered; one return ribbon carries extra beads back toward the local tray. Show the local node gaining useful wider context rather than competing with other stations. No labels, maps with text, code, screen UI, logos, watermarks, numbers, or charts. Use the shared visual contract.

### s3 — 一问一答

Use case: scientific-educational. Asset type: theory illustration. A learner’s hand slides one small sealed blue request envelope into the inlet of a friendly slate-blue data server cabinet. From a separate outlet, the cabinet returns one neatly tied ivory data parcel with a visible stack of nested blank compartments and a blue bead peeking from the innermost layer. The two opposite-direction paths should clearly show ask then answer. Tactile watercolor science textbook art, no restaurant or screen imagery, no text, letters, digits, code, UI, logos, charts, or watermarks. Use the shared visual contract.

### s4 — GET 与 POST

Use case: scientific-educational. Asset type: concept illustration. One slate-blue public data cabinet has two distinct safe-to-compare actions: on the left, a transparent read-only viewing drawer opens and lets a blue bead copy travel out onto a visitor tray while every original bead stays inside; on the right, a coral-orange deposit chute accepts a new bead and visibly adds it to the cabinet’s internal row. A child hand gently uses only the read-only drawer. Convey viewing versus changing data without text, code, buttons, browser UI, numbers, labels, logos, or watermarks. Use the shared visual contract.

### s5 — JSON 嵌套盒子

Use case: scientific-educational. Asset type: theory illustration. A large open ivory parcel box sits on a natural wood workbench. Inside is one neatly nested slate-blue compartment; within it, a short orderly row of three identical smaller unmarked compartments; one selected small compartment opens to reveal a single bright blue data bead. Each layer has a blank tactile tab shape, making “tagged containers inside containers and a list” visible without writing. A child finger follows the layers from outer to inner. No text, letters, numbers, code, UI, charts, logos, or watermarks. Use the shared visual contract.

### s6 — 先确认再拆

Use case: scientific-educational. Asset type: concept illustration. At a tidy workbench checkpoint, a sealed ivory response parcel first passes through one clear green-blue approval window before a child opens its nested compartments. Beside it, two sealed parcels sit behind gentle stop gates: one coral-red closed gate and one warm amber waiting gate. On the approved parcel, a set of three unique blank-shaped tabs precisely matches three matching slots on the nested boxes, emphasizing exact keys. No text, digits, status-code numbers, code, UI, charts, logos, or watermarks. Use the shared visual contract.

### s8 — 请求拼装台

Use case: scientific-educational. Asset type: interactive game cover. A child’s hands assemble a small tactile request builder on an ivory workbench: three blank selection tokens click into a slate-blue request capsule, which travels along a blue line to a miniature public data cabinet. A green-blue approval token returns with a layered ivory parcel; the child’s other hand opens the innermost compartment to pick one blue data bead. A spare mismatched coral token rests clearly aside. No writing, text, numbers, computer screens, UI, labels, logos, charts, or watermarks. Use the shared visual contract.

### s11 — 公开数据之门打开

Use case: illustration-story. Asset type: lesson outro. At a warm evening window, a child’s weatherproof air-quality node sits beside an open research tray. A graceful blue thread of light reaches from the node toward a distant, unbranded public data archive across a softly suggested city skyline and returns as a small layered ivory parcel carrying blue beads. The child places the returned bead alongside the node’s own beads in the research tray, showing local and public data can now work together. No text, maps with labels, code, screen UI, logos, numbers, charts, or watermarks. Use the shared visual contract.

## Batch record

- Status: eight images generated, reviewed and mapped locally on 2026-08-26; pending the next production content deployment.
- Runtime mapping: every visual M30 slide maps directly to one versioned file under `images/remake-v2/` in `M30-w0-python-openaq/slides.json`.
- Verification: all eight files are WebP with captions and are 121–207 KiB; the regenerated PurpleAir course manifest has no missing or mismatched files.
- SVG retirement: retain legacy `inline_svg` until the node’s mapped images and production image URLs have been verified.
