"""Tests for spec-026 (3D object media type #9) factory helpers.

覆盖:
- should_generate_3d_object: 正例 (硬件 + 内部结构) / 反例 (抽象概念 / capstone / 命中硬件但无解剖话题)
- make_course_content: 传入 threed_object_html 时生成 mode='3d_object' idea + rendered_section
- workspace_bridge._split_html_assets: 把 idea['3d_object_html'] 拆到 media/3d_object-*.html
"""

from __future__ import annotations

import sys
from pathlib import Path

# course_factory/ 位于项目根下
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from course_factory import make_course_content, make_exercises  # noqa: E402
from course_factory.factory import should_generate_3d_object  # noqa: E402
from course_factory.workspace_bridge import _split_html_assets  # noqa: E402


# ── should_generate_3d_object: 正例 ────────────────────────────

def test_should_generate_3d_hardware_with_structure_keyword():
    knode = {
        "title": "PMS5003 激光颗粒传感器内部结构",
        "summary": "拆开 PMS5003 看激光器/光电二极管/风扇/PCB 如何协同检测 PM2.5",
        "module_role": "core",
        "hands_on_components": ["接线 PMS5003 到 Pi Zero 读串口"],
        "rough_learning_topics": [
            "PMS5003 内部结构",
            "激光散射工作原理",
        ],
    }
    out = should_generate_3d_object(knode)
    assert out["should_generate"] is True
    # 应命中 pms5003 (优先具体型号), 而不是 sensor
    assert "pms5003" == out["object_name_hint"].lower()
    assert "pms5003" in [k.lower() for k in out["matched_keywords"]]
    assert out["reason"]


def test_should_generate_3d_pi_zero_with_anatomy():
    knode = {
        "title": "认识 Raspberry Pi Zero 主板布局",
        "module_role": "core",
        "summary": "解剖 Pi Zero, 看 CPU/RAM/GPIO/MicroSD 槽都在哪",
        "hands_on_components": [],
        "rough_learning_topics": ["Pi Zero 解剖", "硬件接口认识"],
    }
    out = should_generate_3d_object(knode)
    assert out["should_generate"] is True
    assert "pi zero" in out["object_name_hint"].lower() or "raspberry pi" in out[
        "object_name_hint"
    ].lower()


# ── should_generate_3d_object: 反例 ────────────────────────────

def test_should_reject_3d_capstone_role():
    knode = {
        "title": "项目终展: 室内 PM2.5 监测站",
        "module_role": "capstone",
        "summary": "整合所有产物做最终展示",
        "hands_on_components": ["搭建 PMS5003 完整原型"],
        "rough_learning_topics": ["项目复盘"],
    }
    out = should_generate_3d_object(knode)
    assert out["should_generate"] is False
    assert "capstone" in out["reason"]


def test_should_reject_3d_abstract_concept():
    knode = {
        "title": "什么是 AQI 空气质量指数",
        "module_role": "core",
        "summary": "AQI 是把多种污染物浓度归一化到 0-500 的数字",
        "hands_on_components": ["查询本地 AQI 数据"],
        "rough_learning_topics": ["AQI 计算公式", "等级划分"],
    }
    out = should_generate_3d_object(knode)
    assert out["should_generate"] is False
    # 抽象概念没有硬件关键词命中
    assert "硬件" in out["reason"] or "命中" in out["reason"]


def test_should_reject_3d_mention_hardware_but_no_structure_topic():
    """节点只是 mention 硬件名, 不讲内部结构 → reject"""
    knode = {
        "title": "把 PMS5003 数据上传到云端",
        "module_role": "core",
        "summary": "用 MQTT 协议把传感器读数推到 IoT 平台",
        "hands_on_components": ["PMS5003 接 Pi Zero"],
        "rough_learning_topics": ["MQTT 协议入门", "云端数据存储"],
    }
    out = should_generate_3d_object(knode)
    assert out["should_generate"] is False
    assert "学习内容" in out["reason"] or "结构" in out["reason"] or "解剖" in out["reason"]


def test_should_reject_3d_process_action():
    knode = {
        "title": "用纸巾擦窗台对比室内外灰尘",
        "module_role": "core",
        "summary": "动手做擦灰对比实验",
        "hands_on_components": ["用纸巾擦窗台"],
        "rough_learning_topics": ["颗粒物沉积", "数据采集"],
    }
    out = should_generate_3d_object(knode)
    assert out["should_generate"] is False


# ── make_course_content + 3d_object idea ──────────────────────

def _minimal_anim_html() -> str:
    return (
        "<!doctype html><html><body>"
        "<canvas id='c' width='400' height='300'></canvas>"
        "<script>const ctx=document.getElementById('c').getContext('2d');"
        "ctx.fillRect(0,0,10,10);</script>"
        "</body></html>"
    )


def _minimal_3d_html() -> str:
    return (
        "<!doctype html><html><body>"
        "<div id='stage'></div>"
        "<script>console.log('3d placeholder');</script>"
        "</body></html>"
    )


def test_make_course_content_3d_idea_and_section():
    cc = make_course_content(
        plan_markdown="# 节点学习计划\n\n短文",
        animation_html=_minimal_anim_html(),
        animation_topic="anim_topic",
        exercises=make_exercises([
            {
                "type": "choice",
                "question": "Q?",
                "options": ["a", "b", "c", "d"],
                "correct": 0,
                "explanation": "因为 a",
            }
        ]),
        exercise_topic="ex_topic",
        threed_object_html=_minimal_3d_html(),
        threed_object_topic="PMS5003 cutaway",
        preflight=False,
    )

    ideas = cc["ideas"]
    threed_ideas = [i for i in ideas if i["mode"] == "3d_object"]
    assert len(threed_ideas) == 1
    threed = threed_ideas[0]
    assert threed["topic"] == "PMS5003 cutaway"
    assert threed["style_key"] == "flipbook_paper"
    assert "3d_object_html" in threed  # 挂在 idea 上以便 _split_html_assets 拆走

    # rendered_sections 中也有对应 entry
    rs = cc["rendered_sections"]
    assert threed["idea_id"] in rs
    assert rs[threed["idea_id"]]["mode"] == "3d_object"
    assert rs[threed["idea_id"]]["html"] == _minimal_3d_html()


def test_make_course_content_no_3d_when_omitted():
    cc = make_course_content(
        plan_markdown="# x",
        animation_html=_minimal_anim_html(),
        animation_topic="t",
        exercises=make_exercises([
            {
                "type": "choice",
                "question": "Q?",
                "options": ["a", "b", "c", "d"],
                "correct": 0,
                "explanation": "因为 a",
            }
        ]),
        exercise_topic="ex",
        preflight=False,
    )
    assert not [i for i in cc["ideas"] if i["mode"] == "3d_object"]


# ── workspace_bridge: 拆 3d_object html 到 media/ ────────────

def test_split_html_assets_writes_3d_object_file(tmp_path):
    knode_path = tmp_path / "knode"
    knode_path.mkdir()

    course_content = {
        "ideas": [
            {
                "idea_id": "3dobj_1",
                "mode": "3d_object",
                "topic": "PMS5003 cutaway",
                "3d_object_html": _minimal_3d_html(),
            }
        ],
    }

    out, written = _split_html_assets(
        course_content, knode_path, slug="proj", module_id="M11"
    )

    media_dir = knode_path / "media"
    files = list(media_dir.iterdir())
    assert len(files) == 1
    assert files[0].name.startswith("3d_object-")
    assert files[0].name.endswith(".html")

    idea = out["ideas"][0]
    assert "3d_object_html" not in idea  # 已被 _split 弹走
    assert idea["3d_object_path"] == f"media/{files[0].name}"
    assert files[0].read_text(encoding="utf-8") == _minimal_3d_html()
