"""rocket.basic - side-view educational 2D rocket.

Semantic layer: parts definition, must-have list, labels/descriptions
Geometry layer: parameterized shape builder
"""

from __future__ import annotations

from systemedu.agents.builtin.gameagent.object_spec import (
    EllipseShape,
    LabelAnchor,
    LineShape,
    PathShape,
    PolygonShape,
    RectShape,
    RenderSpec,
)

# ---------------------------------------------------------------------------
# Semantic layer
# ---------------------------------------------------------------------------

META = {
    "object_key": "rocket.basic",
    "description": "火箭整体侧视外观图，包含鼻锥、箭体、尾翼、发动机喷嘴。适合讲解火箭整体结构和各部件名称。不包含发动机内部燃烧室、燃料箱内部、制导系统、级间分离机构等内部细节。",
    "views": ["side"],
    "must_have": ["nose_cone", "body", "left_fin", "right_fin", "engine_nozzle"],
    "optional": ["window", "interstage", "grid_fin_left", "grid_fin_right", "flame"],
    "labelable": [
        "nose_cone", "body", "window", "interstage",
        "left_fin", "right_fin", "engine_nozzle", "grid_fin_left",
    ],
    "parts": {
        "nose_cone": {
            "label_zh": "鼻锥",
            "label_en": "Nose Cone",
            "desc_brief": "保护载荷，承受发射时的气动载荷，减少空气阻力",
            "hint": "它的形状为什么是尖的？",
        },
        "body": {
            "label_zh": "主体结构",
            "label_en": "Body / Fuselage",
            "desc_brief": "容纳燃料箱和航电系统，是火箭的主干",
            "hint": "主体里装着什么？",
        },
        "window": {
            "label_zh": "观察窗",
            "label_en": "Observation Window",
            "desc_brief": "载人版本供宇航员观察外部环境",
            "hint": "并非所有火箭都有窗户",
        },
        "interstage": {
            "label_zh": "级间段",
            "label_en": "Interstage",
            "desc_brief": "连接上下两级，分离时将上级推离",
            "hint": "多级火箭为什么要分离？",
        },
        "left_fin": {
            "label_zh": "左尾翼",
            "label_en": "Left Fin",
            "desc_brief": "稳定飞行姿态，防止翻滚",
            "hint": "尾翼和飞机的机翼有什么不同？",
        },
        "right_fin": {
            "label_zh": "右尾翼",
            "label_en": "Right Fin",
            "desc_brief": "稳定飞行姿态，防止翻滚",
            "hint": "尾翼和飞机的机翼有什么不同？",
        },
        "grid_fin_left": {
            "label_zh": "左栅格翼",
            "label_en": "Left Grid Fin",
            "desc_brief": "用于再入大气时的姿态控制和减速，可回收火箭的关键部件",
            "hint": "栅格翼何时展开？",
        },
        "grid_fin_right": {
            "label_zh": "右栅格翼",
            "label_en": "Right Grid Fin",
            "desc_brief": "用于再入大气时的姿态控制和减速，可回收火箭的关键部件",
            "hint": "栅格翼何时展开？",
        },
        "engine_nozzle": {
            "label_zh": "发动机喷口",
            "label_en": "Engine Nozzle",
            "desc_brief": "高速喷出燃气，产生推力，推动火箭飞行",
            "hint": "喷口越大推力越大吗？",
        },
        "flame": {
            "label_zh": "火焰",
            "label_en": "Exhaust Flame",
            "desc_brief": "发动机点火后喷出的高温燃气",
            "hint": "",
        },
    },
}


# ---------------------------------------------------------------------------
# Geometry layer
# ---------------------------------------------------------------------------

def build(view: str = "side", variant: str | None = None) -> RenderSpec:
    """Build a side-view rocket RenderSpec.

    Viewbox: 0 0 560 420
    Rocket centered at x=280, occupying roughly y=20..390
    """
    if view != "side":
        raise ValueError(f"rocket.basic only supports view='side', got {view!r}")

    # Geometry constants (all in viewbox units, 560x420)
    cx = 280.0          # horizontal center
    body_x = cx - 30   # body left edge
    body_y = 90.0       # body top
    body_w = 60.0
    body_h = 200.0
    nose_tip_y = 20.0
    interstage_y = body_y + body_h * 0.62   # ~214
    fin_y_start = body_y + body_h * 0.72    # ~234
    fin_y_end = body_y + body_h             # 290
    nozzle_top_y = body_y + body_h          # 290
    nozzle_h = 32.0

    shapes: list = []

    # --- body ---
    shapes.append(RectShape(
        id="body_rect",
        part_id="body",
        x=body_x, y=body_y, w=body_w, h=body_h,
        rx=4,
        fill="#B0BEC5",
        stroke="#78909C",
        stroke_width=1.5,
    ))

    # body highlight stripe (shading, no part_id)
    shapes.append(RectShape(
        id="body_highlight",
        part_id=None,
        x=body_x + 8, y=body_y + 10, w=10, h=body_h - 20,
        rx=5,
        fill="#ECEFF1",
        opacity=0.5,
    ))

    # --- nose cone (triangle) ---
    shapes.append(PolygonShape(
        id="nose_cone_poly",
        part_id="nose_cone",
        points=[
            (body_x, body_y),
            (body_x + body_w, body_y),
            (cx, nose_tip_y),
        ],
        fill="#78909C",
        stroke="#546E7A",
        stroke_width=1.5,
    ))

    # nose cone inner shading
    shapes.append(PolygonShape(
        id="nose_cone_shade",
        part_id=None,
        points=[
            (body_x + 10, body_y),
            (body_x + 18, body_y),
            (cx - 2, nose_tip_y + 18),
        ],
        fill="#ECEFF1",
        opacity=0.3,
    ))

    # --- window ---
    shapes.append(EllipseShape(
        id="window_ellipse",
        part_id="window",
        cx=cx, cy=body_y + 46,
        rx=12, ry=12,
        fill="#80DEEA",
        stroke="#4DD0E1",
        stroke_width=2.0,
    ))
    # window glare
    shapes.append(EllipseShape(
        id="window_glare",
        part_id=None,
        cx=cx - 4, cy=body_y + 41,
        rx=4, ry=3,
        fill="#FFFFFF",
        opacity=0.5,
    ))

    # --- interstage stripe ---
    shapes.append(RectShape(
        id="interstage_rect",
        part_id="interstage",
        x=body_x, y=interstage_y, w=body_w, h=10,
        fill="#546E7A",
        stroke="#37474F",
        stroke_width=1.0,
    ))

    # --- grid fins (small, above main fins) ---
    gf_w = 14.0
    gf_h = 18.0
    gf_y = interstage_y - gf_h - 4

    shapes.append(RectShape(
        id="grid_fin_left_rect",
        part_id="grid_fin_left",
        x=body_x - gf_w, y=gf_y, w=gf_w, h=gf_h,
        rx=2,
        fill="#546E7A",
        stroke="#37474F",
        stroke_width=1.0,
    ))
    # grid pattern lines inside left grid fin
    for i in range(1, 3):
        shapes.append(LineShape(
            id=f"grid_fin_left_v{i}",
            part_id=None,
            x1=body_x - gf_w + gf_w * i / 3,
            y1=gf_y,
            x2=body_x - gf_w + gf_w * i / 3,
            y2=gf_y + gf_h,
            stroke="#78909C",
            stroke_width=0.8,
        ))

    shapes.append(RectShape(
        id="grid_fin_right_rect",
        part_id="grid_fin_right",
        x=body_x + body_w, y=gf_y, w=gf_w, h=gf_h,
        rx=2,
        fill="#546E7A",
        stroke="#37474F",
        stroke_width=1.0,
    ))
    for i in range(1, 3):
        shapes.append(LineShape(
            id=f"grid_fin_right_v{i}",
            part_id=None,
            x1=body_x + body_w + gf_w * i / 3,
            y1=gf_y,
            x2=body_x + body_w + gf_w * i / 3,
            y2=gf_y + gf_h,
            stroke="#78909C",
            stroke_width=0.8,
        ))

    # --- left fin (swept triangle) ---
    shapes.append(PolygonShape(
        id="left_fin_poly",
        part_id="left_fin",
        points=[
            (body_x, fin_y_start),
            (body_x, fin_y_end),
            (body_x - 38, fin_y_end),
        ],
        fill="#546E7A",
        stroke="#37474F",
        stroke_width=1.5,
    ))

    # --- right fin ---
    shapes.append(PolygonShape(
        id="right_fin_poly",
        part_id="right_fin",
        points=[
            (body_x + body_w, fin_y_start),
            (body_x + body_w, fin_y_end),
            (body_x + body_w + 38, fin_y_end),
        ],
        fill="#546E7A",
        stroke="#37474F",
        stroke_width=1.5,
    ))

    # --- engine nozzle (trapezoid via polygon) ---
    nozzle_top_w = body_w - 10
    nozzle_bot_w = body_w - 20
    nozzle_top_x = cx - nozzle_top_w / 2
    nozzle_bot_x = cx - nozzle_bot_w / 2

    shapes.append(PolygonShape(
        id="engine_nozzle_poly",
        part_id="engine_nozzle",
        points=[
            (nozzle_top_x, nozzle_top_y),
            (nozzle_top_x + nozzle_top_w, nozzle_top_y),
            (nozzle_bot_x + nozzle_bot_w, nozzle_top_y + nozzle_h),
            (nozzle_bot_x, nozzle_top_y + nozzle_h),
        ],
        fill="#37474F",
        stroke="#263238",
        stroke_width=1.5,
    ))

    # nozzle inner bell curve (path)
    noz_cx = cx
    noz_top = nozzle_top_y + 4
    noz_bot = nozzle_top_y + nozzle_h - 2
    shapes.append(PathShape(
        id="engine_nozzle_inner",
        part_id=None,
        d=f"M {noz_cx - 10} {noz_top} Q {noz_cx - 14} {(noz_top+noz_bot)/2} {noz_cx - 8} {noz_bot}",
        fill="none",
        stroke="#546E7A",
        stroke_width=1.0,
    ))

    # --- flame (optional, always included as decorative) ---
    flame_y = nozzle_top_y + nozzle_h
    shapes.append(PolygonShape(
        id="flame_outer",
        part_id="flame",
        points=[
            (cx - 14, flame_y),
            (cx + 14, flame_y),
            (cx + 6, flame_y + 45),
            (cx, flame_y + 60),
            (cx - 6, flame_y + 45),
        ],
        fill="#FF6F00",
        opacity=0.85,
    ))
    shapes.append(PolygonShape(
        id="flame_inner",
        part_id=None,
        points=[
            (cx - 7, flame_y),
            (cx + 7, flame_y),
            (cx + 3, flame_y + 28),
            (cx, flame_y + 38),
            (cx - 3, flame_y + 28),
        ],
        fill="#FFF176",
        opacity=0.9,
    ))

    # ---------------------------------------------------------------------------
    # Label anchors (% of 560x420 viewbox)
    # ---------------------------------------------------------------------------
    anchors = [
        LabelAnchor(part_id="nose_cone",       x=50.0, y=10.0),
        LabelAnchor(part_id="body",            x=64.0, y=38.0),
        LabelAnchor(part_id="window",          x=64.0, y=26.0),
        LabelAnchor(part_id="interstage",      x=64.0, y=53.0),
        LabelAnchor(part_id="left_fin",        x=28.0, y=70.0),
        LabelAnchor(part_id="right_fin",       x=72.0, y=70.0),
        LabelAnchor(part_id="grid_fin_left",   x=36.0, y=47.0),
        LabelAnchor(part_id="grid_fin_right",  x=64.0, y=47.0),
        LabelAnchor(part_id="engine_nozzle",   x=50.0, y=74.0),
        LabelAnchor(part_id="flame",           x=50.0, y=88.0),
    ]

    rendered_parts = list({s.part_id for s in shapes if s.part_id})

    return RenderSpec(
        object_key="rocket.basic",
        viewbox="0 0 560 420",
        shapes=shapes,
        anchors=anchors,
        rendered_parts=rendered_parts,
    )
