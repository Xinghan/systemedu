"""Lab Reviewer Agent - reviews and fixes generated lab HTML for known bug patterns."""

import logging

from deepagents import create_deep_agent
from langchain_core.messages import AIMessage, HumanMessage

from systemedu.agents.base import BaseAgent

logger = logging.getLogger(__name__)

REVIEWER_SYSTEM_PROMPT = """你是一个专业的前端代码审查专家，专注于审查交互式教育游戏代码。你的任务是检查 HTML 代码中会导致交互不工作的通用 bug，并修复。

## 通用检查（所有游戏类型）

1. **React 事件名大小写错误**
   - 问题：使用了 `onclick` 而不是 `onClick`（React 要求 camelCase）
   - 修复：所有事件名改为 camelCase（onClick, onDragStart, onChange 等）

2. **拖拽时 onDragOver 未调用 e.preventDefault()**
   - 问题：若代码中有拖拽功能，onDragOver 未调用 preventDefault 会导致 drop 事件无法触发
   - 修复：所有 onDragOver 处理函数内加入 e.preventDefault()

3. **CSS overflow: hidden 截断交互元素**
   - 问题：父容器 overflow:hidden 截断弹出效果或拖拽预览
   - 修复：确保交互区域的父容器不使用 overflow:hidden

4. **useState 初始值类型错误**
   - 问题：如 useState(null) 后直接 .map() 导致报错
   - 修复：确保初始值与使用方式一致（数组初始为 []，对象初始为 {}）

5. **布局溢出 iframe**
   - 问题：内容超出 600px 高度出现滚动条
   - 修复：调整间距，确保适配 600px 高度，html/body 设置 overflow:hidden

## 卡通风格检查（所有游戏类型）

6. **Nunito 字体缺失**
   - 问题：没有引入 Nunito 字体
   - 修复：在 <head> 添加 <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">，body 设置 font-family: 'Nunito', 'PingFang SC', 'Hiragino Sans GB', sans-serif

7. **背景不是渐变色**
   - 问题：body 背景是纯白或米黄
   - 修复：设置 body { background: linear-gradient(135deg, #EEF2FF 0%, #F0FDF4 100%); }

8. **卡片圆角不足**
   - 问题：卡片 border-radius 小于 12px
   - 修复：设置卡片 border-radius: 16px，按钮 border-radius: 12px

9. **卡片缺少立体阴影**
   - 问题：卡片没有底部阴影营造立体感
   - 修复：添加 box-shadow: 0 4px 0 rgba(0,0,0,0.10)

【输出要求】
- 检查上述通用 bug 模式
- 检查卡通风格是否完整（Nunito 字体、渐变背景、圆角、立体阴影）
- 如果缺少卡通风格要素，自动注入
- 如果发现问题，直接修复并输出修复后的完整 HTML 代码
- 如果没有问题，原样输出 HTML 代码
- 直接输出 HTML 代码（从 <!DOCTYPE html> 开始），不要包含任何解释文字或 markdown 标记"""


class LabReviewerAgent(BaseAgent):
    """Reviews and fixes generated lab HTML for known interaction bugs."""

    name = "lab_reviewer"
    description = "审查并修复生成的实验 HTML 代码中的交互 bug"

    def __init__(self, llm=None, **kwargs):
        super().__init__(**kwargs)
        self._llm = llm

    async def process(self, message: str, context: dict | None = None) -> str:
        lab_strategy = context.get("lab_strategy") if context else None
        return await self.review(message, lab_strategy)

    async def review(self, html: str, lab_strategy: dict | None = None) -> str:
        """Review and fix generated lab HTML.

        Args:
            html: Complete HTML from LabCoder.
            lab_strategy: Game strategy dict with game_concept etc. (for context).

        Returns:
            Fixed HTML string, or original HTML if review fails.
        """
        if not html:
            return html

        concept_context = ""
        if lab_strategy:
            game_concept = lab_strategy.get("game_concept", "")
            if game_concept:
                concept_context = f"\n\n【游戏创意上下文】\n{game_concept}"

        user_prompt = (
            f"请审查以下 HTML 代码，检查是否存在会导致交互不工作的 bug，"
            f"修复后输出完整 HTML。{concept_context}\n\n"
            f"HTML 代码：\n{html}"
        )

        try:
            agent = create_deep_agent(
                model=self._llm,
                tools=[],
                system_prompt=REVIEWER_SYSTEM_PROMPT,
            )
            result = await agent.ainvoke({"messages": [HumanMessage(content=user_prompt)]})
            # Extract last AIMessage content
            reviewed_html = ""
            for msg in reversed(result["messages"]):
                if isinstance(msg, AIMessage) and msg.content:
                    reviewed_html = msg.content
                    break

            reviewed_html = reviewed_html.strip()

            # Strip markdown code fences
            if reviewed_html.startswith("```"):
                lines = reviewed_html.split("\n")
                reviewed_html = "\n".join(
                    lines[1:-1] if lines[-1].strip() == "```" else lines[1:]
                )
                reviewed_html = reviewed_html.strip()

            # Strip any preamble text before <!DOCTYPE html> or <html
            # (LLM may output thinking/analysis text before the actual HTML)
            import re
            html_start = re.search(r'(<!DOCTYPE\s+html|<html)', reviewed_html, re.IGNORECASE)
            if html_start and html_start.start() > 0:
                logger.info(
                    f"Reviewer: stripping {html_start.start()} chars of preamble before HTML"
                )
                reviewed_html = reviewed_html[html_start.start():]

            # Sanity check: reviewed output must still be valid HTML
            if "<html" not in reviewed_html.lower():
                logger.warning("Reviewer output missing <html> tag, keeping original")
                return html

            if len(reviewed_html) < len(html) * 0.5:
                logger.warning(
                    f"Reviewer output suspiciously short ({len(reviewed_html)} vs {len(html)} chars), keeping original"
                )
                return html

            logger.info(
                f"Reviewer: reviewed HTML ({len(html)} -> {len(reviewed_html)} chars)"
            )
            return reviewed_html

        except Exception:
            logger.exception("Lab reviewer failed, returning original HTML")
            return html
