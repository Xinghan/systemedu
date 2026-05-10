"""ScientificModelAgent — extracts domain constraints before media generation.

For physics/chemistry/math/biology nodes, generates a structured "scientific model"
that captures core formulas, mechanisms, constraints, and common misconceptions.
This is injected into AnimationGenAgent's prompt to ensure scientific accuracy.

Inspired by OpenMAIC's interactive-scientific-model pre-step.
"""

from __future__ import annotations

import asyncio
import json
import logging

logger = logging.getLogger(__name__)

# Categories that benefit from scientific modeling
SCIENCE_CATEGORIES = frozenset({
    "physics", "chemistry", "math", "biology", "biotech",
    "aerospace", "energy", "robotics", "cs",
})

_SCIENTIFIC_MODEL_PROMPT = """你是一位严谨的理科教育专家。请为以下知识点提取关键的科学约束，
用于指导后续的教育动画/游戏生成，确保内容科学准确。

知识点：{node_title}
简介：{node_summary}
媒体类型：{mode}（animation=动画演示 / game=模拟实验）

请输出一个科学模型 JSON，格式如下（不要 markdown 代码块）：
{{
  "core_formulas": [
    "关键公式1（如 F = ma，用 LaTeX：F = ma 或 \\\\(F=ma\\\\)）",
    "关键公式2"
  ],
  "key_mechanisms": [
    "核心机制/过程描述1（20-40字）",
    "核心机制/过程描述2"
  ],
  "visual_constraints": [
    "视觉呈现必须满足的约束1（如：力的方向必须与运动方向相同）",
    "视觉约束2"
  ],
  "common_misconceptions": [
    "学生常犯的错误认知1（动画/游戏必须避免强化此误区）",
    "常见误区2"
  ],
  "forbidden_errors": [
    "绝对不能出现的科学错误1（如：速度快时质量变大）",
    "禁止错误2"
  ],
  "suggested_variables": [
    {{
      "name": "变量名（中文）",
      "symbol": "符号（如 F、v、T）",
      "unit": "单位（如 N、m/s、K）",
      "range_hint": "合理范围提示（如 0-100 N）"
    }}
  ]
}}

要求：
- core_formulas：列出 1-3 个最关键的公式，用 LaTeX 语法书写（如 \\\\(E = mc^2\\\\)）
- key_mechanisms：2-3 条，描述知识点的核心工作原理
- visual_constraints：2-3 条，动画/游戏在视觉上必须正确体现的规律
- common_misconceptions：1-3 条，常见的错误理解，内容生成时应主动纠正而非强化
- forbidden_errors：1-2 条，最严重的科学错误（如颠倒因果关系、错误的物理量关系）
- suggested_variables：仅 game/simulation 模式需要，列出 2-3 个适合当滑块参数的变量
- 全部用中文（symbol、unit 除外）
- 直接输出 JSON，不要其他文字
"""

_SCIENCE_MODEL_INJECT_BLOCK = """
【科学准确性约束（必须严格遵守）】
以下约束来自领域专家审核，违反任何一条将导致内容被拒绝：

核心公式（必须正确体现）：
{core_formulas}

关键机制（动画/游戏逻辑必须符合）：
{key_mechanisms}

视觉约束（画面呈现必须满足）：
{visual_constraints}

禁止强化的错误认知（common misconceptions，不得在内容中出现）：
{common_misconceptions}

绝对禁止的科学错误：
{forbidden_errors}
"""


class ScientificModelAgent:
    """Pre-generation agent that extracts scientific constraints for a knowledge node.

    Call extract() before AnimationGenAgent or GameGenAgent to get a constraint
    block that can be injected into generation prompts.
    """

    def __init__(self, llm):
        self.llm = llm

    @staticmethod
    def should_run(project_category: str, node_title: str, node_summary: str) -> bool:
        """Return True if scientific modeling is warranted for this node."""
        if project_category.lower() in SCIENCE_CATEGORIES:
            return True
        # Keyword-based detection for uncategorized projects
        science_keywords = (
            "力", "速度", "加速度", "质量", "能量", "功", "压强", "温度", "电压", "电流",
            "化学", "反应", "分子", "原子", "细胞", "基因", "光合", "呼吸",
            "函数", "方程", "积分", "导数", "向量", "矩阵", "概率",
            "重力", "磁场", "电场", "波", "频率", "振动",
        )
        combined = f"{node_title} {node_summary}"
        return any(kw in combined for kw in science_keywords)

    async def extract(
        self,
        node_title: str,
        node_summary: str,
        mode: str = "animation",
    ) -> dict | None:
        """Extract scientific model for a node.

        Returns a dict with keys: core_formulas, key_mechanisms, visual_constraints,
        common_misconceptions, forbidden_errors, suggested_variables.
        Returns None if extraction fails (non-fatal — generation should proceed without it).
        """
        from langchain_core.messages import HumanMessage

        prompt = _SCIENTIFIC_MODEL_PROMPT.format(
            node_title=node_title,
            node_summary=node_summary[:400],
            mode=mode,
        )

        try:
            response = await asyncio.to_thread(
                self.llm.invoke, [HumanMessage(content=prompt)]
            )
            text = response.content.strip()
            if text.startswith("```"):
                lines = text.split("\n")
                text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:]).strip()
            model = json.loads(text)
            if not isinstance(model, dict):
                return None
            logger.info(
                "ScientificModelAgent: extracted model for '%s' (%d formulas, %d constraints)",
                node_title,
                len(model.get("core_formulas", [])),
                len(model.get("visual_constraints", [])),
            )
            return model
        except Exception:
            logger.warning(
                "ScientificModelAgent: extraction failed for '%s' (non-fatal)",
                node_title,
                exc_info=True,
            )
            return None

    @staticmethod
    def build_prompt_block(model: dict) -> str:
        """Build a prompt injection block from a scientific model dict."""
        if not model:
            return ""

        def _fmt_list(items: list) -> str:
            if not items:
                return "（无）"
            return "\n".join(f"  - {item}" for item in items)

        return _SCIENCE_MODEL_INJECT_BLOCK.format(
            core_formulas=_fmt_list(model.get("core_formulas", [])),
            key_mechanisms=_fmt_list(model.get("key_mechanisms", [])),
            visual_constraints=_fmt_list(model.get("visual_constraints", [])),
            common_misconceptions=_fmt_list(model.get("common_misconceptions", [])),
            forbidden_errors=_fmt_list(model.get("forbidden_errors", [])),
        )
