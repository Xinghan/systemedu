"""cell.animal - animal cell cross-section educational diagram."""

from __future__ import annotations

from systemedu.agents.builtin.gameagent.object_spec import (
    EllipseShape,
    LabelAnchor,
    PathShape,
    RectShape,
    RenderSpec,
)

META = {
    "object_key": "cell.animal",
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


def build(view: str = "cross_section", variant: str | None = None) -> RenderSpec:
    """Build an animal cell cross-section RenderSpec. Viewbox: 0 0 560 420."""
    cx, cy = 280.0, 210.0
    cell_rx, cell_ry = 220.0, 170.0

    shapes: list = []

    # cytoplasm background
    shapes.append(EllipseShape(
        id="cytoplasm_bg", part_id="cytoplasm",
        cx=cx, cy=cy, rx=cell_rx, ry=cell_ry,
        fill="#FFF9C4", stroke=None,
    ))

    # cell membrane (dashed effect via two ellipses)
    shapes.append(EllipseShape(
        id="cell_membrane_outer", part_id="cell_membrane",
        cx=cx, cy=cy, rx=cell_rx, ry=cell_ry,
        fill="none", stroke="#F57F17", stroke_width=4.0,
    ))
    shapes.append(EllipseShape(
        id="cell_membrane_inner", part_id=None,
        cx=cx, cy=cy, rx=cell_rx - 6, ry=cell_ry - 5,
        fill="none", stroke="#FFE082", stroke_width=2.0, opacity=0.6,
    ))

    # nucleus
    nuc_cx, nuc_cy = cx - 20, cy - 10
    nuc_rx, nuc_ry = 60.0, 52.0
    shapes.append(EllipseShape(
        id="nucleus_bg", part_id="nucleus",
        cx=nuc_cx, cy=nuc_cy, rx=nuc_rx, ry=nuc_ry,
        fill="#BBDEFB", stroke="#1565C0", stroke_width=2.5,
    ))
    # nuclear pore dots
    for angle_deg in [30, 90, 150, 210, 270, 330]:
        import math
        a = math.radians(angle_deg)
        px = nuc_cx + nuc_rx * math.cos(a)
        py = nuc_cy + nuc_ry * math.sin(a)
        shapes.append(EllipseShape(
            id=f"nuclear_pore_{angle_deg}", part_id=None,
            cx=px, cy=py, rx=3.5, ry=3.5,
            fill="#1565C0", opacity=0.7,
        ))

    # nucleolus
    shapes.append(EllipseShape(
        id="nucleolus_ellipse", part_id="nucleolus",
        cx=nuc_cx + 10, cy=nuc_cy + 5, rx=18, ry=15,
        fill="#7986CB", stroke="#3949AB", stroke_width=1.5,
    ))

    # mitochondria (two bean shapes via ellipses)
    shapes.append(EllipseShape(
        id="mitochondria_1_ellipse", part_id="mitochondria_1",
        cx=cx + 100, cy=cy - 50, rx=36, ry=18,
        fill="#FFCC80", stroke="#E65100", stroke_width=1.5,
    ))
    # inner membrane lines
    shapes.append(PathShape(
        id="mito_1_crista", part_id=None,
        d=f"M {cx+82} {cy-50} Q {cx+100} {cy-60} {cx+118} {cy-50}",
        fill="none", stroke="#FF6D00", stroke_width=1.2,
    ))

    shapes.append(EllipseShape(
        id="mitochondria_2_ellipse", part_id="mitochondria_2",
        cx=cx + 90, cy=cy + 60, rx=30, ry=16,
        fill="#FFCC80", stroke="#E65100", stroke_width=1.5,
    ))
    shapes.append(PathShape(
        id="mito_2_crista", part_id=None,
        d=f"M {cx+74} {cy+60} Q {cx+90} {cy+50} {cx+106} {cy+60}",
        fill="none", stroke="#FF6D00", stroke_width=1.2,
    ))

    # ribosomes (small dots near ER)
    for i, (rx2, ry2) in enumerate([(cx + 30, cy + 90), (cx + 50, cy + 100), (cx + 20, cy + 110), (cx - 20, cy + 105)]):
        shapes.append(EllipseShape(
            id=f"ribosome_{i}", part_id="ribosome" if i == 0 else None,
            cx=rx2, cy=ry2, rx=5, ry=5,
            fill="#E040FB", stroke=None,
        ))

    # rough ER (wavy path)
    shapes.append(PathShape(
        id="er_rough_path", part_id="er_rough",
        d=(f"M {cx - 120} {cy + 60} "
           f"C {cx - 100} {cy + 40} {cx - 80} {cy + 80} {cx - 60} {cy + 60} "
           f"C {cx - 40} {cy + 40} {cx - 20} {cy + 80} {cx} {cy + 70}"),
        fill="none", stroke="#26C6DA", stroke_width=2.5,
    ))
    shapes.append(PathShape(
        id="er_rough_path2", part_id=None,
        d=(f"M {cx - 115} {cy + 70} "
           f"C {cx - 95} {cy + 50} {cx - 75} {cy + 90} {cx - 55} {cy + 70} "
           f"C {cx - 35} {cy + 50} {cx - 15} {cy + 90} {cx + 5} {cy + 80}"),
        fill="none", stroke="#26C6DA", stroke_width=1.2, opacity=0.5,
    ))

    # Golgi (stacked arcs)
    golgi_cx, golgi_cy = cx - 110, cy - 40
    for i in range(4):
        offset = i * 8
        shapes.append(PathShape(
            id=f"golgi_arc_{i}", part_id="golgi" if i == 0 else None,
            d=(f"M {golgi_cx - 30 + offset} {golgi_cy} "
               f"Q {golgi_cx} {golgi_cy - 20 + offset * 2} {golgi_cx + 30 - offset} {golgi_cy}"),
            fill="none", stroke="#66BB6A", stroke_width=3.0 - i * 0.5,
        ))

    # vacuole
    shapes.append(EllipseShape(
        id="vacuole_ellipse", part_id="vacuole",
        cx=cx + 50, cy=cy - 80, rx=28, ry=22,
        fill="#B3E5FC", stroke="#0288D1", stroke_width=1.5, opacity=0.8,
    ))

    anchors = [
        LabelAnchor(part_id="cell_membrane",  x=88.0, y=50.0),
        LabelAnchor(part_id="cytoplasm",       x=16.0, y=74.0),
        LabelAnchor(part_id="nucleus",         x=28.0, y=30.0),
        LabelAnchor(part_id="nucleolus",       x=38.0, y=42.0),
        LabelAnchor(part_id="mitochondria_1",  x=72.0, y=22.0),
        LabelAnchor(part_id="mitochondria_2",  x=72.0, y=72.0),
        LabelAnchor(part_id="ribosome",        x=56.0, y=82.0),
        LabelAnchor(part_id="er_rough",        x=22.0, y=70.0),
        LabelAnchor(part_id="golgi",           x=14.0, y=42.0),
        LabelAnchor(part_id="vacuole",         x=62.0, y=14.0),
    ]

    rendered_parts = list({s.part_id for s in shapes if s.part_id})

    return RenderSpec(
        object_key="cell.animal",
        viewbox="0 0 560 420",
        shapes=shapes,
        anchors=anchors,
        rendered_parts=rendered_parts,
    )
