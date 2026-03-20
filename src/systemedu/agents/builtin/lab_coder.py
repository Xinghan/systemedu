"""Lab Coder Agent - generates complete runnable HTML from a game design spec."""

import json
import logging

from deepagents import create_deep_agent
from langchain_core.messages import AIMessage, HumanMessage

from systemedu.agents.base import BaseAgent

logger = logging.getLogger(__name__)

CODER_SYSTEM_PROMPT = """你是一个专业的前端开发者，擅长 React + SVG + CSS 动画。你的任务是根据游戏设计稿，生成一个完整的、可在浏览器中独立运行的交互式小游戏 HTML 页面。

【技术栈】
- React 18 CDN:
  - https://unpkg.com/react@18/umd/react.production.min.js
  - https://unpkg.com/react-dom@18/umd/react-dom.production.min.js
- Babel standalone: https://unpkg.com/@babel/standalone/babel.min.js
- 不引入任何第三方图形库（不用 rough.js）
- script type="text/babel"
- ReactDOM.createRoot(document.getElementById('root')).render(<App />)

【视觉风格（卡通教育风）】
整体风格：活泼卡通，类似 Duolingo 的儿童教育游戏风格。圆润、色彩鲜明、有趣。

1. 字体与背景：
   - Google Fonts: <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
   - body font-family: 'Nunito', 'PingFang SC', 'Hiragino Sans GB', sans-serif
   - body 背景色：明亮渐变，如 linear-gradient(135deg, #EEF2FF 0%, #F0FDF4 100%)

2. 色板（高饱和度卡通色）：
   - 主蓝 #4F8EF7、主绿 #4ADE80、主红 #F87171、主橙 #FB923C、主紫 #A78BFA、主黄 #FCD34D
   - 卡片白色 #FFFFFF，border-radius: 16px，box-shadow: 0 4px 0 rgba(0,0,0,0.10)（底部阴影营造立体感）
   - 选中状态：border 3px solid 主色 + box-shadow: 0 0 0 4px 主色20%

3. 按钮（卡通立体感）：
   - 背景为主色，border-radius: 12px
   - box-shadow: 0 4px 0 darken主色（如 #3B7AF0 配 #2563EB 底部阴影）
   - 按下时：translateY(2px) + box-shadow 减少，模拟按压效果
   - 文字 font-weight: 800，白色

4. 卡片元素：
   - 统一白色背景 + 16px 圆角 + 底部 4px 彩色阴影
   - 每种类别用不同主色区分
   - 图标/符号用大字号 emoji 或简洁 SVG（不用手绘库）

5. SVG 图形：
   - 用纯 SVG path/circle/rect，颜色饱和鲜明
   - 形状圆润，strokeWidth 2，stroke 颜色比填充色深一档
   - 不使用任何第三方图形库

【图片渲染规则】
当物品数据含 image_url 字段（非 null 非空字符串）时，用 <img> 展示真实图片，失败时降级为 emoji：
```jsx
{item.image_url ? (
  <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:'64px',height:'64px'}}>
    <img src={item.image_url}
         style={{width:'64px',height:'64px',objectFit:'contain',borderRadius:'8px'}}
         onError={(e)=>{e.currentTarget.style.display='none'; e.currentTarget.nextSibling.style.display='flex';}} />
    <span style={{display:'none',width:'64px',height:'64px',alignItems:'center',justifyContent:'center',fontSize:'32px'}}>
      {/* emoji fallback，根据标签推断，如 🍃🐱📦🌊 */}
    </span>
  </span>
) : (
  <svg>/* 原有 SVG 图形 */</svg>
)}
```
- image_url 为 null 或缺失时：使用原有 SVG 几何图形，不使用 <img>
- onError 回调：隐藏失败的 img，显示 emoji fallback span
- 图片尺寸统一 64x64px，objectFit: contain，borderRadius: 8px

【CSS 动画要求】
- 正确答案：绿色边框 + scale(1.08) bounce + 对勾淡入
- 错误答案：红色边框 + shake 抖动（translateX）
- 卡片出现：bounceIn（scale 0.8 -> 1.05 -> 1.0）
- 完成庆祝：5-8 个彩色圆点从顶部飘落（@keyframes 控制 translateY + opacity）
- 使用 CSS transition + @keyframes，不用第三方动画库

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
- 点击选项后高亮并判断正确性，正确绿色边框+手绘对勾，错误红色+shake
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

## animated_story（动画演示）
- 用 SVG + anime.js 实现逐帧矢量动画（从 CDN 加载 anime.js：https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js）
- 不用 React，用原生 HTML + JS + SVG，更适合时间轴动画控制
- 布局：上方大 SVG 场景区（~320px 高），下方旁白文字区（~120px），底部继续按钮（~60px）
- 角色用 SVG group（<g>）包裹，通过 anime.js translate 实现移动
- 高亮效果：目标元素 filter glow + stroke 颜色变化 + 脉冲动画
- 旁白文字淡入淡出配合步骤切换
- 进度条显示当前步骤（第 X / 共 Y 步）
- 最后一步完成后：彩色圆点飘落 + 完成文字
代码模板：
```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js"></script>
  <style>
    body { margin:0; font-family:'PingFang SC',sans-serif; background:linear-gradient(135deg,#EEF2FF,#F0FDF4); height:100vh; overflow:hidden; display:flex; flex-direction:column; }
    #scene-area { flex:1; min-height:0; }
    #narration { padding:12px 20px; background:#fff; border-radius:12px; margin:8px 16px; font-size:15px; min-height:48px; box-shadow:0 2px 8px rgba(0,0,0,0.08); }
    #continue-btn { margin:8px 16px 12px; padding:10px; background:#4F8EF7; color:#fff; border:none; border-radius:12px; font-size:15px; font-weight:700; cursor:pointer; box-shadow:0 4px 0 #2563EB; }
    #continue-btn:active { transform:translateY(2px); box-shadow:0 2px 0 #2563EB; }
    #progress { font-size:12px; color:#94a3b8; text-align:center; margin-bottom:4px; }
    .highlight-glow { filter: drop-shadow(0 0 6px currentColor); }
    @keyframes float-confetti { 0%{transform:translateY(-20px);opacity:1} 100%{transform:translateY(580px);opacity:0} }
  </style>
</head>
<body>
  <svg id="scene-area" viewBox="0 0 760 320" preserveAspectRatio="xMidYMid meet">
    <!-- 场景元素：界面/物体/背景 -->
    <!-- 角色 <g id="char1"> ... </g> -->
  </svg>
  <div id="progress">第 1 / 4 步</div>
  <div id="narration">点击「继续」开始学习</div>
  <button id="continue-btn">继续</button>
  <script>
    const steps = [
      {
        narration: "这是浏览器的地址栏，用来输入网址",
        run: () => {
          anime({ targets: '#char1', translateX: 150, duration: 1000, easing: 'easeInOutQuad' });
          anime({ targets: '#addr-bar', stroke: '#4F8EF7', strokeWidth: 3, duration: 600, delay: 800 });
          // 显示标签
          document.getElementById('label-addr').style.opacity = 1;
          anime({ targets: '#label-addr', opacity: [0,1], scale: [0.8,1], duration: 400, delay: 1200 });
        }
      },
      // ... 更多步骤
    ];
    let currentStep = 0;
    function runStep(i) {
      document.getElementById('narration').textContent = steps[i].narration;
      document.getElementById('progress').textContent = `第 ${i+1} / ${steps.length} 步`;
      steps[i].run();
      if (i === steps.length - 1) {
        document.getElementById('continue-btn').textContent = '完成！';
      }
    }
    document.getElementById('continue-btn').addEventListener('click', () => {
      if (currentStep < steps.length) {
        runStep(currentStep);
        currentStep++;
      } else {
        showConfetti();
      }
    });
    function showConfetti() {
      for (let i = 0; i < 8; i++) {
        const dot = document.createElement('div');
        dot.style.cssText = `position:fixed;top:0;left:${10+i*12}%;width:12px;height:12px;border-radius:50%;background:${['#4F8EF7','#4ADE80','#FB923C','#A78BFA'][i%4]};animation:float-confetti ${1+Math.random()}s ease forwards;animation-delay:${i*0.1}s;`;
        document.body.appendChild(dot);
      }
    }
  </script>
</body>
</html>
```

关键要求：
- SVG 场景元素必须与设计稿中 scene.elements 完全对应
- 每个 animation_steps 的 actions 都用 anime.js 实现
- 角色走路：translateX 移动 + 小幅 translateY 正弦模拟步伐
- 高亮效果：stroke 颜色变化 + drop-shadow filter glow
- label_popup：SVG text + 小箭头，淡入显示
- 旁白文字要与步骤同步切换

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
    # animated_story uses anime.js without React, so skip the React requirement
    if interaction_type != "animated_story" and "react" not in html_lower:
        return {"fatal": "No React reference found", "warnings": []}
    if "<div" not in html_lower and "<svg" not in html_lower:
        return {"fatal": "No <div> or <svg> element found", "warnings": []}

    # Non-fatal structural checks (skip React-specific checks for animated_story)
    if interaction_type != "animated_story":
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

    if interaction_type == "animated_story":
        if "anime" not in html_lower and "animejs" not in html_lower:
            warnings.append("animated_story should use anime.js for timeline animations")
        if "steps" not in html_lower and "step" not in html_lower:
            warnings.append("animated_story should have animation steps logic")

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
        return await self.generate(design, difficulty)

    async def generate(self, design: dict, difficulty: int) -> str:
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
            import re as _re
            html_start = _re.search(r'(<!DOCTYPE\s+html|<html)', html_code, _re.IGNORECASE)
            if html_start and html_start.start() > 0:
                logger.info(f"Coder: stripping {html_start.start()} chars of preamble before HTML")
                html_code = html_code[html_start.start():]

            # Validate HTML structure
            issues = validate_lab_html(html_code, interaction_type=interaction_type)
            if issues.get("fatal"):
                logger.warning(f"Coder output failed validation: {issues['fatal']}")
                return ""

            if issues.get("warnings"):
                for w in issues["warnings"]:
                    logger.warning(f"Lab HTML warning: {w}")

            # Detect what the generated HTML actually implements
            import re
            title_match = re.search(r'<title>(.*?)</title>', html_code)
            html_title = title_match.group(1) if title_match else "?"
            has_drag = "draggable" in html_code or "onDragStart" in html_code
            has_click = "onClick" in html_code or "handleSelect" in html_code
            has_line = "<line" in html_code or "<path" in html_code
            has_range = 'type="range"' in html_code or "type='range'" in html_code
            actual_hints = []
            if has_drag:
                actual_hints.append("drag")
            if has_click:
                actual_hints.append("click")
            if has_line:
                actual_hints.append("svg-line")
            if has_range:
                actual_hints.append("range-slider")
            logger.info(
                f"Coder decision: requested_type={interaction_type} | "
                f"html_title='{html_title}' | "
                f"detected_patterns={actual_hints} | "
                f"{len(html_code)} chars"
            )
            return html_code

        except Exception:
            logger.exception("Lab coder failed")
            return ""
