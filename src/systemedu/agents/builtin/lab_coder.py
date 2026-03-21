"""Lab Coder Agent - generates complete runnable HTML from a free-form game concept."""

import logging
import re

from deepagents import create_deep_agent
from langchain_core.messages import AIMessage, HumanMessage

from systemedu.agents.base import BaseAgent

logger = logging.getLogger(__name__)

CODER_SYSTEM_PROMPT = """你是一个专业的前端开发者，擅长 React + SVG + CSS 动画。你的任务是根据游戏创意描述，自由实现一个完整的、可在浏览器中独立运行的交互式小游戏 HTML 页面。

【技术栈】
- React 18 CDN:
  - https://unpkg.com/react@18/umd/react.production.min.js
  - https://unpkg.com/react-dom@18/umd/react-dom.production.min.js
- Babel standalone: https://unpkg.com/@babel/standalone/babel.min.js
- 不引入任何第三方图形库或动画库
- script type="text/babel"
- ReactDOM.createRoot(document.getElementById('root')).render(<App />)

【视觉风格（卡通教育风）】
整体风格：活泼卡通，类似 Duolingo 的儿童教育游戏风格。圆润、色彩鲜明、有趣。

1. 字体与背景：
   - Google Fonts: <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
   - body font-family: 'Nunito', 'PingFang SC', 'Hiragino Sans GB', sans-serif
   - body 背景色：明亮渐变，linear-gradient(135deg, #EEF2FF 0%, #F0FDF4 100%)

2. 色板（高饱和度卡通色）：
   - 主蓝 #4F8EF7、主绿 #4ADE80、主红 #F87171、主橙 #FB923C、主紫 #A78BFA、主黄 #FCD34D
   - 卡片白色 #FFFFFF，border-radius: 16px，box-shadow: 0 4px 0 rgba(0,0,0,0.10)（底部阴影营造立体感）

3. 按钮（卡通立体感）：
   - 背景为主色，border-radius: 12px
   - box-shadow: 0 4px 0 对应深色（如 #4F8EF7 配 #2563EB）
   - 按下时：translateY(2px) + box-shadow 减少，模拟按压效果
   - 文字 font-weight: 800，白色

4. 卡片元素：
   - 统一白色背景 + 16px 圆角 + 底部 4px 彩色阴影
   - 图标/符号用大字号 emoji 或简洁 SVG

【SVG 图形要求（强制！）】
游戏场景中的所有物体必须用 SVG 绘制，让用户能一眼看出是什么。严禁用灰色空矩形 + 文字标签代替图形。

SVG 绘图规范：
- 每个游戏对象必须有清晰的 SVG 外形（用 rect/circle/polygon/path 组合）
- 用 fill 颜色区分不同元素：教室场景用 #4F8EF7（蓝色黑板）、#8B4513（棕色桌椅）、#F5F5DC（米色纸张）等
- 可叠加多个 SVG 基元（如黑板 = 深绿色 rect + 白色 rect 作为粉笔槽 + 浅色 text 模拟文字）
- SVG 内部元素之间用描边（stroke）区分层次

具体示例（照着这个标准画）：
- 黑板：<rect fill="#2D5A27" rx="4"/> + <rect fill="#8B7355" y="底部" height="6"/> （深绿色面板 + 棕色粉笔槽）
- 书本：<rect fill="#4F8EF7" rx="2"/> + <rect fill="#3B7DD8" x="中间" width="3"/>（蓝色封面 + 深蓝书脊）
- 椅子：<rect fill="#8B4513" rx="2"/>（棕色椅面）+ <line stroke="#6B3410"/>（椅腿）
- 试卷：<rect fill="#FAFAFA" stroke="#E0E0E0"/> + 多条 <line stroke="#E0E0E0"/>（白纸 + 横线）

实际游戏对象数量：至少 4-6 个，分布在场景的不同位置，每个有独立 SVG 图形。

【布局要求（严格！）】
- html, body: margin:0; padding:0; height:100vh; overflow:hidden;
- 整体在 800px 宽居中容器内
- 必须适配 600px 高度的 iframe，不出现滚动条
- 使用 flexbox 布局，紧凑排列
- 标题区域高度不超过 50px
- 底部状态栏高度不超过 40px

【游戏实现原则】
- 游戏目标要明确：用户一眼看出该做什么
- 操作即时反馈：用户每次操作必须有视觉/动画响应（不能点了没反应）
- 使用 React.useState 管理所有游戏状态
- 游戏完成时：显示鼓励语 + 彩色圆点飘落庆祝动画
- 组件结构清晰：App > 游戏区域 + 状态显示
- 全部文字使用中文

【CSS 动画要求】
- 正确操作：绿色边框 + scale(1.08) bounce 动画
- 错误操作：红色边框 + shake 抖动（translateX）
- 完成庆祝：5-8 个彩色圆点从顶部飘落（@keyframes 控制 translateY + opacity）
- 使用 CSS transition + @keyframes，不用第三方动画库

【拖拽实现（如创意中需要拖拽）】
- 使用 HTML5 Drag & Drop API: onDragStart, onDragOver, onDrop
- onDragOver 必须调用 e.preventDefault() 才能允许 drop
- 用 e.dataTransfer.setData/getData("text/plain", id) 传递数据
```
const handleDragStart = (e, id) => { e.dataTransfer.setData("text/plain", String(id)); };
const handleDragOver = (e) => { e.preventDefault(); };
const handleDrop = (e, targetId) => {
  e.preventDefault();
  const itemId = e.dataTransfer.getData("text/plain");
  // 判断正确性，更新状态
};
```

【参数调节类游戏（如创意中有滑块/参数控制）】
```
const [params, setParams] = React.useState({ value: 50 });
// 左侧控制:
<input type="range" min={0} max={100} value={params.value}
       onChange={(e) => setParams(p => ({...p, value: +e.target.value}))} />
// 右侧效果区域用 inline style 绑定 state 变量实时响应
```

直接输出完整的 HTML 代码（从 <!DOCTYPE html> 开始），不要包含 markdown 代码块标记，不要输出任何其他文字。"""


def validate_lab_html(html_code: str) -> dict:
    """Validate generated lab HTML for required structure.

    Returns dict with:
        - "fatal": str or None — if set, HTML is unusable
        - "warnings": list[str] — non-fatal issues
    """
    html_lower = html_code.lower()
    warnings = []

    # Fatal checks
    if "<html" not in html_lower:
        return {"fatal": "Missing <html> tag", "warnings": []}
    if "react" not in html_lower:
        return {"fatal": "No React reference found", "warnings": []}
    if "<div" not in html_lower and "<svg" not in html_lower:
        return {"fatal": "No <div> or <svg> element found", "warnings": []}

    # Non-fatal structural checks
    if "react.production.min.js" not in html_lower and "react@18" not in html_lower:
        warnings.append("React CDN URL may be non-standard")
    if "react-dom" not in html_lower:
        warnings.append("Missing ReactDOM reference")
    if "babel" not in html_lower:
        warnings.append("Missing Babel standalone (JSX won't compile)")
    if 'text/babel' not in html_lower:
        warnings.append("Missing script type='text/babel'")
    if "createroot" not in html_lower and "createRoot" not in html_code:
        warnings.append("Missing ReactDOM.createRoot call")
    if "usestate" not in html_lower and "useState" not in html_code:
        warnings.append("No useState found — may lack interactivity")
    if "<style" not in html_lower:
        warnings.append("No <style> tag — missing CSS styles")
    if len(html_code) < 1000:
        warnings.append(f"HTML very short ({len(html_code)} chars) — may be incomplete")

    # Animation checks
    keyframe_count = html_lower.count("@keyframes")
    if keyframe_count < 2:
        warnings.append(f"Only {keyframe_count} @keyframes found — should have at least 2 animations")

    # Event handler checks
    has_events = any(kw in html_code for kw in ["onclick", "onClick", "onDrag", "ondrag", "onDrop", "ondrop", "onChange", "onchange"])
    if not has_events:
        warnings.append("No event handlers (onClick/onDrag/onChange) found — may lack interactivity")

    return {"fatal": None, "warnings": warnings}


class LabCoderAgent(BaseAgent):
    """Generates complete runnable HTML+React+SVG code from a game concept."""

    name = "lab_coder"
    description = "根据游戏创意描述自由实现完整可运行的 HTML+React+SVG 游戏"

    def __init__(self, llm=None, **kwargs):
        super().__init__(**kwargs)
        self._llm = llm

    async def process(self, message: str, context: dict | None = None) -> str:
        ctx = context or {}
        node_title = message
        node_summary = ctx.get("summary", "")
        difficulty = ctx.get("difficulty", 5)
        lab_strategy = ctx.get("lab_strategy", {})
        return await self.generate(node_title, node_summary, difficulty, lab_strategy)

    async def generate(
        self,
        node_title: str,
        node_summary: str,
        difficulty: int,
        lab_strategy: dict,
    ) -> str:
        """Generate complete HTML code from a free-form game concept.

        Args:
            node_title: Title of the knowledge node.
            node_summary: Brief summary of the knowledge node.
            difficulty: Difficulty level (1-10).
            lab_strategy: Dict with game_concept, game_mechanic, learning_connection.

        Returns:
            Complete HTML string, or empty string on failure.
        """
        difficulty_desc = "入门级" if difficulty <= 3 else "中级" if difficulty <= 6 else "高级"

        game_concept = lab_strategy.get("game_concept", "")
        game_mechanic = lab_strategy.get("game_mechanic", "exploration")
        learning_connection = lab_strategy.get("learning_connection", "")

        user_prompt = (
            f"知识点：{node_title}\n"
            f"知识简介：{node_summary}\n"
            f"难度：{difficulty_desc}\n\n"
            f"游戏创意：{game_concept}\n"
            f"游戏机制类型：{game_mechanic}\n"
            f"学习目标：{learning_connection}\n\n"
            f"请用 HTML + React + CSS 实现这个小游戏。严格按照游戏创意描述实现界面和交互，"
            f"确保用户操作有即时视觉反馈，游戏完成时有鼓励动画。"
            f"布局必须适配 600px 高度 iframe，不出现滚动条。"
            f"直接输出完整 HTML 代码。"
        )

        try:
            agent = create_deep_agent(
                model=self._llm,
                tools=[],
                system_prompt=CODER_SYSTEM_PROMPT,
            )
            result = await agent.ainvoke({"messages": [HumanMessage(content=user_prompt)]})
            # Extract last AIMessage content
            html_code = ""
            for msg in reversed(result["messages"]):
                if isinstance(msg, AIMessage) and msg.content:
                    html_code = msg.content
                    break

            html_code = html_code.strip()
            # Strip markdown code fences
            if html_code.startswith("```"):
                lines = html_code.split("\n")
                html_code = "\n".join(
                    lines[1:-1] if lines[-1].strip() == "```" else lines[1:]
                )
                html_code = html_code.strip()

            # Strip any preamble text before <!DOCTYPE html> or <html
            html_start = re.search(r'(<!DOCTYPE\s+html|<html)', html_code, re.IGNORECASE)
            if html_start and html_start.start() > 0:
                logger.info(f"Coder: stripping {html_start.start()} chars of preamble before HTML")
                html_code = html_code[html_start.start():]

            # Validate HTML structure
            issues = validate_lab_html(html_code)
            if issues.get("fatal"):
                logger.warning(f"Coder output failed validation: {issues['fatal']}")
                return ""

            if issues.get("warnings"):
                for w in issues["warnings"]:
                    logger.warning(f"Lab HTML warning: {w}")

            # Log what was generated
            title_match = re.search(r'<title>(.*?)</title>', html_code)
            html_title = title_match.group(1) if title_match else "?"
            has_drag = "draggable" in html_code or "onDragStart" in html_code
            has_range = 'type="range"' in html_code or "type='range'" in html_code
            actual_hints = []
            if has_drag:
                actual_hints.append("drag")
            if has_range:
                actual_hints.append("range-slider")
            logger.info(
                f"Coder: html_title='{html_title}' | "
                f"game_mechanic={game_mechanic} | "
                f"detected_patterns={actual_hints} | "
                f"{len(html_code)} chars"
            )
            return html_code

        except Exception:
            logger.exception("Lab coder failed")
            return ""
