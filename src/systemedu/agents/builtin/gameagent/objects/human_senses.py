"""human_body.senses - front-view human figure showing external sense organs only.

Rendering approach (high-fidelity):
- 7.5-head proportion system
- Cubic bezier organic outlines (head jaw taper, tapered limbs, ear C-curves)
- 3-layer skin system: highlight / base / shadow with warm hue shift
- SVG linearGradient + radialGradient for volume
- Cel-shading shadow shapes, rim lights
- Output via RenderSpec.defs_svg + body_svg (raw SVG, bypasses JS shapeToSVG)
"""

from __future__ import annotations
import math
from systemedu.agents.builtin.gameagent.object_spec import (
    LabelAnchor,
    RenderSpec,
)

META = {
    "object_key": "human_body.senses",
    "description": (
        "人体正面感官图，专门展示外部感觉器官：眼睛、耳朵、鼻子、嘴巴/舌头、双手（皮肤触觉）。"
        "适合讲解五感、感觉器官、传感器类比（眼→摄像头、耳→麦克风、鼻→气体传感器、皮肤→压力传感器）。"
        "不包含心脏、肺、胃、肝等内脏器官，不包含骨骼、肌肉系统。"
        "与 human_body.external 的区别：external 是泛用人体外观图（含内脏标注）；"
        "senses 是专用感官教学图（仅外感官热点）。"
    ),
    "views": ["front"],
    "must_have": ["left_eye", "right_eye", "left_ear", "right_ear", "nose", "mouth"],
    "optional": ["tongue", "left_hand", "right_hand", "brain_hint"],
    "labelable": [
        "left_eye", "right_eye", "left_ear", "right_ear",
        "nose", "mouth", "tongue", "left_hand", "right_hand", "brain_hint",
    ],
    "parts": {
        "left_eye":   {"label_zh": "左眼",       "label_en": "Left Eye",
                       "desc_brief": "感知光线和颜色，类似摄像头 / 光传感器",
                       "hint": "眼睛能看到哪些颜色？机器呢？"},
        "right_eye":  {"label_zh": "右眼",       "label_en": "Right Eye",
                       "desc_brief": "感知光线和颜色，类似摄像头 / 光传感器",
                       "hint": "两只眼睛一起用有什么好处？"},
        "left_ear":   {"label_zh": "左耳",       "label_en": "Left Ear",
                       "desc_brief": "感知声音振动，类似麦克风 / 声音传感器",
                       "hint": "耳朵如何判断声音来自哪个方向？"},
        "right_ear":  {"label_zh": "右耳",       "label_en": "Right Ear",
                       "desc_brief": "感知声音振动，类似麦克风 / 声音传感器",
                       "hint": "分贝越高越危险，耳朵有保护机制吗？"},
        "nose":       {"label_zh": "鼻子",       "label_en": "Nose",
                       "desc_brief": "感知气味分子，类似气体传感器",
                       "hint": "人能区分多少种气味？"},
        "mouth":      {"label_zh": "嘴巴",       "label_en": "Mouth",
                       "desc_brief": "感知味道（酸甜苦咸鲜），类似化学传感器",
                       "hint": "舌头不同区域感知不同味道吗？"},
        "tongue":     {"label_zh": "舌头",       "label_en": "Tongue",
                       "desc_brief": "味蕾感知化学物质，类似化学成分传感器",
                       "hint": "舌头上有多少个味蕾？"},
        "left_hand":  {"label_zh": "左手（皮肤）", "label_en": "Left Hand / Skin",
                       "desc_brief": "感知触觉、温度、压力，类似压力传感器 / 温度传感器",
                       "hint": "皮肤上有多少种感受器？"},
        "right_hand": {"label_zh": "右手（皮肤）", "label_en": "Right Hand / Skin",
                       "desc_brief": "感知触觉、温度、压力，类似压力传感器 / 温度传感器",
                       "hint": "指尖的触觉为什么比背部灵敏？"},
        "brain_hint": {"label_zh": "大脑（处理中枢）", "label_en": "Brain (Processing Center)",
                       "desc_brief": "接收所有感官信号并处理，类似微控制器 / CPU",
                       "hint": "感官信号到大脑需要多长时间？"},
    },
}

# ── Color system ─────────────────────────────────────────────────────────────
_SKIN_HI   = "#F5C8A0"   # warm highlight
_SKIN_BASE = "#E0956A"   # midtone
_SKIN_SH   = "#A85C30"   # warm-shifted shadow
_OUTLINE   = "#6B3518"   # dark brown outline
_HAIR      = "#2C1A0E"
_EYE_WHITE = "#F8F8F0"
_EYE_IRIS  = "#3A6FC4"
_EYE_PUPIL = "#10102A"
_SHIRT_LT  = "#6AA8E8"
_SHIRT_MID = "#4A82C8"
_SHIRT_SH  = "#2A5090"
_PANTS_MID = "#3C5480"
_PANTS_SH  = "#1A2A50"
_MOUTH_COL = "#C04848"
_TONGUE    = "#D85870"
_TEETH     = "#F8F4E8"


# ── SVG path helpers ─────────────────────────────────────────────────────────

def _ep(cx, cy, rx, ry) -> str:
    """Ellipse as 4-arc cubic bezier path."""
    k = 0.5523
    return (f"M {cx:.2f},{cy-ry:.2f} "
            f"C {cx+rx*k:.2f},{cy-ry:.2f} {cx+rx:.2f},{cy-ry*k:.2f} {cx+rx:.2f},{cy:.2f} "
            f"C {cx+rx:.2f},{cy+ry*k:.2f} {cx+rx*k:.2f},{cy+ry:.2f} {cx:.2f},{cy+ry:.2f} "
            f"C {cx-rx*k:.2f},{cy+ry:.2f} {cx-rx:.2f},{cy+ry*k:.2f} {cx-rx:.2f},{cy:.2f} "
            f"C {cx-rx:.2f},{cy-ry*k:.2f} {cx-rx*k:.2f},{cy-ry:.2f} {cx:.2f},{cy-ry:.2f} Z")


def _smooth_path(pts: list[tuple[float, float]], close=True, sm=0.18) -> str:
    """Smooth cubic bezier through point list (François Romain algorithm)."""
    n = len(pts)
    if n < 2:
        return ""
    cps = []
    for i in range(n):
        p  = pts[i]
        pp = pts[max(0, i - 1)]
        pn = pts[min(n - 1, i + 1)]
        dx, dy = pn[0] - pp[0], pn[1] - pp[1]
        cps.append(((p[0] - dx * sm, p[1] - dy * sm),
                    (p[0] + dx * sm, p[1] + dy * sm)))
    d = f"M {pts[0][0]:.2f},{pts[0][1]:.2f}"
    for i in range(1, n):
        c1 = cps[i - 1][1]
        c2 = cps[i][0]
        ep = pts[i]
        d += f" C {c1[0]:.2f},{c1[1]:.2f} {c2[0]:.2f},{c2[1]:.2f} {ep[0]:.2f},{ep[1]:.2f}"
    if close:
        d += " Z"
    return d


def _limb(x1, y1, x2, y2, w1, w2, bend=0.0) -> str:
    """Tapered limb: wider at (x1,y1), narrower at (x2,y2), optional lateral bend."""
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1
    nx, ny = -dy / L, dx / L
    mx, my = (x1 + x2) / 2 + bend, (y1 + y2) / 2
    # 4 corner points
    lx1, ly1 = x1 - nx * w1, y1 - ny * w1
    rx1, ry1 = x1 + nx * w1, y1 + ny * w1
    lx2, ly2 = x2 - nx * w2 + bend, y2 - ny * w2
    rx2, ry2 = x2 + nx * w2 + bend, y2 + ny * w2
    return (f"M {lx1:.2f},{ly1:.2f} "
            f"C {lx1:.2f},{my:.2f} {lx2:.2f},{my:.2f} {lx2:.2f},{ly2:.2f} "
            f"L {rx2:.2f},{ry2:.2f} "
            f"C {rx2:.2f},{my:.2f} {rx1:.2f},{my:.2f} {rx1:.2f},{ry1:.2f} Z")


def _g(part_id: str | None, content: str, extra: str = "") -> str:
    pid_attr = f' data-part="{part_id}"' if part_id else ""
    return f"<g{pid_attr}{(' ' + extra) if extra else ''}>{content}</g>"


def _path(d, fill="none", stroke="none", sw=1, opacity=1, **kw) -> str:
    attrs = f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"'
    if opacity != 1:
        attrs += f' opacity="{opacity}"'
    for k, v in kw.items():
        attrs += f' {k.replace("_", "-")}="{v}"'
    return f'<path d="{d}" {attrs}/>'


def _ellipse(cx, cy, rx, ry, fill, stroke="none", sw=1, opacity=1, **kw) -> str:
    attrs = f'cx="{cx:.2f}" cy="{cy:.2f}" rx="{rx:.2f}" ry="{ry:.2f}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"'
    if opacity != 1:
        attrs += f' opacity="{opacity}"'
    for k, v in kw.items():
        attrs += f' {k.replace("_", "-")}="{v}"'
    return f'<ellipse {attrs}/>'


# ── Main build ───────────────────────────────────────────────────────────────

def build(view: str = "front", variant: str | None = None) -> RenderSpec:
    """Build human_body.senses RenderSpec. ViewBox: 0 0 380 600"""
    W, H = 380, 600
    cx = W / 2   # 190

    # 7.5-head proportion system
    HU = H / 7.5       # head unit ≈ 80px
    head_cy  = 10 + HU * 0.60     # ~58
    head_rx  = HU * 0.50          # ~40
    head_ry  = HU * 0.60          # ~48
    chin_y   = head_cy + head_ry  # ~106
    neck_bot = chin_y + HU * 0.22 # ~124
    sh_y     = neck_bot + 4       # shoulder top ~128
    torso_bot= 10 + HU * 3.0      # ~250
    hip_bot  = 10 + HU * 4.0      # ~330
    knee_y   = 10 + HU * 5.6      # ~458
    ankle_y  = 10 + HU * 7.0      # ~570
    elbow_y  = 10 + HU * 2.9      # ~242
    wrist_y  = 10 + HU * 4.0      # ~330

    sh_hw  = HU * 0.90   # shoulder half-width ~72
    wa_hw  = HU * 0.58   # waist half-width ~46
    hip_hw = HU * 0.72   # hip half-width ~58
    ua_w   = HU * 0.165  # upper arm half-width ~13
    fa_w   = HU * 0.11   # forearm half-width ~9
    wr_w   = HU * 0.08   # wrist half-width ~6

    eye_y   = head_cy - HU * 0.06
    eye_sep = head_rx * 0.44

    # ── defs ─────────────────────────────────────────────────────────────────
    head_clip_d = _head_d(cx, head_cy, head_rx, head_ry)
    defs = f"""
<radialGradient id="hs_face" cx="40%" cy="32%" r="60%">
  <stop offset="0%" stop-color="{_SKIN_HI}"/>
  <stop offset="50%" stop-color="{_SKIN_BASE}"/>
  <stop offset="100%" stop-color="{_SKIN_SH}"/>
</radialGradient>
<linearGradient id="hs_skin_v" x1="0" y1="0" x2="0.15" y2="1">
  <stop offset="0%" stop-color="{_SKIN_HI}"/>
  <stop offset="40%" stop-color="{_SKIN_BASE}"/>
  <stop offset="100%" stop-color="{_SKIN_SH}"/>
</linearGradient>
<linearGradient id="hs_shirt" x1="0" y1="0" x2="0.25" y2="1">
  <stop offset="0%" stop-color="{_SHIRT_LT}"/>
  <stop offset="55%" stop-color="{_SHIRT_MID}"/>
  <stop offset="100%" stop-color="{_SHIRT_SH}"/>
</linearGradient>
<linearGradient id="hs_pants" x1="0" y1="0" x2="0.2" y2="1">
  <stop offset="0%" stop-color="#4C6490"/>
  <stop offset="100%" stop-color="{_PANTS_SH}"/>
</linearGradient>
<clipPath id="hs_head_clip">
  <path d="{head_clip_d}"/>
</clipPath>
"""

    # ── body ─────────────────────────────────────────────────────────────────
    parts: list[str] = []

    # -- Hair (back) --
    hair_d = _smooth_path([
        (cx - head_rx * 1.05, head_cy - head_ry * 0.1),
        (cx - head_rx * 0.85, head_cy - head_ry * 1.08),
        (cx - head_rx * 0.3,  head_cy - head_ry * 1.28),
        (cx,                  head_cy - head_ry * 1.32),
        (cx + head_rx * 0.3,  head_cy - head_ry * 1.28),
        (cx + head_rx * 0.85, head_cy - head_ry * 1.08),
        (cx + head_rx * 1.05, head_cy - head_ry * 0.1),
    ], close=False)
    parts.append(_path(hair_d, fill=_HAIR, stroke=_HAIR, sw=2,
                       stroke_linejoin="round", stroke_linecap="round"))

    # -- Ears (behind head) --
    for side, pid in [(-1, "left_ear"), (1, "right_ear")]:
        ex = cx + side * (head_rx - 1)
        ey = head_cy + 6
        outer_d = _ear_d(ex, ey, side, 13, 20)
        inner_d = _ear_d(ex + side * 1, ey, side, 6, 10)
        parts.append(_g(pid,
            _path(outer_d, fill=_OUTLINE) +
            _path(_ear_d(ex, ey, side, 12, 19), fill=_SKIN_BASE) +
            _path(_ear_d(ex, ey, side, 11.5, 18.5), fill=f"url(#hs_skin_v)") +
            _path(inner_d, fill=_SKIN_SH, opacity=0.45)
        ))

    # -- Head base --
    head_d_str = head_clip_d
    # outline (enlarge 2px)
    head_out_d = _head_d(cx, head_cy, head_rx + 2, head_ry + 2)
    parts.append(_path(head_out_d, fill=_OUTLINE))
    parts.append(_path(head_d_str, fill=f"url(#hs_face)"))
    # chin shadow
    parts.append(_path(
        _smooth_path([(cx - head_rx * 0.5, head_cy + head_ry * 0.55),
                      (cx, head_cy + head_ry * 0.82),
                      (cx + head_rx * 0.5, head_cy + head_ry * 0.55)], close=False),
        stroke=_SKIN_SH, sw=14, stroke_linecap="round", opacity=0.3,
        clip_path="url(#hs_head_clip)"
    ))

    # -- Eyes --
    for side, pid in [(-1, "left_eye"), (1, "right_eye")]:
        ex = cx + side * eye_sep
        parts.append(_g(pid, _eye_svg(ex, eye_y)))

    # -- Eyebrows --
    for side in [-1, 1]:
        bx = cx + side * eye_sep
        by = eye_y - 17
        parts.append(f'<path d="M {bx-13:.1f},{by:.1f} Q {bx:.1f},{by-5:.1f} {bx+13:.1f},{by:.1f}" '
                     f'fill="none" stroke="{_HAIR}" stroke-width="3.5" stroke-linecap="round"/>')

    # -- Nose --
    parts.append(_g("nose", _nose_svg(cx, head_cy + head_ry * 0.22)))

    # -- Mouth --
    parts.append(_mouth_svg(cx, head_cy + head_ry * 0.58))

    # -- Neck --
    neck_d = (f"M {cx-13:.1f},{chin_y:.1f} L {cx-15:.1f},{neck_bot:.1f} "
              f"L {cx+15:.1f},{neck_bot:.1f} L {cx+13:.1f},{chin_y:.1f} Z")
    parts.append(_path(neck_d, fill=f"url(#hs_skin_v)", stroke=_OUTLINE, sw=1))
    parts.append(_path(f"M {cx+4:.1f},{chin_y:.1f} L {cx+15:.1f},{neck_bot:.1f} "
                       f"L {cx+15:.1f},{chin_y:.1f} Z", fill=_SKIN_SH, opacity=0.3))

    # -- Torso --
    torso_d = _torso_d(cx, sh_y, torso_bot, hip_bot, sh_hw, wa_hw, hip_hw)
    parts.append(_path(torso_d, fill=f"url(#hs_shirt)", stroke=_SHIRT_SH, sw=1.5))
    # right-side shirt shadow
    torso_sh = _torso_d(cx + wa_hw * 0.35, sh_y, torso_bot, hip_bot,
                         sh_hw * 0.3, wa_hw * 0.32, hip_hw * 0.32)
    parts.append(_path(torso_sh, fill=_SHIRT_SH, opacity=0.35))
    # collar V
    parts.append(f'<path d="M {cx-10:.1f},{sh_y:.1f} L {cx:.1f},{sh_y+20:.1f} L {cx+10:.1f},{sh_y:.1f}" '
                 f'fill="none" stroke="{_SHIRT_SH}" stroke-width="1.5" stroke-linecap="round"/>')

    # -- Arms --
    for side, hand_pid in [(-1, "left_hand"), (1, "right_hand")]:
        ax = cx + side * (sh_hw - ua_w)
        # upper arm (shirt)
        ua_d = _limb(ax, sh_y, ax + side * 4, elbow_y, ua_w, ua_w * 0.85, bend=side * 5)
        parts.append(_path(ua_d, fill=f"url(#hs_shirt)", stroke=_SHIRT_SH, sw=1))
        # elbow joint
        parts.append(_ellipse(ax + side * 4, elbow_y, ua_w * 0.9, ua_w * 0.85,
                               fill=_SHIRT_SH, opacity=0.25))
        # forearm (skin)
        wx = ax + side * 9
        fa_d = _limb(ax + side * 4, elbow_y, wx, wrist_y, fa_w, wr_w, bend=side * 4)
        parts.append(_path(fa_d, fill=f"url(#hs_skin_v)", stroke=_OUTLINE, sw=1))
        # forearm shadow stripe
        fa_sh = _limb(ax + side * 4 + side * fa_w * 0.3, elbow_y,
                      wx + side * wr_w * 0.3, wrist_y,
                      fa_w * 0.28, wr_w * 0.28)
        parts.append(_path(fa_sh, fill=_SKIN_SH, opacity=0.32))
        # hand
        parts.append(_g(hand_pid, _hand_svg(wx, wrist_y, side)))

    # -- Legs --
    for side in [-1, 1]:
        lx = cx + side * hip_hw * 0.50
        ul_w = HU * 0.205
        ll_w = HU * 0.155
        # upper leg
        ul_d = _limb(lx, hip_bot, lx + side * 2, knee_y, ul_w, ll_w * 1.05, bend=side * 3)
        parts.append(_path(ul_d, fill=f"url(#hs_pants)", stroke=_PANTS_SH, sw=1))
        # knee highlight
        parts.append(_ellipse(lx + side * 2, knee_y, ll_w * 0.9, ll_w * 0.7,
                               fill=_PANTS_MID, opacity=0.4))
        # lower leg
        ll_d = _limb(lx + side * 2, knee_y, lx + side * 1, ankle_y, ll_w, HU * 0.09, bend=side * 2)
        parts.append(_path(ll_d, fill=f"url(#hs_pants)", stroke=_PANTS_SH, sw=1))
        # foot
        fx = lx + side
        foot_w = HU * 0.09
        shoe_toe = fx + side * HU * 0.25
        shoe_d = (f"M {fx-foot_w:.1f},{ankle_y:.1f} "
                  f"C {fx-foot_w:.1f},{H-14:.1f} {shoe_toe:.1f},{H-12:.1f} {shoe_toe:.1f},{ankle_y+18:.1f} "
                  f"C {shoe_toe:.1f},{ankle_y+8:.1f} {fx+foot_w:.1f},{ankle_y+4:.1f} {fx+foot_w:.1f},{ankle_y:.1f} Z")
        parts.append(_path(shoe_d, fill="#2A2A3A", stroke="#111", sw=1))
        # shoe highlight
        parts.append(_ellipse(fx + side * HU * 0.08, ankle_y + 8,
                               HU * 0.08, HU * 0.04,
                               fill="#5A5A7A", opacity=0.5))

    # -- Hair foreground --
    parts.append(f'<path d="M {cx-head_rx*0.5:.1f},{head_cy-head_ry*0.92:.1f} '
                 f'Q {cx:.1f},{head_cy-head_ry*1.28:.1f} '
                 f'{cx+head_rx*0.5:.1f},{head_cy-head_ry*0.92:.1f}" '
                 f'fill="none" stroke="{_HAIR}" stroke-width="7" '
                 f'stroke-linecap="round" opacity="0.55"/>')

    body_svg = "\n".join(parts)

    # ── Anchors ────────────────────────────────────────────────────────────────
    def px(x): return round(x / W * 100, 1)
    def py(y): return round(y / H * 100, 1)

    left_wrist_x  = cx - (sh_hw - ua_w) - 9
    right_wrist_x = cx + (sh_hw - ua_w) + 9

    anchors = [
        LabelAnchor(part_id="left_eye",   x=px(cx - eye_sep - 20), y=py(eye_y)),
        LabelAnchor(part_id="right_eye",  x=px(cx + eye_sep + 20), y=py(eye_y)),
        LabelAnchor(part_id="left_ear",   x=px(cx - head_rx - 22), y=py(head_cy + 5)),
        LabelAnchor(part_id="right_ear",  x=px(cx + head_rx + 22), y=py(head_cy + 5)),
        LabelAnchor(part_id="nose",       x=px(cx + 22),            y=py(head_cy + head_ry * 0.3)),
        LabelAnchor(part_id="mouth",      x=px(cx + 22),            y=py(head_cy + head_ry * 0.65)),
        LabelAnchor(part_id="tongue",     x=px(cx - 22),            y=py(head_cy + head_ry * 0.72)),
        LabelAnchor(part_id="left_hand",  x=px(left_wrist_x - 24), y=py(wrist_y + 12)),
        LabelAnchor(part_id="right_hand", x=px(right_wrist_x + 24),y=py(wrist_y + 12)),
        LabelAnchor(part_id="brain_hint", x=px(cx + 28),            y=py(head_cy - head_ry * 0.6)),
    ]

    rendered_parts = [
        "left_eye", "right_eye", "left_ear", "right_ear",
        "nose", "mouth", "tongue", "left_hand", "right_hand",
    ]

    return RenderSpec(
        object_key="human_body.senses",
        viewbox=f"0 0 {W} {H}",
        shapes=[],
        anchors=anchors,
        rendered_parts=rendered_parts,
        defs_svg=defs.strip(),
        body_svg=body_svg,
    )


# ── Sub-builders ──────────────────────────────────────────────────────────────

def _head_d(cx, cy, rx, ry) -> str:
    """Head with jaw taper — narrower at chin than at cheekbones."""
    jrx = rx * 0.76
    return (
        f"M {cx:.2f},{cy-ry:.2f} "
        f"C {cx+rx*1.05:.2f},{cy-ry:.2f} {cx+rx:.2f},{cy-ry*0.3:.2f} {cx+rx:.2f},{cy:.2f} "
        f"C {cx+rx:.2f},{cy+ry*0.4:.2f} {cx+jrx:.2f},{cy+ry*0.7:.2f} {cx+jrx*0.45:.2f},{cy+ry*0.88:.2f} "
        f"C {cx+jrx*0.18:.2f},{cy+ry:.2f} {cx-jrx*0.18:.2f},{cy+ry:.2f} {cx-jrx*0.45:.2f},{cy+ry*0.88:.2f} "
        f"C {cx-jrx:.2f},{cy+ry*0.7:.2f} {cx-rx:.2f},{cy+ry*0.4:.2f} {cx-rx:.2f},{cy:.2f} "
        f"C {cx-rx:.2f},{cy-ry*0.3:.2f} {cx-rx*1.05:.2f},{cy-ry:.2f} {cx:.2f},{cy-ry:.2f} Z"
    )


def _ear_d(ex, ey, side: int, erx, ery) -> str:
    """Ear: outer C-curve (flat on medial side)."""
    return (
        f"M {ex:.2f},{ey-ery:.2f} "
        f"C {ex+side*erx*1.1:.2f},{ey-ery:.2f} {ex+side*erx*1.1:.2f},{ey+ery:.2f} {ex:.2f},{ey+ery:.2f} "
        f"C {ex+side*erx*0.12:.2f},{ey+ery*0.55:.2f} {ex+side*erx*0.12:.2f},{ey-ery*0.55:.2f} {ex:.2f},{ey-ery:.2f} Z"
    )


def _eye_svg(cx, cy) -> str:
    """Detailed eye: socket shadow, white, iris+pupil, catchlights, lids."""
    parts = []
    # socket shadow
    parts.append(_ellipse(cx, cy + 1, 17, 12, fill=_SKIN_SH, opacity=0.22))
    # eye white
    parts.append(_path(_ep(cx, cy, 14, 10), fill=_EYE_WHITE, stroke=_OUTLINE, sw=1.2))
    # iris
    parts.append(_path(_ep(cx, cy, 8, 9), fill=_EYE_IRIS))
    # limbal ring (dark top)
    parts.append(_path(_ep(cx, cy - 1.5, 8, 5), fill=_EYE_PUPIL, opacity=0.3))
    # pupil
    parts.append(_path(_ep(cx, cy, 4, 5), fill=_EYE_PUPIL))
    # catchlight main
    parts.append(_ellipse(cx - 3, cy - 3, 2.5, 2.5, fill="white", opacity=0.92))
    # catchlight small
    parts.append(_ellipse(cx + 4, cy + 2, 1.3, 1.3, fill="white", opacity=0.5))
    # upper eyelid
    parts.append(f'<path d="M {cx-14:.1f},{cy-2:.1f} Q {cx:.1f},{cy-13:.1f} {cx+14:.1f},{cy-2:.1f}" '
                 f'fill="none" stroke="{_OUTLINE}" stroke-width="2" stroke-linecap="round"/>')
    # lower lash line
    parts.append(f'<path d="M {cx-13:.1f},{cy+6:.1f} Q {cx:.1f},{cy+11:.1f} {cx+13:.1f},{cy+6:.1f}" '
                 f'fill="none" stroke="{_SKIN_SH}" stroke-width="1" stroke-linecap="round" opacity="0.5"/>')
    return "".join(parts)


def _nose_svg(cx, ny) -> str:
    """Nose: bridge shadow, tip bulb, nostrils, highlight."""
    parts = []
    # bridge shadow line
    parts.append(f'<path d="M {cx-2:.1f},{ny-16:.1f} C {cx-5:.1f},{ny:.1f} {cx-7:.1f},{ny+8:.1f} {cx-8:.1f},{ny+13:.1f}" '
                 f'fill="none" stroke="{_SKIN_SH}" stroke-width="2.5" stroke-linecap="round" opacity="0.4"/>')
    # nose tip
    parts.append(_path(_ep(cx, ny + 11, 9, 7), fill=_SKIN_BASE,
                       stroke=_SKIN_SH, sw=0.8, opacity=0.7))
    # nostrils
    parts.append(_ellipse(cx - 7, ny + 15, 4.5, 3.5, fill=_SKIN_SH, opacity=0.55))
    parts.append(_ellipse(cx + 7, ny + 15, 4.5, 3.5, fill=_SKIN_SH, opacity=0.55))
    # highlight
    parts.append(_ellipse(cx + 3, ny + 8, 3, 2.5, fill=_SKIN_HI, opacity=0.5))
    return "".join(parts)


def _mouth_svg(cx, my) -> str:
    """Mouth: teeth, tongue, upper/lower lips with highlights."""
    parts = []
    # mouth opening / teeth
    teeth_d = (_ep(cx, my + 8, 14, 9))
    parts.append(_path(teeth_d, fill=_TEETH))
    # tongue
    parts.append(_g("tongue", _ellipse(cx, my + 13, 9, 6, fill=_TONGUE, opacity=0.9)))
    # upper lip (M-shape)
    ul_d = (f"M {cx-17:.1f},{my:.1f} "
            f"C {cx-8:.1f},{my-7:.1f} {cx-3:.1f},{my-4:.1f} {cx:.1f},{my-2:.1f} "
            f"C {cx+3:.1f},{my-4:.1f} {cx+8:.1f},{my-7:.1f} {cx+17:.1f},{my:.1f} "
            f"Q {cx:.1f},{my+6:.1f} {cx-17:.1f},{my:.1f} Z")
    parts.append(_g("mouth",
        _path(ul_d, fill=_MOUTH_COL, stroke=_OUTLINE, sw=0.8)))
    # lower lip
    ll_d = (f"M {cx-17:.1f},{my:.1f} Q {cx:.1f},{my+22:.1f} {cx+17:.1f},{my:.1f} "
            f"Q {cx:.1f},{my+13:.1f} {cx-17:.1f},{my:.1f} Z")
    parts.append(_path(ll_d, fill=_MOUTH_COL, stroke=_OUTLINE, sw=0.8, opacity=0.85))
    # lower lip highlight
    parts.append(_ellipse(cx, my + 16, 7, 3, fill=_SKIN_HI, opacity=0.38))
    # corner shadows
    for sx in [cx - 17, cx + 17]:
        parts.append(_ellipse(sx, my, 3, 3, fill=_SKIN_SH, opacity=0.35))
    return "".join(parts)


def _hand_svg(wx, wy, side) -> str:
    """Hand: 4 fingers + thumb + palm with gradient."""
    parts = []
    # 4 fingers
    for fi in range(4):
        fx = wx + (fi - 1.5) * 7
        fy = wy + 2
        # outline
        parts.append(_path(_ep(fx, fy, 5, 11), fill=_OUTLINE))
        # finger skin
        parts.append(_path(_ep(fx, fy, 4.2, 10), fill=f"url(#hs_skin_v)"))
        # knuckle highlight
        parts.append(_ellipse(fx - 1, fy - 5, 2, 1.5, fill=_SKIN_HI, opacity=0.45))
    # thumb
    tx = wx - side * 17
    parts.append(_path(_ep(tx, wy + 6, 5, 10), fill=_OUTLINE))
    parts.append(_path(_ep(tx, wy + 6, 4.2, 9), fill=f"url(#hs_skin_v)"))
    # palm outline + fill
    parts.append(_path(_ep(wx, wy + 17, 16, 19), fill=_OUTLINE))
    parts.append(_path(_ep(wx, wy + 17, 14.5, 17.5), fill=f"url(#hs_skin_v)"))
    # palm shadow
    parts.append(_ellipse(wx + side * 4, wy + 20, 7, 10, fill=_SKIN_SH, opacity=0.28))
    # palm highlight
    parts.append(_ellipse(wx - side * 3, wy + 12, 5, 4, fill=_SKIN_HI, opacity=0.35))
    return "".join(parts)


def _torso_d(cx, sh_y, tb, hb, sh_hw, wa_hw, hip_hw) -> str:
    """Torso outline with S-curve sides."""
    mid_y = (sh_y + tb) * 0.5
    return (
        f"M {cx-sh_hw:.2f},{sh_y:.2f} "
        f"C {cx-sh_hw:.2f},{mid_y:.2f} {cx-wa_hw:.2f},{mid_y:.2f} {cx-wa_hw:.2f},{tb:.2f} "
        f"C {cx-wa_hw:.2f},{(tb+hb)/2:.2f} {cx-hip_hw:.2f},{(tb+hb)/2:.2f} {cx-hip_hw:.2f},{hb:.2f} "
        f"L {cx+hip_hw:.2f},{hb:.2f} "
        f"C {cx+hip_hw:.2f},{(tb+hb)/2:.2f} {cx+wa_hw:.2f},{(tb+hb)/2:.2f} {cx+wa_hw:.2f},{tb:.2f} "
        f"C {cx+wa_hw:.2f},{mid_y:.2f} {cx+sh_hw:.2f},{mid_y:.2f} {cx+sh_hw:.2f},{sh_y:.2f} Z"
    )
