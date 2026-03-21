"""cell.animal - animal cell cross-section educational diagram.

High-fidelity rendering:
- Translucent cytoplasm with radial gradient (warm yellow-green)
- Double-layered cell membrane with phospholipid dots
- Nucleus with gradient + nuclear pore detail
- Mitochondria as proper bean shapes with cristae
- Rough ER as parallel wavy membrane pairs
- Golgi as stacked curved ribbon stacks
- Ribosomes as paired ellipses
- Output via RenderSpec.defs_svg + body_svg (raw SVG)
"""

from __future__ import annotations

import math

from systemedu.agents.builtin.gameagent.object_spec import (
    LabelAnchor,
    RenderSpec,
)

META = {
    "object_key": "cell.animal",
    "description": (
        "动物细胞横截面图，包含细胞膜、细胞核、细胞质及主要细胞器（线粒体、核糖体、内质网、高尔基体）。"
        "适合讲解动物细胞结构和细胞器功能。"
        "不包含细胞壁、叶绿体（植物细胞专有），不包含细菌（原核细胞）结构。"
    ),
    "views": ["cross_section"],
    "must_have": ["cell_membrane", "nucleus", "cytoplasm"],
    "optional": ["nucleolus", "mitochondria_1", "mitochondria_2", "ribosome", "er_rough", "golgi", "vacuole"],
    "labelable": [
        "cell_membrane", "nucleus", "nucleolus",
        "mitochondria_1", "ribosome", "er_rough", "golgi", "vacuole", "cytoplasm",
    ],
    "parts": {
        "cell_membrane": {
            "label_zh": "细胞膜",
            "label_en": "Cell Membrane",
            "desc_brief": "控制物质进出细胞，保护细胞内部环境",
            "hint": "细胞膜是由什么组成的？",
        },
        "nucleus": {
            "label_zh": "细胞核",
            "label_en": "Nucleus",
            "desc_brief": "含有遗传物质 DNA，控制细胞的生命活动",
            "hint": "所有细胞都有细胞核吗？",
        },
        "nucleolus": {
            "label_zh": "核仁",
            "label_en": "Nucleolus",
            "desc_brief": "合成核糖体 RNA，参与蛋白质合成",
            "hint": "核仁在哪里？",
        },
        "cytoplasm": {
            "label_zh": "细胞质",
            "label_en": "Cytoplasm",
            "desc_brief": "细胞膜内充满的胶状液体，各种细胞器悬浮其中",
            "hint": "",
        },
        "mitochondria_1": {
            "label_zh": "线粒体",
            "label_en": "Mitochondria",
            "desc_brief": "细胞的能量工厂，通过细胞呼吸产生 ATP",
            "hint": "为什么线粒体被称为能量工厂？",
        },
        "mitochondria_2": {
            "label_zh": "线粒体",
            "label_en": "Mitochondria",
            "desc_brief": "细胞的能量工厂，通过细胞呼吸产生 ATP",
            "hint": "",
        },
        "ribosome": {
            "label_zh": "核糖体",
            "label_en": "Ribosome",
            "desc_brief": "蛋白质合成的场所，几乎存在于所有细胞中",
            "hint": "核糖体有多大？",
        },
        "er_rough": {
            "label_zh": "内质网",
            "label_en": "Endoplasmic Reticulum",
            "desc_brief": "细胞内的运输网络，参与蛋白质和脂质的合成运输",
            "hint": "粗面内质网和滑面内质网有什么区别？",
        },
        "golgi": {
            "label_zh": "高尔基体",
            "label_en": "Golgi Apparatus",
            "desc_brief": '加工、分类和分发蛋白质的"物流中心"',
            "hint": "高尔基体怎么运输蛋白质？",
        },
        "vacuole": {
            "label_zh": "液泡",
            "label_en": "Vacuole",
            "desc_brief": "储存水分和代谢废物，动物细胞液泡较小",
            "hint": "动物细胞和植物细胞的液泡有什么不同？",
        },
    },
}


def _e(cx, cy, rx, ry, fill, stroke="none", sw=1, opacity=1, **kw) -> str:
    attrs = f'cx="{cx:.2f}" cy="{cy:.2f}" rx="{rx:.2f}" ry="{ry:.2f}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"'
    if opacity != 1:
        attrs += f' opacity="{opacity}"'
    for k, v in kw.items():
        attrs += f' {k.replace("_", "-")}="{v}"'
    return f'<ellipse {attrs}/>'


def _p(d, fill="none", stroke="none", sw=1, **kw) -> str:
    attrs = f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"'
    for k, v in kw.items():
        attrs += f' {k.replace("_", "-")}="{v}"'
    return f'<path d="{d}" {attrs}/>'


def _g(part_id, content) -> str:
    return f'<g data-part="{part_id}">{content}</g>'


def _mito(mx, my, rx, ry, rot=0) -> str:
    """Bean-shaped mitochondrion with outer membrane, inner membrane, cristae."""
    # outer envelope
    outer = (f'<ellipse cx="{mx:.1f}" cy="{my:.1f}" rx="{rx:.1f}" ry="{ry:.1f}" '
             f'fill="#FFF3E0" stroke="#E65100" stroke-width="1.8" '
             f'transform="rotate({rot} {mx:.1f} {my:.1f})"/>')
    # inner fill gradient
    inner = (f'<ellipse cx="{mx:.1f}" cy="{my:.1f}" rx="{rx*0.82:.1f}" ry="{ry*0.78:.1f}" '
             f'fill="url(#cl_mito)" stroke="#FF6D00" stroke-width="0.8" '
             f'transform="rotate({rot} {mx:.1f} {my:.1f})"/>')
    # cristae (folded inner membrane)
    c = math.cos(math.radians(rot))
    s = math.sin(math.radians(rot))
    def rot_pt(px, py):
        return mx + (px - mx) * c - (py - my) * s, my + (px - mx) * s + (py - my) * c
    cristae = ""
    for i in range(3):
        cy_offset = -ry * 0.35 + i * ry * 0.35
        x0, y0 = mx - rx * 0.6, my + cy_offset
        x1, y1 = mx + rx * 0.6, my + cy_offset
        xm, ym = mx, my + cy_offset - ry * 0.18
        r0 = rot_pt(x0, y0)
        r1 = rot_pt(x1, y1)
        rm = rot_pt(xm, ym)
        cristae += (f'<path d="M {r0[0]:.1f},{r0[1]:.1f} Q {rm[0]:.1f},{rm[1]:.1f} {r1[0]:.1f},{r1[1]:.1f}" '
                    f'fill="none" stroke="#FF8F00" stroke-width="1.0" opacity="0.7"/>')
    # highlight
    hx, hy = rot_pt(mx - rx * 0.28, my - ry * 0.28)
    hl = f'<ellipse cx="{hx:.1f}" cy="{hy:.1f}" rx="{rx*0.18:.1f}" ry="{ry*0.16:.1f}" fill="white" opacity="0.35"/>'
    return outer + inner + cristae + hl


def build(view: str = "cross_section", variant: str | None = None) -> RenderSpec:
    """Build a high-fidelity animal cell. ViewBox: 0 0 560 420"""
    W, H = 560, 420
    cx, cy = W / 2, H / 2   # 280, 210
    cell_rx, cell_ry = 225.0, 175.0

    # nucleus position
    nuc_cx, nuc_cy = cx - 22, cy - 8
    nuc_rx, nuc_ry = 64.0, 55.0

    defs = f"""
<radialGradient id="cl_cyto" cx="40%" cy="35%" r="65%">
  <stop offset="0%" stop-color="#FFFFF0"/>
  <stop offset="60%" stop-color="#FFFDE7"/>
  <stop offset="100%" stop-color="#F0E68C" stop-opacity="0.7"/>
</radialGradient>
<radialGradient id="cl_nucleus" cx="35%" cy="30%" r="65%">
  <stop offset="0%" stop-color="#E3F2FD"/>
  <stop offset="55%" stop-color="#90CAF9"/>
  <stop offset="100%" stop-color="#1565C0"/>
</radialGradient>
<radialGradient id="cl_nucleolus" cx="40%" cy="35%" r="65%">
  <stop offset="0%" stop-color="#D1C4E9"/>
  <stop offset="60%" stop-color="#7B1FA2"/>
  <stop offset="100%" stop-color="#4A148C"/>
</radialGradient>
<radialGradient id="cl_mito" cx="35%" cy="30%" r="65%">
  <stop offset="0%" stop-color="#FFF8E1"/>
  <stop offset="55%" stop-color="#FFB300"/>
  <stop offset="100%" stop-color="#E65100"/>
</radialGradient>
<radialGradient id="cl_vacuole" cx="35%" cy="30%" r="65%">
  <stop offset="0%" stop-color="#E1F5FE"/>
  <stop offset="70%" stop-color="#0288D1" stop-opacity="0.5"/>
  <stop offset="100%" stop-color="#01579B" stop-opacity="0.3"/>
</radialGradient>
<clipPath id="cl_cell_clip">
  <ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{cell_rx:.1f}" ry="{cell_ry:.1f}"/>
</clipPath>
"""

    parts = []

    # ── Cytoplasm ─────────────────────────────────────────────────────────────
    parts.append(_g("cytoplasm",
        _e(cx, cy, cell_rx, cell_ry, fill="url(#cl_cyto)")
    ))

    # ── Rough ER (inside clip) ────────────────────────────────────────────────
    er_svg = ""
    er_x0, er_y = cx - 128, cy + 58
    er_amp, er_lambda = 12, 48
    n_waves = 3
    for line in range(3):
        dy = line * 14
        pts = []
        for i in range(n_waves * 4 + 1):
            x = er_x0 + i * er_lambda / 4
            y = er_y + dy + er_amp * math.sin(i * math.pi / 2)
            pts.append((x, y))
        d = f"M {pts[0][0]:.1f},{pts[0][1]:.1f}"
        for i in range(1, len(pts)):
            d += f" L {pts[i][0]:.1f},{pts[i][1]:.1f}"
        sw = 2.2 if line == 0 else 1.0
        op = "1.0" if line < 2 else "0.45"
        er_svg += f'<path d="{d}" fill="none" stroke="#00BCD4" stroke-width="{sw}" opacity="{op}"/>'
    # ribosome dots on ER
    for i, (rx2, ry2) in enumerate([(er_x0 + 20, er_y - 5), (er_x0 + 68, er_y - 5),
                                     (er_x0 + 116, er_y - 5), (er_x0 + 44, er_y + 10)]):
        er_svg += (f'<ellipse cx="{rx2:.1f}" cy="{ry2:.1f}" rx="4" ry="3" '
                   f'fill="#CE93D8" stroke="#8E24AA" stroke-width="0.6"/>')
    parts.append(_g("er_rough", f'<g clip-path="url(#cl_cell_clip)">{er_svg}</g>'))

    # ── Golgi apparatus ───────────────────────────────────────────────────────
    golgi_cx, golgi_cy = cx - 120, cy - 45
    golgi_svg = ""
    for i in range(5):
        spread = i * 7
        w = 50 - i * 5
        golgi_svg += (f'<path d="M {golgi_cx-w:.1f},{golgi_cy+i*9:.1f} '
                      f'Q {golgi_cx:.1f},{golgi_cy+i*9-18+spread:.1f} '
                      f'{golgi_cx+w:.1f},{golgi_cy+i*9:.1f}" '
                      f'fill="none" stroke="#43A047" stroke-width="{3.0-i*0.4:.1f}" '
                      f'stroke-linecap="round"/>')
    # vesicle buds
    golgi_svg += _e(golgi_cx - 48, golgi_cy + 8, 7, 6, fill="#A5D6A7", stroke="#2E7D32", sw=0.8)
    golgi_svg += _e(golgi_cx + 48, golgi_cy + 30, 7, 6, fill="#A5D6A7", stroke="#2E7D32", sw=0.8)
    parts.append(_g("golgi", golgi_svg))

    # ── Mitochondria ─────────────────────────────────────────────────────────
    parts.append(_g("mitochondria_1", _mito(cx + 106, cy - 48, 38, 19, rot=-15)))
    parts.append(_g("mitochondria_2", _mito(cx + 92,  cy + 65,  32, 17, rot=10)))

    # ── Ribosomes ────────────────────────────────────────────────────────────
    ribo_pos = [(cx + 28, cy + 92), (cx + 52, cy + 105), (cx + 18, cy + 114), (cx - 18, cy + 108)]
    ribo_svg = ""
    for px2, py2 in ribo_pos:
        ribo_svg += (f'<ellipse cx="{px2:.1f}" cy="{py2:.1f}" rx="5" ry="4" '
                     f'fill="#CE93D8" stroke="#8E24AA" stroke-width="0.8"/>')
        ribo_svg += (f'<ellipse cx="{px2+3:.1f}" cy="{py2+3:.1f}" rx="3.5" ry="3" '
                     f'fill="#BA68C8" stroke="#8E24AA" stroke-width="0.6"/>')
    parts.append(_g("ribosome", ribo_svg))

    # ── Vacuole ───────────────────────────────────────────────────────────────
    parts.append(_g("vacuole",
        _e(cx + 54, cy - 80, 30, 24, fill="url(#cl_vacuole)", stroke="#0288D1", sw=1.5) +
        _e(cx + 44, cy - 90, 10, 7, fill="white", opacity=0.4)
    ))

    # ── Nucleus ──────────────────────────────────────────────────────────────
    # nuclear envelope (outer ring)
    nuc_svg = (
        _e(nuc_cx, nuc_cy, nuc_rx + 4, nuc_ry + 3, fill="none", stroke="#1565C0", sw=4, opacity=0.4) +
        _e(nuc_cx, nuc_cy, nuc_rx, nuc_ry, fill="url(#cl_nucleus)", stroke="#1565C0", sw=2.0)
    )
    # nuclear pores
    for angle_deg in range(0, 360, 45):
        a = math.radians(angle_deg)
        px3 = nuc_cx + nuc_rx * math.cos(a)
        py3 = nuc_cy + nuc_ry * math.sin(a)
        nuc_svg += _e(px3, py3, 4.5, 4.5, fill="#1565C0", opacity=0.7)
        nuc_svg += _e(px3, py3, 2.5, 2.5, fill="#E3F2FD", opacity=0.6)
    # chromatin texture
    nuc_svg += _e(nuc_cx + 15, nuc_cy + 12, 20, 14, fill="#90CAF9", opacity=0.35)
    nuc_svg += _e(nuc_cx - 18, nuc_cy - 8, 14, 10, fill="#64B5F6", opacity=0.3)
    # catchlight
    nuc_svg += _e(nuc_cx - nuc_rx * 0.3, nuc_cy - nuc_ry * 0.32, 18, 12, fill="white", opacity=0.18)
    parts.append(_g("nucleus", nuc_svg))

    # ── Nucleolus ────────────────────────────────────────────────────────────
    parts.append(_g("nucleolus",
        _e(nuc_cx + 12, nuc_cy + 6, 20, 17, fill="url(#cl_nucleolus)", stroke="#6A1B9A", sw=1.5) +
        _e(nuc_cx + 6, nuc_cy + 0, 7, 6, fill="#CE93D8", opacity=0.5)
    ))

    # ── Cell membrane ─────────────────────────────────────────────────────────
    # outer phospholipid layer
    mem_svg = (
        _e(cx, cy, cell_rx + 4, cell_ry + 4, fill="none", stroke="#F9A825", sw=7, opacity=0.25) +
        _e(cx, cy, cell_rx, cell_ry, fill="none", stroke="#FFA000", sw=4.0, opacity=0.75) +
        _e(cx, cy, cell_rx - 7, cell_ry - 5, fill="none", stroke="#FFD54F", sw=2.0, opacity=0.45)
    )
    # phospholipid heads (dots along membrane)
    for angle_deg in range(0, 360, 18):
        a = math.radians(angle_deg)
        px4 = cx + cell_rx * math.cos(a)
        py4 = cy + cell_ry * math.sin(a)
        mem_svg += _e(px4, py4, 3, 3, fill="#FFA000", opacity=0.55)
    parts.append(_g("cell_membrane", mem_svg))

    body_svg = "\n".join(parts)

    # ── Anchors ───────────────────────────────────────────────────────────────
    def px(x): return round(x / W * 100, 1)
    def py(y): return round(y / H * 100, 1)

    anchors = [
        LabelAnchor(part_id="cell_membrane",  x=px(cx + cell_rx + 12), y=py(cy)),
        LabelAnchor(part_id="cytoplasm",       x=px(18),                y=py(cy + 80)),
        LabelAnchor(part_id="nucleus",         x=px(nuc_cx - nuc_rx - 16), y=py(nuc_cy - 10)),
        LabelAnchor(part_id="nucleolus",       x=px(nuc_cx - 10),       y=py(nuc_cy + 28)),
        LabelAnchor(part_id="mitochondria_1",  x=px(cx + 106 + 42),     y=py(cy - 48)),
        LabelAnchor(part_id="mitochondria_2",  x=px(cx + 92 + 36),      y=py(cy + 65)),
        LabelAnchor(part_id="ribosome",        x=px(cx + 60),           y=py(cy + 108)),
        LabelAnchor(part_id="er_rough",        x=px(er_x0 - 18),        y=py(er_y + 10)),
        LabelAnchor(part_id="golgi",           x=px(golgi_cx - 58),     y=py(golgi_cy + 20)),
        LabelAnchor(part_id="vacuole",         x=px(cx + 54 + 34),      y=py(cy - 80)),
    ]

    rendered_parts = [
        "cell_membrane", "cytoplasm", "nucleus", "nucleolus",
        "mitochondria_1", "mitochondria_2", "ribosome", "er_rough", "golgi", "vacuole",
    ]

    return RenderSpec(
        object_key="cell.animal",
        viewbox=f"0 0 {W} {H}",
        shapes=[],
        anchors=anchors,
        rendered_parts=rendered_parts,
        defs_svg=defs.strip(),
        body_svg=body_svg,
    )
