# Animation 核心逻辑生成

你是一位精通 Canvas 2D 动画的前端工程师。你需要为教育动画编写核心 JS 逻辑代码。

## 上下文

### Idea 信息
```
__IDEA_JSON__
```

### Base Template 说明
你的代码将被注入到 animation_base.html 的 `/* __CORE_LOGIC__ */` 位置。模板已经提供了：
- `canvas`, `ctx` — Canvas 2D 上下文
- `W=600, H=420` — 逻辑画布尺寸
- `COLORS` 对象 — sci-fi 配色方案：
  - `bg1="#0a0e14"`, `bg2="#1a1035"` — 背景渐变
  - `neonBlue="#00d2ff"`, `neonGreen="#00ff9d"`, `purple="#818cf8"` — 主色
  - `gold="#ffd700"`, `red="#ff4b2b"` — 强调色
  - `white="rgba(255,255,255,0.9)"`, `grid="rgba(255,255,255,0.03)"` — 辅助色
- `drawSciFiBg()` — 绘制深色渐变背景 + 网格
- `drawTitle(text)` — 绘制顶部标题
- `glow(color, blur)` / `noGlow()` — 发光效果
- `lerp(a, b, t)` / `easeInOut(t)` — 插值和缓动
- `particles[]` + `drawParticles()` — 背景飘浮粒子
- `TITLE` — 动画标题字符串

### 高质量参考动画
```
__SAMPLE_ANIMATION__
```

## 你需要输出的内容

仅输出 `/* __CORE_LOGIC__ */` 部分的 JavaScript 代码。不要输出完整的 HTML 文件。不要包含 ```javascript 标记。

代码必须包含：
1. **动画状态变量** — 时间、阶段、对象位置等
2. **核心绘制函数** — 绘制教学内容的主要视觉元素
3. **动画主循环** — 使用 `requestAnimationFrame` 驱动的主循环，每帧调用：
   - `drawSciFiBg()` — 背景
   - `drawParticles()` — 背景粒子
   - 你的核心绘制函数
   - `drawTitle(TITLE)` — 标题
4. **阶段切换逻辑** — 动画应有 2-4 个阶段，自动推进或循环

## Sci-Fi 视觉规范（强制）

| 元素 | 规范 |
|------|------|
| 发光 | 所有关键元素使用 `glow(color, 10-30)` |
| 粒子 | 流动粒子用 arc 绘制，alpha 0.3-0.7 |
| 曲线 | 贝塞尔曲线 `ctx.bezierCurveTo()` 或 `ctx.quadraticCurveTo()` |
| 渐变 | 使用 `createLinearGradient` / `createRadialGradient` |
| 标签 | 白色小字 12px，关键数值用 neonBlue/neonGreen |
| 动效 | 使用 sin/cos 做呼吸、脉冲、轨迹效果 |
| HUD | 左下角或右下角显示当前阶段提示文字 |

## 代码质量要求

- 使用 `var` 声明变量（兼容 IIFE strict mode）
- 不使用 ES6+ 语法（no let/const/arrow/class/template literal）
- 不引入外部库
- 动画流畅：60fps，避免 GC 压力（预分配数组，避免 frame 内创建对象）
- 中文标签和提示
- 代码总行数控制在 80-200 行

直接输出 JavaScript 代码，不要任何解释文字或 markdown 包裹。
