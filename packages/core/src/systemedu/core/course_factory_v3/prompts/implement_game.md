# 教学游戏

设计一个**精美、可玩、富有创意**的教学游戏, 让学生亲手操纵动态系统理解知识点。
**完全的视觉与交互自由**——不要被任何模板拘束。

## 知识点

```json
{detail_plan_json}
```

- 核心问题: {core_question}
- 学生该做的真实动作: {hands_on_ref}
- 必须验收的产物: {acceptance_ref}

## 视觉规范 (锁定 + 自由结合)

{theme_block}

- **颜色锁定**: 主体颜色全部用 CSS 变量 `var(--ORBIT)` 等 palette 名 (palette 已注入到 `:root`)
- **字体**: Inter / JetBrains Mono / Noto Sans SC (Google Fonts CDN)
- **玻璃态**: 浮动元素用 `backdrop-filter: blur(10px) + rgba` 半透明

## 布局规范 (强制) — 直接照下面骨架写, 不要乱改

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>...</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC&family=Inter&family=JetBrains+Mono&display=swap" rel="stylesheet">
  <style>
    :root {{ /* 这里注入 theme palette CSS 变量 */ }}
    body {{ margin:0; padding:0; overflow:hidden; height:100vh; background:var(--BG); font-family:'Noto Sans SC', sans-serif; }}
  </style>
</head>
<body class="h-screen overflow-hidden flex">
  <!-- 必须的左侧控制栏 (.game-sidebar 200px 固定宽) -->
  <aside class="game-sidebar w-[200px] h-screen flex-shrink-0 flex flex-col gap-4 p-4 border-r border-white/10">
    <h1 class="text-base font-bold">标题 / Title</h1>
    <p class="text-xs opacity-80">目标 50-100 字: 你要做什么...</p>
    <ul class="text-xs space-y-1 opacity-90">
      <li>· 操作 1: 拖动滑块...</li>
      <li>· 操作 2: 观察 HUD...</li>
      <li>· 操作 3: 寻找平衡点...</li>
    </ul>
    <div class="flex flex-col gap-2 mt-2">
      <label class="text-xs">力大小 F = <span id="lblF">5</span> N</label>
      <input id="sliderF" type="range" min="0" max="10" value="5" step="0.1" class="w-full">
      <label class="text-xs mt-2">质量 m = <span id="lblM">0.5</span> kg</label>
      <input id="sliderM" type="range" min="0.1" max="2" value="0.5" step="0.05" class="w-full">
    </div>
    <button id="langBtn" class="mt-auto px-2 py-1 text-xs border border-white/20 rounded">中 / EN</button>
  </aside>

  <!-- 主舞台 (剩余宽度) -->
  <main class="flex-1 h-screen relative overflow-hidden">
    <canvas id="stage" class="absolute inset-0 w-full h-full"></canvas>
    <!-- 右上 HUD 玻璃面板 -->
    <div class="absolute top-4 right-4 backdrop-blur-md bg-white/5 border border-white/10 rounded p-3 text-xs font-mono">
      <div>F = <span id="hF">5.0</span> N</div>
      <div>a = <span id="hA">10.0</span> m/s²</div>
      <div>v = <span id="hV">0.0</span> m/s</div>
    </div>
  </main>

  <script>
    /* 滑块监听 → 物理仿真 → HUD 实时更新 → langBtn 切换 */
  </script>
</body>
</html>
```

**铁律**:
- `<body>` 必须含 `overflow:hidden` + `height:100vh` (CSS) **和** `class="h-screen overflow-hidden"` (Tailwind 双重保险)
- `.game-sidebar` 200px 固定, `<main>` flex-1
- sidebar 内必须含: `#langBtn` + 至少 1 个 `<input type="range">` 滑块 + 文字说明
- 滑块的 `input` 事件必须实时更新 HUD 数值和主舞台仿真

## 6 条硬底线

1. **真交互**: 滑块/拖拽/键盘/鼠标实时操纵, 不能退化为"输入数字+确认"或"选项点击"
2. **真物理参数**: 涉及具体数值时用真实工程数值
3. **视觉与物理坐标分离**:
   - 物理量(米/秒/牛/度等) ≠ 像素, 视觉是物理量的"投影"
   - 当模拟值超出可视范围 → 镜头跟随 / 比例尺自适应 / 显示当前可视范围标尺(如"1 格=100m"或网格线带刻度)
   - 屏幕数字读数 与 视觉位置 永远保持一致 (不能数字说 200m 但物体已出屏)
   - **严格遵守 detail_plan 的 `directional_rules`** — 力的方向与物体响应方向必须一致, 禁止"向左施力物体向右动"
   - **严格按 detail_plan 的 `layout_zones` 划分屏幕** — 控制面板/主舞台/HUD/字幕各自独立不重叠
4. **中英文双语都能玩** (切换按钮 / 同时显示 / 段落对照, 实现自由)
5. **单文件 HTML**: `<!DOCTYPE html>` 到 `</html>`, 一屏内布局不滚动
6. **JS 顶层禁用 window 同名变量** (会覆盖全局对象导致页面挂掉):
   - **禁止** `var/let/const` 在顶层声明这些名字: `history`, `location`, `name`, `status`,
     `origin`, `parent`, `top`, `self`, `length`, `event`, `closed`, `opener`, `frames`,
     `outerWidth`, `outerHeight`
   - 这些是 window 已有属性, 顶层重新声明会破坏全局
   - 改名: 用 `appOrigin` / `gameTop` / `playerName` / `gameStatus` / `histArr` 等明确语义

剩下完全自由 — 3D / 物理引擎 / 任意 CDN 库都行。**浅薄比冗长糟**, 代码长度无上限。

直接输出完整 HTML, 不要任何解释/前言/代码块标记。
