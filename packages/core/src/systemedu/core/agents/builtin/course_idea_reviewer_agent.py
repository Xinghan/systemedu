"""CourseIdeaReviewerAgent — 审核并质疑 CourseIdeaAgent 产出的每个 idea。

该 agent 对每个 idea 进行评估，判断是否值得生成富媒体内容。
审核不通过的 idea 将被标记为 rejected，不会进入后续生成流程。
"""

from __future__ import annotations

import json
import logging

logger = logging.getLogger(__name__)

IDEA_REVIEW_PROMPT = """你是一位严格的教育内容审核专家。请对以下富媒体内容创意进行审核和质疑。

知识节点：{node_title}
学习计划摘要：{plan_summary}

待审核的创意：
- 创意 ID: {idea_id}
- 类型: {mode}
- 主题: {topic}
- 上下文摘要: {context_summary}
- 选择理由: {mode_reason}

请从以下维度进行严格评估：

1. **教学价值** (0-10分)
   - 这个创意是否真正有助于学生理解核心概念？
   - 是否比纯文字讲解更有价值？

2. **可行性** (0-10分)
   - 以当前技术能力（AI生成），能否高质量地完成？
   - 是否存在难以实现的部分？

3. **适合度** (0-10分)
   - 所选的媒体类型（animation/game/story/exercise）是否最适合这个知识点？
   - 是否有更好的替代方案？

4. **复杂度** (0-10分，分数越低表示越复杂难做)
   - 是否在合理的时间/资源范围内可以完成？

审核规则：
- 总分 >= 28 且 教学价值 >= 7 且 可行性 >= 6：通过 (approved)
- 总分 < 24 或 教学价值 < 6 或 可行性 < 5：拒绝 (rejected)
- 其他情况：需要修改 (needs_revision)

请输出 JSON 格式：
{{
  "decision": "approved|rejected|needs_revision",
  "total_score": 总分,
  "scores": {{
    "teaching_value": 教学价值分数,
    "feasibility": 可行性分数,
    "appropriateness": 适合度分数,
    "complexity": 复杂度分数
  }},
  "reasoning": "详细说明审核理由，指出问题和风险点（100-200字）",
  "suggestions": "如果拒绝或需要修改，给出具体建议（如有）"
}}

只输出 JSON，不要其他内容。"""


class CourseIdeaReviewerAgent:
    """审核 CourseIdeaAgent 产出的每个 idea，决定是否进入生成阶段。"""

    def __init__(self, llm):
        self.llm = llm

    async def review(
        self,
        idea: dict,
        node_title: str,
        plan_summary: str,
    ) -> dict:
        """审核单个 idea，返回审核结果。

        Returns:
            {
                "decision": "approved" | "rejected" | "needs_revision",
                "total_score": int,
                "scores": dict,
                "reasoning": str,
                "suggestions": str,
            }
        """
        import asyncio
        from langchain_core.messages import HumanMessage

        prompt = IDEA_REVIEW_PROMPT.format(
            node_title=node_title,
            plan_summary=plan_summary[:500] if plan_summary else "",
            idea_id=idea.get("idea_id", ""),
            mode=idea.get("mode", ""),
            topic=idea.get("topic", ""),
            context_summary=idea.get("context_summary", ""),
            mode_reason=idea.get("mode_reason", ""),
        )

        try:
            response = await asyncio.to_thread(
                self.llm.invoke, [HumanMessage(content=prompt)]
            )
            text = response.content.strip()

            # Strip markdown code fences if present
            if text.startswith("```"):
                lines = text.split("\n")
                text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
                text = text.strip()

            result = json.loads(text)

            # Validate and normalize result
            if not isinstance(result, dict):
                logger.warning("CourseIdeaReviewerAgent: response is not a dict, auto-approving")
                return self._auto_approve(idea)

            decision = result.get("decision", "").lower()
            if decision not in {"approved", "rejected", "needs_revision"}:
                # Fallback to score-based decision
                total_score = result.get("total_score", 0)
                scores = result.get("scores", {})
                teaching_value = scores.get("teaching_value", 0)
                feasibility = scores.get("feasibility", 0)

                if total_score >= 28 and teaching_value >= 7 and feasibility >= 6:
                    decision = "approved"
                elif total_score < 24 or teaching_value < 6 or feasibility < 5:
                    decision = "rejected"
                else:
                    decision = "needs_revision"
                result["decision"] = decision

            logger.info(
                "CourseIdeaReviewerAgent: idea '%s' (mode=%s) -> %s (score=%s)",
                idea.get("topic", ""),
                idea.get("mode", ""),
                decision,
                result.get("total_score", "N/A"),
            )
            return result

        except (json.JSONDecodeError, TypeError):
            logger.exception("CourseIdeaReviewerAgent: JSON parse error, auto-approving")
            return self._auto_approve(idea)
        except Exception:
            logger.exception("CourseIdeaReviewerAgent: unexpected error, auto-approving")
            return self._auto_approve(idea)

    async def review_all(
        self,
        ideas: list[dict],
        node_title: str,
        plan_summary: str,
    ) -> tuple[list[dict], list[dict]]:
        """批量审核所有 ideas，返回 (approved_ideas, rejected_ideas)。

        Args:
            ideas: CourseIdeaAgent 产出的 ideas 列表
            node_title: 知识节点标题
            plan_summary: 学习计划摘要

        Returns:
            (approved_ideas, rejected_ideas)
        """
        import asyncio

        approved = []
        rejected = []

        # Parallel review of all ideas
        review_tasks = [
            self.review(idea, node_title, plan_summary) for idea in ideas
        ]
        review_results = await asyncio.gather(*review_tasks)

        for idea, review_result in zip(ideas, review_results):
            idea_with_review = dict(idea)
            idea_with_review["review"] = review_result

            decision = review_result.get("decision", "approved")
            if decision == "approved":
                approved.append(idea_with_review)
            else:
                rejected.append(idea_with_review)
                logger.info(
                    "CourseIdeaReviewerAgent: rejected idea '%s' - %s",
                    idea.get("topic", ""),
                    review_result.get("reasoning", "")[:100],
                )

        logger.info(
            "CourseIdeaReviewerAgent: %d approved, %d rejected out of %d ideas",
            len(approved),
            len(rejected),
            len(ideas),
        )
        return approved, rejected

    def _auto_approve(self, idea: dict) -> dict:
        """当审核出错时，自动通过（保守策略）。"""
        return {
            "decision": "approved",
            "total_score": 30,
            "scores": {
                "teaching_value": 8,
                "feasibility": 8,
                "appropriateness": 7,
                "complexity": 7,
            },
            "reasoning": "审核过程出错，采用保守策略自动通过",
            "suggestions": "",
        }
