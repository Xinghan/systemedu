# Step 5 — 实现 Animation HTML (fogsight 风格)

请你生成一个**非常精美的动态动画**, 讲讲下面 detail_plan 描述的知识点。

要动态的, 要像一个**完整的, 正在播放的视频**。包含一个完整的过程, 能把知识点讲清楚。
页面**极为精美, 好看, 有设计感**, 同时能够很好地传达知识。**知识和图像必须准确**。

附带**旁白式的双语字幕** (中文 + 英文), 从头到尾讲清楚一个小的知识点。
**不需要任何互动按钮, 直接开始播放** (帧导航/暂停由 sidebar 控制, 见下方"教学骨架")。

使用**和谐好看, 广泛采用的深色配色方案** (slate-900 / indigo / cyan 系), 使用**很多丰富的视觉元素**。

**请保证任何一个元素都在容器中被摆在了正确的位置**, 避免穿模 / 字幕遮挡 / 图形位置错误等问题影响视觉传达。

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
- **学科主题色 (id={style_key})**: 优先使用 `oklch(0.72 0.17 295)` 系列空间紫 / cyan-400 / orange-400 / fuchsia 渐变。

## 推荐技术栈 (强烈建议直接采用, 看起来更精美)

1. **Tailwind CSS via CDN**: `<script src="https://cdn.tailwindcss.com"></script>`
   - 直接用 `text-cyan-400 font-bold tracking-widest` 类似 utility class
2. **Google Fonts**: `Inter` (正文) + `JetBrains Mono` (HUD 数字) + `Noto Sans SC` (中文)
3. **inline SVG** 绘制主体物体 (火箭/分子/力箭头等), 用 `<linearGradient>` 渐变 + `<path>` 自由曲线
4. **CSS @keyframes** 驱动连续动画 (`shake` / `float` / `pulse-glow` / `blink`)
5. **CSS `transition: transform Xs cubic-bezier(...)`** 实现物体连续运动, 不要 Canvas lerp
6. **<canvas> + Particle 类** 实现尾焰 / 粒子效果 (rAF 循环 + life/decay/vx/vy)
7. **scenes 时间轴**: JS 数组定义多个 phase, 每个有 `id` / `action` / `duration` / `next`, `runScene()` 用 setTimeout 串行推进
8. **`<defs>` + `<marker>`** 实现 SVG 箭头 (推力箭头/排气箭头, 带文字标注)
9. **HUD 玻璃态**: `backdrop-filter: blur(10px); background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(148, 163, 184, 0.2);`
10. **双语字幕 box**: 浮在底部, 中文大字 + 英文小字斜体, fade transition

## 教学骨架 (与 fogsight 不同, 我们必须保留)

整体布局 = **左侧 200px sidebar + 右侧主舞台**:

```html
<div class="flex h-screen">
  <!-- 左侧 sidebar: 必须有 -->
  <div class="w-[200px] shrink-0 bg-slate-950/80 border-r border-slate-800 p-3 flex flex-col gap-2 text-slate-300">
    <button id="langBtn" class="self-start text-[10px] px-2 py-1 border border-slate-700 hover:border-cyan-400">CN</button>
    <h1 class="text-[12px] font-bold text-cyan-400 mt-2 uppercase tracking-wider" id="title"></h1>
    <div class="text-[10px] text-slate-500" id="frameInd"></div>
    <div class="text-[9px] uppercase tracking-widest text-cyan-400 mt-2">观看指南</div>
    <div class="text-[11px] text-slate-400 leading-relaxed" id="guideContent"></div>
  </div>
  <!-- 右侧主舞台: 自由发挥 fogsight 风格 -->
  <div class="flex-1 relative overflow-hidden bg-slate-900">
    <!-- 你的 SVG / canvas / HUD / 字幕 都放这里 -->
  </div>
</div>
```

**硬规则**:
- lang-btn 必须在左侧 sidebar, 不允许 `position: fixed/absolute` 浮在主舞台
- guide 内容来自 detail_plan.user_guide.observe_points (列表渲染)
- title 来自 detail_plan.title
- 主舞台高度 = 100vh, 不允许垂直滚动

## i18n 双语 (必须)

```js
var LANG = 'cn';
var I18N = {
  title:    {en: 'TITLE', cn: '标题'},
  // ... 所有可见文本 (sidebar 标题/字幕/HUD 标签) 都用 t(key) 取
};
function t(key) { return (I18N[key] && I18N[key][LANG]) || (I18N[key] && I18N[key]['en']) || key; }

document.getElementById('langBtn').addEventListener('click', function() {
  LANG = LANG === 'cn' ? 'en' : 'cn';
  this.textContent = LANG.toUpperCase();
  refreshI18N();  // 你必须实现: 更新所有 DOM 文本 + 重绘动画
});
```

字幕 box 的中文/英文行可以用单独 `<p id="subCn">` / `<p id="subEn">`, 不需要进 I18N 表。

## 硬性约束 (违反 = 闸门 fail)

1. 单文件自包含 (`<!DOCTYPE html>` 到 `</html>`)
2. body `overflow: hidden`, 一屏内布局, 无垂直滚动
3. **禁止 `onclick="fn()"` 属性**, 必须 `addEventListener`
4. 动画循环必须 `requestAnimationFrame`, **禁止 `setInterval` 做帧循环** (但 setInterval 用于"每 200ms 更新一个数字"是允许的)
5. **禁止 window 同名变量**: history/location/name/status/event/length/parent/top/self 等做顶层 `var`
6. 物理常识: 重力向下, 火焰向上, 比例合理 (太阳>地球, 细胞<人), 颜色直觉 (天空蓝/植物绿/火橙/水蓝)
7. **数值真实性**: 涉及具体物理量 (kg/s, m/s, N) 时用真实工程参数 (例: Saturn V F-1 引擎质量流量 ~270 kg/s, 排气速度 ~2500 m/s)
8. 双语字幕从头到尾覆盖整个动画过程 (中文 + 英文)
9. **代码长度无上限**, 浅薄比冗长更糟糕 (fogsight 演示约 500-800 行)

## 输出

直接输出**完整 HTML 字符串** (从 `<!DOCTYPE html>` 到 `</html>`), 不要前言/后记/代码块标记/解释。
