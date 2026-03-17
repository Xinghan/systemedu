"""Lab Coder Agent - generates complete runnable HTML from a game design spec."""

import json
import logging

from langchain_core.messages import HumanMessage, SystemMessage

from systemedu.agents.base import BaseAgent

logger = logging.getLogger(__name__)

CODER_SYSTEM_PROMPT = """你是一个专业的前端开发者，擅长 React + SVG + CSS 动画。你的任务是根据游戏设计稿，生成一个完整的、可在浏览器中独立运行的交互式小游戏 HTML 页面。

【技术栈】
- React 18 CDN:
  - https://unpkg.com/react@18/umd/react.production.min.js
  - https://unpkg.com/react-dom@18/umd/react-dom.production.min.js
- Babel standalone: https://unpkg.com/@babel/standalone/babel.min.js
- script type="text/babel"
- ReactDOM.createRoot(document.getElementById('root')).render(<App />)

【SVG 矢量图形要求】
- 所有游戏物品必须用 SVG 绘制，不依赖外部图片
- 根据设计稿中的 svg_description 绘制具体图形
- SVG 使用 viewBox 确保缩放正确

【CSS 动画要求】
- 使用 @keyframes 定义动画：fadeIn, shake, bounceIn, float, confetti 等
- 使用 CSS transition 做 hover 和状态变化的平滑过渡
- 动画时间和缓动函数要符合设计稿描述

【布局要求（严格！）】
- html, body: margin:0; padding:0; height:100vh; overflow:hidden;
- 整体在 800px 宽居中容器内
- 必须适配 600px 高度的 iframe，不出现滚动条
- 使用 flexbox 布局，紧凑排列
- 标题区域高度不超过 50px
- 底部状态栏高度不超过 40px

【代码质量】
- 使用 React.useState 管理游戏状态
- 组件结构清晰：App > Header + GameArea + StatusBar
- 所有 CSS 放在 <style> 标签中
- 全部文字使用中文

---

根据 interaction_type 选择对应的实现方式：

## drag_classify / drag_sort（拖拽类）
- 使用 HTML5 Drag & Drop API: onDragStart, onDragOver, onDrop, onDragEnd
- 拖拽时设置 dataTransfer.setData 传递物品 ID
- 目标区域 onDragOver 要 preventDefault 允许放置
- 不要使用 React DnD 等库，只用原生 HTML5 Drag & Drop
- 在 iframe sandbox 中必须用 e.dataTransfer.setData/getData 方式传递数据
代码模板：
```
const handleDragStart = (e, id) => { e.dataTransfer.setData("text/plain", id); };
const handleDragOver = (e) => { e.preventDefault(); };
const handleDrop = (e, targetId) => {
  e.preventDefault();
  const itemId = e.dataTransfer.getData("text/plain");
  // 判断正确性，更新状态
};
<div draggable onDragStart={(e) => handleDragStart(e, item.id)} style={{cursor:'grab'}}>...</div>
<div onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, target.id)}>...</div>
```

## click_select（点击选择）
- 每题显示题目文字 + 多个可点击选项卡片（每个卡片含 SVG 图形和文字）
- 点击选项后高亮并判断正确性，正确绿色边框+✓，错误红色+shake
- 答对后自动跳转下一题，全部完成后显示总分
代码模板：
```
const [currentQ, setCurrentQ] = React.useState(0);
const [selected, setSelected] = React.useState(null);
const handleSelect = (optionId, isCorrect) => {
  setSelected(optionId);
  if (isCorrect) { setScore(s => s + 10); }
  setTimeout(() => { setCurrentQ(q => q + 1); setSelected(null); }, 1200);
};
<div onClick={() => handleSelect(opt.id, opt.is_correct)}
     style={{cursor:'pointer', border: selected===opt.id ? (opt.is_correct?'3px solid green':'3px solid red') : '2px solid #ddd'}}>
  <svg>...</svg><span>{opt.label}</span>
</div>
```

## connect_match（连线配对）
- 左列和右列各显示卡片，点击左侧选中，再点击右侧完成配对
- 使用 SVG 的 <line> 或 <path> 在两个卡片之间画连线
- 正确配对连线变绿，错误连线变红后消失
代码模板：
```
const [selectedLeft, setSelectedLeft] = React.useState(null);
const [matches, setMatches] = React.useState([]);
const handleLeftClick = (id) => { setSelectedLeft(id); };
const handleRightClick = (rightId) => {
  if (!selectedLeft) return;
  const isCorrect = /* 检查 selectedLeft 和 rightId 是否匹配 */;
  setMatches(m => [...m, {left: selectedLeft, right: rightId, correct: isCorrect}]);
  setSelectedLeft(null);
};
// 连线用 SVG overlay:
<svg style={{position:'absolute', top:0, left:0, width:'100%', height:'100%', pointerEvents:'none'}}>
  {matches.map(m => <line x1={...} y1={...} x2={...} y2={...} stroke={m.correct?'green':'red'} strokeWidth={2}/>)}
</svg>
```

## cause_effect（因果操作）
- 左侧控制面板显示滑块/按钮/开关
- 右侧展示区域用 SVG 动画实时响应参数变化
- 参数变化时使用 CSS transition 平滑过渡
代码模板：
```
const [params, setParams] = React.useState({ctrl1: 50});
const handleChange = (id, value) => { setParams(p => ({...p, [id]: value})); };
// 左侧控制:
<input type="range" min={0} max={100} value={params.ctrl1}
       onChange={(e) => handleChange('ctrl1', +e.target.value)} />
// 右侧效果:
<div style={{transform: `translateY(${-params.ctrl1 * 2}px)`, transition: 'transform 0.5s'}}>
  <svg>/* 火箭等动画元素 */</svg>
</div>
```

---

直接输出完整的 HTML 代码（从 <!DOCTYPE html> 开始），不要包含 markdown 代码块标记，不要输出任何其他文字。"""


def validate_lab_html(html_code: str, interaction_type: str = "") -> dict:
    """Validate generated lab HTML for required structure.

    Args:
        html_code: The HTML string to validate.
        interaction_type: The interaction type (e.g. "click_select"). Used to
            tailor checks — drag checks are skipped for non-drag types.

    Returns dict with:
        - "fatal": str or None — if set, HTML is unusable
        - "warnings": list[str] — non-fatal issues
    """
    html_lower = html_code.lower()
    warnings = []

    # Fatal checks — must have these or HTML won't work
    if "<html" not in html_lower:
        return {"fatal": "Missing <html> tag", "warnings": []}
    if "react" not in html_lower:
        return {"fatal": "No React reference found", "warnings": []}
    if "<div" not in html_lower:
        return {"fatal": "No <div> element found", "warnings": []}

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
    if "<svg" not in html_lower:
        warnings.append("No SVG elements found — may lack visual items")
    if len(html_code) < 1000:
        warnings.append(f"HTML very short ({len(html_code)} chars) — may be incomplete")

    # Interaction-type-specific checks
    drag_types = {"drag_classify", "drag_sort"}
    if interaction_type in drag_types or not interaction_type:
        # Drag & drop checks — only for drag types (or when type unknown for backward compat)
        if "draggable" not in html_lower and "ondragstart" not in html_lower and "onDragStart" not in html_code:
            warnings.append("No draggable/onDragStart found — drag game may not work")

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
    """Generates complete runnable HTML+React+SVG code from a game design spec."""

    name = "lab_coder"
    description = "根据游戏设计稿生成完整可运行的 HTML+React+SVG 代码"

    def __init__(self, llm=None, **kwargs):
        super().__init__(**kwargs)
        self._llm = llm

    async def process(self, message: str, context: dict | None = None) -> str:
        design = json.loads(message) if isinstance(message, str) else message
        difficulty = context.get("difficulty", 5) if context else 5
        return self.generate(design, difficulty)

    def generate(self, design: dict, difficulty: int) -> str:
        """Generate complete HTML code from a game design spec.

        Args:
            design: The JSON dict from LabDesignerAgent.
            difficulty: Difficulty level (1-10).

        Returns:
            Complete HTML string, or empty string on failure.
        """
        difficulty_desc = "入门级" if difficulty <= 3 else "中级" if difficulty <= 6 else "高级"
        design_text = json.dumps(design, ensure_ascii=False, indent=2)

        interaction_type = design.get("interaction_type", "drag_classify")
        user_prompt = (
            f"请根据以下游戏设计稿，生成完整的 HTML 页面代码。\n\n"
            f"交互模式：{interaction_type}\n"
            f"游戏设计：\n{design_text}\n\n"
            f"难度：{difficulty_desc}\n\n"
            f"注意事项：\n"
            f"- 请严格按照 system prompt 中 {interaction_type} 类型的代码模板实现\n"
            f"- 严格按照设计稿中的 SVG 描述绘制每个元素\n"
            f"- 严格实现设计稿中描述的所有动画效果\n"
            f"- 正确和错误操作必须有明显不同的动画反馈\n"
            f"- 全部完成后必须有庆祝动画\n"
            f"- 分数显示和鼓励语要符合设计稿\n"
            f"- 布局紧凑，适配 600px 高度 iframe\n"
            f"- 直接输出完整 HTML 代码"
        )

        try:
            response = self._llm.invoke([
                SystemMessage(content=CODER_SYSTEM_PROMPT),
                HumanMessage(content=user_prompt),
            ])
            html_code = response.content.strip()
            # Strip markdown code fences
            if html_code.startswith("```"):
                lines = html_code.split("\n")
                html_code = "\n".join(
                    lines[1:-1] if lines[-1].strip() == "```" else lines[1:]
                )
                html_code = html_code.strip()

            # Validate HTML structure
            html_lower = html_code.lower()
            issues = validate_lab_html(html_code, interaction_type=interaction_type)
            if issues.get("fatal"):
                logger.warning(f"Coder output failed validation: {issues['fatal']}")
                return ""

            if issues.get("warnings"):
                for w in issues["warnings"]:
                    logger.warning(f"Lab HTML warning: {w}")

            logger.info(f"Coder: generated {len(html_code)} chars of HTML")
            return html_code

        except Exception:
            logger.exception("Lab coder failed")
            return ""
