"""GameGenAgent — generates interactive game HTML directly via LLM.

Simplified architecture: receives detail_plan, directly prompts LLM to generate HTML.
No complex pipelines, no fallbacks.
"""

import logging

from systemedu.agents.builtin.animation_gen_agent import _build_style_guide
from systemedu.agents.builtin.media_art_direction import inject_katex_if_needed

logger = logging.getLogger(__name__)

GAME_GENERATION_PROMPT = """你是一位教育游戏开发专家。请根据以下详细创意方案，生成一个互动教育游戏的完整 HTML 代码。

知识点：{topic}
上下文：{context_summary}

详细创意方案：
{detail_plan_json}

【用户操作说明 -- 必须严格实现】
以下是面向学生的操作说明，你生成的游戏必须完全匹配这些描述。
学生能看到的每一个按钮、控件、交互元素，都必须按说明中的描述工作：
{user_guide_text}

严格检查清单：
- 说明中列出的每个控件必须存在且可操作
- 说明中描述的操作步骤必须能顺序完成
- 通关条件必须与说明一致
- 不要添加说明中没有提到的额外复杂功能

【视觉风格指南 -- 必须遵循】
{style_guide}

UI组件风格（根据上方配色自适应）：
- 按钮：主色背景或主色边框，hover 时发光阴影
- 卡片：surface 色背景 + 细边框
- 滑块：主色轨道，带发光效果
- 进度条：主色到辅助色渐变填充

游戏机制参考：
- simulation: 参数调节模拟，滑块控制变量观察结果
- drag_sort: 拖拽分类，拖拽时有视觉反馈
- match_pairs: 配对游戏，匹配成功时动画反馈
- timeline_order: 时间线排序，正确位置高亮提示
- boss_quiz: 测验挑战，风格化选项卡片

【物理常识与视觉方向 -- 必须遵守】
这是面向学生的教育内容，任何违反物理常识的画面都会严重误导学生。
1. 重力方向：物体自然下落，向画面下方。陨石坑、水面、地面必须在画面下方或底部。
   天空、太阳、星空在画面上方。树木从地面向上生长。雨和雪从上往下落。
2. SVG/Canvas 坐标系：y 轴向下递增。y=0 是顶部（天空），y=max 是底部（地面）。
   如果要画一个从天上落下的物体，y 值应从小到大变化。
3. 方向性：箭头指向运动方向。河流从高处流向低处。火焰和烟雾向上飘。
   电流从正极到负极（传统方向）。光从光源向外发散。
4. 比例关系：远处物体小，近处物体大。太阳比地球大。细胞比人小。
   原子比分子小。确保标注和比例尺与实际科学一致。
5. 颜色常识：天空为蓝色系，植物为绿色系，岩浆/火为红橙色系，
   水为蓝色透明系，土壤为棕色系。不要用反直觉的颜色。

请生成一个完整的、独立的 HTML 文件，包含：
1. 互动游戏玩法（符合详细方案中的 game_mechanic）
2. 符合上述风格指南的 UI
3. 与知识点紧密结合的游戏机制
4. 即时反馈和得分系统
5. 游戏结束时的知识总结
6. 【内嵌操作说明面板】在游戏区域上方放置一个简洁的说明区域，内容来自上方的「用户操作说明」。
   要求：默认展开，用户可以点击折叠。使用列表形式展示目标、操作步骤、通关条件。
   面板标题为「游戏指南」，风格与页面整体一致。不要用大段文字，用短句 + 图标。

技术要求：
- 严格遵循上方风格指南的配色方案
- 响应式布局，整个页面必须在 100vh 内完成展示，禁止出现垂直滚动条
- body 设置 overflow: hidden; height: 100vh; 所有内容必须在一屏内布局完成
- 单文件 HTML，可使用 Google Fonts CDN
- 发光效果和动画

【输出前自检 -- 在脑中逐条检查，不要输出检查过程】
- 重力方向是否正确？物体是否向下落而非向上飞？
- 地面/水面是否在画面底部？天空是否在上方？
- 所有箭头方向是否符合物理规律？
- 颜色是否符合常识（水是蓝的、火是红的、植物是绿的）？
- 游戏中每个按钮/滑块是否绑定了事件处理函数并能正常响应？
- 拖拽功能是否正确实现了 mousedown/mousemove/mouseup 事件链？
- 得分和通关判定逻辑是否能正确触发？

请直接输出完整的 HTML 代码（包含 <!DOCTYPE html> 到 </html>），不要有任何其他说明文字。
"""


class GameGenAgent:
    """Generates interactive game HTML directly via LLM.

    Simplified architecture: no complex pipelines, no fallbacks.
    Receives detail_plan, directly prompts LLM to generate HTML.
    """

    def __init__(self, llm):
        self.llm = llm

    @staticmethod
    def _format_game_user_guide(detail_plan: dict) -> str:
        """Format user_guide from detail_plan into readable text for prompt injection."""
        guide = detail_plan.get("user_guide")
        if not isinstance(guide, dict):
            return "(无用户操作说明)"

        parts: list[str] = []
        goal = guide.get("goal", "")
        if goal:
            parts.append(f"- 目标: {goal}")
        controls = guide.get("controls", [])
        if isinstance(controls, list) and controls:
            parts.append("- 操作说明:")
            for ctrl in controls:
                if isinstance(ctrl, dict):
                    elem = ctrl.get("element", "")
                    action = ctrl.get("action", "")
                    parts.append(f"  * [{elem}] {action}")
        steps = guide.get("steps", [])
        if isinstance(steps, list) and steps:
            parts.append("- 操作步骤:")
            for i, step in enumerate(steps, 1):
                if isinstance(step, str):
                    parts.append(f"  {i}. {step}")
        win_cond = guide.get("win_condition", "")
        if win_cond:
            parts.append(f"- 通关条件: {win_cond}")
        tips = guide.get("tips", "")
        if tips:
            parts.append(f"- 提示: {tips}")
        return "\n".join(parts) if parts else "(无用户操作说明)"

    async def generate(
        self,
        detail_plan: dict,
        node_title: str,
        node_summary: str,
        difficulty: int,
    ) -> str:
        """Generate game HTML from detail_plan.

        Args:
            detail_plan: The detailed game plan from CourseIdeaDetailPlannerAgent.
            node_title: The knowledge node title.
            node_summary: The node summary.
            difficulty: The difficulty level.

        Returns:
            HTML string, or empty string on failure.
        """
        import asyncio
        import json
        from langchain_core.messages import HumanMessage

        topic = detail_plan.get("topic", node_title)
        context_summary = detail_plan.get("context_summary", node_summary)

        user_guide_text = self._format_game_user_guide(detail_plan)
        style_key = detail_plan.get("style_key", "neural_circuit")
        style_guide = _build_style_guide(style_key)

        prompt = GAME_GENERATION_PROMPT.format(
            topic=topic,
            context_summary=context_summary[:500] if context_summary else "",
            detail_plan_json=json.dumps(detail_plan, ensure_ascii=False, indent=2),
            user_guide_text=user_guide_text,
            style_guide=style_guide,
        )

        try:
            response = await asyncio.to_thread(
                self.llm.invoke, [HumanMessage(content=prompt)]
            )
            html = response.content.strip()

            # Strip markdown code fences if present
            if html.startswith("```"):
                lines = html.split("\n")
                if lines[0].startswith("```html"):
                    lines = lines[1:]
                elif lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].strip() == "```":
                    lines = lines[:-1]
                html = "\n".join(lines).strip()

            if not html.startswith("<!DOCTYPE") and not html.startswith("<html"):
                logger.warning("GameGenAgent: response is not valid HTML for '%s'", node_title)
                return ""

            html = inject_katex_if_needed(html)

            logger.info(
                "GameGenAgent: generated %d chars (style=%s) for '%s'",
                len(html),
                style_key,
                node_title,
            )
            return html

        except Exception:
            logger.exception("GameGenAgent: failed to generate for '%s'", node_title)
            return ""
