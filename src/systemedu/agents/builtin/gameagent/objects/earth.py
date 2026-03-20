"""earth.basic - cross-section / front view educational earth diagram."""

from __future__ import annotations

from systemedu.agents.builtin.gameagent.object_spec import (
    EllipseShape,
    LabelAnchor,
    PathShape,
    RenderSpec,
)

META = {
    "object_key": "earth.basic",
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


def build(view: str = "front", variant: str | None = None) -> RenderSpec:
    """Build an earth cross-section RenderSpec. Viewbox: 0 0 560 420."""
    cx, cy = 280.0, 210.0
    r_inner_core = 36.0
    r_outer_core = 72.0
    r_mantle = 130.0
    r_crust = 148.0
    r_ocean = 154.0
    r_atmos = 175.0

    shapes: list = []

    # atmosphere glow
    shapes.append(EllipseShape(
        id="atmosphere_glow", part_id="atmosphere",
        cx=cx, cy=cy, rx=r_atmos + 14, ry=r_atmos + 14,
        fill="#B3E5FC", opacity=0.25,
    ))
    shapes.append(EllipseShape(
        id="atmosphere_ring", part_id=None,
        cx=cx, cy=cy, rx=r_atmos, ry=r_atmos,
        fill="none", stroke="#4FC3F7", stroke_width=3.0, opacity=0.5,
    ))

    # ocean (full sphere)
    shapes.append(EllipseShape(
        id="ocean_sphere", part_id="ocean",
        cx=cx, cy=cy, rx=r_ocean, ry=r_ocean,
        fill="#1565C0", opacity=0.75,
    ))

    # land masses (irregular ellipses on top)
    import math
    land_positions = [
        (cx - 30, cy - 50, 38, 24, -20),
        (cx + 55, cy - 20, 28, 38, 10),
        (cx - 60, cy + 40, 22, 18, 15),
        (cx + 10, cy + 55, 30, 16, -5),
    ]
    for i, (lx, ly, lrx, lry, angle_deg) in enumerate(land_positions):
        # check if within ocean sphere (rough clip via opacity)
        shapes.append(EllipseShape(
            id=f"land_mass_{i}", part_id="land_mass" if i == 0 else None,
            cx=lx, cy=ly, rx=lrx, ry=lry,
            fill="#4CAF50", stroke="#2E7D32", stroke_width=0.8, opacity=0.85,
        ))

    # mantle (half-circle cross-section visible)
    # draw as filled circle minus upper half overlay
    shapes.append(EllipseShape(
        id="mantle_full", part_id="mantle",
        cx=cx, cy=cy, rx=r_mantle, ry=r_mantle,
        fill="#FF7043", opacity=0.5,
    ))
    shapes.append(EllipseShape(
        id="mantle_outline", part_id=None,
        cx=cx, cy=cy, rx=r_mantle, ry=r_mantle,
        fill="none", stroke="#BF360C", stroke_width=1.5,
    ))

    # outer core
    shapes.append(EllipseShape(
        id="outer_core_full", part_id="outer_core",
        cx=cx, cy=cy, rx=r_outer_core, ry=r_outer_core,
        fill="#FFA000", opacity=0.75,
    ))
    shapes.append(EllipseShape(
        id="outer_core_outline", part_id=None,
        cx=cx, cy=cy, rx=r_outer_core, ry=r_outer_core,
        fill="none", stroke="#E65100", stroke_width=1.2,
    ))

    # inner core
    shapes.append(EllipseShape(
        id="inner_core_full", part_id="inner_core",
        cx=cx, cy=cy, rx=r_inner_core, ry=r_inner_core,
        fill="#FFEE58", stroke="#F57F17", stroke_width=1.5,
    ))
    # inner core glow
    shapes.append(EllipseShape(
        id="inner_core_glow", part_id=None,
        cx=cx - 8, cy=cy - 8, rx=14, ry=14,
        fill="#FFFFFF", opacity=0.3,
    ))

    # label lines (visual guides)
    label_lines = [
        (r_inner_core + 5, 45, "inner_core"),
        (r_outer_core + 5, 0, "outer_core"),
        (r_mantle + 5, 315, "mantle"),
        (r_crust + 5, 270, "crust"),
    ]
    for r, angle_deg, pid in label_lines:
        a = math.radians(angle_deg)
        x1 = cx + (r - 5) * math.cos(a)
        y1 = cy + (r - 5) * math.sin(a)
        x2 = cx + (r + 20) * math.cos(a)
        y2 = cy + (r + 20) * math.sin(a)
        shapes.append(PathShape(
            id=f"label_line_{pid}", part_id=None,
            d=f"M {x1:.1f} {y1:.1f} L {x2:.1f} {y2:.1f}",
            fill="none", stroke="#ECEFF1", stroke_width=0.8, opacity=0.5,
        ))

    anchors = [
        LabelAnchor(part_id="atmosphere", x=50.0, y=4.0),
        LabelAnchor(part_id="ocean",      x=22.0, y=36.0),
        LabelAnchor(part_id="land_mass",  x=40.0, y=24.0),
        LabelAnchor(part_id="crust",      x=78.0, y=22.0),
        LabelAnchor(part_id="mantle",     x=82.0, y=50.0),
        LabelAnchor(part_id="outer_core", x=70.0, y=50.0),
        LabelAnchor(part_id="inner_core", x=58.0, y=50.0),
    ]

    rendered_parts = list({s.part_id for s in shapes if s.part_id})

    return RenderSpec(
        object_key="earth.basic",
        viewbox="0 0 560 420",
        shapes=shapes,
        anchors=anchors,
        rendered_parts=rendered_parts,
    )
