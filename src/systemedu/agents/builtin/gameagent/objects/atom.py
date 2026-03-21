"""atom.bohr - Bohr model atom diagram.

High-fidelity rendering:
- Dark background glow effect for space feel
- Radial gradient nucleus (red-orange plasma look)
- Tilted elliptical orbits for 3D perspective
- Electron glow halos with radial gradient
- Subtle orbit glow / trail effect
- Output via RenderSpec.defs_svg + body_svg (raw SVG)
"""

from __future__ import annotations

import math

from systemedu.agents.builtin.gameagent.object_spec import (
    LabelAnchor,
    RenderSpec,
)

META = {
    "object_key": "atom.bohr",
    "description": (
        "玻尔原子模型图，包含原子核（质子+中子）和电子轨道。"
        "适合讲解原子结构和电子层概念。"
        "不包含具体元素分子结构、化学键、离子键等，也不涉及量子力学轨道模型。"
    ),
    "views": ["front"],
    "must_have": ["nucleus", "electron_shell_1", "electron_1"],
    "optional": ["electron_shell_2", "electron_shell_3", "electron_2", "electron_3", "proton", "neutron"],
    "labelable": ["nucleus", "electron_shell_1", "electron_shell_2", "electron_1", "proton", "neutron"],
    "parts": {
        "nucleus": {
            "label_zh": "原子核",
            "label_en": "Nucleus",
            "desc_brief": "由质子和中子组成，带正电，质量占原子总质量 99.9% 以上",
            "hint": "原子核有多小？",
        },
        "proton": {
            "label_zh": "质子",
            "label_en": "Proton",
            "desc_brief": "带正电荷，质子数决定元素种类",
            "hint": "质子数等于什么？",
        },
        "neutron": {
            "label_zh": "中子",
            "label_en": "Neutron",
            "desc_brief": "不带电荷，与质子共同构成原子核",
            "hint": "同一元素的中子数可以不同吗？",
        },
        "electron_shell_1": {
            "label_zh": "第一电子层",
            "label_en": "1st Electron Shell",
            "desc_brief": "离原子核最近的电子轨道，最多容纳 2 个电子",
            "hint": "为什么电子不掉进原子核？",
        },
        "electron_shell_2": {
            "label_zh": "第二电子层",
            "label_en": "2nd Electron Shell",
            "desc_brief": "第二层轨道，最多容纳 8 个电子",
            "hint": "",
        },
        "electron_shell_3": {
            "label_zh": "第三电子层",
            "label_en": "3rd Electron Shell",
            "desc_brief": "第三层轨道，最多容纳 18 个电子",
            "hint": "",
        },
        "electron_1": {
            "label_zh": "电子",
            "label_en": "Electron",
            "desc_brief": "带负电荷，围绕原子核高速运动，质量极小",
            "hint": "电子有多快？",
        },
        "electron_2": {
            "label_zh": "电子",
            "label_en": "Electron",
            "desc_brief": "带负电荷，围绕原子核高速运动",
            "hint": "",
        },
        "electron_3": {
            "label_zh": "电子",
            "label_en": "Electron",
            "desc_brief": "带负电荷，围绕原子核高速运动",
            "hint": "",
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
    """Build a high-fidelity Bohr atom. ViewBox: 0 0 560 420"""
    W, H = 560, 420
    cx, cy = W / 2, H / 2  # 280, 210

    shells = [72.0, 128.0, 178.0]
    tilt_factors = [0.36, 0.40, 0.44]    # ry = rx * factor for 3D tilt
    nucleus_r = 26.0
    e_r = 7.0

    defs = f"""
<radialGradient id="at_nucleus" cx="35%" cy="30%" r="65%">
  <stop offset="0%" stop-color="#FFEE58"/>
  <stop offset="35%" stop-color="#FF7043"/>
  <stop offset="100%" stop-color="#B71C1C"/>
</radialGradient>
<radialGradient id="at_electron" cx="35%" cy="30%" r="65%">
  <stop offset="0%" stop-color="#B3E5FC"/>
  <stop offset="50%" stop-color="#29B6F6"/>
  <stop offset="100%" stop-color="#0277BD"/>
</radialGradient>
<radialGradient id="at_proton" cx="35%" cy="30%" r="65%">
  <stop offset="0%" stop-color="#FFCDD2"/>
  <stop offset="60%" stop-color="#EF5350"/>
  <stop offset="100%" stop-color="#B71C1C"/>
</radialGradient>
<radialGradient id="at_neutron" cx="35%" cy="30%" r="65%">
  <stop offset="0%" stop-color="#E0E0E0"/>
  <stop offset="60%" stop-color="#90A4AE"/>
  <stop offset="100%" stop-color="#37474F"/>
</radialGradient>
<filter id="at_glow" x="-50%" y="-50%" width="200%" height="200%">
  <feGaussianBlur stdDeviation="6" result="blur"/>
  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter id="at_softglow" x="-30%" y="-30%" width="160%" height="160%">
  <feGaussianBlur stdDeviation="3" result="blur"/>
  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
"""

    parts = []

    # ── Background space feel ──────────────────────────────────────────────
    # subtle background circle for context
    parts.append(_e(cx, cy, W * 0.46, H * 0.46, fill="#0D1B2A", opacity=0.15))

    # ── Orbits (tilted ellipses) ────────────────────────────────────────────
    shell_colors = ["#64B5F6", "#4FC3F7", "#81D4FA"]
    for i, (r, tf, col) in enumerate(zip(shells, tilt_factors, shell_colors)):
        pid = f"electron_shell_{i+1}"
        ry = r * tf
        # outer glow
        parts.append(_g(pid,
            _e(cx, cy, r + 3, ry + 3, fill="none", stroke=col, sw=6, opacity=0.1) +
            _e(cx, cy, r, ry, fill="none", stroke=col, sw=1.5, opacity=0.65)
        ))

    # ── Nucleus glow aura ────────────────────────────────────────────────────
    parts.append(_e(cx, cy, nucleus_r + 22, nucleus_r + 22,
                    fill="#FF7043", opacity=0.12, filter="url(#at_glow)"))
    parts.append(_e(cx, cy, nucleus_r + 12, nucleus_r + 12,
                    fill="#FF7043", opacity=0.2))

    # ── Nucleus ──────────────────────────────────────────────────────────────
    parts.append(_g("nucleus",
        _e(cx, cy, nucleus_r, nucleus_r, fill="url(#at_nucleus)",
           stroke="#E65100", sw=1.5)
    ))

    # proton / neutron clusters inside nucleus
    pn_positions = [
        (cx - 8, cy - 7, "proton", "at_proton"),
        (cx + 7, cy + 6, "proton", "at_proton"),
        (cx - 5, cy + 8, "neutron", "at_neutron"),
        (cx + 6, cy - 7, "neutron", "at_neutron"),
    ]
    for i, (px, py, pid, grad) in enumerate(pn_positions):
        actual_pid = pid if i in (0, 2) else None
        parts.append(_g(actual_pid or "nucleus",
            _e(px, py, 7.5, 7.5, fill=f"url(#{grad})", stroke="#00000033", sw=0.5)
        ) if actual_pid else
            _e(px, py, 7.5, 7.5, fill=f"url(#{grad})", stroke="#00000033", sw=0.5)
        )

    # ── Electrons ────────────────────────────────────────────────────────────
    electron_positions = [
        (0,   0),   # shell 1
        (180, 0),
        (45,  1),   # shell 2
        (135, 1),
        (225, 1),
        (315, 1),
        (60,  2),   # shell 3
        (180, 2),
        (300, 2),
    ]
    labeled = ["electron_1", "electron_2", "electron_3"]
    for i, (angle_deg, sh_idx) in enumerate(electron_positions):
        a = math.radians(angle_deg)
        r = shells[sh_idx]
        ry = r * tilt_factors[sh_idx]
        ex = cx + r * math.cos(a)
        ey = cy + ry * math.sin(a)
        pid = labeled[i] if i < 3 else None
        # glow halo
        parts.append(_e(ex, ey, e_r + 8, e_r + 8, fill="#29B6F6", opacity=0.18))
        # electron
        e_content = _e(ex, ey, e_r, e_r, fill="url(#at_electron)",
                       stroke="#0277BD", sw=1.0)
        # catchlight
        e_content += _e(ex - 2.5, ey - 2.5, 2, 2, fill="white", opacity=0.7)
        if pid:
            parts.append(_g(pid, e_content))
        else:
            parts.append(e_content)

    body_svg = "\n".join(str(p) for p in parts)

    # ── Anchors (% of 560x420) ────────────────────────────────────────────────
    def px(x): return round(x / W * 100, 1)
    def py(y): return round(y / H * 100, 1)

    # compute representative electron positions for anchors
    s0x = cx + shells[0] * math.cos(0)
    s0y = cy + shells[0] * tilt_factors[0] * math.sin(0)
    s1x = cx + shells[1] * math.cos(math.radians(45))
    s1y = cy + shells[1] * tilt_factors[1] * math.sin(math.radians(45))
    s2x = cx + shells[2] * math.cos(math.radians(60))
    s2y = cy + shells[2] * tilt_factors[2] * math.sin(math.radians(60))

    anchors = [
        LabelAnchor(part_id="nucleus",          x=px(cx + nucleus_r + 12), y=py(cy - 10)),
        LabelAnchor(part_id="proton",           x=px(cx - 8 + 12),          y=py(cy - 7 - 12)),
        LabelAnchor(part_id="neutron",          x=px(cx - 5 - 14),          y=py(cy + 8 + 10)),
        LabelAnchor(part_id="electron_shell_1", x=px(cx + shells[0] + 12),  y=py(cy - shells[0] * tilt_factors[0] - 10)),
        LabelAnchor(part_id="electron_shell_2", x=px(cx + shells[1] + 14),  y=py(cy - shells[1] * tilt_factors[1] - 10)),
        LabelAnchor(part_id="electron_shell_3", x=px(cx + shells[2] + 16),  y=py(cy - shells[2] * tilt_factors[2] - 10)),
        LabelAnchor(part_id="electron_1",       x=px(s0x + 12),             y=py(s0y - 12)),
        LabelAnchor(part_id="electron_2",       x=px(s1x + 12),             y=py(s1y - 12)),
        LabelAnchor(part_id="electron_3",       x=px(s2x + 12),             y=py(s2y - 12)),
    ]

    rendered_parts = [
        "nucleus", "proton", "neutron",
        "electron_shell_1", "electron_shell_2", "electron_shell_3",
        "electron_1", "electron_2", "electron_3",
    ]

    return RenderSpec(
        object_key="atom.bohr",
        viewbox=f"0 0 {W} {H}",
        shapes=[],
        anchors=anchors,
        rendered_parts=rendered_parts,
        defs_svg=defs.strip(),
        body_svg=body_svg,
    )
