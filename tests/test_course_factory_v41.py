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
    ANIMATION_RESIZE_PATCH_MARKER,
    fix_nonuniform_scale_in_html,
    inject_animation_resize_patch,
    inject_idea_markers,
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

    def test_injects_idea_markers_into_plan_markdown(self):
        """make_course_content 输出的 plan_markdown 必须包含 [[IDEA:<anim>]] 和 [[IDEA:<ex>]] 标记，前端据此渲染。"""
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
        anim_id = next(i["idea_id"] for i in cc["ideas"] if i["mode"] == "animation")
        ex_id = next(i["idea_id"] for i in cc["ideas"] if i["mode"] == "exercise")
        pm = cc["plan_markdown"]
        assert f"[[IDEA:{anim_id}]]" in pm
        assert f"[[IDEA:{ex_id}]]" in pm
        # 动画 marker 应出现在"深入理解"附近
        assert pm.index("## 深入理解") < pm.index(f"[[IDEA:{anim_id}]]")
        # 练习 marker 应出现在"应用与拓展"附近
        assert pm.index("## 应用与拓展") < pm.index(f"[[IDEA:{ex_id}]]")

    def test_supports_game_html_parameter(self):
        """传入 game_html 时应生成独立的 game idea + rendered_section + marker。"""
        knode = _v41_knode()
        plan = _valid_course_content(knode)["plan_markdown"]
        exercises = make_exercises([
            {"question": "Q1", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "E1"},
        ])
        cc = make_course_content(
            plan_markdown=plan,
            animation_html="<html>anim</html>",
            animation_topic="视角切换",
            exercises=exercises,
            exercise_topic="练习",
            knode=knode,
            animation_hands_on_ref="浏览并筛选真实火星图像样本",
            animation_acceptance_ref="火星图像风险观察笔记",
            game_html="<html>game</html>",
            game_topic="拖拽分类游戏",
            game_hands_on_ref="在样例图上手工圈出危险区域并写理由",
            game_acceptance_ref="20 张样例图的人工风险说明",
            exercise_hands_on_ref="在样例图上手工圈出危险区域并写理由",
            exercise_acceptance_ref="学生能够现场说明并演示本模块中的至少两项动手动作",
        )
        modes = [i["mode"] for i in cc["ideas"]]
        assert modes == ["animation", "game", "exercise"], f"got {modes}"
        game = next(i for i in cc["ideas"] if i["mode"] == "game")
        assert game["topic"] == "拖拽分类游戏"
        assert game["hands_on_ref"] == "在样例图上手工圈出危险区域并写理由"
        assert game["acceptance_ref"] == "20 张样例图的人工风险说明"
        gid = game["idea_id"]
        assert gid in cc["rendered_sections"]
        assert cc["rendered_sections"][gid]["mode"] == "game"
        assert cc["rendered_sections"][gid]["html"] is not None
        assert f"[[IDEA:{gid}]]" in cc["plan_markdown"]

    def test_game_only_no_animation(self):
        """animation_html=None 时应跳过 animation idea（d=1 场景）。"""
        knode = _v41_knode()
        plan = _valid_course_content(knode)["plan_markdown"]
        exercises = make_exercises([
            {"question": "Q1", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "E1"},
        ])
        cc = make_course_content(
            plan_markdown=plan,
            animation_html=None,
            animation_topic="",
            exercises=exercises,
            exercise_topic="练习",
            knode=knode,
            game_html="<html>game</html>",
            game_topic="拖拽分类游戏",
            game_hands_on_ref="浏览并筛选真实火星图像样本",
            game_acceptance_ref="火星图像风险观察笔记",
            exercise_hands_on_ref="在样例图上手工圈出危险区域并写理由",
            exercise_acceptance_ref="学生能够现场说明并演示本模块中的至少两项动手动作",
        )
        modes = [i["mode"] for i in cc["ideas"]]
        assert "animation" not in modes
        assert "game" in modes
        assert "exercise" in modes

    def test_game_preflight_validates_refs(self):
        """game idea 也必须满足 v4.1 ref 校验，非法 ref 应抛异常。"""
        knode = _v41_knode()
        plan = _valid_course_content(knode)["plan_markdown"]
        exercises = make_exercises([
            {"question": "Q1", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "E1"},
        ])
        with pytest.raises(ValueError, match="v4.1 preflight failed"):
            make_course_content(
                plan_markdown=plan,
                animation_html="<html></html>",
                animation_topic="x",
                exercises=exercises,
                exercise_topic="y",
                knode=knode,
                animation_hands_on_ref="浏览并筛选真实火星图像样本",
                animation_acceptance_ref="火星图像风险观察笔记",
                game_html="<html>game</html>",
                game_topic="游戏",
                # 故意填非法 ref
                game_hands_on_ref="不存在的动作",
                game_acceptance_ref="不存在的产物",
                exercise_hands_on_ref="在样例图上手工圈出危险区域并写理由",
                exercise_acceptance_ref="学生能够现场说明并演示本模块中的至少两项动手动作",
            )


# ── inject_idea_markers 测试 ────────────────────────────────────


class TestInjectIdeaMarkers:
    _PLAN_TEMPLATE = """> Module: M01

## 学习目标

- 目标 1

## 引入

引入段。

## 核心概念

概念段。

## 深入理解

深入段。

## 应用与拓展

拓展段。

## 延伸阅读

- ref
"""

    def test_inserts_anim_after_deep_understanding(self):
        out = inject_idea_markers(self._PLAN_TEMPLATE, anim_id="anim_x", ex_id="ex_y")
        assert "[[IDEA:anim_x]]" in out
        assert "[[IDEA:ex_y]]" in out
        # anim 应在"深入理解"之后、"应用与拓展"之前
        i_deep = out.index("## 深入理解")
        i_anim = out.index("[[IDEA:anim_x]]")
        i_ext = out.index("## 应用与拓展")
        assert i_deep < i_anim < i_ext
        # ex 应在"应用与拓展"之后
        i_ex = out.index("[[IDEA:ex_y]]")
        assert i_ext < i_ex

    def test_anim_falls_back_to_core_concept(self):
        plan = "## 学习目标\n- g1\n\n## 核心概念\n概念\n"
        out = inject_idea_markers(plan, anim_id="anim_a", ex_id=None)
        assert "[[IDEA:anim_a]]" in out
        assert out.index("## 核心概念") < out.index("[[IDEA:anim_a]]")

    def test_no_anchor_appends_to_end(self):
        plan = "# 无结构\n纯文本。"
        out = inject_idea_markers(plan, anim_id="anim_z", ex_id="ex_z")
        assert out.strip().endswith("[[IDEA:ex_z]]")
        assert "[[IDEA:anim_z]]" in out

    def test_empty_plan_returns_unchanged(self):
        assert inject_idea_markers("", anim_id="x", ex_id="y") == ""

    def test_none_ids_do_nothing(self):
        out = inject_idea_markers(self._PLAN_TEMPLATE)
        assert out == self._PLAN_TEMPLATE

    def test_idempotent_on_existing_markers(self):
        """已存在同名标记时不重复插入。"""
        plan = self._PLAN_TEMPLATE + "\n[[IDEA:anim_x]]\n"
        out = inject_idea_markers(plan, anim_id="anim_x")
        assert out.count("[[IDEA:anim_x]]") == 1

    def test_story_inserted_at_intro(self):
        out = inject_idea_markers(self._PLAN_TEMPLATE, story_id="story_a")
        assert "[[IDEA:story_a]]" in out
        assert out.index("## 引入") < out.index("[[IDEA:story_a]]")
        # story 应在"核心概念"之前
        assert out.index("[[IDEA:story_a]]") < out.index("## 核心概念")


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


# ── 动画 HTML resize 补丁测试 ─────────────────────────────────

class TestInjectAnimationResizePatch:
    """
    验证 inject_animation_resize_patch：
    - 基本注入行为（在 </body> 前插入 <script>）
    - 幂等（不重复注入）
    - 空值保护
    - 关键 JS 片段存在（ResizeObserver + contentRect + CSS 防撑大）
    """

    SIMPLE_HTML = (
        "<!doctype html><html><body>"
        "<canvas id='c'></canvas>"
        "<script>function resize(){}</script>"
        "</body></html>"
    )

    def test_inserts_script_before_closing_body(self):
        patched = inject_animation_resize_patch(self.SIMPLE_HTML)
        assert ANIMATION_RESIZE_PATCH_MARKER in patched
        # script 注入在 </body> 之前
        script_idx = patched.find(ANIMATION_RESIZE_PATCH_MARKER)
        body_close_idx = patched.find("</body>")
        assert script_idx < body_close_idx
        # 原 canvas 标签仍在
        assert "<canvas id='c'></canvas>" in patched

    def test_idempotent_on_repeated_injection(self):
        once = inject_animation_resize_patch(self.SIMPLE_HTML)
        twice = inject_animation_resize_patch(once)
        assert once == twice
        # 标记只出现一次（出现次数 = marker 字符串出现次数）
        assert twice.count(ANIMATION_RESIZE_PATCH_MARKER) == once.count(
            ANIMATION_RESIZE_PATCH_MARKER
        )

    def test_empty_html_returns_unchanged(self):
        assert inject_animation_resize_patch("") == ""
        assert inject_animation_resize_patch(None) is None  # type: ignore[arg-type]

    def test_no_body_tag_appends_to_end(self):
        html = "<html><canvas id='c'></canvas></html>"
        patched = inject_animation_resize_patch(html)
        assert patched.startswith("<html><canvas id='c'></canvas></html>")
        assert ANIMATION_RESIZE_PATCH_MARKER in patched

    def test_patch_contains_critical_pieces(self):
        """patch 必须包含防止反馈循环的关键代码：ResizeObserver、
        contentRect、CSS 防撑大、幂等标记。"""
        patched = inject_animation_resize_patch(self.SIMPLE_HTML)
        # 使用 ResizeObserver（不是 window.resize）
        assert "ResizeObserver" in patched
        # 使用 contentRect 避免子元素反馈污染
        assert "contentRect" in patched
        # 注入 CSS 让 canvas 脱离文档流
        assert "systemedu-canvas-host" in patched
        assert "position:absolute" in patched
        # requestAnimationFrame 做防抖
        assert "requestAnimationFrame" in patched
        # 幂等守卫
        assert "__systemedu_resize_patched" in patched

    def test_fix_nonuniform_scale_pattern1(self):
        """ctx.scale(canvas.width / W, canvas.height / H) 应被替换。"""
        html = (
            "<script>function resize(){"
            "canvas.width = rect.width * DPR;"
            "canvas.height = rect.height * DPR;"
            "ctx.setTransform(1,0,0,1,0,0);"
            "ctx.scale(canvas.width / W, canvas.height / H);"
            "}</script>"
        )
        fixed = fix_nonuniform_scale_in_html(html)
        assert "systemedu-uniform-scale" in fixed
        assert "Math.min(__seRect.width / W, __seRect.height / H)" in fixed
        # 原 ctx.scale(canvas.width/W, canvas.height/H) 不应再出现
        assert "ctx.scale(canvas.width / W, canvas.height / H)" not in fixed

    def test_fix_nonuniform_scale_pattern2(self):
        """ctx.scale(DPR * rect.width / W, DPR * rect.height / H) 应被替换。"""
        html = (
            "<script>function resize(){"
            "ctx.setTransform(1,0,0,1,0,0);"
            "ctx.scale(DPR * rect.width / W, DPR * rect.height / H);"
            "}</script>"
        )
        fixed = fix_nonuniform_scale_in_html(html)
        assert "systemedu-uniform-scale" in fixed
        assert "ctx.scale(DPR * rect.width / W, DPR * rect.height / H)" not in fixed

    def test_fix_nonuniform_scale_idempotent(self):
        html = (
            "<script>function resize(){"
            "ctx.setTransform(1,0,0,1,0,0);"
            "ctx.scale(canvas.width / W, canvas.height / H);"
            "}</script>"
        )
        once = fix_nonuniform_scale_in_html(html)
        twice = fix_nonuniform_scale_in_html(once)
        assert once == twice

    def test_fix_nonuniform_scale_empty_unchanged(self):
        assert fix_nonuniform_scale_in_html("") == ""

    def test_fix_nonuniform_scale_skips_correct_html(self):
        """已经使用 letterbox 等比缩放的 HTML 不应被改动。"""
        html = (
            "<script>function resize(){"
            "var scale = Math.min(rect.width/W, rect.height/H);"
            "ctx.setTransform(DPR*scale, 0, 0, DPR*scale, 0, 0);"
            "}</script>"
        )
        fixed = fix_nonuniform_scale_in_html(html)
        # 没有目标模式，不应添加标记
        assert "systemedu-uniform-scale" not in fixed
        assert fixed == html

    def test_make_course_content_injects_patch_into_animation_html(self):
        """make_course_content 应自动给 animation_html 注入 patch。"""
        raw_html = (
            "<!doctype html><html><body>"
            "<canvas id='c'></canvas>"
            "<script>function resize(){};function drawCurrent(){}</script>"
            "</body></html>"
        )
        plan = (
            "## 学习目标\n- 目标\n\n"
            "## 引入\n情境\n\n"
            "## 深入理解\n核心\n\n"
            "## 应用与拓展\n练习\n"
        )
        cc = make_course_content(
            plan_markdown=plan,
            animation_html=raw_html,
            animation_topic="测试动画",
            exercises=make_exercises([
                {
                    "question": "Q?",
                    "options": ["A", "B", "C", "D"],
                    "correct": 0,
                    "explanation": "because",
                }
            ]),
            exercise_topic="测试练习",
        )
        # 找到 anim_id
        anim_id = next(
            i["idea_id"] for i in cc["ideas"] if i["mode"] == "animation"
        )
        patched_html = cc["rendered_sections"][anim_id]["html"]
        assert ANIMATION_RESIZE_PATCH_MARKER in patched_html
        # 原 resize / drawCurrent 保留
        assert "function resize()" in patched_html
        assert "function drawCurrent()" in patched_html

    def test_patch_contains_enforce_size_consistency(self):
        """新增：patch 必须包含 backing-store 校正逻辑 enforceSizeConsistency
        和 callInternalResize，防止 canvas backing store 与 CSS 显示尺寸
        不一致导致的字体拉伸。"""
        patched = inject_animation_resize_patch(self.SIMPLE_HTML)
        # backing store 校正函数
        assert "enforceSizeConsistency" in patched
        # local resize 调用包装器（优先 dispatchEvent 驱动 addEventListener）
        assert "callInternalResize" in patched
        # 同时保留 dispatchEvent 作为 fallback
        assert "dispatchEvent(new Event('resize'))" in patched
        # skipFirst 旧逻辑已移除（iframe 首次回调也要处理）
        assert "skipFirst" not in patched

    def test_patch_upgrades_old_patched_html(self):
        """升级场景：对含旧版 patch 的 html 再次调用 inject，应剥离旧 patch
        并注入新版，而不是被幂等检查跳过。"""
        # 模拟旧版 patch（不含校正逻辑，只有最早的 marker + ResizeObserver 占位）
        old_patch_script = (
            "<script>\n"
            "(function () {\n"
            "  if (window.__systemedu_resize_patched) return;\n"
            "  window.__systemedu_resize_patched = true;\n"
            "  var SENTINEL_OLD_PATCH = 'marker-for-old-patch-only';\n"
            "})();\n"
            "</script>\n"
        )
        old_html = (
            "<!doctype html><html><body>"
            "<canvas id='c'></canvas>"
            + old_patch_script
            + "</body></html>"
        )
        assert ANIMATION_RESIZE_PATCH_MARKER in old_html
        assert "SENTINEL_OLD_PATCH" in old_html
        assert "enforceSizeConsistency" not in old_html

        upgraded = inject_animation_resize_patch(old_html)
        # 新版 patch 的标志函数应出现
        assert "enforceSizeConsistency" in upgraded
        assert "callInternalResize" in upgraded
        # marker 仍在（新 patch 里有）
        assert ANIMATION_RESIZE_PATCH_MARKER in upgraded
        # 旧 patch 的独特片段应被剥离
        assert "SENTINEL_OLD_PATCH" not in upgraded
        # 原始 canvas 保留
        assert "<canvas id='c'></canvas>" in upgraded

    def test_patch_idempotent_after_upgrade(self):
        """升级后的 html 再次 inject 应保持不变（新版对新版幂等）。"""
        upgraded = inject_animation_resize_patch(self.SIMPLE_HTML)
        twice = inject_animation_resize_patch(upgraded)
        assert twice == upgraded


# ── Theories 功能测试 ─────────────────────────────────────────


class TestTheories:
    """测试 make_course_content 的 theories 参数注入。"""

    def _sample_theories(self):
        return [
            {
                "theory_id": "theory_phys_friction",
                "title": "摩擦力",
                "subject": "physics",
                "body_markdown": "## 摩擦力\n\n摩擦力是两个接触表面之间的阻力。",
                "related_paragraph": "核心概念段",
            },
            {
                "theory_id": "theory_math_coord",
                "title": "坐标系",
                "subject": "math",
                "body_markdown": "## 笛卡尔坐标系\n\n用两条垂直的数轴来定位平面上的点。",
                "related_paragraph": "深入理解段",
            },
        ]

    def test_theories_included_in_course_content(self):
        """传入 theories 时，course_content 中包含 theories 字段。"""
        theories = self._sample_theories()
        knode = _v41_knode()
        cc = make_course_content(
            plan_markdown="> Module: M01\n\n## 学习目标\n\n能够...\n\n"
                + "[[THEORY:theory_phys_friction]]\n\n## 核心概念：测试\n\n"
                + f"内容 core_question={knode['core_question']}\n\n"
                + "## 深入理解：测试\n\nhands_on\n\n"
                + "[[THEORY:theory_math_coord]]\n\n## 应用与拓展\n\n"
                + f"acceptance_artifacts title={knode['acceptance_artifacts'][0]['title']}\n\n",
            animation_html=None,
            animation_topic="",
            exercises=make_exercises([
                {"question": "Q1", "options": ["A", "B", "C", "D"], "correct": 0,
                 "explanation": "E1"},
            ]),
            exercise_topic="测试练习",
            knode=knode,
            exercise_hands_on_ref=knode["hands_on_components"][0],
            exercise_acceptance_ref=knode["acceptance_standard"][0],
            theories=theories,
        )
        assert "theories" in cc
        assert len(cc["theories"]) == 2
        assert cc["theories"][0]["theory_id"] == "theory_phys_friction"
        assert cc["theories"][1]["subject"] == "math"

    def test_no_theories_omits_field(self):
        """不传入 theories 时，course_content 中没有 theories 字段。"""
        knode = _v41_knode()
        cc = make_course_content(
            plan_markdown="> Module: M01\n\n## 学习目标\n\n能够...\n\n"
                + f"## 核心概念：测试\n\ncore_question={knode['core_question']}\n\n"
                + "## 深入理解：测试\n\nhands_on\n\n## 应用与拓展\n\n"
                + f"acceptance_artifacts title={knode['acceptance_artifacts'][0]['title']}\n\n",
            animation_html=None,
            animation_topic="",
            exercises=make_exercises([
                {"question": "Q1", "options": ["A", "B", "C", "D"], "correct": 0,
                 "explanation": "E1"},
            ]),
            exercise_topic="测试练习",
            knode=knode,
            exercise_hands_on_ref=knode["hands_on_components"][0],
            exercise_acceptance_ref=knode["acceptance_standard"][0],
        )
        assert "theories" not in cc

    def test_empty_theories_omits_field(self):
        """传入空列表时，course_content 中没有 theories 字段。"""
        knode = _v41_knode()
        cc = make_course_content(
            plan_markdown="> Module: M01\n\n## 学习目标\n\n能够...\n\n"
                + f"## 核心概念：测试\n\ncore_question={knode['core_question']}\n\n"
                + "## 深入理解：测试\n\nhands_on\n\n## 应用与拓展\n\n"
                + f"acceptance_artifacts title={knode['acceptance_artifacts'][0]['title']}\n\n",
            animation_html=None,
            animation_topic="",
            exercises=make_exercises([
                {"question": "Q1", "options": ["A", "B", "C", "D"], "correct": 0,
                 "explanation": "E1"},
            ]),
            exercise_topic="测试练习",
            knode=knode,
            exercise_hands_on_ref=knode["hands_on_components"][0],
            exercise_acceptance_ref=knode["acceptance_standard"][0],
            theories=[],
        )
        assert "theories" not in cc
