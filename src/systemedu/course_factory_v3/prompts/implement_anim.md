# 教学动画

设计一个**精美、像视频一样自动播放的动态动画**, 把下面知识点讲清楚。
**完全的视觉与叙事自由**——不要被任何模板拘束。

## 知识点

```json
{detail_plan_json}
```

- 核心问题: {core_question}
- 学生该做的真实动作 (字幕/HUD 应呼应): {hands_on_ref}
- 必须验收的产物 (动画结尾应明示学生记住什么): {acceptance_ref}

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
  <!-- 必须的左侧栏 (.sidebar 200px 固定宽) -->
  <aside class="sidebar w-[200px] h-screen flex-shrink-0 flex flex-col gap-4 p-4 border-r border-white/10">
    <h1 class="text-base font-bold">标题 / Title</h1>
    <div class="text-xs opacity-80">
      <p class="mb-1">概念简介中文 50-100 字...</p>
      <p class="italic opacity-70">English summary...</p>
    </div>
    <ul class="text-xs space-y-1">
      <li>· 观察提示 1</li>
      <li>· 观察提示 2</li>
      <li>· 观察提示 3</li>
    </ul>
    <button id="langBtn" class="mt-auto px-2 py-1 text-xs border border-white/20 rounded">中 / EN</button>
  </aside>

  <!-- 主舞台 (剩余宽度) -->
  <main class="flex-1 h-screen relative overflow-hidden">
    <canvas id="stage" class="absolute inset-0 w-full h-full"></canvas>
    <!-- 右上 HUD 玻璃面板 -->
    <div class="absolute top-4 right-4 backdrop-blur-md bg-white/5 border border-white/10 rounded p-3 text-xs font-mono">
      <div>F = <span id="hF">5.0</span> N</div>
      <div>v = <span id="hV">0.0</span> m/s</div>
    </div>
    <!-- 底部双语字幕 -->
    <div class="absolute bottom-6 left-1/2 -translate-x-1/2 text-center transition-opacity duration-700">
      <div class="text-2xl font-bold text-white" id="subZh">中文字幕</div>
      <div class="text-sm italic opacity-70" id="subEn">English subtitle</div>
    </div>
  </main>

  <script>
    /* scenes 时间轴, 自动播放, langBtn 切换字幕 */
  </script>
</body>
</html>
```

**铁律**:
- `<body>` 必须含 `overflow:hidden` + `height:100vh` (CSS) **和** `class="h-screen overflow-hidden"` (Tailwind 双重保险)
- `.sidebar` 200px 固定, `<main>` flex-1
- `#langBtn` 必须有, sidebar 内
- 主舞台是 `<canvas>` 或 `<svg>` 都行, 但容器 absolute inset-0

## 6 条硬底线

1. **本质要求 — 演示一条独立科学规律的过程**:
   - 看 detail_plan_json 里的 `scientific_concept` 和 `process_to_show`, 整个 anim 必须把那条规律的因果链演出来
   - 不是项目步骤的可视化, 不是结构图动起来 — 是科学规律本身在你眼前发生
   - 学生看完能用自己话复述这条规律 (而不是记住视觉细节)
   - **严格遵守 `directional_rules` 中的方向规约** — 力的方向 → 物体运动方向必须一致; 推力向右物体不能向左动
   - **严格按 `layout_zones` 划分屏幕区域** — 主舞台/HUD/字幕/标题各自独立, 严禁互相挤压重叠
2. **自动播放主流程** (anim 不是 game, 主舞台不能等用户操作):
   - 页面 `load` / `DOMContentLoaded` 触发后**立即**开始主舞台动画, 视觉立刻有变化, 不要等任何点击
   - **唯一允许的交互**: sidebar 里的 `#langBtn` 中/EN 切换字幕语言。其他**禁止**: 滑块 / 数字输入 / 控制面板 / "点击开始"/"按 X 切换"
   - **禁止**主舞台元素挂 `addEventListener('click')` 等用户操作; 只 lang 按钮可以
   - **禁止**初始化物理量为 0 等待用户输入 — 例如不要 `force = 0` 然后等拨滑块, 必须 `force = 5.0` 直接开演
   - 用 scenes 时间轴 (JS 数组 + setTimeout / requestAnimationFrame 串行推进 phase),
     每个 phase 字幕 / HUD / 视觉同步切换; 整个动画 30-90 秒, 末尾自动循环或停在 takeaway
3. **真物理参数**: 涉及具体数值时用真实工程数值, 起始就给定具体数值不是 0
4. **视觉与物理坐标分离**:
   - 物理量(米/秒/牛/度等) ≠ 像素, 视觉是物理量的"投影"
   - 当模拟值超出可视范围 → 镜头跟随 / 比例尺自适应 / 显示当前可视范围标尺(如"1 格=100m")
   - 屏幕数字读数 与 视觉位置 永远保持一致 (不能数字说 200m 但物体已出屏)
5. **中英文双语字幕** 从头覆盖整个动画过程
6. **单文件 HTML**: `<!DOCTYPE html>` 到 `</html>`, 一屏内布局不滚动
7. **JS 顶层禁用 window 同名变量** (会覆盖全局对象导致页面挂掉):
   - **禁止** `var/let/const` 在顶层声明这些名字: `history`, `location`, `name`, `status`,
     `origin`, `parent`, `top`, `self`, `length`, `event`, `closed`, `opener`, `frames`
   - 改名: 用 `histArr` / `appOrigin` / `animTop` / `sceneName` / `gameStatus` 等明确语义

剩下完全自由 — 3D / 物理引擎 / 任意 CDN 库都行。**浅薄比冗长糟**, 代码长度无上限。

直接输出完整 HTML, 不要任何解释/前言/代码块标记。
