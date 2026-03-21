"""rocket.basic - side-view educational 2D rocket.

High-fidelity rendering:
- Smooth bezier nose cone (ogive profile)
- Metallic body with radial highlight gradient
- Swept delta fins with perspective shading
- Multi-bell nozzle with rim glow
- Layered flame with opacity gradient
- Output via RenderSpec.defs_svg + body_svg (raw SVG)
"""

from __future__ import annotations

from systemedu.agents.builtin.gameagent.object_spec import (
    LabelAnchor,
    RenderSpec,
)

META = {
    "object_key": "rocket.basic",
    "description": (
        "火箭整体侧视外观图，包含鼻锥、箭体、尾翼、发动机喷嘴。"
        "适合讲解火箭整体结构和各部件名称。"
        "不包含发动机内部燃烧室、燃料箱内部、制导系统、级间分离机构等内部细节。"
    ),
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


def _p(d, fill="none", stroke="none", sw=1, **kw) -> str:
    attrs = f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"'
    for k, v in kw.items():
        attrs += f' {k.replace("_", "-")}="{v}"'
    return f'<path d="{d}" {attrs}/>'


def _g(part_id, content) -> str:
    return f'<g data-part="{part_id}">{content}</g>'


def build(view: str = "side", variant: str | None = None) -> RenderSpec:
    """Build a high-fidelity side-view rocket. ViewBox: 0 0 420 580"""
    W, H = 420, 580
    cx = W / 2  # 210

    # proportions
    bw = 60.0           # body half-width * 2
    bx = cx - bw / 2   # 180
    body_top = 100.0
    body_bot = 370.0
    body_h = body_bot - body_top
    nose_tip_y = 18.0
    interstage_y = body_top + body_h * 0.62  # ~275
    fin_start_y = body_top + body_h * 0.68   # ~290
    nozzle_top = body_bot
    nozzle_bot = body_bot + 38.0
    flame_top = nozzle_bot
    flame_bot = flame_top + 80.0

    # defs
    defs = f"""
<linearGradient id="rk_body" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0%" stop-color="#8EAFC0"/>
  <stop offset="18%" stop-color="#D6E8F0"/>
  <stop offset="35%" stop-color="#F0F8FF"/>
  <stop offset="60%" stop-color="#C8DCE8"/>
  <stop offset="100%" stop-color="#7090A8"/>
</linearGradient>
<linearGradient id="rk_nose" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0%" stop-color="#7090A0"/>
  <stop offset="30%" stop-color="#E0EEF4"/>
  <stop offset="100%" stop-color="#506878"/>
</linearGradient>
<linearGradient id="rk_fin_l" x1="1" y1="0" x2="0" y2="0">
  <stop offset="0%" stop-color="#506880"/>
  <stop offset="100%" stop-color="#283848"/>
</linearGradient>
<linearGradient id="rk_fin_r" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0%" stop-color="#506880"/>
  <stop offset="100%" stop-color="#283848"/>
</linearGradient>
<linearGradient id="rk_nozzle" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0%" stop-color="#1A2830"/>
  <stop offset="40%" stop-color="#486070"/>
  <stop offset="100%" stop-color="#1A2830"/>
</linearGradient>
<radialGradient id="rk_flame_outer" cx="50%" cy="0%" r="70%">
  <stop offset="0%" stop-color="#FFEE58"/>
  <stop offset="40%" stop-color="#FF6F00"/>
  <stop offset="100%" stop-color="#FF3300" stop-opacity="0"/>
</radialGradient>
<radialGradient id="rk_flame_core" cx="50%" cy="5%" r="60%">
  <stop offset="0%" stop-color="#FFFFFF"/>
  <stop offset="30%" stop-color="#FFFDE7"/>
  <stop offset="100%" stop-color="#FF8F00" stop-opacity="0"/>
</radialGradient>
<filter id="rk_glow">
  <feGaussianBlur stdDeviation="4" result="blur"/>
  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
"""

    parts = []

    # ── Flame ────────────────────────────────────────────────────────────────
    # outer flame lobe
    fd = (f"M {cx-22:.1f},{flame_top:.1f} "
          f"C {cx-28:.1f},{flame_top+30:.1f} {cx-10:.1f},{flame_bot-5:.1f} {cx:.1f},{flame_bot:.1f} "
          f"C {cx+10:.1f},{flame_bot-5:.1f} {cx+28:.1f},{flame_top+30:.1f} {cx+22:.1f},{flame_top:.1f} Z")
    parts.append(_g("flame",
        _p(fd, fill="url(#rk_flame_outer)", stroke="none") +
        # inner bright core
        _p(f"M {cx-12:.1f},{flame_top:.1f} "
           f"C {cx-14:.1f},{flame_top+20:.1f} {cx-5:.1f},{flame_top+55:.1f} {cx:.1f},{flame_top+70:.1f} "
           f"C {cx+5:.1f},{flame_top+55:.1f} {cx+14:.1f},{flame_top+20:.1f} {cx+12:.1f},{flame_top:.1f} Z",
           fill="url(#rk_flame_core)", stroke="none")
    ))

    # ── Left fin ─────────────────────────────────────────────────────────────
    lf_d = (f"M {bx:.1f},{fin_start_y:.1f} "
            f"L {bx:.1f},{body_bot:.1f} "
            f"L {bx-52:.1f},{body_bot+8:.1f} "
            f"C {bx-58:.1f},{body_bot-20:.1f} {bx-20:.1f},{fin_start_y+30:.1f} {bx:.1f},{fin_start_y:.1f} Z")
    parts.append(_g("left_fin",
        _p(lf_d, fill="url(#rk_fin_l)", stroke="#283848", sw=1.2) +
        # rim highlight
        _p(f"M {bx:.1f},{fin_start_y:.1f} C {bx-4:.1f},{fin_start_y+40:.1f} {bx-8:.1f},{body_bot-20:.1f} {bx:.1f},{body_bot:.1f}",
           stroke="#7090A8", sw=1.5, stroke_linecap="round")
    ))

    # ── Right fin ────────────────────────────────────────────────────────────
    rx2 = bx + bw
    rf_d = (f"M {rx2:.1f},{fin_start_y:.1f} "
            f"L {rx2:.1f},{body_bot:.1f} "
            f"L {rx2+52:.1f},{body_bot+8:.1f} "
            f"C {rx2+58:.1f},{body_bot-20:.1f} {rx2+20:.1f},{fin_start_y+30:.1f} {rx2:.1f},{fin_start_y:.1f} Z")
    parts.append(_g("right_fin",
        _p(rf_d, fill="url(#rk_fin_r)", stroke="#283848", sw=1.2) +
        _p(f"M {rx2:.1f},{fin_start_y:.1f} C {rx2+4:.1f},{fin_start_y+40:.1f} {rx2+8:.1f},{body_bot-20:.1f} {rx2:.1f},{body_bot:.1f}",
           stroke="#7090A8", sw=1.5, stroke_linecap="round")
    ))

    # ── Nozzle ───────────────────────────────────────────────────────────────
    noz_tw, noz_bw = 44.0, 54.0
    noz_d = (f"M {cx-noz_tw/2:.1f},{nozzle_top:.1f} "
             f"C {cx-noz_tw/2:.1f},{nozzle_top+18:.1f} {cx-noz_bw/2:.1f},{nozzle_bot-8:.1f} {cx-noz_bw/2:.1f},{nozzle_bot:.1f} "
             f"L {cx+noz_bw/2:.1f},{nozzle_bot:.1f} "
             f"C {cx+noz_bw/2:.1f},{nozzle_bot-8:.1f} {cx+noz_tw/2:.1f},{nozzle_top+18:.1f} {cx+noz_tw/2:.1f},{nozzle_top:.1f} Z")
    parts.append(_g("engine_nozzle",
        _p(noz_d, fill="url(#rk_nozzle)", stroke="#0A1820", sw=1.5) +
        # inner rim glow
        _p(f"M {cx-noz_bw/2+4:.1f},{nozzle_bot:.1f} L {cx+noz_bw/2-4:.1f},{nozzle_bot:.1f}",
           stroke="#FF8F00", sw=3, stroke_linecap="round", opacity="0.7", filter="url(#rk_glow)")
    ))

    # ── Body ─────────────────────────────────────────────────────────────────
    body_d = (f"M {bx:.1f},{body_top:.1f} L {bx+bw:.1f},{body_top:.1f} "
              f"L {bx+bw:.1f},{body_bot:.1f} L {bx:.1f},{body_bot:.1f} Z")
    parts.append(_g("body",
        _p(body_d, fill="url(#rk_body)", stroke="#5A7888", sw=1.5) +
        # panel line 1
        _p(f"M {bx:.1f},{body_top+90:.1f} L {bx+bw:.1f},{body_top+90:.1f}",
           stroke="#90B0C0", sw=0.8, opacity="0.5") +
        # panel line 2
        _p(f"M {bx:.1f},{body_top+160:.1f} L {bx+bw:.1f},{body_top+160:.1f}",
           stroke="#90B0C0", sw=0.8, opacity="0.5")
    ))

    # ── Interstage band ───────────────────────────────────────────────────────
    parts.append(_g("interstage",
        f'<rect x="{bx:.1f}" y="{interstage_y:.1f}" width="{bw:.1f}" height="10" '
        f'fill="#2C4A60" stroke="#1A2E3C" stroke-width="1"/>' +
        f'<rect x="{bx:.1f}" y="{interstage_y:.1f}" width="{bw:.1f}" height="3" '
        f'fill="#4A6C80" opacity="0.6"/>'
    ))

    # ── Grid fins ─────────────────────────────────────────────────────────────
    gf_w, gf_h = 16.0, 20.0
    gf_y = interstage_y - gf_h - 2
    for pid, gx in [("grid_fin_left", bx - gf_w), ("grid_fin_right", bx + bw)]:
        cells = ""
        for col in range(3):
            for row in range(3):
                cells += (f'<rect x="{gx + col*(gf_w/3):.1f}" y="{gf_y + row*(gf_h/3):.1f}" '
                          f'width="{gf_w/3:.1f}" height="{gf_h/3:.1f}" '
                          f'fill="#3A5868" stroke="#283848" stroke-width="0.6"/>')
        parts.append(_g(pid, cells))

    # ── Window ───────────────────────────────────────────────────────────────
    win_cy = body_top + 54
    parts.append(_g("window",
        f'<ellipse cx="{cx}" cy="{win_cy}" rx="14" ry="14" '
        f'fill="#1A3A50" stroke="#4A90B8" stroke-width="2.5"/>' +
        f'<ellipse cx="{cx}" cy="{win_cy}" rx="12" ry="12" fill="#2A6090" opacity="0.85"/>' +
        # window glare
        f'<ellipse cx="{cx-4}" cy="{win_cy-5}" rx="5" ry="4" fill="white" opacity="0.45"/>' +
        f'<ellipse cx="{cx+4}" cy="{win_cy+4}" rx="2" ry="1.5" fill="white" opacity="0.2"/>'
    ))

    # ── Nose cone (ogive bezier) ──────────────────────────────────────────────
    nc_d = (f"M {bx:.1f},{body_top:.1f} "
            f"C {bx:.1f},{body_top-20:.1f} {cx-8:.1f},{nose_tip_y+30:.1f} {cx:.1f},{nose_tip_y:.1f} "
            f"C {cx+8:.1f},{nose_tip_y+30:.1f} {bx+bw:.1f},{body_top-20:.1f} {bx+bw:.1f},{body_top:.1f} Z")
    parts.append(_g("nose_cone",
        _p(nc_d, fill="url(#rk_nose)", stroke="#405868", sw=1.5) +
        # highlight band
        _p(f"M {bx+8:.1f},{body_top:.1f} "
           f"C {bx+8:.1f},{body_top-14:.1f} {cx-4:.1f},{nose_tip_y+22:.1f} {cx-2:.1f},{nose_tip_y+8:.1f}",
           stroke="white", sw=2.5, stroke_linecap="round", opacity="0.3")
    ))

    body_svg = "\n".join(parts)

    # ── Anchors (% of 420x580) ────────────────────────────────────────────────
    def px(x): return round(x / W * 100, 1)
    def py(y): return round(y / H * 100, 1)

    anchors = [
        LabelAnchor(part_id="nose_cone",      x=px(cx + 28), y=py(nose_tip_y + 28)),
        LabelAnchor(part_id="body",           x=px(bx + bw + 20), y=py(body_top + 90)),
        LabelAnchor(part_id="window",         x=px(bx + bw + 20), y=py(win_cy)),
        LabelAnchor(part_id="interstage",     x=px(bx + bw + 20), y=py(interstage_y + 5)),
        LabelAnchor(part_id="left_fin",       x=px(bx - 36), y=py(fin_start_y + 60)),
        LabelAnchor(part_id="right_fin",      x=px(rx2 + 36), y=py(fin_start_y + 60)),
        LabelAnchor(part_id="grid_fin_left",  x=px(bx - gf_w - 16), y=py(gf_y + 10)),
        LabelAnchor(part_id="grid_fin_right", x=px(bx + bw + gf_w + 16), y=py(gf_y + 10)),
        LabelAnchor(part_id="engine_nozzle",  x=px(cx + 36), y=py(nozzle_bot - 10)),
        LabelAnchor(part_id="flame",          x=px(cx + 24), y=py(flame_top + 50)),
    ]

    rendered_parts = [
        "nose_cone", "body", "window", "interstage",
        "left_fin", "right_fin", "grid_fin_left", "grid_fin_right",
        "engine_nozzle", "flame",
    ]

    return RenderSpec(
        object_key="rocket.basic",
        viewbox=f"0 0 {W} {H}",
        shapes=[],
        anchors=anchors,
        rendered_parts=rendered_parts,
        defs_svg=defs.strip(),
        body_svg=body_svg,
    )
