"""DebateAgent — debates and evaluates CourseIdeaAgent's creative ideas.

Uses a debate format to critically evaluate each idea's quality and feasibility
before committing to generation resources.
"""

import json
import logging

logger = logging.getLogger(__name__)

DEBATE_PROMPT = """你是一位批判性教育内容评估专家。请对以下详细创意方案进行一场"内部辩论"，
从正反两个角度评估这个方案的质量、可行性和教学价值。

知识节点：{node_title}
学习计划摘要：{plan_summary}

待评估的详细方案：
- 创意 ID: {idea_id}
- 类型: {mode}
- 主题: {topic}
- 上下文摘要: {context_summary}
- 详细方案内容：
{detail_plan_json}

请进行一场结构化辩论：

【正方观点 - 支持这个方案】
1. 教学价值：为什么这个详细方案能有效帮助学生理解概念？
2. 可行性：为什么这个方案的技术实现是可行的？
3. 内容质量：方案的内容结构、交互设计是否合理？

【反方观点 - 质疑这个方案】
1. 教学价值质疑：方案内容可能存在的教学盲点或误导？
2. 可行性风险：技术实现的具体困难或资源消耗过大？
3. 内容缺陷：方案结构是否有漏洞、交互是否过于复杂？
4. 替代建议：是否有更简单有效的方式达到同样的教学目标？

【关键质疑点】
请列出 2-3 个最关键的问题，如果这些问题无法解决，应该否决这个方案。

【最终裁决】
基于以上辩论，给出裁决：
- verdict: "approve" | "reject" | "revise"
  - approve: 方案合理可行，可以进入生成阶段
  - reject: 质疑有理，方案存在根本性问题，**不应进行生成**
  - revise: 方案有潜力但需要修改
- confidence: 0-100 (置信度)
- reasoning: 简要说明裁决理由（50-100字）
- key_concerns: 如果裁决是 reject，列出导致否决的关键问题
- suggestions: 如果裁决是 revise，给出具体修改建议

注意：如果方案存在根本性问题（如教学逻辑错误、技术不可行、内容与目标不符），
请果断选择 "reject"，避免浪费生成资源。

请输出 JSON 格式：
{{
  "debate": {{
    "supporter": {{
      "teaching_value": "正方教学价值观点",
      "feasibility": "正方可行性观点",
      "content_quality": "正方内容质量观点"
    }},
    "opponent": {{
      "teaching_value": "反方教学价值质疑",
      "feasibility_risks": "反方可行性风险",
      "content_defects": "反方内容缺陷",
      "alternatives": "反方替代方案建议"
    }},
    "key_concerns": ["质疑点1", "质疑点2", "质疑点3"]
  }},
  "verdict": "approve|reject|revise",
  "confidence": 85,
  "reasoning": "裁决理由",
  "key_concerns": ["关键问题1", "关键问题2"],
  "suggestions": "修改建议（如需要）"
}}

只输出 JSON，不要其他内容。"""


class DebateAgent:
    """Debates and evaluates CourseIdeaAgent's creative ideas.
    
    Acts as a critical evaluation layer before committing to content generation.
    Uses internal debate format to assess quality from multiple perspectives.
    """

    def __init__(self, llm):
        self.llm = llm

    async def evaluate(self, idea: dict, node_title: str, plan_summary: str) -> dict:
        """Evaluate a single idea's detailed plan through debate.

        Args:
            idea: The idea with detail_plan from CourseIdeaDetailAgent.
            node_title: The knowledge node title.
            plan_summary: Summary of the learning plan.

        Returns:
            Evaluation result with verdict and reasoning.
        """
        import asyncio
        import json
        from langchain_core.messages import HumanMessage

        detail_plan = idea.get("detail_plan", {})
        
        prompt = DEBATE_PROMPT.format(
            node_title=node_title,
            plan_summary=plan_summary[:500] if plan_summary else "",
            idea_id=idea.get("idea_id", ""),
            mode=idea.get("mode", ""),
            topic=idea.get("topic", ""),
            context_summary=idea.get("context_summary", ""),
            detail_plan_json=json.dumps(detail_plan, ensure_ascii=False, indent=2)[:2000],
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

            # Normalize verdict
            verdict = result.get("verdict", "").lower()
            if verdict not in {"approve", "reject", "revise"}:
                # Default based on confidence
                confidence = result.get("confidence", 50)
                if confidence >= 70:
                    verdict = "approve"
                elif confidence >= 40:
                    verdict = "revise"
                else:
                    verdict = "reject"
                result["verdict"] = verdict

            logger.info(
                "DebateAgent: idea '%s' (mode=%s) -> %s (confidence=%s)",
                idea.get("topic", ""),
                idea.get("mode", ""),
                verdict,
                result.get("confidence", "N/A"),
            )
            return result

        except (json.JSONDecodeError, TypeError):
            logger.exception("DebateAgent: JSON parse error, auto-approving")
            return self._auto_approve()
        except Exception:
            logger.exception("DebateAgent: unexpected error, auto-approving")
            return self._auto_approve()

    async def evaluate_all(
        self,
        ideas: list[dict],
        node_title: str,
        plan_summary: str,
    ) -> tuple[list[dict], list[dict], list[dict]]:
        """Evaluate all ideas and categorize them.

        Returns:
            (approved, rejected, needs_revision) - three lists of ideas with debate results.
        """
        import asyncio

        approved = []
        rejected = []
        needs_revision = []

        # Sequential evaluation to avoid rate limits
        for idea in ideas:
            debate_result = await self.evaluate(idea, node_title, plan_summary)
            
            idea_with_debate = dict(idea)
            idea_with_debate["debate"] = debate_result

            verdict = debate_result.get("verdict", "approve")
            if verdict == "approve":
                approved.append(idea_with_debate)
            elif verdict == "reject":
                rejected.append(idea_with_debate)
                logger.info(
                    "DebateAgent: rejected idea '%s' - %s",
                    idea.get("topic", ""),
                    debate_result.get("reasoning", "")[:100],
                )
            else:  # revise
                needs_revision.append(idea_with_debate)

        logger.info(
            "DebateAgent: %d approved, %d rejected, %d needs revision out of %d ideas",
            len(approved),
            len(rejected),
            len(needs_revision),
            len(ideas),
        )
        return approved, rejected, needs_revision

    def _auto_approve(self) -> dict:
        """Auto-approve when debate fails."""
        return {
            "debate": {
                "supporter": {
                    "teaching_value": "辩论过程出错，采用保守策略",
                    "feasibility": "自动通过以确保流程继续",
                    "appropriateness": "保持原有创意",
                },
                "opponent": {
                    "teaching_value": "",
                    "feasibility_risks": "",
                    "alternatives": "",
                },
            },
            "verdict": "approve",
            "confidence": 60,
            "reasoning": "辩论评估过程出错，采用保守策略自动通过",
            "suggestions": "",
        }
