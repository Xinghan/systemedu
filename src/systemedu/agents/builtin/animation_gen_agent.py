"""AnimationGenAgent — generates SVG/CSS animation HTML from a frame-based detail plan."""

import logging

logger = logging.getLogger(__name__)

ANIMATION_GEN_PROMPT = """你是一位专业的 SVG 动画工程师，请根据以下动画帧序列方案，生成一个完整的 HTML 动画文件。

知识节点：{node_title}
动画标题：{title}
动画类型：{animation_type}
风格：{style_hint}

帧序列：
{frames_description}

请生成一个完整的 HTML 文件，要求：
1. 使用 SVG + CSS animation 实现帧序列动画
2. 每帧切换间隔 2-3 秒，总时长 {total_duration} 秒
3. 包含进度指示器（底部圆点，高度不超过 20px）
4. 动画结束时发送 postMessage：window.parent.postMessage({{type: 'STEP_COMPLETE'}}, '*')
5. HTML 结构：
   - <!DOCTYPE html><html><head>...</head><body style="margin:0;padding:0;overflow:hidden">...</body></html>
   - 使用内联 <style> 和 <script>
   - body 和 html 高度设为 100%，无内外边距
   - SVG 充满整个视口：width="100%" height="100%" viewBox="0 0 600 420"
   - 禁止在 SVG 外添加任何 div 标题或副标题文字
6. 视觉要求：
   - 动画主体内容占 viewBox 的上方 85%（约 0~360 区域）
   - 底部 360~420 区域：左侧放简短帧说明文字（font-size 11px），右侧放进度圆点
   - 禁止在顶部放大标题（不要 h1/h2/大号 text 元素作为标题）
   - 背景色：#f8f9fa（浅灰白）
   - 主色调：根据 style_hint 选择（科技感用蓝色系，卡通用彩色，手绘用暖色）
   - 字体：微软雅黑或系统中文字体
   - 每帧有明确的视觉焦点
7. 代码质量：
   - 所有主体 SVG 元素使用有机曲线（bezier path）而非纯矩形叠加
   - 渐变色填充（linearGradient 或 radialGradient）
   - 动画过渡流畅（使用 CSS transition 或 @keyframes）

直接输出完整 HTML 代码，不要添加任何说明文字。
"""


class AnimationGenAgent:
    """Generates SVG + CSS animation HTML from a frame detail plan."""

    def __init__(self, llm):
        self.llm = llm

    async def generate(self, detail_plan: dict, node_title: str) -> str:
        """Generate animation HTML from detail_plan.

        Returns HTML string, or empty string on failure.
        """
        from langchain_core.messages import HumanMessage

        frames = detail_plan.get("frames", [])
        if not frames:
            logger.warning("AnimationGenAgent: no frames in detail_plan")
            return ""

        # Build frames description
        frames_desc_parts = []
        for f in frames:
            idx = f.get("frame_index", 0)
            desc = f.get("description", "")
            elements = ", ".join(f.get("visual_elements", []))
            narration = f.get("narration", "")
            part = f"帧 {idx + 1}: {desc}\n  视觉元素: {elements}"
            if narration:
                part += f"\n  旁白: {narration}"
            frames_desc_parts.append(part)

        frames_description = "\n".join(frames_desc_parts)
        total_duration = max(len(frames) * 3, 12)

        prompt = ANIMATION_GEN_PROMPT.format(
            node_title=node_title,
            title=detail_plan.get("title", node_title),
            animation_type=detail_plan.get("animation_type", "流程演示"),
            style_hint=detail_plan.get("style_hint", "科技感"),
            frames_description=frames_description,
            total_duration=total_duration,
        )

        try:
            import asyncio

            response = await asyncio.to_thread(self.llm.invoke, [HumanMessage(content=prompt)])
            html = response.content.strip()

            # Strip markdown code fences if present
            if html.startswith("```"):
                lines = html.split("\n")
                html = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
                html = html.strip()

            # Validate output contains SVG or canvas and animation-related code
            html_lower = html.lower()
            if "<svg" not in html_lower and "<canvas" not in html_lower:
                logger.warning(
                    "AnimationGenAgent: output missing <svg> or <canvas>, returning empty"
                )
                return ""
            if "animation" not in html_lower and "@keyframes" not in html_lower:
                logger.warning(
                    "AnimationGenAgent: output missing animation, returning empty"
                )
                return ""

            logger.info(
                f"AnimationGenAgent: generated {len(html)} chars for '{node_title}'"
            )
            return html

        except Exception:
            logger.exception(f"AnimationGenAgent: unexpected error for '{node_title}'")
            return ""
