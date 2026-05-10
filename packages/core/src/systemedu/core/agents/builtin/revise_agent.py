"""ReviseAgent — automatically revises detail plans based on DebateAgent's feedback.

Takes a detail plan and debate feedback, uses LLM to revise the plan.
"""

import json
import logging

logger = logging.getLogger(__name__)

REVISION_PROMPT = """你是一位教育内容优化专家。请根据辩论评估的反馈，修改以下详细创意方案。

原始详细方案：
{original_plan_json}

辩论反馈：
- 裁决：{verdict}
- 置信度：{confidence}
- 理由：{reasoning}
- 关键质疑点：{key_concerns}
- 修改建议：{suggestions}

反方观点：
- 教学价值质疑：{opponent_teaching_value}
- 可行性风险：{opponent_feasibility_risks}
- 内容缺陷：{opponent_content_defects}
- 替代方案建议：{opponent_alternatives}

你的任务：
1. 仔细分析辩论反馈中的问题和建议
2. 修改原始方案，解决关键质疑点
3. 保持方案的核心教学目标不变
4. 简化复杂部分，增强可行性
5. 确保修改后的方案更加合理、可实现

请输出修改后的完整 JSON 方案，格式与原始方案相同。只输出 JSON，不要其他说明。

注意：
- 保持原有字段结构
- 修改内容以解决质疑点
- 可以简化过于复杂的交互
- 确保修改后的方案可行
"""


class ReviseAgent:
    """Revises detail plans based on debate feedback."""

    def __init__(self, llm):
        self.llm = llm

    async def revise(self, idea: dict) -> dict:
        """Revise a detail plan based on debate feedback.

        Args:
            idea: The idea with detail_plan and debate feedback.

        Returns:
            Revised idea with updated detail_plan.
        """
        import asyncio
        from langchain_core.messages import HumanMessage

        detail_plan = idea.get("detail_plan", {})
        debate = idea.get("debate", {})
        debate_debate = debate.get("debate", {})
        opponent = debate_debate.get("opponent", {})

        prompt = REVISION_PROMPT.format(
            original_plan_json=json.dumps(detail_plan, ensure_ascii=False, indent=2),
            verdict=debate.get("verdict", "revise"),
            confidence=debate.get("confidence", 50),
            reasoning=debate.get("reasoning", ""),
            key_concerns=json.dumps(debate.get("key_concerns", []), ensure_ascii=False),
            suggestions=debate.get("suggestions", ""),
            opponent_teaching_value=opponent.get("teaching_value", ""),
            opponent_feasibility_risks=opponent.get("feasibility_risks", ""),
            opponent_content_defects=opponent.get("content_defects", ""),
            opponent_alternatives=opponent.get("alternatives", ""),
        )

        try:
            response = await asyncio.to_thread(
                self.llm.invoke, [HumanMessage(content=prompt)]
            )
            text = response.content.strip()

            # Strip markdown code fences if present
            if text.startswith("```"):
                lines = text.split("\n")
                if lines[0].startswith("```json"):
                    lines = lines[1:]
                elif lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].strip() == "```":
                    lines = lines[:-1]
                text = "\n".join(lines).strip()

            revised_plan = json.loads(text)

            # Create revised idea
            revised_idea = dict(idea)
            revised_idea["detail_plan"] = revised_plan
            revised_idea["revised"] = True
            revised_idea["original_plan"] = detail_plan

            logger.info(
                "ReviseAgent: revised idea '%s' (mode=%s)",
                idea.get("topic", ""),
                idea.get("mode", ""),
            )
            return revised_idea

        except (json.JSONDecodeError, TypeError) as e:
            logger.warning(
                "ReviseAgent: JSON parse error for '%s', using original plan: %s",
                idea.get("topic", ""),
                e,
            )
            # Return original idea if revision fails
            return idea
        except Exception as e:
            logger.exception(
                "ReviseAgent: unexpected error for '%s', using original plan",
                idea.get("topic", ""),
            )
            return idea

    async def revise_all(self, ideas: list[dict]) -> list[dict]:
        """Revise all ideas that need revision.

        Args:
            ideas: List of ideas with debate feedback marked as "revise".

        Returns:
            List of revised ideas.
        """
        import asyncio

        revised_ideas = []
        for idea in ideas:
            revised = await self.revise(idea)
            revised_ideas.append(revised)

        logger.info(
            "ReviseAgent: revised %d ideas",
            len(revised_ideas),
        )
        return revised_ideas
