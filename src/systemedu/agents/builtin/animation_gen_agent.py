"""AnimationGenAgent — generates animation HTML directly via LLM.

Simplified architecture: receives detail_plan, directly prompts LLM to generate HTML.
No complex pipelines, no fallbacks.
"""

import logging

from systemedu.agents.builtin.media_art_direction import (
    STYLE_KITS,
    inject_katex_if_needed,
)

logger = logging.getLogger(__name__)

ANIMATION_GENERATION_PROMPT = """你是一位教育动画开发专家。请根据以下详细创意方案，生成一个教育动画的完整 HTML 代码。

知识点：{topic}
上下文：{context_summary}

详细创意方案：
{detail_plan_json}

【用户操作说明 -- 必须严格实现】
以下是面向学生的操作说明，你生成的动画必须完全匹配这些描述：
{user_guide_text}

如果说明中提到了播放控制方式，你必须实现对应的控制按钮。
如果说明中提到了阶段数量，你必须实现对应数量的阶段。
如果说明中提到了观察重点，你必须确保对应的视觉元素清晰可见。

【视觉风格指南 -- 必须遵循】
{style_guide}

动画效果：
- 平滑过渡：使用 CSS transition 或 requestAnimationFrame
- 脉冲发光：关键节点添加 pulse animation
- 数据流动：使用虚线动画（stroke-dasharray）表现传输

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
1. 教育动画展示（使用 SVG 或 Canvas）
2. 帧序列控制（播放、暂停、上一帧、下一帧）
3. 清晰展示知识点的动态过程
4. 符合上述风格指南的 UI
5. 【内嵌操作说明面板】在页面顶部或侧边放置一个简洁的说明区域，内容来自上方的「用户操作说明」。
   要求：默认展开，用户可以点击折叠。使用图标 + 短文本，排版紧凑美观。
   面板标题为「观看指南」，风格与页面整体一致。

技术要求：
- 严格遵循上方风格指南的配色方案
- 响应式布局，整个页面必须在 100vh 内完成展示，禁止出现垂直滚动条
- body 设置 overflow: hidden; height: 100vh; 所有内容必须在一屏内布局完成
- 单文件 HTML，可使用 Google Fonts CDN
- 发光效果和渐变

【输出前自检 -- 在脑中逐条检查，不要输出检查过程】
- 重力方向是否正确？物体是否向下落而非向上飞？
- 地面/水面是否在画面底部？天空是否在上方？
- 所有箭头方向是否符合物理规律？
- 颜色是否符合常识（水是蓝的、火是红的、植物是绿的）？
- 动画每一帧的物体位置变化是否符合因果逻辑？
- 所有按钮和控件是否真的绑定了事件并能正常工作？

请直接输出完整的 HTML 代码（包含 <!DOCTYPE html> 到 </html>），不要有任何其他说明文字。
"""


def _build_style_guide(style_key: str) -> str:
    """Build a detailed style guide text from a style_key.

    Generates comprehensive CSS/design specification from STYLE_KITS,
    based on real design systems extracted from animation_game_design/ directory.
    """
    kit = STYLE_KITS.get(style_key)
    if not kit:
        style_key = "neural_circuit"
        kit = STYLE_KITS["neural_circuit"]

    palette = kit["palette"]
    desc = kit.get("description", "")
    effects = kit.get("special_effects", [])
    font = kit.get("font_pairing", "Space Grotesk")
    radius = kit.get("radius", {})
    shadow = kit.get("shadow", {})
    glassmorphism = kit.get("glassmorphism", "")
    gradient_cta = kit.get("gradient_cta", "")
    css_rules = kit.get("css_rules", [])

    lines = [f"风格名称: {style_key}"]
    if desc:
        lines.append(f"风格说明: {desc}")

    # -- 配色方案 (完整) --
    lines.append(f"\n配色方案 (必须严格使用这些颜色值):")
    lines.append(f"- 页面背景 (body/html): {palette.get('bg', '#121318')}")
    lines.append(f"- 面板/卡片背景: {palette.get('surface', 'rgba(26,27,33,0.92)')}")
    if palette.get("surface_high"):
        lines.append(f"- 高层级面板: {palette['surface_high']}")
    lines.append(f"- 主色调 (primary): {palette.get('primary', '#dbfcff')}")
    if palette.get("primary_container"):
        lines.append(f"- 主色容器 (primary-container): {palette['primary_container']}")
    lines.append(f"- 辅助色 (secondary): {palette.get('secondary', '#2ff801')}")
    if palette.get("secondary_container"):
        lines.append(f"- 辅助色容器: {palette['secondary_container']}")
    if palette.get("tertiary"):
        lines.append(f"- 第三色 (tertiary): {palette['tertiary']}")
    lines.append(f"- 信号色/警告: {palette.get('signal', '#ef4444')}")
    lines.append(f"- 成功色: {palette.get('success', '#10b981')}")
    lines.append(f"- 主文字: {palette.get('text', '#e8e8ec')}")
    lines.append(f"- 次要文字: {palette.get('muted', '#8a8a90')}")
    if palette.get("outline_variant"):
        lines.append(f"- 边框/分割线: {palette['outline_variant']}")

    # -- 字体 --
    lines.append(f"\n字体: {font}")

    # -- 圆角 --
    r_sm = radius.get("sm", 0)
    r_md = radius.get("md", 0)
    r_lg = radius.get("lg", 0)
    lines.append(f"圆角: sm={r_sm}px, md={r_md}px, lg={r_lg}px")

    # -- 阴影 --
    lines.append(f"柔和阴影: {shadow.get('soft', 'none')}")
    lines.append(f"焦点阴影: {shadow.get('focus', 'none')}")

    # -- 玻璃态 --
    if glassmorphism:
        lines.append(f"\n玻璃态效果 (glassmorphism): {glassmorphism}")

    # -- 渐变 CTA --
    if gradient_cta:
        lines.append(f"渐变按钮/CTA: {gradient_cta}")

    # -- 特殊效果 --
    if effects:
        lines.append(f"\n特殊视觉效果 (必须至少实现 2-3 个):")
        for eff in effects:
            lines.append(f"- {eff}")

    # -- CSS 硬性规则 --
    if css_rules:
        lines.append(f"\nCSS 硬性规则:")
        for rule in css_rules:
            lines.append(f"- {rule}")

    # -- 通用深色主题规则 --
    lines.append(f"\n整体基调: 深色沉浸式主题")
    lines.append("通用规则:")
    lines.append("- body 背景必须使用上方指定的 bg 颜色")
    lines.append("- 所有面板使用 glassmorphism (半透明 + backdrop-blur)")
    lines.append("- 不要使用传统 drop-shadow，改用发光效果 (glow)")
    lines.append("- 交互元素 hover 时添加发光或微缩放效果")
    lines.append("- Google Fonts CDN 加载字体: " + font.split("+")[0].strip())

    return "\n".join(lines)


class AnimationGenAgent:
    """Generates animation HTML directly via LLM.

    Simplified architecture: no complex pipelines, no fallbacks.
    Receives detail_plan, directly prompts LLM to generate HTML.
    """

    def __init__(self, llm):
        self.llm = llm

    @staticmethod
    def _format_animation_user_guide(detail_plan: dict) -> str:
        """Format user_guide from detail_plan into readable text for prompt injection."""
        guide = detail_plan.get("user_guide")
        if not isinstance(guide, dict):
            return "(无用户操作说明)"

        parts: list[str] = []
        what = guide.get("what_it_shows", "")
        if what:
            parts.append(f"- 这个动画展示了: {what}")
        observe = guide.get("observe_points", [])
        if isinstance(observe, list) and observe:
            parts.append("- 观察重点:")
            for pt in observe:
                if isinstance(pt, str):
                    parts.append(f"  * {pt}")
        controls = guide.get("controls", "")
        if controls:
            parts.append(f"- 播放控制: {controls}")
        takeaway = guide.get("takeaway", "")
        if takeaway:
            parts.append(f"- 看完后能回答: {takeaway}")
        return "\n".join(parts) if parts else "(无用户操作说明)"

    async def generate(
        self,
        detail_plan: dict,
        node_title: str,
        node_summary: str = "",
        project_category: str = "",
    ) -> str:
        """Generate animation HTML from detail_plan.

        Args:
            detail_plan: The detailed animation plan from CourseIdeaDetailPlannerAgent.
            node_title: The knowledge node title.
            node_summary: Optional node summary.
            project_category: Optional project category.

        Returns:
            HTML string, or empty string on failure.
        """
        import asyncio
        import json
        from langchain_core.messages import HumanMessage

        topic = detail_plan.get("topic", node_title)
        context_summary = detail_plan.get("context_summary", node_summary)

        user_guide_text = self._format_animation_user_guide(detail_plan)
        style_key = detail_plan.get("style_key", "neural_circuit")
        style_guide = _build_style_guide(style_key)

        prompt = ANIMATION_GENERATION_PROMPT.format(
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
                logger.warning("AnimationGenAgent: response is not valid HTML for '%s'", node_title)
                return ""

            html = inject_katex_if_needed(html)

            logger.info(
                "AnimationGenAgent: generated %d chars (style=%s) for '%s'",
                len(html),
                style_key,
                node_title,
            )
            return html

        except Exception:
            logger.exception("AnimationGenAgent: failed to generate for '%s'", node_title)
            return ""
