"""human_body.external - front-view human body with internal organ overlay.

High-fidelity rendering (shared techniques with human_senses.py):
- 7-head proportion system
- Cubic bezier organic outlines (head jaw taper, tapered limbs)
- 3-layer skin system: highlight / base / warm shadow
- SVG linearGradient for body shading
- Semi-transparent internal organs (heart, lungs, stomach, brain)
- Output via RenderSpec.defs_svg + body_svg (raw SVG)
"""

from __future__ import annotations

import math

from systemedu.agents.builtin.gameagent.object_spec import (
    LabelAnchor,
    RenderSpec,
)

META = {
    "object_key": "human_body.external",
    "description": (
        "人体正面外观图，包含头、躯干、四肢轮廓及主要内脏位置标注（心、肺、胃）。"
        "适合讲解人体各部位名称和器官大致位置。"
        "不包含骨骼系统、肌肉系统、神经系统、单个器官的详细内部结构。"
        "与 human_body.senses 的区别：external 是泛用人体外观图（含内脏标注）；"
        "senses 是专用感官教学图（仅外感官热点）。"
    ),
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

# ── Color system (same palette as human_senses) ───────────────────────────────
_SKIN_HI   = "#F5C8A0"
_SKIN_BASE = "#E0956A"
_SKIN_SH   = "#A85C30"
_OUTLINE   = "#6B3518"
_HAIR      = "#2C1A0E"
_SHIRT_LT  = "#6AA8E8"
_SHIRT_MID = "#4A82C8"
_SHIRT_SH  = "#2A5090"
_PANTS_MID = "#3C5480"
_PANTS_SH  = "#1A2A50"


def _ep(cx, cy, rx, ry) -> str:
    k = 0.5523
    return (f"M {cx:.2f},{cy-ry:.2f} "
            f"C {cx+rx*k:.2f},{cy-ry:.2f} {cx+rx:.2f},{cy-ry*k:.2f} {cx+rx:.2f},{cy:.2f} "
            f"C {cx+rx:.2f},{cy+ry*k:.2f} {cx+rx*k:.2f},{cy+ry:.2f} {cx:.2f},{cy+ry:.2f} "
            f"C {cx-rx*k:.2f},{cy+ry:.2f} {cx-rx:.2f},{cy+ry*k:.2f} {cx-rx:.2f},{cy:.2f} "
            f"C {cx-rx:.2f},{cy-ry*k:.2f} {cx-rx*k:.2f},{cy-ry:.2f} {cx:.2f},{cy-ry:.2f} Z")


def _p(d, fill="none", stroke="none", sw=1, **kw) -> str:
    attrs = f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"'
    for k, v in kw.items():
        attrs += f' {k.replace("_", "-")}="{v}"'
    return f'<path d="{d}" {attrs}/>'


def _e(cx, cy, rx, ry, fill, stroke="none", sw=1, opacity=1) -> str:
    attrs = f'cx="{cx:.2f}" cy="{cy:.2f}" rx="{rx:.2f}" ry="{ry:.2f}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"'
    if opacity != 1:
        attrs += f' opacity="{opacity}"'
    return f'<ellipse {attrs}/>'


def _g(part_id, content) -> str:
    return f'<g data-part="{part_id}">{content}</g>'


def _limb(x1, y1, x2, y2, w1, w2, bend=0.0) -> str:
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1
    nx, ny = -dy / L, dx / L
    my = (y1 + y2) / 2
    lx1, ly1 = x1 - nx * w1, y1 - ny * w1
    rx1, ry1 = x1 + nx * w1, y1 + ny * w1
    lx2, ly2 = x2 - nx * w2 + bend, y2 - ny * w2
    rx2, ry2 = x2 + nx * w2 + bend, y2 + ny * w2
    return (f"M {lx1:.2f},{ly1:.2f} "
            f"C {lx1:.2f},{my:.2f} {lx2:.2f},{my:.2f} {lx2:.2f},{ly2:.2f} "
            f"L {rx2:.2f},{ry2:.2f} "
            f"C {rx2:.2f},{my:.2f} {rx1:.2f},{my:.2f} {rx1:.2f},{ry1:.2f} Z")


def _head_d(cx, cy, rx, ry) -> str:
    jrx = rx * 0.76
    return (
        f"M {cx:.2f},{cy-ry:.2f} "
        f"C {cx+rx*1.05:.2f},{cy-ry:.2f} {cx+rx:.2f},{cy-ry*0.3:.2f} {cx+rx:.2f},{cy:.2f} "
        f"C {cx+rx:.2f},{cy+ry*0.4:.2f} {cx+jrx:.2f},{cy+ry*0.7:.2f} {cx+jrx*0.45:.2f},{cy+ry*0.88:.2f} "
        f"C {cx+jrx*0.18:.2f},{cy+ry:.2f} {cx-jrx*0.18:.2f},{cy+ry:.2f} {cx-jrx*0.45:.2f},{cy+ry*0.88:.2f} "
        f"C {cx-jrx:.2f},{cy+ry*0.7:.2f} {cx-rx:.2f},{cy+ry*0.4:.2f} {cx-rx:.2f},{cy:.2f} "
        f"C {cx-rx:.2f},{cy-ry*0.3:.2f} {cx-rx*1.05:.2f},{cy-ry:.2f} {cx:.2f},{cy-ry:.2f} Z"
    )


def _torso_d(cx, sh_y, tb, hb, sh_hw, wa_hw, hip_hw) -> str:
    mid_y = (sh_y + tb) * 0.5
    return (
        f"M {cx-sh_hw:.2f},{sh_y:.2f} "
        f"C {cx-sh_hw:.2f},{mid_y:.2f} {cx-wa_hw:.2f},{mid_y:.2f} {cx-wa_hw:.2f},{tb:.2f} "
        f"C {cx-wa_hw:.2f},{(tb+hb)/2:.2f} {cx-hip_hw:.2f},{(tb+hb)/2:.2f} {cx-hip_hw:.2f},{hb:.2f} "
        f"L {cx+hip_hw:.2f},{hb:.2f} "
        f"C {cx+hip_hw:.2f},{(tb+hb)/2:.2f} {cx+wa_hw:.2f},{(tb+hb)/2:.2f} {cx+wa_hw:.2f},{tb:.2f} "
        f"C {cx+wa_hw:.2f},{mid_y:.2f} {cx+sh_hw:.2f},{mid_y:.2f} {cx+sh_hw:.2f},{sh_y:.2f} Z"
    )


def build(view: str = "front", variant: str | None = None) -> RenderSpec:
    """Build human_body.external RenderSpec. ViewBox: 0 0 380 580"""
    W, H = 380, 580
    cx = W / 2   # 190

    # 7-head proportion system
    HU = H / 7.5
    head_cy  = 10 + HU * 0.60
    head_rx  = HU * 0.50
    head_ry  = HU * 0.60
    chin_y   = head_cy + head_ry
    neck_bot = chin_y + HU * 0.22
    sh_y     = neck_bot + 4
    torso_bot= 10 + HU * 3.0
    hip_bot  = 10 + HU * 4.0
    knee_y   = 10 + HU * 5.6
    ankle_y  = 10 + HU * 7.0
    elbow_y  = 10 + HU * 2.9
    wrist_y  = 10 + HU * 4.0

    sh_hw  = HU * 0.90
    wa_hw  = HU * 0.58
    hip_hw = HU * 0.72
    ua_w   = HU * 0.165
    fa_w   = HU * 0.11
    wr_w   = HU * 0.08

    eye_y   = head_cy - HU * 0.06
    eye_sep = head_rx * 0.44

    head_d = _head_d(cx, head_cy, head_rx, head_ry)

    defs = f"""
<radialGradient id="hb_face" cx="40%" cy="32%" r="60%">
  <stop offset="0%" stop-color="{_SKIN_HI}"/>
  <stop offset="50%" stop-color="{_SKIN_BASE}"/>
  <stop offset="100%" stop-color="{_SKIN_SH}"/>
</radialGradient>
<linearGradient id="hb_skin_v" x1="0" y1="0" x2="0.15" y2="1">
  <stop offset="0%" stop-color="{_SKIN_HI}"/>
  <stop offset="40%" stop-color="{_SKIN_BASE}"/>
  <stop offset="100%" stop-color="{_SKIN_SH}"/>
</linearGradient>
<linearGradient id="hb_shirt" x1="0" y1="0" x2="0.25" y2="1">
  <stop offset="0%" stop-color="{_SHIRT_LT}"/>
  <stop offset="55%" stop-color="{_SHIRT_MID}"/>
  <stop offset="100%" stop-color="{_SHIRT_SH}"/>
</linearGradient>
<linearGradient id="hb_pants" x1="0" y1="0" x2="0.2" y2="1">
  <stop offset="0%" stop-color="#4C6490"/>
  <stop offset="100%" stop-color="{_PANTS_SH}"/>
</linearGradient>
<clipPath id="hb_torso_clip">
  <path d="{_torso_d(cx, sh_y, torso_bot, hip_bot, sh_hw, wa_hw, hip_hw)}"/>
</clipPath>
<clipPath id="hb_head_clip">
  <path d="{head_d}"/>
</clipPath>
"""

    parts = []

    # ── Hair (back) ───────────────────────────────────────────────────────────
    parts.append(_p(
        f"M {cx-head_rx*1.05:.1f},{head_cy-head_ry*0.1:.1f} "
        f"C {cx-head_rx*0.85:.1f},{head_cy-head_ry*1.08:.1f} {cx:.1f},{head_cy-head_ry*1.32:.1f} "
        f"{cx+head_rx*0.85:.1f},{head_cy-head_ry*1.08:.1f} L {cx+head_rx*1.05:.1f},{head_cy-head_ry*0.1:.1f}",
        fill=_HAIR, stroke=_HAIR, sw=2,
        stroke_linejoin="round", stroke_linecap="round"
    ))

    # ── Head ──────────────────────────────────────────────────────────────────
    parts.append(_g("head",
        _p(_head_d(cx, head_cy, head_rx + 2, head_ry + 2), fill=_OUTLINE) +
        _p(head_d, fill="url(#hb_face)")
    ))

    # Brain outline (inside head, semi-transparent)
    parts.append(_g("brain_outline",
        f'<ellipse cx="{cx:.1f}" cy="{head_cy-head_ry*0.1:.1f}" '
        f'rx="{head_rx*0.72:.1f}" ry="{head_ry*0.62:.1f}" '
        f'fill="#CE93D8" stroke="#7B1FA2" stroke-width="1.2" opacity="0.38" '
        f'clip-path="url(#hb_head_clip)"/>'
    ))

    # Eyes
    for side, eid in [(-1, None), (1, None)]:
        ex = cx + side * eye_sep
        parts.append(
            _e(ex, eye_y, 12, 9, fill="white", stroke=_OUTLINE, sw=1.0) +
            _e(ex, eye_y, 6, 7, fill="#3A6FC4") +
            _e(ex, eye_y, 3.5, 4, fill=_HAIR) +
            _e(ex - 2, eye_y - 2.5, 1.8, 1.8, fill="white", opacity=0.85) +
            f'<path d="M {ex-12:.1f},{eye_y-1:.1f} Q {ex:.1f},{eye_y-11:.1f} {ex+12:.1f},{eye_y-1:.1f}" '
            f'fill="none" stroke="{_OUTLINE}" stroke-width="1.8" stroke-linecap="round"/>'
        )
    # Eyebrows
    for side in [-1, 1]:
        bx = cx + side * eye_sep
        by = eye_y - 16
        parts.append(f'<path d="M {bx-11:.1f},{by:.1f} Q {bx:.1f},{by-4:.1f} {bx+11:.1f},{by:.1f}" '
                     f'fill="none" stroke="{_HAIR}" stroke-width="3" stroke-linecap="round"/>')
    # Nose
    parts.append(_p(
        f"M {cx-2:.1f},{head_cy+head_ry*0.12:.1f} "
        f"C {cx-4:.1f},{head_cy+head_ry*0.28:.1f} {cx-6:.1f},{head_cy+head_ry*0.38:.1f} {cx-7:.1f},{head_cy+head_ry*0.42:.1f}",
        stroke=_SKIN_SH, sw=2, stroke_linecap="round", opacity="0.38"
    ))
    # Mouth
    parts.append(_p(
        f"M {cx-12:.1f},{head_cy+head_ry*0.62:.1f} Q {cx:.1f},{head_cy+head_ry*0.7:.1f} {cx+12:.1f},{head_cy+head_ry*0.62:.1f}",
        stroke="#C04848", sw=2.0, stroke_linecap="round"
    ))

    # ── Neck ────────────────────────────────────────────────────────────────
    parts.append(_p(
        f"M {cx-11:.1f},{chin_y:.1f} L {cx-13:.1f},{neck_bot:.1f} "
        f"L {cx+13:.1f},{neck_bot:.1f} L {cx+11:.1f},{chin_y:.1f} Z",
        fill="url(#hb_skin_v)", stroke=_OUTLINE, sw=1
    ))

    # ── Torso ────────────────────────────────────────────────────────────────
    torso_d = _torso_d(cx, sh_y, torso_bot, hip_bot, sh_hw, wa_hw, hip_hw)
    parts.append(_g("torso",
        _p(torso_d, fill="url(#hb_shirt)", stroke=_SHIRT_SH, sw=1.5) +
        # collar V
        f'<path d="M {cx-9:.1f},{sh_y:.1f} L {cx:.1f},{sh_y+18:.1f} L {cx+9:.1f},{sh_y:.1f}" '
        f'fill="none" stroke="{_SHIRT_SH}" stroke-width="1.5" stroke-linecap="round"/>'
    ))

    # ── Internal organs (semi-transparent, clipped to torso) ─────────────────
    # Left lung
    parts.append(_g("left_lung",
        f'<ellipse cx="{cx-wa_hw*0.55:.1f}" cy="{sh_y+torso_bot*0.28:.1f}" '
        f'rx="{wa_hw*0.58:.1f}" ry="{(torso_bot-sh_y)*0.38:.1f}" '
        f'fill="#EF9A9A" stroke="#E53935" stroke-width="1.2" opacity="0.55" '
        f'clip-path="url(#hb_torso_clip)"/>'
    ))
    # Right lung
    parts.append(_g("right_lung",
        f'<ellipse cx="{cx+wa_hw*0.55:.1f}" cy="{sh_y+torso_bot*0.28:.1f}" '
        f'rx="{wa_hw*0.58:.1f}" ry="{(torso_bot-sh_y)*0.38:.1f}" '
        f'fill="#EF9A9A" stroke="#E53935" stroke-width="1.2" opacity="0.55" '
        f'clip-path="url(#hb_torso_clip)"/>'
    ))
    # Heart
    heart_cx = cx + wa_hw * 0.12
    heart_cy = sh_y + (torso_bot - sh_y) * 0.30
    parts.append(_g("heart",
        f'<path d="M {heart_cx:.1f},{heart_cy+13:.1f} '
        f'C {heart_cx-16:.1f},{heart_cy+5:.1f} {heart_cx-16:.1f},{heart_cy-9:.1f} {heart_cx:.1f},{heart_cy:.1f} '
        f'C {heart_cx+16:.1f},{heart_cy-9:.1f} {heart_cx+16:.1f},{heart_cy+5:.1f} {heart_cx:.1f},{heart_cy+13:.1f} Z" '
        f'fill="#EF5350" stroke="#C62828" stroke-width="1.2" opacity="0.7" '
        f'clip-path="url(#hb_torso_clip)"/>'
    ))
    # Stomach
    stomach_cx = cx - wa_hw * 0.15
    stomach_cy = sh_y + (torso_bot - sh_y) * 0.7
    parts.append(_g("stomach",
        f'<ellipse cx="{stomach_cx:.1f}" cy="{stomach_cy:.1f}" '
        f'rx="{wa_hw*0.52:.1f}" ry="{(torso_bot-sh_y)*0.2:.1f}" '
        f'fill="#A5D6A7" stroke="#388E3C" stroke-width="1.2" opacity="0.62" '
        f'clip-path="url(#hb_torso_clip)"/>'
    ))

    # ── Arms ────────────────────────────────────────────────────────────────
    for side, pid in [(-1, "left_arm"), (1, "right_arm")]:
        ax = cx + side * (sh_hw - ua_w)
        # upper arm (shirt)
        ua_d = _limb(ax, sh_y, ax + side * 4, elbow_y, ua_w, ua_w * 0.85, bend=side * 5)
        parts.append(_g(pid,
            _p(ua_d, fill="url(#hb_shirt)", stroke=_SHIRT_SH, sw=1) +
            _p(_limb(ax + side * 4, elbow_y, ax + side * 9, wrist_y, fa_w, wr_w, bend=side * 4),
               fill="url(#hb_skin_v)", stroke=_OUTLINE, sw=1) +
            # hand
            _p(_ep(ax + side * 9, wrist_y + 14, 12, 16), fill="url(#hb_skin_v)", stroke=_OUTLINE, sw=1)
        ))

    # ── Legs ────────────────────────────────────────────────────────────────
    for side, pid in [(-1, "left_leg"), (1, "right_leg")]:
        lx = cx + side * hip_hw * 0.50
        ul_w = HU * 0.205
        ll_w = HU * 0.155
        ul_d = _limb(lx, hip_bot, lx + side * 2, knee_y, ul_w, ll_w * 1.05, bend=side * 3)
        ll_d = _limb(lx + side * 2, knee_y, lx + side * 1, ankle_y, ll_w, HU * 0.09, bend=side * 2)
        # shoe
        fx = lx + side
        foot_w = HU * 0.09
        shoe_toe = fx + side * HU * 0.25
        shoe_d = (f"M {fx-foot_w:.1f},{ankle_y:.1f} "
                  f"C {fx-foot_w:.1f},{H-14:.1f} {shoe_toe:.1f},{H-12:.1f} {shoe_toe:.1f},{ankle_y+18:.1f} "
                  f"C {shoe_toe:.1f},{ankle_y+8:.1f} {fx+foot_w:.1f},{ankle_y+4:.1f} {fx+foot_w:.1f},{ankle_y:.1f} Z")
        parts.append(_g(pid,
            _p(ul_d, fill="url(#hb_pants)", stroke=_PANTS_SH, sw=1) +
            _p(ll_d, fill="url(#hb_pants)", stroke=_PANTS_SH, sw=1) +
            _p(shoe_d, fill="#2A2A3A", stroke="#111", sw=1)
        ))

    # ── Hair foreground ───────────────────────────────────────────────────────
    parts.append(_p(
        f"M {cx-head_rx*0.5:.1f},{head_cy-head_ry*0.92:.1f} "
        f"Q {cx:.1f},{head_cy-head_ry*1.28:.1f} "
        f"{cx+head_rx*0.5:.1f},{head_cy-head_ry*0.92:.1f}",
        stroke=_HAIR, sw=7, stroke_linecap="round", opacity="0.55"
    ))

    body_svg = "\n".join(parts)

    # ── Anchors ────────────────────────────────────────────────────────────────
    def px(x): return round(x / W * 100, 1)
    def py(y): return round(y / H * 100, 1)

    left_ax  = cx - (sh_hw - ua_w) - ua_w - 20
    right_ax = cx + (sh_hw - ua_w) + ua_w + 20
    left_lx  = cx - hip_hw * 0.50 - HU * 0.25
    right_lx = cx + hip_hw * 0.50 + HU * 0.25

    anchors = [
        LabelAnchor(part_id="head",          x=px(cx + head_rx + 22), y=py(head_cy - head_ry * 0.5)),
        LabelAnchor(part_id="brain_outline", x=px(cx + 26),            y=py(head_cy - head_ry * 0.55)),
        LabelAnchor(part_id="torso",         x=px(cx + sh_hw + 20),   y=py(sh_y + (torso_bot - sh_y) * 0.35)),
        LabelAnchor(part_id="heart",         x=px(heart_cx + 22),      y=py(heart_cy)),
        LabelAnchor(part_id="left_lung",     x=px(cx - wa_hw - 22),   y=py(sh_y + (torso_bot - sh_y) * 0.28)),
        LabelAnchor(part_id="right_lung",    x=px(cx + wa_hw + 22),   y=py(sh_y + (torso_bot - sh_y) * 0.28)),
        LabelAnchor(part_id="stomach",       x=px(stomach_cx - 28),   y=py(stomach_cy)),
        LabelAnchor(part_id="left_arm",      x=px(left_ax - 10),       y=py(elbow_y - 10)),
        LabelAnchor(part_id="right_arm",     x=px(right_ax + 10),      y=py(elbow_y - 10)),
        LabelAnchor(part_id="left_leg",      x=px(left_lx - 10),       y=py((hip_bot + knee_y) / 2)),
        LabelAnchor(part_id="right_leg",     x=px(right_lx + 10),      y=py((hip_bot + knee_y) / 2)),
    ]

    rendered_parts = [
        "head", "brain_outline", "torso",
        "heart", "left_lung", "right_lung", "stomach",
        "left_arm", "right_arm", "left_leg", "right_leg",
    ]

    return RenderSpec(
        object_key="human_body.external",
        viewbox=f"0 0 {W} {H}",
        shapes=[],
        anchors=anchors,
        rendered_parts=rendered_parts,
        defs_svg=defs.strip(),
        body_svg=body_svg,
    )
