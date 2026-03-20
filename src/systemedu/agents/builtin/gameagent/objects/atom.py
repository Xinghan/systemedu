"""atom.bohr - Bohr model atom diagram (side/front view)."""

from __future__ import annotations

import math

from systemedu.agents.builtin.gameagent.object_spec import (
    EllipseShape,
    LabelAnchor,
    PathShape,
    RenderSpec,
)

META = {
    "object_key": "atom.bohr",
    "description": "玻尔原子模型图，包含原子核（质子+中子）和电子轨道。适合讲解原子结构和电子层概念。不包含具体元素分子结构、化学键、离子键等，也不涉及量子力学轨道模型。",
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


def build(view: str = "front", variant: str | None = None) -> RenderSpec:
    """Build a Bohr model atom RenderSpec. Viewbox: 0 0 560 420."""
    cx, cy = 280.0, 210.0
    shells = [80.0, 140.0, 195.0]   # radii for 3 shells
    nucleus_r = 28.0

    shapes: list = []

    # shells (elliptical orbits, slightly tilted for 3D feel)
    tilt_ry_factors = [0.38, 0.42, 0.45]
    for i, (r, ry_f) in enumerate(zip(shells, tilt_ry_factors)):
        part = f"electron_shell_{i+1}"
        shapes.append(EllipseShape(
            id=f"shell_{i+1}_ellipse", part_id=part,
            cx=cx, cy=cy, rx=r, ry=r * ry_f,
            fill="none", stroke="#90CAF9", stroke_width=1.5, opacity=0.7,
        ))

    # nucleus glow
    shapes.append(EllipseShape(
        id="nucleus_glow", part_id=None,
        cx=cx, cy=cy, rx=nucleus_r + 12, ry=nucleus_r + 12,
        fill="#FF8F00", opacity=0.2,
    ))

    # nucleus
    shapes.append(EllipseShape(
        id="nucleus_circle", part_id="nucleus",
        cx=cx, cy=cy, rx=nucleus_r, ry=nucleus_r,
        fill="#FF6F00", stroke="#E65100", stroke_width=2.0,
    ))

    # proton / neutron inside nucleus (small dots)
    for i, (px, py, pcolor, pid) in enumerate([
        (cx - 8, cy - 6, "#EF5350", "proton"),
        (cx + 7, cy + 5, "#EF5350", None),
        (cx - 5, cy + 8, "#78909C", "neutron"),
        (cx + 6, cy - 7, "#78909C", None),
    ]):
        shapes.append(EllipseShape(
            id=f"nucleus_particle_{i}", part_id=pid,
            cx=px, cy=py, rx=7, ry=7,
            fill=pcolor, stroke=None, opacity=0.9,
        ))

    # electrons on each shell
    electron_positions = [
        # shell 1: 2 electrons at 0 and 180 deg
        [(0, 0), (180, 0)],
        # shell 2: 4 electrons at 45/135/225/315
        [(45, 1), (135, 1), (225, 1), (315, 1)],
        # shell 3: 3 electrons at 60/180/300
        [(60, 2), (180, 2), (300, 2)],
    ]
    e_count = 0
    for shell_electrons in electron_positions:
        for angle_deg, shell_idx in shell_electrons:
            a = math.radians(angle_deg)
            r = shells[shell_idx]
            ry_f = tilt_ry_factors[shell_idx]
            ex = cx + r * math.cos(a)
            ey = cy + r * ry_f * math.sin(a)
            e_count += 1
            pid = f"electron_{min(e_count, 3)}" if e_count <= 3 else None
            shapes.append(EllipseShape(
                id=f"electron_{e_count}", part_id=pid,
                cx=ex, cy=ey, rx=7, ry=7,
                fill="#42A5F5", stroke="#0D47A1", stroke_width=1.2,
            ))
            # glow
            shapes.append(EllipseShape(
                id=f"electron_{e_count}_glow", part_id=None,
                cx=ex, cy=ey, rx=12, ry=12,
                fill="#42A5F5", opacity=0.25,
            ))

    # nucleus label line
    shapes.append(PathShape(
        id="nucleus_label_line", part_id=None,
        d=f"M {cx + nucleus_r} {cy} L {cx + nucleus_r + 30} {cy - 20}",
        fill="none", stroke="#FF8F00", stroke_width=1.0, opacity=0.5,
    ))

    anchors = [
        LabelAnchor(part_id="nucleus",          x=50.0, y=50.0),
        LabelAnchor(part_id="proton",           x=44.0, y=43.0),
        LabelAnchor(part_id="neutron",          x=56.0, y=57.0),
        LabelAnchor(part_id="electron_shell_1", x=72.0, y=40.0),
        LabelAnchor(part_id="electron_shell_2", x=80.0, y=35.0),
        LabelAnchor(part_id="electron_shell_3", x=88.0, y=30.0),
        LabelAnchor(part_id="electron_1",       x=64.0, y=24.0),
        LabelAnchor(part_id="electron_2",       x=74.0, y=54.0),
        LabelAnchor(part_id="electron_3",       x=24.0, y=56.0),
    ]

    rendered_parts = list({s.part_id for s in shapes if s.part_id})

    return RenderSpec(
        object_key="atom.bohr",
        viewbox="0 0 560 420",
        shapes=shapes,
        anchors=anchors,
        rendered_parts=rendered_parts,
    )
