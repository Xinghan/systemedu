"""Pattern registry — maps pattern_id to parameter schema + HTML renderer."""

from __future__ import annotations
from pathlib import Path
import json
import re

_HERE = Path(__file__).parent


def _load_template(name: str) -> str:
    return (_HERE / f"{name}.html").read_text(encoding="utf-8")


def render_pattern(pattern_id: str, params: dict) -> str:
    """Render a parametric animation pattern to self-contained HTML.

    Substitutes {{KEY}} placeholders in the template with param values.
    Returns empty string if pattern_id is unknown or template missing.
    """
    try:
        template = _load_template(pattern_id)
    except FileNotFoundError:
        return ""

    # Replace {{KEY}} placeholders with JSON-serialized values
    # (so strings get quoted, numbers don't)
    def replacer(m):
        key = m.group(1)
        val = params.get(key)
        if val is None:
            return m.group(0)  # leave unreplaced if key missing
        if isinstance(val, str):
            return json.dumps(val, ensure_ascii=False)
        return str(val)

    result = re.sub(r"\{\{(\w+)\}\}", replacer, template)
    return result


# Pattern registry — describes available patterns for the router agent
PATTERN_REGISTRY: dict[str, dict] = {
    "relative_motion": {
        "description": "两个物体相向运动（追及、相遇、相离），展示相对速度与距离变化",
        "suitable_for": [
            "追及问题", "相遇问题", "速度合成", "相对运动",
            "火车/汽车/人的行程", "距离-速度-时间关系",
        ],
        "params": {
            "title":          {"type": "str",   "desc": "动画标题",        "default": "相遇问题"},
            "total_distance": {"type": "float", "desc": "总距离（数值）",   "default": 1000},
            "speed_a":        {"type": "float", "desc": "物体A速度",        "default": 60},
            "speed_b":        {"type": "float", "desc": "物体B速度",        "default": 40},
            "label_a":        {"type": "str",   "desc": "物体A名称",        "default": "甲"},
            "label_b":        {"type": "str",   "desc": "物体B名称",        "default": "乙"},
            "unit":           {"type": "str",   "desc": "速度单位",         "default": "km/h"},
            "distance_unit":  {"type": "str",   "desc": "距离单位",         "default": "km"},
            "mode":           {"type": "str",   "desc": "toward=相向|away=相背|chase=追及", "default": "toward"},
            "color_a":        {"type": "str",   "desc": "A的颜色",          "default": "#3b82f6"},
            "color_b":        {"type": "str",   "desc": "B的颜色",          "default": "#ef4444"},
        },
    },
    "wave_oscillation": {
        "description": "弹簧/单摆/波动振荡，展示周期性运动和能量转换",
        "suitable_for": [
            "弹簧振动", "单摆", "谐振", "声波", "简谐运动",
            "周期与频率", "波长", "振幅", "弹力与恢复力",
        ],
        "params": {
            "title":       {"type": "str",   "desc": "动画标题",          "default": "弹簧振动"},
            "mode":        {"type": "str",   "desc": "spring=弹簧|pendulum=单摆|wave=横波", "default": "spring"},
            "amplitude":   {"type": "float", "desc": "振幅（像素，建议50-100）", "default": 80},
            "period":      {"type": "float", "desc": "周期（秒）",         "default": 2.0},
            "label_mass":  {"type": "str",   "desc": "质量块标签",         "default": "m"},
            "label_k":     {"type": "str",   "desc": "弹簧系数标签",       "default": "k"},
            "show_energy": {"type": "bool",  "desc": "是否显示能量条",     "default": True},
            "color_main":  {"type": "str",   "desc": "主色",              "default": "#6366f1"},
        },
    },
    "crank_slider": {
        "description": "曲柄滑块机构（活塞-曲轴），展示旋转运动转化为直线运动",
        "suitable_for": [
            "发动机", "活塞运动", "内燃机", "曲柄连杆机构",
            "往复运动", "机械传动", "冲程", "气缸",
        ],
        "params": {
            "title":       {"type": "str",   "desc": "动画标题",    "default": "曲柄滑块机构"},
            "rpm":         {"type": "float", "desc": "转速(RPM)",   "default": 120},
            "crank_r":     {"type": "float", "desc": "曲柄半径(px)", "default": 60},
            "rod_len":     {"type": "float", "desc": "连杆长度(px)", "default": 130},
            "label_crank": {"type": "str",   "desc": "曲柄标签",    "default": "曲轴"},
            "label_piston":{"type": "str",   "desc": "活塞标签",    "default": "活塞"},
            "label_rod":   {"type": "str",   "desc": "连杆标签",    "default": "连杆"},
            "show_angle":  {"type": "bool",  "desc": "显示角度HUD", "default": True},
            "color_crank": {"type": "str",   "desc": "曲轴颜色",    "default": "#f59e0b"},
            "color_piston":{"type": "str",   "desc": "活塞颜色",    "default": "#6366f1"},
        },
    },
    "projectile": {
        "description": "抛体/火箭轨迹运动，展示水平与竖直方向的合运动",
        "suitable_for": [
            "抛体运动", "平抛", "斜抛", "火箭升空", "弹道",
            "重力加速度", "惯性与重力", "加速度",
        ],
        "params": {
            "title":        {"type": "str",   "desc": "动画标题",       "default": "抛体运动"},
            "mode":         {"type": "str",   "desc": "horizontal=平抛|angle=斜抛|rocket=火箭", "default": "angle"},
            "launch_angle": {"type": "float", "desc": "发射角(度，斜抛用)", "default": 45},
            "v0":           {"type": "float", "desc": "初速度(m/s，标定值)", "default": 20},
            "gravity":      {"type": "float", "desc": "重力加速度(m/s²)",   "default": 10},
            "label_object": {"type": "str",   "desc": "物体标签",         "default": "炮弹"},
            "show_components": {"type": "bool", "desc": "显示分量箭头",  "default": True},
            "color_trail":  {"type": "str",   "desc": "轨迹颜色",         "default": "#f59e0b"},
            "color_object": {"type": "str",   "desc": "物体颜色",         "default": "#ef4444"},
        },
    },
}
