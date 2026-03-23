"""ScientificModeler - extracts scientific constraints from a knowledge node.

Inspired by OpenMAIC's interactive-scientific-model approach:
- Distills core formulas, mechanisms, constraints, and forbidden errors
- Output is injected into the GameSpec planner prompt to ensure physical/mathematical accuracy
"""

import json
import logging

from langchain_core.messages import AIMessage, HumanMessage
from pydantic import BaseModel

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """你是一位顶级科学教育专家，专门从知识点中提炼科学建模约束。

你的任务：给定一个知识点标题和简介，输出该知识点的科学建模信息，用于指导后续的教育游戏设计。

必须输出 JSON，包含以下字段：
- core_formulas: 核心公式或数学关系（字符串列表，如 ["F=ma", "a=F/m"]）
- mechanism: 物理/化学/生物机制描述（字符串列表，如 ["力使物体加速，方向与力相同"]）
- constraints: 必须遵守的约束（字符串列表，如 ["质量m必须大于0", "加速度方向与合力方向相同"]）
- forbidden_errors: 严禁出现的常见错误/误解（字符串列表，如 ["质量为负", "力为零时加速度非零"]）

要求：
- 每个列表 1-4 条，精简准确
- 仅输出 JSON，不要其他文字
- 如果是人文/历史类知识点（无数学公式），core_formulas 可以为空列表，用 mechanism 描述因果关系

示例输出：
{
  "core_formulas": ["F=ma", "a=F/m", "m=F/a"],
  "mechanism": ["施加力时物体产生加速度，方向与合力相同", "质量越大，同等力产生的加速度越小"],
  "constraints": ["质量m必须大于0", "加速度单位为m/s²", "力与加速度方向严格对应"],
  "forbidden_errors": ["质量为负数", "力为零时加速度非零", "混淆质量与重力"]
}"""


class ScientificModel(BaseModel):
    core_formulas: list[str] = []
    mechanism: list[str] = []
    constraints: list[str] = []
    forbidden_errors: list[str] = []

    def to_prompt_section(self) -> str:
        """Format the model as a constraint block for injection into planner prompts."""
        lines = ["【科学建模约束（必须遵守）】"]
        if self.core_formulas:
            lines.append(f"- 核心公式：{', '.join(self.core_formulas)}")
        if self.mechanism:
            for m in self.mechanism:
                lines.append(f"- 物理机制：{m}")
        if self.constraints:
            for c in self.constraints:
                lines.append(f"- 必须遵守的约束：{c}")
        if self.forbidden_errors:
            for f in self.forbidden_errors:
                lines.append(f"- 严禁出现的错误：{f}")
        return "\n".join(lines)


class ScientificModeler:
    """Extracts scientific constraints from a knowledge node via LLM."""

    def __init__(self, llm):
        self._llm = llm

    async def model(
        self,
        node_title: str,
        node_summary: str,
        subject: str = "",
    ) -> ScientificModel | None:
        """Extract scientific constraints for the given knowledge node.

        Returns a ScientificModel, or None on failure (graceful skip).
        """
        user_content = f"知识点：{node_title}"
        if node_summary:
            user_content += f"\n简介：{node_summary}"
        if subject:
            user_content += f"\n学科：{subject}"

        try:
            from deepagents import create_deep_agent

            agent = create_deep_agent(
                model=self._llm,
                tools=[],
                system_prompt=_SYSTEM_PROMPT,
            )
            result = await agent.ainvoke(
                {"messages": [HumanMessage(content=user_content)]}
            )

            raw = ""
            for msg in reversed(result["messages"]):
                if isinstance(msg, AIMessage) and msg.content:
                    raw = msg.content
                    break

            raw = raw.strip()
            # Strip markdown fences if present
            if raw.startswith("```"):
                lines = raw.split("\n")
                raw = "\n".join(
                    lines[1:-1] if lines[-1].strip() == "```" else lines[1:]
                )
                raw = raw.strip()

            data = json.loads(raw)
            model = ScientificModel(**data)
            logger.info(
                f"ScientificModeler: built model for '{node_title}' "
                f"({len(model.core_formulas)} formulas, {len(model.constraints)} constraints)"
            )
            return model

        except Exception:
            logger.warning(
                f"ScientificModeler failed for '{node_title}', skipping",
                exc_info=True,
            )
            return None
