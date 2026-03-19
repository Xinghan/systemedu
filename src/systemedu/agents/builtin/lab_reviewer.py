"""Lab Reviewer Agent - reviews and fixes generated lab HTML for known bug patterns."""

import logging

from deepagents import create_deep_agent
from langchain_core.messages import AIMessage, HumanMessage

from systemedu.agents.base import BaseAgent

logger = logging.getLogger(__name__)

REVIEWER_SYSTEM_PROMPT = """你是一个专业的前端代码审查专家，专注于审查交互式教育游戏代码。你的任务是根据交互类型检查 HTML 代码中会导致交互不工作的 bug，并修复。

## 通用检查（所有交互类型）

1. **React 事件名大小写错误**
   - 问题：使用了 `onclick` 而不是 `onClick`（React 要求 camelCase）
   - 修复：所有事件名改为 camelCase（onClick, onDragStart, onChange 等）

2. **缺少 e.preventDefault()**
   - 问题：需要阻止默认行为的事件没有调用 preventDefault
   - 修复：在 onDragOver、onDrop、form submit 等处添加

3. **CSS overflow: hidden 截断交互元素**
   - 问题：父容器 overflow:hidden 截断弹出效果或拖拽预览
   - 修复：确保交互区域的父容器不使用 overflow:hidden

4. **useState 初始值类型错误**
   - 问题：如 useState(null) 后直接 .map() 导致报错
   - 修复：确保初始值与使用方式一致

5. **布局溢出 iframe**
   - 问题：内容超出 600px 高度出现滚动条
   - 修复：调整间距，确保适配 600px 高度

## drag_classify / drag_sort 专属检查

6. **pointer-events: none 用在拖拽元素上**
   - 修复：删除拖拽元素上的 pointer-events:none，改用 opacity

7. **draggable 属性缺失**
   - 修复：需要拖拽的元素添加 draggable

8. **e.dataTransfer.setData/getData 缺失或 key 不匹配**
   - 修复：确保 setData 和 getData 使用相同 key（"text/plain"）

9. **onDragOver 未调用 e.preventDefault()**
   - 修复：否则浏览器不允许 drop

10. **e.dataTransfer.effectAllowed 未设置**
    - 修复：dragStart 中添加 e.dataTransfer.effectAllowed = "move"

## click_select 专属检查

11. **onClick handler 缺失**
    - 问题：选项卡片没有绑定 onClick
    - 修复：确保每个选项都有 onClick 处理

12. **选中状态未清除**
    - 问题：选择后切换下一题时上一题的选中态残留
    - 修复：切换题目时 setSelected(null)

13. **cursor: pointer 缺失**
    - 问题：可点击元素没有手型光标提示
    - 修复：添加 cursor: pointer

## connect_match 专属检查

14. **SVG 连线坐标计算错误**
    - 问题：line 的 x1/y1/x2/y2 使用固定值而非动态获取元素位置
    - 修复：使用 ref 或 getBoundingClientRect 计算连线端点

15. **SVG overlay 层阻挡点击**
    - 问题：覆盖在卡片上方的 SVG 层拦截了鼠标事件
    - 修复：SVG 层添加 pointerEvents:'none'

16. **未处理重复配对**
    - 问题：已配对成功的项可以再次点击
    - 修复：已匹配的项目禁用点击

## cause_effect 专属检查

17. **input range onChange 事件问题**
    - 问题：使用 onInput 而非 onChange（React 中两者等效但建议 onChange）
    - 修复：使用 onChange

18. **效果区域未响应参数变化**
    - 问题：SVG 动画没有根据 state 更新
    - 修复：确保效果区域的 style/属性绑定了 state 变量

19. **滑块值类型错误**
    - 问题：e.target.value 是字符串，直接用于计算出错
    - 修复：使用 Number(e.target.value) 或 +e.target.value

## 卡通风格检查（所有交互类型）

20. **Nunito 字体缺失**
    - 问题：没有引入 Nunito 字体
    - 修复：在 <head> 添加 <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">，body 设置 font-family: 'Nunito', 'PingFang SC', 'Hiragino Sans GB', sans-serif

21. **背景不是渐变色**
    - 问题：body 背景是纯白或米黄
    - 修复：设置 body { background: linear-gradient(135deg, #EEF2FF 0%, #F0FDF4 100%); }

22. **卡片圆角不足**
    - 问题：卡片 border-radius 小于 12px
    - 修复：设置卡片 border-radius: 16px，按钮 border-radius: 12px

23. **卡片缺少立体阴影**
    - 问题：卡片没有底部阴影营造立体感
    - 修复：添加 box-shadow: 0 4px 0 rgba(0,0,0,0.10)

【输出要求】
- 根据交互类型检查对应的 bug 模式
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
        design = context.get("design", {}) if context else {}
        return await self.review(message, design)

    async def review(self, html: str, design: dict | None = None) -> str:
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

        interaction_type = ""
        design_summary = ""
        if design:
            game_title = design.get("game_title", "")
            interaction_type = design.get("interaction_type", "")
            design_summary = (
                f"\n\n【游戏设计上下文】\n"
                f"- 游戏标题: {game_title}\n"
                f"- 交互类型: {interaction_type}"
            )

        type_instruction = ""
        if interaction_type:
            type_instruction = f"本游戏的交互类型是 {interaction_type}，请重点检查该类型的专属 bug 模式。"

        user_prompt = (
            f"请审查以下 HTML 代码，检查是否存在会导致交互不工作的 bug，"
            f"修复后输出完整 HTML。{type_instruction}{design_summary}\n\n"
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
