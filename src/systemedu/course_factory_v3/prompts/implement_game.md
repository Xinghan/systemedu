# Step 5 — 实现 Game HTML (fogsight 视觉 + 真实教学交互)

请你生成一个**非常精美的可交互教学游戏**, 让学生通过操纵动态系统理解下面 detail_plan 描述的知识点。

页面**极为精美, 好看, 有设计感**, 同时是一个**真正可玩的 sandbox**——
学生通过滑块/按钮/拖拽**实时调节参数**, 看到仿真结果立刻反馈, 建立"参数 → 结果"的因果直觉。

使用**和谐好看, 广泛采用的深色配色方案** + **丰富的视觉元素**。

**html + css + js + svg, 全部放进一个 html 里**。

---

## 知识点 detail_plan

```json
{detail_plan_json}
```

## 节点对齐 (必须呼应)

- **core_question**: {core_question}
- **hands_on_ref**: {hands_on_ref}
- **acceptance_ref**: {acceptance_ref}
- **chosen pattern**: {chosen_pattern}
- **学科主题色 (id={style_key})**: 优先使用对应学科 oklch palette。

## 推荐技术栈 (强烈建议直接采用)

1. **Tailwind CSS via CDN**: `<script src="https://cdn.tailwindcss.com"></script>`
2. **Google Fonts**: `Inter` (正文) + `JetBrains Mono` (HUD 数字) + `Noto Sans SC` (中文)
3. **inline SVG** 绘制场景主体 (火箭/分子/电路等), 用 `<linearGradient>` + `<path>` 渐变曲线
4. **CSS @keyframes + transitions** 驱动平滑动画, 不要 Canvas lerp
5. **<canvas> + Particle 类** (rAF 循环) 实现尾焰/粒子等动态效果
6. **`<input type="range">` 滑块**, 自定义样式带 oklch glow
7. **HUD 玻璃态**: `backdrop-filter: blur(10px); background: rgba(30, 41, 59, 0.7);`
8. **真实物理参数**: 数值要真实 (Saturn V F-1 推力 ~7000 kN, 比冲 ~263s)

## 教学骨架 (硬规则, 与 fogsight 不同)

整体布局 = **左侧 200px sidebar (含真实交互控件) + 右侧主舞台**:

```html
<div class="flex h-screen">
  <!-- 左侧 sidebar: 含 lang-btn / 标题 / 操作说明 / 控件 (滑块/按钮) -->
  <div class="w-[200px] shrink-0 bg-slate-950/80 border-r border-slate-800 p-3 flex flex-col gap-3 text-slate-300 overflow-y-auto">
    <button id="langBtn" class="self-start text-[10px] px-2 py-1 border border-slate-700 hover:border-cyan-400">CN</button>
    <h1 class="text-[12px] font-bold text-cyan-400 mt-1 uppercase tracking-wider" id="gameTitle"></h1>
    <div class="text-[9px] uppercase tracking-widest text-cyan-400 mt-2">操作指南</div>
    <div class="text-[11px] text-slate-400 leading-relaxed" id="guideContent"></div>

    <!-- 控件区: 每个 simulation_param 一个滑块 -->
    <div class="text-[9px] uppercase tracking-widest text-cyan-400 mt-2">参数控制</div>
    <div class="flex flex-col gap-2" id="controlsContainer">
      <!-- 由 JS 根据 detail_plan.simulation_params 动态生成 -->
    </div>

    <!-- 主操作按钮 -->
    <button id="actionBtn" class="mt-2 px-3 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs uppercase tracking-wider hover:shadow-cyan-500/50 hover:shadow-lg transition">发射 / Launch</button>
    <button id="resetBtn" class="px-3 py-1.5 border border-slate-700 hover:border-cyan-400 text-slate-400 text-[10px] uppercase">重置</button>
  </div>

  <!-- 右侧主舞台: SVG 场景 + HUD + 状态显示 (fogsight 风格自由发挥) -->
  <div class="flex-1 relative overflow-hidden bg-slate-900">
    <!-- 你的 SVG 场景 / canvas / HUD / 字幕 -->
  </div>
</div>
```

**硬规则**:
- lang-btn 必须在左侧 sidebar (不允许 `position: fixed/absolute` 浮在主舞台)
- **每个 detail_plan.simulation_params 项必须对应一个 sidebar 中的 `<input type="range">`** (含 label + 当前值显示)
- 主舞台 100vh 不滚动
- 滑块拖动必须**实时**更新视觉 (拖动时 oninput 立即重绘, 不是松开才更新)

## Pattern {chosen_pattern} 落地

按 detail_plan 的 game_mechanic 描述实现真正的"操纵动态系统":
- Pattern 1 Sandbox: 滑块 → 实时仿真引擎 (rAF) → 视觉反馈
- Pattern 2 Build & Test: 零件库 → 拼装区 → Run → 仿真执行
- Pattern 6 Live Tuning: 实时画面 + 控制按钮 + 瞬时反馈
- 其它 Pattern 见 SKILL.md §1006-1095

**禁止退化为**:
- 输入数字 + 确认 (那是 exercise)
- 选项点击 (那是选择题)
- "玩家不知道答案就无法开始" (那是 exercise 变装)

## i18n 双语

```js
var LANG = 'cn';
var I18N = {
  // ... 所有 sidebar / HUD / 状态文本
};
function t(key) { return (I18N[key] && I18N[key][LANG]) || (I18N[key] && I18N[key]['en']) || key; }
function refreshI18N() {
  // 必须实现: 更新所有 DOM 文本 + 重渲染动态生成的列表 + 重绘 canvas
}
document.getElementById('langBtn').addEventListener('click', function() {
  LANG = LANG === 'cn' ? 'en' : 'cn';
  this.textContent = LANG.toUpperCase();
  refreshI18N();
});
```

## 硬性约束

1. 单文件自包含
2. body `overflow: hidden`, 一屏内
3. **禁止 `onclick` 属性**, 必须 `addEventListener`
4. 动画循环必须 `requestAnimationFrame` (但 setInterval 用于"每 200ms 更新数字"是允许的)
5. **禁止 window 同名变量**: history/location/name/status/event/length/parent/top/self
6. 物理常识: 重力向下, 火焰向上, 比例合理
7. **数值真实性**: 涉及具体物理量时用真实工程参数
8. 通关后展示**学习总结面板** (中英双语, 写明 takeaway)
9. **代码长度无上限**, 浅薄比冗长更糟糕

## 输出

直接输出**完整 HTML 字符串**, 不要前言/后记/代码块标记/解释。
