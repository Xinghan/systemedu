"""plant.basic - side-view educational plant diagram.

High-fidelity rendering:
- Sky gradient background
- Layered soil with texture
- Bezier-shaped leaves with realistic veins and gradient
- Organic stem with gradient shading
- Detailed flower with gradient petals + stamen
- Radial sun with soft glow rays
- Output via RenderSpec.defs_svg + body_svg (raw SVG)
"""

from __future__ import annotations

import math

from systemedu.agents.builtin.gameagent.object_spec import (
    LabelAnchor,
    RenderSpec,
)

META = {
    "object_key": "plant.basic",
    "description": (
        "植物整体侧视图，包含根、茎、叶、花。"
        "适合讲解植物整体结构和各部分功能。"
        "不包含叶片横截面（叶肉细胞/气孔）、根毛放大图、维管束细节等微观结构。"
    ),
    "views": ["side"],
    "must_have": ["stem", "root", "leaf_left", "leaf_right"],
    "optional": ["flower", "soil_line", "sun", "leaf_top"],
    "labelable": ["stem", "root", "leaf_left", "leaf_right", "flower", "sun", "leaf_top"],
    "parts": {
        "stem": {
            "label_zh": "茎",
            "label_en": "Stem",
            "desc_brief": "支撑植物，运输水分和有机物",
            "hint": "茎里面有什么？",
        },
        "root": {
            "label_zh": "根",
            "label_en": "Root",
            "desc_brief": "吸收水分和矿质盐，固定植株",
            "hint": "根毛有什么作用？",
        },
        "leaf_left": {
            "label_zh": "叶片",
            "label_en": "Leaf",
            "desc_brief": "进行光合作用，将光能转化为化学能",
            "hint": "叶片为什么是绿色的？",
        },
        "leaf_right": {
            "label_zh": "叶片",
            "label_en": "Leaf",
            "desc_brief": "进行光合作用，将光能转化为化学能",
            "hint": "",
        },
        "leaf_top": {
            "label_zh": "顶叶",
            "label_en": "Top Leaf",
            "desc_brief": "朝向阳光，最大化光合作用效率",
            "hint": "",
        },
        "flower": {
            "label_zh": "花",
            "label_en": "Flower",
            "desc_brief": "有性生殖器官，吸引传粉者，产生种子",
            "hint": "花的哪些部分用于繁殖？",
        },
        "sun": {
            "label_zh": "阳光",
            "label_en": "Sunlight",
            "desc_brief": "光合作用的能量来源",
            "hint": "光合作用需要哪种颜色的光？",
        },
        "soil_line": {
            "label_zh": "土壤",
            "label_en": "Soil",
            "desc_brief": "提供矿质元素和水，支撑根系",
            "hint": "",
        },
    },
}


def _p(d, fill="none", stroke="none", sw=1, **kw) -> str:
    attrs = f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"'
    for k, v in kw.items():
        attrs += f' {k.replace("_", "-")}="{v}"'
    return f'<path d="{d}" {attrs}/>'


def _e(cx, cy, rx, ry, fill, stroke="none", sw=1, opacity=1, **kw) -> str:
    attrs = f'cx="{cx:.2f}" cy="{cy:.2f}" rx="{rx:.2f}" ry="{ry:.2f}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"'
    if opacity != 1:
        attrs += f' opacity="{opacity}"'
    for k, v in kw.items():
        attrs += f' {k.replace("_", "-")}="{v}"'
    return f'<ellipse {attrs}/>'


def _g(part_id, content) -> str:
    return f'<g data-part="{part_id}">{content}</g>'


def build(view: str = "side", variant: str | None = None) -> RenderSpec:
    """Build a high-fidelity plant diagram. ViewBox: 0 0 560 460"""
    W, H = 560, 460
    cx = W / 2   # 280
    soil_y = 320.0
    stem_bot = soil_y - 2
    stem_top = 150.0
    stem_cx = cx

    defs = """
<linearGradient id="pl_sky" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%" stop-color="#87CEEB"/>
  <stop offset="100%" stop-color="#E0F4FF"/>
</linearGradient>
<linearGradient id="pl_soil" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%" stop-color="#5D4037"/>
  <stop offset="30%" stop-color="#6D4C41"/>
  <stop offset="100%" stop-color="#4E342E"/>
</linearGradient>
<linearGradient id="pl_stem" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0%" stop-color="#2E7D32"/>
  <stop offset="40%" stop-color="#66BB6A"/>
  <stop offset="100%" stop-color="#1B5E20"/>
</linearGradient>
<linearGradient id="pl_leaf_r" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0%" stop-color="#A5D6A7"/>
  <stop offset="40%" stop-color="#4CAF50"/>
  <stop offset="100%" stop-color="#2E7D32"/>
</linearGradient>
<linearGradient id="pl_leaf_l" x1="1" y1="0" x2="0" y2="1">
  <stop offset="0%" stop-color="#A5D6A7"/>
  <stop offset="40%" stop-color="#43A047"/>
  <stop offset="100%" stop-color="#1B5E20"/>
</linearGradient>
<linearGradient id="pl_petal" x1="0" y1="0" x2="0.5" y2="1">
  <stop offset="0%" stop-color="#FCE4EC"/>
  <stop offset="60%" stop-color="#F48FB1"/>
  <stop offset="100%" stop-color="#E91E63"/>
</linearGradient>
<radialGradient id="pl_sun" cx="40%" cy="38%" r="60%">
  <stop offset="0%" stop-color="#FFFDE7"/>
  <stop offset="50%" stop-color="#FDD835"/>
  <stop offset="100%" stop-color="#F57F17"/>
</radialGradient>
"""

    parts = []

    # ── Sky background ────────────────────────────────────────────────────────
    parts.append(f'<rect x="0" y="0" width="{W}" height="{soil_y:.1f}" fill="url(#pl_sky)"/>')

    # ── Soil ─────────────────────────────────────────────────────────────────
    parts.append(_g("soil_line",
        f'<rect x="0" y="{soil_y:.1f}" width="{W}" height="{H - soil_y:.1f}" fill="url(#pl_soil)"/>' +
        # darker top soil band
        f'<rect x="0" y="{soil_y:.1f}" width="{W}" height="14" fill="#3E2723" opacity="0.55"/>' +
        # pebble texture hints
        _e(cx - 80, soil_y + 30, 10, 6, fill="#4E342E", opacity=0.5) +
        _e(cx + 60, soil_y + 22, 8, 5, fill="#4E342E", opacity=0.45) +
        _e(cx - 20, soil_y + 55, 6, 4, fill="#3E2723", opacity=0.4)
    ))

    # ── Roots ────────────────────────────────────────────────────────────────
    root_color = "#8D6E63"
    root_content = (
        # main taproot
        _p(f"M {cx:.1f},{soil_y:.1f} C {cx-4:.1f},{soil_y+50:.1f} {cx+4:.1f},{soil_y+80:.1f} {cx:.1f},{soil_y+110:.1f}",
           stroke=root_color, sw=4, stroke_linecap="round") +
        # lateral roots
        _p(f"M {cx:.1f},{soil_y+28:.1f} C {cx-40:.1f},{soil_y+24:.1f} {cx-70:.1f},{soil_y+14:.1f} {cx-85:.1f},{soil_y+30:.1f}",
           stroke=root_color, sw=2.5, stroke_linecap="round") +
        _p(f"M {cx:.1f},{soil_y+28:.1f} C {cx+40:.1f},{soil_y+24:.1f} {cx+70:.1f},{soil_y+14:.1f} {cx+85:.1f},{soil_y+30:.1f}",
           stroke=root_color, sw=2.5, stroke_linecap="round") +
        _p(f"M {cx-50:.1f},{soil_y+28:.1f} C {cx-70:.1f},{soil_y+42:.1f} {cx-90:.1f},{soil_y+52:.1f} {cx-75:.1f},{soil_y+68:.1f}",
           stroke=root_color, sw=1.5, stroke_linecap="round") +
        _p(f"M {cx+50:.1f},{soil_y+28:.1f} C {cx+70:.1f},{soil_y+42:.1f} {cx+90:.1f},{soil_y+52:.1f} {cx+75:.1f},{soil_y+68:.1f}",
           stroke=root_color, sw=1.5, stroke_linecap="round") +
        # fine root tips
        _p(f"M {cx-75:.1f},{soil_y+68:.1f} C {cx-88:.1f},{soil_y+78:.1f} {cx-82:.1f},{soil_y+85:.1f} {cx-72:.1f},{soil_y+82:.1f}",
           stroke=root_color, sw=0.9, stroke_linecap="round", opacity="0.7") +
        _p(f"M {cx+75:.1f},{soil_y+68:.1f} C {cx+88:.1f},{soil_y+78:.1f} {cx+82:.1f},{soil_y+85:.1f} {cx+72:.1f},{soil_y+82:.1f}",
           stroke=root_color, sw=0.9, stroke_linecap="round", opacity="0.7")
    )
    parts.append(_g("root", root_content))

    # ── Stem ─────────────────────────────────────────────────────────────────
    # slightly curved stem
    stem_content = (
        # outline (enlarged)
        _p(f"M {stem_cx-9:.1f},{stem_bot:.1f} C {stem_cx-10:.1f},{(stem_top+stem_bot)/2:.1f} "
           f"{stem_cx-8:.1f},{stem_top+20:.1f} {stem_cx:.1f},{stem_top:.1f} "
           f"C {stem_cx+8:.1f},{stem_top+20:.1f} {stem_cx+10:.1f},{(stem_top+stem_bot)/2:.1f} "
           f"{stem_cx+9:.1f},{stem_bot:.1f} Z",
           fill="#1B5E20") +
        # gradient fill
        _p(f"M {stem_cx-7:.1f},{stem_bot:.1f} C {stem_cx-8:.1f},{(stem_top+stem_bot)/2:.1f} "
           f"{stem_cx-6:.1f},{stem_top+18:.1f} {stem_cx:.1f},{stem_top:.1f} "
           f"C {stem_cx+6:.1f},{stem_top+18:.1f} {stem_cx+8:.1f},{(stem_top+stem_bot)/2:.1f} "
           f"{stem_cx+7:.1f},{stem_bot:.1f} Z",
           fill="url(#pl_stem)")
    )
    parts.append(_g("stem", stem_content))

    # ── Leaf right (upper-right) ──────────────────────────────────────────────
    lr_y = stem_top + (stem_bot - stem_top) * 0.30   # attach point ~215
    lr_d = (f"M {stem_cx+6:.1f},{lr_y:.1f} "
            f"C {stem_cx+55:.1f},{lr_y-35:.1f} {stem_cx+95:.1f},{lr_y-15:.1f} {stem_cx+82:.1f},{lr_y+18:.1f} "
            f"C {stem_cx+60:.1f},{lr_y+38:.1f} {stem_cx+22:.1f},{lr_y+25:.1f} {stem_cx+6:.1f},{lr_y:.1f} Z")
    parts.append(_g("leaf_right",
        _p(lr_d, fill="url(#pl_leaf_r)", stroke="#2E7D32", sw=1.2) +
        # midrib
        _p(f"M {stem_cx+6:.1f},{lr_y+4:.1f} Q {stem_cx+50:.1f},{lr_y+2:.1f} {stem_cx+80:.1f},{lr_y+16:.1f}",
           stroke="#1B5E20", sw=1.2, stroke_linecap="round") +
        # side veins
        _p(f"M {stem_cx+22:.1f},{lr_y+2:.1f} L {stem_cx+36:.1f},{lr_y-14:.1f}",
           stroke="#2E7D32", sw=0.7, opacity="0.7") +
        _p(f"M {stem_cx+42:.1f},{lr_y+2:.1f} L {stem_cx+60:.1f},{lr_y-10:.1f}",
           stroke="#2E7D32", sw=0.7, opacity="0.7") +
        _p(f"M {stem_cx+58:.1f},{lr_y+6:.1f} L {stem_cx+78:.1f},{lr_y+4:.1f}",
           stroke="#2E7D32", sw=0.7, opacity="0.7")
    ))

    # ── Leaf left (lower-left) ────────────────────────────────────────────────
    ll_y = stem_top + (stem_bot - stem_top) * 0.55   # attach point ~265
    ll_d = (f"M {stem_cx-6:.1f},{ll_y:.1f} "
            f"C {stem_cx-55:.1f},{ll_y-32:.1f} {stem_cx-92:.1f},{ll_y-12:.1f} {stem_cx-78:.1f},{ll_y+20:.1f} "
            f"C {stem_cx-58:.1f},{ll_y+40:.1f} {stem_cx-20:.1f},{ll_y+28:.1f} {stem_cx-6:.1f},{ll_y:.1f} Z")
    parts.append(_g("leaf_left",
        _p(ll_d, fill="url(#pl_leaf_l)", stroke="#2E7D32", sw=1.2) +
        _p(f"M {stem_cx-6:.1f},{ll_y+4:.1f} Q {stem_cx-50:.1f},{ll_y+4:.1f} {stem_cx-76:.1f},{ll_y+18:.1f}",
           stroke="#1B5E20", sw=1.2, stroke_linecap="round") +
        _p(f"M {stem_cx-22:.1f},{ll_y+3:.1f} L {stem_cx-38:.1f},{ll_y-12:.1f}",
           stroke="#2E7D32", sw=0.7, opacity="0.7") +
        _p(f"M {stem_cx-44:.1f},{ll_y+3:.1f} L {stem_cx-62:.1f},{ll_y-8:.1f}",
           stroke="#2E7D32", sw=0.7, opacity="0.7")
    ))

    # ── Top leaf ─────────────────────────────────────────────────────────────
    lt_d = (f"M {stem_cx:.1f},{stem_top:.1f} "
            f"C {stem_cx+42:.1f},{stem_top-50:.1f} {stem_cx+48:.1f},{stem_top-10:.1f} {stem_cx+12:.1f},{stem_top+22:.1f} "
            f"C {stem_cx+4:.1f},{stem_top+22:.1f} {stem_cx-2:.1f},{stem_top+8:.1f} {stem_cx:.1f},{stem_top:.1f} Z")
    parts.append(_g("leaf_top",
        _p(lt_d, fill="url(#pl_leaf_r)", stroke="#2E7D32", sw=1.2) +
        _p(f"M {stem_cx:.1f},{stem_top:.1f} Q {stem_cx+28:.1f},{stem_top-14:.1f} {stem_cx+44:.1f},{stem_top-4:.1f}",
           stroke="#1B5E20", sw=1.0, stroke_linecap="round")
    ))

    # ── Flower ───────────────────────────────────────────────────────────────
    flower_cx, flower_cy = stem_cx, stem_top - 28
    petal_r = 18.0
    petal_svgs = ""
    for i in range(5):
        a = math.radians(i * 72 - 90)
        px = flower_cx + 22 * math.cos(a)
        py = flower_cy + 22 * math.sin(a)
        # each petal is an ellipse rotated around bloom center
        rot = i * 72 - 90
        petal_svgs += (
            f'<ellipse cx="{px:.1f}" cy="{py:.1f}" rx="{petal_r:.1f}" ry="{petal_r*0.65:.1f}" '
            f'fill="url(#pl_petal)" stroke="#E91E63" stroke-width="0.8" '
            f'transform="rotate({rot} {px:.1f} {py:.1f})"/>'
        )
    parts.append(_g("flower",
        petal_svgs +
        # stamen center (yellow)
        _e(flower_cx, flower_cy, 11, 11, fill="#FDD835", stroke="#F9A825", sw=1.5) +
        _e(flower_cx, flower_cy, 7, 7, fill="#FFEE58") +
        _e(flower_cx - 3, flower_cy - 3, 3, 2.5, fill="white", opacity=0.45)
    ))

    # ── Sun ──────────────────────────────────────────────────────────────────
    sun_cx, sun_cy = 456.0, 64.0
    sun_r = 30.0
    ray_lines = ""
    for i in range(8):
        a = math.radians(i * 45)
        x1 = sun_cx + (sun_r + 8) * math.cos(a)
        y1 = sun_cy + (sun_r + 8) * math.sin(a)
        x2 = sun_cx + (sun_r + 22) * math.cos(a)
        y2 = sun_cy + (sun_r + 22) * math.sin(a)
        ray_lines += f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="#FDD835" stroke-width="2.5" stroke-linecap="round" opacity="0.9"/>'
    parts.append(_g("sun",
        _e(sun_cx, sun_cy, sun_r + 18, sun_r + 18, fill="#FFF9C4", opacity=0.25) +
        ray_lines +
        _e(sun_cx, sun_cy, sun_r, sun_r, fill="url(#pl_sun)", stroke="#F9A825", sw=1.5) +
        _e(sun_cx - 9, sun_cy - 9, 10, 8, fill="white", opacity=0.3)
    ))

    body_svg = "\n".join(parts)

    # ── Anchors (% of 560x460) ─────────────────────────────────────────────────
    def px(x): return round(x / W * 100, 1)
    def py(y): return round(y / H * 100, 1)

    anchors = [
        LabelAnchor(part_id="sun",        x=px(sun_cx + sun_r + 26), y=py(sun_cy)),
        LabelAnchor(part_id="flower",     x=px(flower_cx + 36),       y=py(flower_cy - 10)),
        LabelAnchor(part_id="leaf_top",   x=px(stem_cx + 58),         y=py(stem_top - 28)),
        LabelAnchor(part_id="leaf_right", x=px(stem_cx + 90),         y=py(lr_y)),
        LabelAnchor(part_id="stem",       x=px(stem_cx + 22),         y=py((stem_top + stem_bot) / 2 + 10)),
        LabelAnchor(part_id="leaf_left",  x=px(stem_cx - 88),         y=py(ll_y + 5)),
        LabelAnchor(part_id="soil_line",  x=px(60),                   y=py(soil_y + 18)),
        LabelAnchor(part_id="root",       x=px(stem_cx + 90),         y=py(soil_y + 50)),
    ]

    rendered_parts = [
        "sun", "flower", "leaf_top", "leaf_right", "leaf_left", "stem", "soil_line", "root",
    ]

    return RenderSpec(
        object_key="plant.basic",
        viewbox=f"0 0 {W} {H}",
        shapes=[],
        anchors=anchors,
        rendered_parts=rendered_parts,
        defs_svg=defs.strip(),
        body_svg=body_svg,
    )
