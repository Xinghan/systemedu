"""知识钻取测试 (spec 2026-06-09)。"""
from __future__ import annotations

import json


def test_parse_drill_valid_json():
    from systemedu.student.drill.generator import parse_drill
    raw = json.dumps({
        "simple_explanation": "采样率是每秒采集信号的次数",
        "why_matters": "决定能不能还原信号",
        "analogy": "像拍视频的帧率",
        "key_points": ["fs>=2fmax", "EEG 常用 250Hz"],
        "go_deeper": "了解傅里叶变换",
    }, ensure_ascii=False)
    out = parse_drill(raw)
    assert out["simple_explanation"].startswith("采样率")
    assert isinstance(out["key_points"], list) and len(out["key_points"]) == 2


def test_parse_drill_strips_code_fence():
    from systemedu.student.drill.generator import parse_drill
    raw = '```json\n{"simple_explanation":"x","why_matters":"y","analogy":"z","key_points":["a"],"go_deeper":"w"}\n```'
    out = parse_drill(raw)
    assert out["simple_explanation"] == "x"


def test_parse_drill_non_json_degrades():
    from systemedu.student.drill.generator import parse_drill
    out = parse_drill("这不是 JSON 只是一段话")
    # 降级: 全部塞进 simple_explanation, 其余空, key_points 空 list
    assert "这不是 JSON" in out["simple_explanation"]
    assert out["key_points"] == []
    assert "why_matters" in out and "analogy" in out and "go_deeper" in out
