"""Tests for scripts/course_factory.py v4.1 alignment helpers.

覆盖：
- load_knode_context: 从 knowledge_tree.json 读取 knode 上下文
- preflight_v41: v4.1 对齐校验的正/反例
- make_exercises: 保留 ref 字段
- make_course_content: 注入 refs、自动 preflight
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

# scripts/ 不在 package 中，需要手动加 sys.path
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from scripts.course_factory import (  # noqa: E402
    load_knode_context,
    make_course_content,
    make_exercises,
    preflight_v41,
)


# ── 测试数据 ──────────────────────────────────────────────────

def _v41_knode() -> dict:
    """返回一个完整的 v4.1 knode dict。"""
    return {
        "title": "在火星图像里看见路况而不是风景",
        "summary": "学会用任务目标、可通行区、危险区、未知区四类语言描述火星图像。",
        "difficulty_level": 1,
        "module_id": "P-MARS-01-M01",
        "module_role": "foundation",
        "core_question": "为什么一张火星图像必须先被解释成对行星车有意义的风险场景？",
        "hands_on_components": [
            "浏览并筛选真实火星图像样本",
            "在样例图上手工圈出危险区域并写理由",
        ],
        "acceptance_artifacts": [
            {"artifact_id": "A1", "title": "火星图像风险观察笔记", "format": "report"},
            {"artifact_id": "A2", "title": "20 张样例图的人工风险说明", "format": "report"},
        ],
        "acceptance_standard": [
            "提交的火星图像风险观察笔记能够被教师或同伴直接打开、检查或运行",
            "学生能够现场说明并演示本模块中的至少两项动手动作",
        ],
        "outputs_produced": ["火星图像风险观察笔记", "20 张样例图的人工风险说明"],
    }


def _legacy_knode() -> dict:
    """返回一个旧版（无 v4.1 字段）的 knode dict。"""
    return {
        "title": "牛顿第二定律",
        "summary": "F=ma 的直觉理解。",
        "difficulty_level": 3,
    }


def _valid_course_content(knode: dict) -> dict:
    """构造一个完全满足 v4.1 约束的 course_content。"""
    plan = f"""> Module: {knode['module_id']} · {knode['module_role']}

## 学习目标

- 能够用任务语言描述火星图像
- 能够圈出危险区域并写出理由

## 引入

{knode['core_question']}

## 核心概念
...

## 深入理解

学生将亲自浏览并筛选真实火星图像样本。

## 应用与拓展

完成火星图像风险观察笔记。
"""
    return {
        "plan_markdown": plan,
        "ideas": [
            {
                "idea_id": "anim_001",
                "mode": "animation",
                "topic": "视角切换",
                "hands_on_ref": "浏览并筛选真实火星图像样本",
                "acceptance_ref": "火星图像风险观察笔记",
            },
            {
                "idea_id": "ex_001",
                "mode": "exercise",
                "topic": "风险观察练习",
                "hands_on_ref": "在样例图上手工圈出危险区域并写理由",
                "acceptance_ref": "学生能够现场说明并演示本模块中的至少两项动手动作",
            },
        ],
        "rendered_sections": {},
    }


# ── preflight_v41 测试 ─────────────────────────────────────────


class TestPreflightV41:
    def test_valid_v41_course_passes(self):
        knode = _v41_knode()
        errors = preflight_v41(knode, _valid_course_content(knode))
        assert errors == []

    def test_legacy_knode_skips_validation(self):
        """旧版 knode 无 v4.1 字段 → 应跳过所有校验。"""
        knode = _legacy_knode()
        course_content = {
            "plan_markdown": "some plan",
            "ideas": [{"idea_id": "anim_1", "mode": "animation", "topic": "x"}],
            "rendered_sections": {},
        }
        errors = preflight_v41(knode, course_content)
        assert errors == []

    def test_missing_hands_on_ref_reported(self):
        knode = _v41_knode()
        cc = _valid_course_content(knode)
        del cc["ideas"][0]["hands_on_ref"]
        errors = preflight_v41(knode, cc)
        assert any("缺少 hands_on_ref" in e for e in errors)

    def test_invalid_hands_on_ref_value_reported(self):
        knode = _v41_knode()
        cc = _valid_course_content(knode)
        cc["ideas"][0]["hands_on_ref"] = "造访月球表面"  # 不在 knode 里
        errors = preflight_v41(knode, cc)
        assert any("不在 knode.hands_on_components" in e for e in errors)

    def test_missing_acceptance_ref_reported(self):
        knode = _v41_knode()
        cc = _valid_course_content(knode)
        del cc["ideas"][1]["acceptance_ref"]
        errors = preflight_v41(knode, cc)
        assert any("缺少 acceptance_ref" in e for e in errors)

    def test_invalid_acceptance_ref_value_reported(self):
        knode = _v41_knode()
        cc = _valid_course_content(knode)
        cc["ideas"][0]["acceptance_ref"] = "量子隧穿实验报告"
        errors = preflight_v41(knode, cc)
        assert any("不在 knode.acceptance_standard" in e for e in errors)

    def test_hands_on_not_covered_reported(self):
        """所有 ideas 都引用同一条 hands_on，其余 hands_on 没被覆盖也应 pass（只需至少一条）。"""
        knode = _v41_knode()
        cc = _valid_course_content(knode)
        # 两个 ideas 都指向同一条 hands_on，另一条没被覆盖 -> 仍然 pass（只要有一条被覆盖）
        cc["ideas"][0]["hands_on_ref"] = "浏览并筛选真实火星图像样本"
        cc["ideas"][1]["hands_on_ref"] = "浏览并筛选真实火星图像样本"
        errors = preflight_v41(knode, cc)
        # 此时两个 ideas 都指向合法值，应该无错误
        assert errors == []

    def test_zero_hands_on_coverage_reported(self):
        """所有 ideas 都没填 hands_on_ref，或全部填的是非法值 → 应该报错。"""
        knode = _v41_knode()
        cc = _valid_course_content(knode)
        # 构造一种情况：所有 ideas 的 ref 都是空，且是 story（不走校验 1）
        cc["ideas"] = [
            {"idea_id": "s1", "mode": "story", "topic": "x"},
        ]
        errors = preflight_v41(knode, cc)
        assert any("未被任何 idea 覆盖" in e for e in errors)

    def test_core_question_not_in_plan_reported(self):
        knode = _v41_knode()
        cc = _valid_course_content(knode)
        cc["plan_markdown"] = "## 学习目标\n没有提到任何问题。"
        errors = preflight_v41(knode, cc)
        assert any("plan_markdown 未出现 core_question" in e for e in errors)

    def test_story_idea_not_required_to_have_refs(self):
        """story mode 的 idea 不强制 refs。"""
        knode = _v41_knode()
        cc = _valid_course_content(knode)
        cc["ideas"].append(
            {"idea_id": "story_1", "mode": "story", "topic": "导入"}
        )
        errors = preflight_v41(knode, cc)
        assert errors == []


# ── make_exercises 测试 ───────────────────────────────────────


class TestMakeExercises:
    def test_preserves_ref_field(self):
        result = make_exercises([
            {
                "question": "Q1",
                "options": ["A", "B", "C", "D"],
                "correct": 0,
                "explanation": "E1",
                "ref": "在样例图上手工圈出危险区域并写理由",
            },
        ])
        assert len(result) == 1
        assert result[0]["ref"] == "在样例图上手工圈出危险区域并写理由"
        assert result[0]["type"] == "choice"

    def test_ref_field_optional(self):
        result = make_exercises([
            {"question": "Q1", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "E1"},
        ])
        assert "ref" not in result[0]

    def test_empty_ref_not_included(self):
        result = make_exercises([
            {
                "question": "Q1",
                "options": ["A", "B", "C", "D"],
                "correct": 0,
                "explanation": "E1",
                "ref": "",
            },
        ])
        assert "ref" not in result[0]


# ── make_course_content 测试 ───────────────────────────────────


class TestMakeCourseContent:
    def test_injects_refs_into_ideas(self):
        knode = _v41_knode()
        plan = _valid_course_content(knode)["plan_markdown"]
        exercises = make_exercises([
            {"question": "Q1", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "E1"},
        ])

        cc = make_course_content(
            plan_markdown=plan,
            animation_html="<html></html>",
            animation_topic="视角切换",
            exercises=exercises,
            exercise_topic="风险观察练习",
            knode=knode,
            animation_hands_on_ref="浏览并筛选真实火星图像样本",
            animation_acceptance_ref="火星图像风险观察笔记",
            exercise_hands_on_ref="在样例图上手工圈出危险区域并写理由",
            exercise_acceptance_ref="学生能够现场说明并演示本模块中的至少两项动手动作",
        )

        anim = next(i for i in cc["ideas"] if i["mode"] == "animation")
        ex = next(i for i in cc["ideas"] if i["mode"] == "exercise")
        assert anim["hands_on_ref"] == "浏览并筛选真实火星图像样本"
        assert anim["acceptance_ref"] == "火星图像风险观察笔记"
        assert ex["hands_on_ref"] == "在样例图上手工圈出危险区域并写理由"
        assert ex["acceptance_ref"] == "学生能够现场说明并演示本模块中的至少两项动手动作"

    def test_auto_preflight_raises_on_invalid(self):
        knode = _v41_knode()
        exercises = make_exercises([
            {"question": "Q1", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "E1"},
        ])
        with pytest.raises(ValueError, match="v4.1 preflight failed"):
            make_course_content(
                plan_markdown="plan without core_question",
                animation_html="<html></html>",
                animation_topic="x",
                exercises=exercises,
                exercise_topic="y",
                knode=knode,
                # 故意填非法 ref
                animation_hands_on_ref="不存在的动作",
                animation_acceptance_ref="不存在的交付物",
                exercise_hands_on_ref="浏览并筛选真实火星图像样本",
                exercise_acceptance_ref="火星图像风险观察笔记",
            )

    def test_preflight_false_skips_validation(self):
        """preflight=False 时即使约束不满足也不抛异常。"""
        knode = _v41_knode()
        exercises = make_exercises([
            {"question": "Q1", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "E1"},
        ])
        cc = make_course_content(
            plan_markdown="",
            animation_html="<html></html>",
            animation_topic="x",
            exercises=exercises,
            exercise_topic="y",
            knode=knode,
            preflight=False,
        )
        assert "ideas" in cc  # 未抛异常

    def test_no_knode_legacy_mode(self):
        """不传 knode 时走旧版路径，无 refs 注入。"""
        exercises = make_exercises([
            {"question": "Q1", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "E1"},
        ])
        cc = make_course_content(
            plan_markdown="plan",
            animation_html="<html></html>",
            animation_topic="topic",
            exercises=exercises,
            exercise_topic="ex topic",
        )
        anim = next(i for i in cc["ideas"] if i["mode"] == "animation")
        assert "hands_on_ref" not in anim
        assert "acceptance_ref" not in anim


# ── load_knode_context 测试 ────────────────────────────────────


class TestLoadKnodeContext:
    def test_loads_v41_knode(self, tmp_path, monkeypatch):
        # 构造一个临时项目
        project_dir = tmp_path / "projects" / "test-proj"
        project_dir.mkdir(parents=True)
        tree = {
            "milestones": [
                {
                    "title": "MS1",
                    "description": "d1",
                    "knodes": [
                        {"title": "K0", "summary": "s0", "module_id": "M0"},
                        {"title": "K1", "summary": "s1", "module_id": "M1"},
                    ],
                },
                {
                    "title": "MS2",
                    "description": "d2",
                    "knodes": [
                        {"title": "K2", "summary": "s2", "module_id": "M2"},
                    ],
                },
            ],
            "sub_projects": [
                {"id": "S1", "title": "Stage 1", "milestone_indices": [0], "brief": "b1"},
                {"id": "S2", "title": "Stage 2", "milestone_indices": [1], "brief": "b2"},
            ],
        }
        (project_dir / "knowledge_tree.json").write_text(
            json.dumps(tree, ensure_ascii=False), encoding="utf-8"
        )

        # monkeypatch course_factory.ROOT 指向 tmp_path
        import scripts.course_factory as cf
        monkeypatch.setattr(cf, "ROOT", tmp_path)

        # 读取第 2 个 knode（global idx=1，属于 MS1/S1）
        ctx = cf.load_knode_context("test-proj", 1)
        assert ctx["knode"]["title"] == "K1"
        assert ctx["knode"]["module_id"] == "M1"
        assert ctx["milestone"]["title"] == "MS1"
        assert ctx["sub_project"]["id"] == "S1"

        # 读取第 3 个 knode（global idx=2，属于 MS2/S2）
        ctx = cf.load_knode_context("test-proj", 2)
        assert ctx["knode"]["title"] == "K2"
        assert ctx["milestone"]["title"] == "MS2"
        assert ctx["sub_project"]["id"] == "S2"

    def test_out_of_range_raises(self, tmp_path, monkeypatch):
        project_dir = tmp_path / "projects" / "mini"
        project_dir.mkdir(parents=True)
        tree = {"milestones": [{"title": "M", "knodes": [{"title": "K0"}]}]}
        (project_dir / "knowledge_tree.json").write_text(
            json.dumps(tree, ensure_ascii=False), encoding="utf-8"
        )
        import scripts.course_factory as cf
        monkeypatch.setattr(cf, "ROOT", tmp_path)
        with pytest.raises(ValueError, match="out of range"):
            cf.load_knode_context("mini", 99)

    def test_missing_project_raises(self, tmp_path, monkeypatch):
        import scripts.course_factory as cf
        monkeypatch.setattr(cf, "ROOT", tmp_path)
        with pytest.raises(FileNotFoundError):
            cf.load_knode_context("nonexistent", 0)

    def test_no_sub_projects_returns_none(self, tmp_path, monkeypatch):
        project_dir = tmp_path / "projects" / "nosub"
        project_dir.mkdir(parents=True)
        tree = {"milestones": [{"title": "M", "knodes": [{"title": "K0"}]}]}
        (project_dir / "knowledge_tree.json").write_text(
            json.dumps(tree, ensure_ascii=False), encoding="utf-8"
        )
        import scripts.course_factory as cf
        monkeypatch.setattr(cf, "ROOT", tmp_path)
        ctx = cf.load_knode_context("nosub", 0)
        assert ctx["sub_project"] is None
