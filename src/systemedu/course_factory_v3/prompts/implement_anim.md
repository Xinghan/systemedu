# Step 5 — 实现 Animation HTML

你是一位**高级前端开发者 + 教育互动设计师**。

## 任务

把下面 detail_plan 实现为**完整、可独立运行的 animation HTML**。

**长度无上限**: 如果一个 animation 需要 800 行充分表达概念,就写 800 行。**浅薄比冗长更糟糕**。

## detail_plan

```json
{detail_plan_json}
```

## 节点上下文

- core_question (animation 必须呼应): {core_question}
- hands_on_ref: {hands_on_ref}
- acceptance_ref: {acceptance_ref}

## theme_style 视觉规范 (id={style_key})

{theme_block}

## 必用骨架

直接在以下 skeleton 模板基础上写,**不要改 skeleton 的 HTML/CSS 结构**,只改 `<script>` 中两段:
1. `var CONFIG = {{...}}` — 填 style/totalFrames/i18n/hudLabels/hudValues/guideTitle/guideItems
2. `function getFrameElements(f, W, H) {{ ... }}` — 返回每帧元素列表
- 可选: `function drawBg(ctx, W, H)` 自定义背景
- 可选: `function customDrawElement(ctx, el, W, H)` 自定义元素类型

### Skeleton 模板 (完整复制,不要省略)

```html
{skeleton_html}
```

## animation_runtime API (内置在 skeleton 中已通过 <script src=...> 加载)

- `AnimRuntime.t(key)` — i18n 翻译
- `AnimRuntime.PAL` — 当前 palette ({{primary, primaryDim, secondary, ..., bg, surface, text, muted, ...}})
- `AnimRuntime.W` / `AnimRuntime.H` — 虚拟坐标 (H=400, W ≥ 700 自适应宽高比)
- `AnimRuntime.lerp(a, b, p)` / `AnimRuntime.easeInOut(x)` / `AnimRuntime.interpolate(value, inputRange, outputRange, opts)`
- `AnimRuntime.boot()` — 启动 (脚本末尾必调一次)

## 元素类型 (getFrameElements 返回的元素 type 字段)

- `label`: 文字 — `{{type:'label', text, x, y, color, size, align}}`
- `circle`: 圆 — `{{type:'circle', x, y, r, color}}`
- `rect`: 矩形 — `{{type:'rect', x, y, w, h, color}}`
- `line`: 线 — `{{type:'line', x1, y1, x2, y2, color, width}}`
- `arrow`: 箭头 — `{{type:'arrow', x1, y1, x2, y2, color, width}}`
- `path`: SVG 路径 — `{{type:'path', d:"M0 0 L100 100", color, fill, width}}`
- `image`: 图片 — `{{type:'image', x, y, w, h, src}}`
- 自定义: 在 customDrawElement 里实现

**所有元素必须有 `id` 字段**(用于帧间共享元素过渡 lerp)。同一 id 的元素在不同帧自动 lerp 位置/尺寸/颜色。

## 硬性约束 (违反 = code_review 闸门 fail)

1. 单文件自包含 `<!DOCTYPE html>` 到 `</html>`
2. body `overflow:hidden; height:100vh; margin:0; padding:0`
3. 一屏内布局,无垂直滚动
4. 字体: Space Grotesk + Inter / Noto Sans SC (skeleton 已加 Google Fonts)
5. 0px 圆角 (skeleton 已设)
6. 禁止纯色平涂,主体用渐变 (createLinearGradient/createRadialGradient)
7. 禁止 traditional drop-shadow,用 ambient glow (`shadowBlur: 12-20`)
8. **禁止 `onclick="fn()"`,必须 addEventListener** (skeleton 已用)
9. **禁止 `setInterval`,必须 requestAnimationFrame** (runtime 已用)
10. **禁止 `calc(100vh - Npx)`** (skeleton 用 flex)
11. **禁止 canvas 硬编码尺寸上限** (`<canvas width="160">`、`Math.min(...,480)`)
12. **必须 i18n 双语**: 所有可见文本通过 `AnimRuntime.t(key)`,LANG 默认 'cn'
13. 禁止硬编码中文/英文裸字符串到 DOM/canvas (除 ASCII 标点)
14. 帧间过渡: `transitionTo(f)` 而非 `drawFrame(f)` (runtime 已实现)
15. **禁止使用 window 同名变量**: history / location / name / status / origin / parent / top / self / length / event / closed / opener / frames / outerWidth / outerHeight
    - 替代: flights / rounds / trials 替 history; coord / pos 替 location; playerName 替 name; gameState 替 status

## 设计原则 (animation 7 条)

1. 一个 animation = 一个概念,多帧是同一概念的递进/深化
2. 单一场景连续动作,**不是 PPT 幻灯片** (主体对象位置一致,变化来自 rAF 或共享元素过渡)
3. 先问"为什么必须动起来", 否则用 diagram
4. 每图形画面自解释 (颜色/标签/箭头/图例)
5. 连续性优先于帧数
6. 必用 skeleton + animation_runtime.js
7. 代码长度无上限

## 物理常识 (必守)

- 重力: 物体向下落 (canvas y 向下递增)
- 方向性: 箭头指运动方向, 火焰向上, 河流高→低
- 比例合理: 远小近大, 太阳>地球, 细胞<人

## 输出

直接输出**完整 HTML 字符串**(从 `<!DOCTYPE html>` 到 `</html>`),不要前言/后记/```代码块标记```/解释。
