"""human_body.external - front-view educational human body outline."""

from __future__ import annotations

from systemedu.agents.builtin.gameagent.object_spec import (
    EllipseShape,
    LabelAnchor,
    PathShape,
    RectShape,
    RenderSpec,
)

META = {
    "object_key": "human_body.external",
    "views": ["front"],
    "must_have": ["head", "torso", "left_arm", "right_arm", "left_leg", "right_leg"],
    "optional": ["heart", "left_lung", "right_lung", "stomach", "brain_outline"],
    "labelable": [
        "head", "torso", "left_arm", "right_arm", "left_leg", "right_leg",
        "heart", "left_lung", "right_lung", "stomach", "brain_outline",
    ],
    "parts": {
        "head": {
            "label_zh": "头部",
            "label_en": "Head",
            "desc_brief": "包含大脑、感觉器官（眼耳鼻口）",
            "hint": "头部有哪些重要器官？",
        },
        "torso": {
            "label_zh": "躯干",
            "label_en": "Torso",
            "desc_brief": "容纳心脏、肺、胃、肝等重要器官",
            "hint": "为什么肋骨这么坚固？",
        },
        "heart": {
            "label_zh": "心脏",
            "label_en": "Heart",
            "desc_brief": "泵血器官，维持全身血液循环",
            "hint": "心脏每分钟跳多少次？",
        },
        "left_lung": {
            "label_zh": "左肺",
            "label_en": "Left Lung",
            "desc_brief": "负责气体交换，吸入氧气、呼出二氧化碳",
            "hint": "为什么左肺比右肺小？",
        },
        "right_lung": {
            "label_zh": "右肺",
            "label_en": "Right Lung",
            "desc_brief": "负责气体交换，吸入氧气、呼出二氧化碳",
            "hint": "肺的内表面积有多大？",
        },
        "stomach": {
            "label_zh": "胃",
            "label_en": "Stomach",
            "desc_brief": "消化器官，分泌胃酸分解食物",
            "hint": "胃里的酸有多强？",
        },
        "left_arm": {
            "label_zh": "左臂",
            "label_en": "Left Arm",
            "desc_brief": "由上臂、前臂和手组成，用于操作和抓握",
            "hint": "",
        },
        "right_arm": {
            "label_zh": "右臂",
            "label_en": "Right Arm",
            "desc_brief": "由上臂、前臂和手组成，用于操作和抓握",
            "hint": "",
        },
        "left_leg": {
            "label_zh": "左腿",
            "label_en": "Left Leg",
            "desc_brief": "支撑体重，用于行走和运动",
            "hint": "",
        },
        "right_leg": {
            "label_zh": "右腿",
            "label_en": "Right Leg",
            "desc_brief": "支撑体重，用于行走和运动",
            "hint": "",
        },
        "brain_outline": {
            "label_zh": "大脑",
            "label_en": "Brain",
            "desc_brief": "神经系统中枢，控制思维、运动和感觉",
            "hint": "大脑有多少个神经元？",
        },
    },
}


def build(view: str = "front", variant: str | None = None) -> RenderSpec:
    """Build a front-view human body RenderSpec. Viewbox: 0 0 560 420."""
    cx = 280.0
    head_cy = 62.0
    head_rx = 34.0
    head_ry = 40.0
    neck_y = head_cy + head_ry
    torso_x = cx - 42
    torso_y = neck_y + 8
    torso_w = 84.0
    torso_h = 110.0
    arm_w = 20.0
    arm_h = 90.0
    leg_w = 28.0
    leg_h = 100.0

    shapes: list = []

    # skin color
    skin = "#FFCC80"
    outline = "#8D6E63"
    organ_stroke = "#78909C"

    # --- head ---
    shapes.append(EllipseShape(
        id="head_ellipse", part_id="head",
        cx=cx, cy=head_cy, rx=head_rx, ry=head_ry,
        fill=skin, stroke=outline, stroke_width=2.0,
    ))
    # eyes (decorative)
    for ex in [cx - 12, cx + 12]:
        shapes.append(EllipseShape(
            id=f"eye_{int(ex)}", part_id=None,
            cx=ex, cy=head_cy - 5, rx=5, ry=6,
            fill="#FFFFFF", stroke="#9E9E9E", stroke_width=1.0,
        ))
        shapes.append(EllipseShape(
            id=f"pupil_{int(ex)}", part_id=None,
            cx=ex, cy=head_cy - 5, rx=2.5, ry=3,
            fill="#5D4037",
        ))

    # --- neck ---
    shapes.append(RectShape(
        id="neck_rect", part_id=None,
        x=cx - 12, y=neck_y, w=24, h=12,
        fill=skin, stroke=outline, stroke_width=1.5,
    ))

    # --- torso ---
    shapes.append(RectShape(
        id="torso_rect", part_id="torso",
        x=torso_x, y=torso_y, w=torso_w, h=torso_h,
        rx=10,
        fill=skin, stroke=outline, stroke_width=2.0,
    ))

    # --- internal organs (optional, drawn on top of torso) ---
    heart_cx = cx + 8
    heart_cy = torso_y + 28

    # heart (two circles + triangle approximation via path)
    shapes.append(PathShape(
        id="heart_path", part_id="heart",
        d=(f"M {heart_cx} {heart_cy + 16} "
           f"C {heart_cx - 20} {heart_cy + 6} {heart_cx - 20} {heart_cy - 10} {heart_cx} {heart_cy} "
           f"C {heart_cx + 20} {heart_cy - 10} {heart_cx + 20} {heart_cy + 6} {heart_cx} {heart_cy + 16} Z"),
        fill="#EF5350", stroke="#C62828", stroke_width=1.0,
    ))

    # lungs
    shapes.append(EllipseShape(
        id="left_lung_ellipse", part_id="left_lung",
        cx=cx - 22, cy=torso_y + 42, rx=16, ry=26,
        fill="#EF9A9A", stroke="#E53935", stroke_width=1.0, opacity=0.8,
    ))
    shapes.append(EllipseShape(
        id="right_lung_ellipse", part_id="right_lung",
        cx=cx + 22, cy=torso_y + 42, rx=16, ry=26,
        fill="#EF9A9A", stroke="#E53935", stroke_width=1.0, opacity=0.8,
    ))

    # stomach
    shapes.append(EllipseShape(
        id="stomach_ellipse", part_id="stomach",
        cx=cx - 5, cy=torso_y + 80, rx=18, ry=14,
        fill="#A5D6A7", stroke="#388E3C", stroke_width=1.0, opacity=0.85,
    ))

    # brain outline (inside head)
    shapes.append(EllipseShape(
        id="brain_ellipse", part_id="brain_outline",
        cx=cx, cy=head_cy - 8, rx=22, ry=24,
        fill="#CE93D8", stroke="#7B1FA2", stroke_width=1.0, opacity=0.55,
    ))

    # --- arms ---
    shapes.append(RectShape(
        id="left_arm_rect", part_id="left_arm",
        x=torso_x - arm_w - 2, y=torso_y + 6, w=arm_w, h=arm_h,
        rx=8, fill=skin, stroke=outline, stroke_width=1.5,
    ))
    shapes.append(RectShape(
        id="right_arm_rect", part_id="right_arm",
        x=torso_x + torso_w + 2, y=torso_y + 6, w=arm_w, h=arm_h,
        rx=8, fill=skin, stroke=outline, stroke_width=1.5,
    ))

    # --- legs ---
    leg_y = torso_y + torso_h + 2
    shapes.append(RectShape(
        id="left_leg_rect", part_id="left_leg",
        x=cx - leg_w - 4, y=leg_y, w=leg_w, h=leg_h,
        rx=8, fill=skin, stroke=outline, stroke_width=1.5,
    ))
    shapes.append(RectShape(
        id="right_leg_rect", part_id="right_leg",
        x=cx + 4, y=leg_y, w=leg_w, h=leg_h,
        rx=8, fill=skin, stroke=outline, stroke_width=1.5,
    ))

    anchors = [
        LabelAnchor(part_id="head",          x=68.0, y=10.0),
        LabelAnchor(part_id="brain_outline", x=50.0, y=8.0),
        LabelAnchor(part_id="torso",         x=68.0, y=40.0),
        LabelAnchor(part_id="heart",         x=62.0, y=26.0),
        LabelAnchor(part_id="left_lung",     x=30.0, y=34.0),
        LabelAnchor(part_id="right_lung",    x=70.0, y=34.0),
        LabelAnchor(part_id="stomach",       x=35.0, y=52.0),
        LabelAnchor(part_id="left_arm",      x=20.0, y=42.0),
        LabelAnchor(part_id="right_arm",     x=80.0, y=42.0),
        LabelAnchor(part_id="left_leg",      x=32.0, y=78.0),
        LabelAnchor(part_id="right_leg",     x=68.0, y=78.0),
    ]

    rendered_parts = list({s.part_id for s in shapes if s.part_id})

    return RenderSpec(
        object_key="human_body.external",
        viewbox="0 0 560 420",
        shapes=shapes,
        anchors=anchors,
        rendered_parts=rendered_parts,
    )
