"""AnimationBackendRouterAgent - route animation generation to the right backend."""

from __future__ import annotations

import json
import logging
import re

logger = logging.getLogger(__name__)

ROUTER_PROMPT = """你是一位动画技术路由器。请判断这个教学动画更适合哪种生成后端。

可选 backend：
- manim: 适合数学公式、几何证明、函数图像、物理公式推导、带清晰数学符号的概念展示
- html_svg: 适合一般流程动画、生活类比、装置演示、非公式型概念可视化

分类原则：
1. 只有在“公式/定理/坐标/几何/函数/明确数学推导”很强时才选择 manim
2. 如果只是物理现象演示，但不是公式推导，优先 html_svg
3. 如果不确定，选择 html_svg

输出严格 JSON：
{{
  "backend": "manim|html_svg",
  "subject_hint": "math_formula|physics_formula|general_visual",
  "reason": "20字以内原因",
  "confidence": 0.0
}}

材料：
node_title={node_title}
node_summary={node_summary}
project_category={project_category}
detail_plan={detail_plan_json}
"""

_FORMULA_PATTERN = re.compile(r"[=+\-*/^]|√|∑|∫|π|θ|λ|Δ")
_MATH_KEYWORDS = {
    "公式", "定理", "方程", "函数", "坐标", "几何", "三角形", "圆", "向量",
    "矩阵", "概率", "导数", "积分", "数列", "勾股", "相似", "面积", "斜率",
}
_PHYSICS_FORMULA_KEYWORDS = {
    "f=ma", "v=", "a=", "欧姆", "电压", "电流", "电阻", "功率", "动能",
    "势能", "加速度", "速度公式", "位移公式", "透镜公式", "折射率", "波长",
}


class AnimationBackendRouterAgent:
    """Route animations to Manim or HTML/SVG backends."""

    def __init__(self, llm=None):
        self.llm = llm

    # TEMP: Manim disabled — always route to html_svg until Manim quality is fixed
    _MANIM_DISABLED = True

    async def route(
        self,
        *,
        node_title: str,
        node_summary: str = "",
        project_category: str = "",
        detail_plan: dict | None = None,
    ) -> dict:
        """Return backend routing decision."""
        if self._MANIM_DISABLED:
            logger.info(
                "AnimationBackendRouterAgent: Manim disabled, forcing html_svg for '%s'",
                node_title,
            )
            return {
                "backend": "html_svg",
                "subject_hint": "general_visual",
                "reason": "Manim暂时禁用，走HTML/SVG",
                "confidence": 1.0,
            }

        heuristic = self._heuristic_route(
            node_title=node_title,
            node_summary=node_summary,
            project_category=project_category,
            detail_plan=detail_plan or {},
        )
        if heuristic["backend"] == "manim":
            return heuristic

        if self.llm is None:
            return heuristic

        try:
            from langchain_core.messages import HumanMessage
            import asyncio

            prompt = ROUTER_PROMPT.format(
                node_title=node_title,
                node_summary=node_summary,
                project_category=project_category,
                detail_plan_json=json.dumps(detail_plan or {}, ensure_ascii=False)[:5000],
            )
            response = await asyncio.to_thread(self.llm.invoke, [HumanMessage(content=prompt)])
            text = response.content.strip()
            if text.startswith("```"):
                lines = text.split("\n")
                text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:]).strip()
            parsed = json.loads(text)
            backend = parsed.get("backend")
            if backend not in {"manim", "html_svg"}:
                return heuristic
            return {
                "backend": backend,
                "subject_hint": parsed.get("subject_hint", heuristic["subject_hint"]),
                "reason": parsed.get("reason", heuristic["reason"]),
                "confidence": float(parsed.get("confidence", heuristic["confidence"])),
            }
        except Exception:
            logger.warning("AnimationBackendRouterAgent: LLM route failed, using heuristic", exc_info=True)
            return heuristic

    def _heuristic_route(
        self,
        *,
        node_title: str,
        node_summary: str = "",
        project_category: str = "",
        detail_plan: dict | None = None,
    ) -> dict:
        """Heuristic fallback route."""
        text_parts = [
            node_title or "",
            node_summary or "",
            str(project_category or ""),
            json.dumps(detail_plan or {}, ensure_ascii=False),
        ]
        haystack = " ".join(text_parts)
        haystack_lower = haystack.lower()

        math_hits = sum(1 for kw in _MATH_KEYWORDS if kw in haystack)
        physics_formula_hits = sum(1 for kw in _PHYSICS_FORMULA_KEYWORDS if kw in haystack_lower or kw in haystack)
        formula_like = bool(_FORMULA_PATTERN.search(haystack))
        is_math_project = "math" in str(project_category).lower() or "数学" in haystack
        is_physics_project = "physics" in str(project_category).lower() or "物理" in haystack

        if math_hits >= 2 or (is_math_project and (math_hits >= 1 or formula_like)):
            return {
                "backend": "manim",
                "subject_hint": "math_formula",
                "reason": "数学公式和图形更适合Manim",
                "confidence": 0.86,
            }

        if is_physics_project and (physics_formula_hits >= 1 or formula_like) and ("推导" in haystack or "公式" in haystack):
            return {
                "backend": "manim",
                "subject_hint": "physics_formula",
                "reason": "物理公式推导更适合Manim",
                "confidence": 0.78,
            }

        return {
            "backend": "html_svg",
            "subject_hint": "general_visual",
            "reason": "一般可视化继续走HTML/SVG",
            "confidence": 0.72,
        }
