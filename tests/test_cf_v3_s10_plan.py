"""s10_plan 单元 + 集成测试。"""

from __future__ import annotations

import pytest

from systemedu.core.course_factory_v3.progress import Emitter
from systemedu.core.course_factory_v3.steps import s10_plan


@pytest.fixture
def normal_ctx():
    return {
        "project_name": "rocket-design",
        "category": "aerospace",
        "knowledge_level": "K3",
        "age_range": [10, 14],
        "knode": {
            "title": "推力的产生",
            "name": "推力的产生",
            "summary": "推力 = 质量流量 × 排气速度",
            "module_id": "P-RKT-01-M02",
            "module_role": "core",
            "core_question": "如何让火箭获得足够的推力升空?",
            "difficulty_level": 3,
            "hands_on_components": [
                "测量不同气球嘴口大小对推进时间的影响",
                "用秤测量火箭模型质量",
            ],
            "acceptance_artifacts": [
                {"title": "推力测量记录表", "description": "至少 5 组数据", "format": "spreadsheet"},
            ],
            "acceptance_standard": [
                "学生能解释推力公式各项含义",
                "记录表数据完整可读",
            ],
            "outputs_produced": ["推力测量数据集"],
        },
        "milestone": {"title": "火箭动力", "description": "理解推力来源"},
        "sub_project": {
            "brief": "搭建可控火箭",
            "core_problem": "如何让火箭按计划上升",
            "task": "设计推进系统",
            "deliverables": ["可发射模型"],
        },
    }


def test_self_check_passes_on_well_formed_plan(normal_ctx):
    plan = """> Module: P-RKT-01-M02 · core

## 学习目标

- 能够说出推力公式中每一项的含义
- 能够测量气球喷气的推进时间并填写推力测量记录表

## 引入: 火箭为什么能升空

如何让火箭获得足够的推力升空? 这就是本节要回答的核心问题。
你将通过气球喷气实验直观感受推力的产生。{{HIRISE}} 数据集里的火箭升空照片可以参考。

## 核心概念: 推力与质量流量

推力 \\(F = \\dot{m} v_e\\),其中 \\(\\dot{m}\\) 是单位时间喷出的质量,
\\(v_e\\) 是排气速度。喷得越快、越多,推力越大。

## 深入理解: 用气球感受推力

测量不同气球嘴口大小对推进时间的影响,你会发现嘴口越大,流量越大,推力越大但持续时间更短。
这是动量守恒在小尺度上的直接体现。

## 应用与拓展

完成 5 组以上数据后,把推力测量记录表整理成电子表格(填入推力测量记录表的格式),
作为下一节"喷管设计"的输入参考。

## 推荐互动资源

- [PhET 火箭模拟](https://phet.colorado.edu/sims/html/rocket-launch/latest/rocket-launch_all.html) -- 调节推力/质量观察轨迹

## 学习路径建议

本节产出的"推力测量数据集"将在下一节用于喷管尺寸的反推计算。
""" + "x" * 200  # 凑字数
    issues = s10_plan._self_check(plan, normal_ctx, is_capstone=False)
    assert issues == [], f"unexpected issues: {issues}"


def test_self_check_detects_missing_module_ref(normal_ctx):
    plan = "## 学习目标\n\n" + "x" * 800  # 没有 > Module: 引用块
    issues = s10_plan._self_check(plan, normal_ctx, is_capstone=False)
    assert any("Module" in it for it in issues)


def test_self_check_detects_missing_section(normal_ctx):
    plan = """> Module: P-RKT-01-M02 · core

## 学习目标
ok
## 引入
ok
## 核心概念
ok
## 深入理解
ok
## 应用与拓展
ok
""" + "x" * 800
    # 缺 ## 推荐互动资源 + ## 学习路径建议
    issues = s10_plan._self_check(plan, normal_ctx, is_capstone=False)
    assert any("推荐互动资源" in it for it in issues)
    assert any("学习路径建议" in it for it in issues)


def test_self_check_detects_forbidden_tavily_premerge(normal_ctx):
    plan = """> Module: P-RKT-01-M02 · core

## 学习目标
能够测量气球喷气的推进时间
## 引入
如何让火箭获得足够的推力升空?
## 核心概念
推力公式
## 深入理解
测量不同气球嘴口大小
## 应用与拓展
推力测量记录表
## 推荐互动资源
- foo
## 学习路径建议
推力测量数据集
## 推荐视频
- 视频1
""" + "x" * 600
    issues = s10_plan._self_check(plan, normal_ctx, is_capstone=False)
    assert any("推荐视频" in it for it in issues)


def test_self_check_detects_placeholder_in_plan(normal_ctx):
    plan = """> Module: P-RKT-01-M02 · core

## 学习目标
能够测量气球喷气的推进时间
## 引入
如何让火箭获得足够的推力升空?
[[IDEA:anim_xxx]]
## 核心概念
推力公式
## 深入理解
测量不同气球嘴口大小
## 应用与拓展
推力测量记录表
## 推荐互动资源
- foo
## 学习路径建议
推力测量数据集
""" + "x" * 600
    issues = s10_plan._self_check(plan, normal_ctx, is_capstone=False)
    assert any("[[IDEA" in it for it in issues)


def test_self_check_detects_missing_core_question(normal_ctx):
    plan = """> Module: P-RKT-01-M02 · core

## 学习目标
能够测量气球喷气的推进时间
## 引入
本节讲解光合作用的卡尔文循环。
## 核心概念
推力公式
## 深入理解
测量不同气球嘴口大小
## 应用与拓展
推力测量记录表
## 推荐互动资源
- foo
## 学习路径建议
推力测量数据集
""" + "x" * 600
    issues = s10_plan._self_check(plan, normal_ctx, is_capstone=False)
    assert any("core_question" in it for it in issues)


def test_capstone_uses_different_required_sections():
    capstone_ctx = {
        "project_name": "rocket-design",
        "category": "aerospace",
        "knowledge_level": "K3",
        "age_range": [10, 14],
        "knode": {
            "title": "完整火箭发射任务",
            "module_id": "P-RKT-01-M99",
            "module_role": "capstone",
            "core_question": "你能设计一枚成功升空的火箭吗?",
            "hands_on_components": ["发射火箭并记录"],
            "acceptance_artifacts": [{"title": "发射视频"}],
            "acceptance_standard": ["视频中火箭离地"],
        },
        "milestone": {"title": "终极挑战"},
        "sub_project": {},
    }
    # capstone 不需要"学习目标 / 引入 / 核心概念"段
    plan = """> Module: P-RKT-01-M99 · capstone

# 完整火箭发射任务

> 你能设计一枚成功升空的火箭吗?

## 项目背景
ok
## 交付物清单
| # | 交付物 | 格式 | 数量 | 验收 |
|---|---|---|---|---|
| 1 | 发射视频 | mp4 | 1 个 | 离地 |
## 制作步骤
### 步骤 1: 制作
做
## 评分标准
| 维度 | 优 | 合 | 差 |
|---|---|---|---|
| 离地 | 是 | 否 | - |
## 提交说明
打包
## 推荐互动资源
本节为大作业,无外部互动资源
""" + "x" * 600
    issues = s10_plan._self_check(plan, capstone_ctx, is_capstone=True)
    assert issues == [], f"unexpected issues: {issues}"


@pytest.mark.asyncio
async def test_run_with_real_llm_rocket_design():
    """集成测试: 真实 Kimi 生成 rocket-design knode 0 的 plan_markdown,
    验证 4 项硬规自检通过。"""
    from systemedu.core.course_factory_v3.steps import s00_boot
    em = Emitter(lambda e, d: None)
    ctx = await s00_boot.run("rocket-design", 0, user_id="t", overrides={}, em=em)
    plan = await s10_plan.run(ctx, em=em)

    # 长度合理
    assert 600 <= len(plan) <= 3500
    # 顶部 Module 引用
    assert "> Module:" in plan.split("\n", 1)[0] or "> Module:" in plan[:200]
    # 7 段齐
    for h in s10_plan.NORMAL_REQUIRED_HEADINGS:
        assert h in plan, f"missing {h} in:\n{plan[:500]}"
    # 不预合并 Tavily
    assert "## 推荐视频" not in plan
    assert "## 延伸阅读" not in plan
    # 不出现占位符
    import re
    assert not re.search(r"\[\[(?:IDEA|THEORY):", plan)
