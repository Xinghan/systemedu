"""plant.basic - side-view educational plant diagram."""

from __future__ import annotations

from systemedu.agents.builtin.gameagent.object_spec import (
    EllipseShape,
    LabelAnchor,
    PathShape,
    RectShape,
    RenderSpec,
)

META = {
    "object_key": "plant.basic",
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


def build(view: str = "side", variant: str | None = None) -> RenderSpec:
    """Build a side-view plant RenderSpec. Viewbox: 0 0 560 420."""
    cx = 280.0
    soil_y = 310.0
    stem_bottom = soil_y
    stem_top = 160.0
    stem_x = cx - 6

    shapes: list = []

    # sky background
    shapes.append(RectShape(
        id="sky_bg", part_id=None,
        x=0, y=0, w=560, h=soil_y,
        fill="#E3F2FD", opacity=0.4,
    ))

    # soil
    shapes.append(RectShape(
        id="soil_rect", part_id="soil_line",
        x=0, y=soil_y, w=560, h=420 - soil_y,
        fill="#795548", opacity=0.6,
    ))
    shapes.append(RectShape(
        id="soil_top", part_id=None,
        x=0, y=soil_y, w=560, h=12,
        fill="#5D4037",
    ))

    # sun
    sun_cx, sun_cy = 470.0, 70.0
    shapes.append(EllipseShape(
        id="sun_glow", part_id=None,
        cx=sun_cx, cy=sun_cy, rx=42, ry=42,
        fill="#FFE082", opacity=0.4,
    ))
    shapes.append(EllipseShape(
        id="sun_circle", part_id="sun",
        cx=sun_cx, cy=sun_cy, rx=28, ry=28,
        fill="#FDD835", stroke="#F9A825", stroke_width=2.0,
    ))
    # sun rays
    import math
    for i in range(8):
        a = math.radians(i * 45)
        x1 = sun_cx + 34 * math.cos(a)
        y1 = sun_cy + 34 * math.sin(a)
        x2 = sun_cx + 50 * math.cos(a)
        y2 = sun_cy + 50 * math.sin(a)
        shapes.append(PathShape(
            id=f"sun_ray_{i}", part_id=None,
            d=f"M {x1:.1f} {y1:.1f} L {x2:.1f} {y2:.1f}",
            fill="none", stroke="#FDD835", stroke_width=2.0,
        ))

    # stem
    shapes.append(RectShape(
        id="stem_rect", part_id="stem",
        x=stem_x, y=stem_top, w=12, h=stem_bottom - stem_top,
        rx=6,
        fill="#388E3C", stroke="#1B5E20", stroke_width=1.0,
    ))

    # roots (branching paths)
    shapes.append(PathShape(
        id="root_main", part_id="root",
        d=f"M {cx} {soil_y} C {cx-5} {soil_y+40} {cx-5} {soil_y+50} {cx} {soil_y+80}",
        fill="none", stroke="#A1887F", stroke_width=3.0,
    ))
    shapes.append(PathShape(
        id="root_left_1", part_id=None,
        d=f"M {cx} {soil_y+30} C {cx-30} {soil_y+30} {cx-50} {soil_y+20} {cx-60} {soil_y+35}",
        fill="none", stroke="#A1887F", stroke_width=2.0,
    ))
    shapes.append(PathShape(
        id="root_right_1", part_id=None,
        d=f"M {cx} {soil_y+30} C {cx+30} {soil_y+30} {cx+50} {soil_y+20} {cx+60} {soil_y+35}",
        fill="none", stroke="#A1887F", stroke_width=2.0,
    ))
    shapes.append(PathShape(
        id="root_left_2", part_id=None,
        d=f"M {cx-30} {soil_y+32} C {cx-55} {soil_y+45} {cx-70} {soil_y+55} {cx-55} {soil_y+65}",
        fill="none", stroke="#A1887F", stroke_width=1.2,
    ))
    shapes.append(PathShape(
        id="root_right_2", part_id=None,
        d=f"M {cx+30} {soil_y+32} C {cx+55} {soil_y+45} {cx+70} {soil_y+55} {cx+55} {soil_y+65}",
        fill="none", stroke="#A1887F", stroke_width=1.2,
    ))

    # leaf right (higher)
    leaf_mid_y = (stem_top + stem_bottom) / 2 - 10
    shapes.append(PathShape(
        id="leaf_right_path", part_id="leaf_right",
        d=(f"M {cx + 6} {leaf_mid_y} "
           f"C {cx + 50} {leaf_mid_y - 30} {cx + 80} {leaf_mid_y - 20} {cx + 70} {leaf_mid_y + 10} "
           f"C {cx + 50} {leaf_mid_y + 30} {cx + 20} {leaf_mid_y + 20} {cx + 6} {leaf_mid_y} Z"),
        fill="#66BB6A", stroke="#388E3C", stroke_width=1.2,
    ))
    # leaf right vein
    shapes.append(PathShape(
        id="leaf_right_vein", part_id=None,
        d=f"M {cx + 6} {leaf_mid_y + 5} Q {cx + 45} {leaf_mid_y} {cx + 68} {leaf_mid_y + 8}",
        fill="none", stroke="#2E7D32", stroke_width=0.8,
    ))

    # leaf left (lower)
    leaf_low_y = leaf_mid_y + 50
    shapes.append(PathShape(
        id="leaf_left_path", part_id="leaf_left",
        d=(f"M {cx - 6} {leaf_low_y} "
           f"C {cx - 50} {leaf_low_y - 28} {cx - 78} {leaf_low_y - 15} {cx - 68} {leaf_low_y + 14} "
           f"C {cx - 50} {leaf_low_y + 32} {cx - 20} {leaf_low_y + 22} {cx - 6} {leaf_low_y} Z"),
        fill="#4CAF50", stroke="#388E3C", stroke_width=1.2,
    ))

    # top leaf
    shapes.append(PathShape(
        id="leaf_top_path", part_id="leaf_top",
        d=(f"M {cx} {stem_top} "
           f"C {cx + 35} {stem_top - 40} {cx + 40} {stem_top - 10} {cx + 10} {stem_top + 20} "
           f"C {cx - 10} {stem_top + 20} {cx - 10} {stem_top + 10} {cx} {stem_top} Z"),
        fill="#81C784", stroke="#388E3C", stroke_width=1.2,
    ))

    # flower (5 petals + center)
    flower_cx, flower_cy = cx, stem_top - 20
    petal_r = 16.0
    for i in range(5):
        a = math.radians(i * 72 - 90)
        px = flower_cx + 20 * math.cos(a)
        py = flower_cy + 20 * math.sin(a)
        shapes.append(EllipseShape(
            id=f"petal_{i}", part_id="flower" if i == 0 else None,
            cx=px, cy=py, rx=petal_r, ry=petal_r,
            fill="#F48FB1", stroke="#E91E63", stroke_width=1.0, opacity=0.9,
        ))
    # flower center
    shapes.append(EllipseShape(
        id="flower_center", part_id=None,
        cx=flower_cx, cy=flower_cy, rx=10, ry=10,
        fill="#FDD835", stroke="#F9A825", stroke_width=1.5,
    ))

    anchors = [
        LabelAnchor(part_id="sun",        x=85.0, y=12.0),
        LabelAnchor(part_id="flower",     x=62.0, y=22.0),
        LabelAnchor(part_id="leaf_top",   x=66.0, y=30.0),
        LabelAnchor(part_id="leaf_right", x=72.0, y=45.0),
        LabelAnchor(part_id="stem",       x=60.0, y=58.0),
        LabelAnchor(part_id="leaf_left",  x=25.0, y=58.0),
        LabelAnchor(part_id="soil_line",  x=18.0, y=76.0),
        LabelAnchor(part_id="root",       x=50.0, y=88.0),
    ]

    rendered_parts = list({s.part_id for s in shapes if s.part_id})

    return RenderSpec(
        object_key="plant.basic",
        viewbox="0 0 560 420",
        shapes=shapes,
        anchors=anchors,
        rendered_parts=rendered_parts,
    )
