"""earth.basic - cross-section educational earth diagram.

High-fidelity rendering:
- Concentric layer circles with radial gradients
- Realistic layer colors (hot core → cool crust)
- Visible cross-section wedge showing layers
- Atmospheric glow ring
- Stylized ocean + land masses on exterior
- Output via RenderSpec.defs_svg + body_svg (raw SVG)
"""

from __future__ import annotations

import math

from systemedu.agents.builtin.gameagent.object_spec import (
    LabelAnchor,
    RenderSpec,
)

META = {
    "object_key": "earth.basic",
    "description": (
        "地球圈层剖面图，包含地壳、地幔、外核、内核及大气层、海洋、陆地。"
        "适合讲解地球内部圈层结构。"
        "不包含板块构造细节、火山截面、大气各层详细划分、水循环等专题内容。"
    ),
    "views": ["front"],
    "must_have": ["crust", "mantle", "outer_core", "inner_core"],
    "optional": ["atmosphere", "ocean", "land_mass", "satellite"],
    "labelable": [
        "crust", "mantle", "outer_core", "inner_core",
        "atmosphere", "ocean", "land_mass",
    ],
    "parts": {
        "inner_core": {
            "label_zh": "内核",
            "label_en": "Inner Core",
            "desc_brief": "固态铁镍合金，温度约 5000-6000°C，压力极高",
            "hint": "内核为什么是固态的？",
        },
        "outer_core": {
            "label_zh": "外核",
            "label_en": "Outer Core",
            "desc_brief": "液态铁镍，其流动产生地球磁场",
            "hint": "地球磁场是怎么产生的？",
        },
        "mantle": {
            "label_zh": "地幔",
            "label_en": "Mantle",
            "desc_brief": "半熔融岩石，体积占地球 84%，地壳运动的驱动力",
            "hint": "地幔的流动如何影响地表？",
        },
        "crust": {
            "label_zh": "地壳",
            "label_en": "Crust",
            "desc_brief": "最外层薄薄的固态岩石层，我们生活在这里",
            "hint": "地壳最厚的地方在哪里？",
        },
        "ocean": {
            "label_zh": "海洋",
            "label_en": "Ocean",
            "desc_brief": "覆盖地球约 71% 的表面，调节气候",
            "hint": "地球上水从哪里来？",
        },
        "land_mass": {
            "label_zh": "陆地",
            "label_en": "Land Mass / Continent",
            "desc_brief": "大陆板块，由地壳运动形成",
            "hint": "七大洲原来是一整块大陆吗？",
        },
        "atmosphere": {
            "label_zh": "大气层",
            "label_en": "Atmosphere",
            "desc_brief": "包围地球的气体层，保护生命免受辐射和陨石",
            "hint": "大气层有几层？",
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


def build(view: str = "front", variant: str | None = None) -> RenderSpec:
    """Build a high-fidelity earth cross-section. ViewBox: 0 0 560 460"""
    W, H = 560, 460
    cx, cy = W / 2, H / 2   # 280, 230

    # Layer radii (scaled to fit comfortably in viewbox)
    r_inner = 38.0
    r_outer  = 76.0
    r_mantle = 140.0
    r_crust  = 160.0
    r_ocean  = 167.0
    r_atmos  = 195.0

    defs = f"""
<radialGradient id="ea_inner" cx="35%" cy="30%" r="70%">
  <stop offset="0%" stop-color="#FFFDE7"/>
  <stop offset="40%" stop-color="#FFCC02"/>
  <stop offset="100%" stop-color="#E65100"/>
</radialGradient>
<radialGradient id="ea_outer" cx="35%" cy="30%" r="70%">
  <stop offset="0%" stop-color="#FFCC80"/>
  <stop offset="50%" stop-color="#FF6F00"/>
  <stop offset="100%" stop-color="#BF360C"/>
</radialGradient>
<radialGradient id="ea_mantle" cx="35%" cy="30%" r="70%">
  <stop offset="0%" stop-color="#FF8A65"/>
  <stop offset="55%" stop-color="#D84315"/>
  <stop offset="100%" stop-color="#8B1A00"/>
</radialGradient>
<radialGradient id="ea_crust" cx="35%" cy="30%" r="70%">
  <stop offset="0%" stop-color="#A5907E"/>
  <stop offset="60%" stop-color="#6D4C41"/>
  <stop offset="100%" stop-color="#3E2723"/>
</radialGradient>
<radialGradient id="ea_ocean" cx="38%" cy="32%" r="65%">
  <stop offset="0%" stop-color="#64B5F6"/>
  <stop offset="50%" stop-color="#1565C0"/>
  <stop offset="100%" stop-color="#0D2B60"/>
</radialGradient>
<clipPath id="ea_globe_clip">
  <circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r_ocean:.1f}"/>
</clipPath>
"""

    parts = []

    # ── Atmosphere glow ───────────────────────────────────────────────────────
    parts.append(_g("atmosphere",
        _e(cx, cy, r_atmos + 18, r_atmos + 18, fill="#B3E5FC", opacity=0.18) +
        _e(cx, cy, r_atmos, r_atmos, fill="none", stroke="#64B5F6", sw=6, opacity=0.22) +
        _e(cx, cy, r_atmos, r_atmos, fill="none", stroke="#29B6F6", sw=2.5, opacity=0.45)
    ))

    # ── Ocean sphere ─────────────────────────────────────────────────────────
    parts.append(_g("ocean",
        _e(cx, cy, r_ocean, r_ocean, fill="url(#ea_ocean)")
    ))

    # ── Land masses (clipped to globe) ────────────────────────────────────────
    land_positions = [
        # (lx, ly, lrx, lry, rotation_deg)
        (cx - 28, cy - 60, 44, 28, -18),
        (cx + 62, cy - 18, 32, 44, 12),
        (cx - 62, cy + 42, 26, 20, 14),
        (cx + 8,  cy + 60, 34, 18, -6),
    ]
    land_svg = ""
    for i, (lx, ly, lrx, lry, rot) in enumerate(land_positions):
        pid_attr = f' data-part="land_mass"' if i == 0 else ""
        land_svg += (
            f'<ellipse cx="{lx:.1f}" cy="{ly:.1f}" rx="{lrx:.1f}" ry="{lry:.1f}" '
            f'fill="#4CAF50" stroke="#2E7D32" stroke-width="0.8" opacity="0.9" '
            f'transform="rotate({rot} {lx:.1f} {ly:.1f})"{pid_attr}/>'
        )
        # snow cap hint on top continent
        if i == 0:
            land_svg += (
                f'<ellipse cx="{lx:.1f}" cy="{ly-lry*0.55:.1f}" rx="{lrx*0.38:.1f}" ry="{lry*0.28:.1f}" '
                f'fill="white" opacity="0.55" transform="rotate({rot} {lx:.1f} {ly:.1f})"/>'
            )
    # polar ice caps
    land_svg += _e(cx, cy - r_ocean + 14, 28, 14, fill="white", opacity=0.7)
    land_svg += _e(cx, cy + r_ocean - 14, 24, 12, fill="white", opacity=0.65)
    parts.append(f'<g clip-path="url(#ea_globe_clip)">{land_svg}</g>')
    # Also add a separate g for land_mass label (first continent, outside clip isn't visible)
    parts.append(f'<g data-part="land_mass" style="display:none"></g>')

    # ── Cross-section wedge (lower-right quarter revealing layers) ─────────────
    # We show the full globe from outside + draw layers as concentric filled circles
    # then overlay a wedge cutout hint (a crescent/label guide lines)
    # Instead: draw label guide lines from each layer edge
    guide_color = "#FFFFFF"
    for r, pid, angle in [
        (r_crust,  "crust",      55),
        (r_mantle, "mantle",     40),
        (r_outer,  "outer_core", 28),
        (r_inner,  "inner_core", 18),
    ]:
        a = math.radians(angle)
        x1 = cx + r * math.cos(a)
        y1 = cy - r * math.sin(a)
        x2 = cx + (r + 30) * math.cos(a)
        y2 = cy - (r + 30) * math.sin(a)
        parts.append(_p(f"M {x1:.1f},{y1:.1f} L {x2:.1f},{y2:.1f}",
                        stroke=guide_color, sw=0.8, opacity="0.5"))

    # Draw layer circles from inside out (concentric, smallest on top)
    # Mantle (largest filled circle for cross-section)
    parts.append(_g("mantle",
        _e(cx, cy, r_mantle, r_mantle, fill="url(#ea_mantle)")
    ))
    parts.append(_g("outer_core",
        _e(cx, cy, r_outer, r_outer, fill="url(#ea_outer)")
    ))
    parts.append(_g("inner_core",
        _e(cx, cy, r_inner, r_inner, fill="url(#ea_inner)") +
        # catchlight
        _e(cx - r_inner * 0.3, cy - r_inner * 0.3, r_inner * 0.25, r_inner * 0.2,
           fill="white", opacity=0.35)
    ))

    # Thin crust ring on globe exterior
    parts.append(_g("crust",
        _e(cx, cy, r_ocean + 2, r_ocean + 2, fill="none", stroke="#795548", sw=5, opacity=0.7) +
        _e(cx, cy, r_ocean + 2, r_ocean + 2, fill="none", stroke="#A1887F", sw=2, opacity=0.5)
    ))

    # Globe rim highlight
    parts.append(_e(cx - r_ocean * 0.28, cy - r_ocean * 0.28,
                    r_ocean * 0.35, r_ocean * 0.22,
                    fill="white", opacity=0.12))

    body_svg = "\n".join(parts)

    # ── Anchors (% of 560x460) ────────────────────────────────────────────────
    def px(x): return round(x / W * 100, 1)
    def py(y): return round(y / H * 100, 1)

    anchors = [
        LabelAnchor(part_id="atmosphere", x=px(cx),                       y=py(cy - r_atmos - 10)),
        LabelAnchor(part_id="ocean",      x=px(cx - r_ocean * 0.7 - 20),  y=py(cy - r_ocean * 0.4)),
        LabelAnchor(part_id="land_mass",  x=px(cx - 28 + 48),             y=py(cy - 60 - 20)),
        LabelAnchor(part_id="crust",      x=px(cx + r_ocean + 14),         y=py(cy - r_ocean * 0.45)),
        LabelAnchor(part_id="mantle",     x=px(cx + r_mantle + 16),        y=py(cy - r_mantle * 0.55)),
        LabelAnchor(part_id="outer_core", x=px(cx + r_outer + 12),         y=py(cy - r_outer * 0.5)),
        LabelAnchor(part_id="inner_core", x=px(cx + r_inner + 8),          y=py(cy - r_inner * 0.5)),
    ]

    rendered_parts = [
        "atmosphere", "ocean", "land_mass", "crust", "mantle", "outer_core", "inner_core",
    ]

    return RenderSpec(
        object_key="earth.basic",
        viewbox=f"0 0 {W} {H}",
        shapes=[],
        anchors=anchors,
        rendered_parts=rendered_parts,
        defs_svg=defs.strip(),
        body_svg=body_svg,
    )
