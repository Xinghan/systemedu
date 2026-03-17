"""Lab Reviewer Agent - reviews and fixes generated lab HTML for known bug patterns."""

import logging

from langchain_core.messages import HumanMessage, SystemMessage

from systemedu.agents.base import BaseAgent

logger = logging.getLogger(__name__)

REVIEWER_SYSTEM_PROMPT = """你是一个专业的前端代码审查专家，专注于审查 HTML5 拖拽交互游戏代码。你的任务是检查给定的 HTML 代码中是否存在会导致拖拽/交互不工作的 bug，并修复它们。

【必须逐条检查的已知 Bug 模式】

1. **pointer-events: none 用在拖拽元素上**
   - 问题：如果 `.dragging` 状态的 CSS 设置了 `pointer-events: none`，dragStart 触发后立即中断所有后续拖拽事件
   - 修复：删除拖拽元素上的 `pointer-events: none`，改用 `opacity: 0.5` 或 `transform: scale(0.95)` 作为拖拽中的视觉反馈

2. **draggable 属性缺失**
   - 问题：需要拖拽的元素没有设置 `draggable` 或 `draggable={true}`
   - 修复：在需要拖拽的元素上添加 `draggable`

3. **e.dataTransfer.setData/getData 缺失或写法错误**
   - 问题：dragStart 中没有调用 `e.dataTransfer.setData("text/plain", id)`，或 drop 中用了错误的 key
   - 修复：确保 setData 和 getData 使用相同的 key（"text/plain"）

4. **onDragOver 中缺少 e.preventDefault()**
   - 问题：浏览器默认不允许 drop，必须在 onDragOver 中调用 e.preventDefault()
   - 修复：添加 `e.preventDefault()`

5. **onDrop 中缺少 e.preventDefault()**
   - 问题：drop 事件不调用 preventDefault 可能导致浏览器默认行为
   - 修复：在 onDrop handler 开头添加 `e.preventDefault()`

6. **CSS user-select: none 导致拖拽启动困难**
   - 问题：虽然不直接影响拖拽 API，但在某些浏览器中可能干扰
   - 处理：如果仅用于拖拽元素且无其他问题，不修改

7. **CSS overflow: hidden 截断拖拽中的元素**
   - 问题：父容器 overflow:hidden 会截断拖拽时的元素预览
   - 修复：确保拖拽元素的直接父容器不使用 overflow:hidden

8. **React 事件名大小写错误**
   - 问题：使用了 `ondragstart` 而不是 `onDragStart`（React 要求 camelCase）
   - 修复：修正为 React 的 camelCase 命名

9. **拖拽状态管理问题**
   - 问题：dragEnd 后没有清除 dragging 状态，或者使用了闭包陷阱
   - 修复：确保 onDragEnd 正确清除拖拽状态

10. **e.dataTransfer.effectAllowed / dropEffect 未设置**
    - 问题：某些浏览器需要设置 effectAllowed
    - 修复：在 dragStart 中添加 `e.dataTransfer.effectAllowed = "move"`

【输出要求】
- 逐条检查上述 10 个 bug 模式
- 如果发现问题，直接修复并输出修复后的完整 HTML 代码
- 如果没有任何问题，原样输出 HTML 代码
- 直接输出 HTML 代码（从 <!DOCTYPE html> 开始），不要包含任何解释文字或 markdown 标记"""


class LabReviewerAgent(BaseAgent):
    """Reviews and fixes generated lab HTML for known interaction bugs."""

    name = "lab_reviewer"
    description = "审查并修复生成的实验 HTML 代码中的交互 bug"

    def __init__(self, llm=None, **kwargs):
        super().__init__(**kwargs)
        self._llm = llm

    async def process(self, message: str, context: dict | None = None) -> str:
        design = context.get("design", {}) if context else {}
        return self.review(message, design)

    def review(self, html: str, design: dict | None = None) -> str:
        """Review and fix generated lab HTML.

        Args:
            html: Complete HTML from LabCoder.
            design: Original game design spec (for context).

        Returns:
            Fixed HTML string, or original HTML if review fails.
        """
        if not html:
            return html

        import json

        design_summary = ""
        if design:
            game_title = design.get("game_title", "")
            interaction = design.get("interaction_type", "")
            items_count = len(design.get("items", []))
            design_summary = (
                f"\n\n【游戏设计上下文】\n"
                f"- 游戏标题: {game_title}\n"
                f"- 交互类型: {interaction}\n"
                f"- 物品数量: {items_count}"
            )

        user_prompt = (
            f"请审查以下 HTML 代码，检查是否存在会导致拖拽/交互不工作的 bug，"
            f"修复后输出完整 HTML。{design_summary}\n\n"
            f"HTML 代码：\n{html}"
        )

        try:
            response = self._llm.invoke([
                SystemMessage(content=REVIEWER_SYSTEM_PROMPT),
                HumanMessage(content=user_prompt),
            ])
            reviewed_html = response.content.strip()

            # Strip markdown code fences
            if reviewed_html.startswith("```"):
                lines = reviewed_html.split("\n")
                reviewed_html = "\n".join(
                    lines[1:-1] if lines[-1].strip() == "```" else lines[1:]
                )
                reviewed_html = reviewed_html.strip()

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
