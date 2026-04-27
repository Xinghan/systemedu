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

## 布局推荐 (Tailwind utility class)

- 引入 Tailwind: `<script src="https://cdn.tailwindcss.com"></script>`
- 推荐布局: 主舞台占满, 浮动 HUD + 双语字幕 box (无须 sidebar, 因为 anim 不互动)
- 字幕浮动在底部, 中文大字 + 英文小字斜体, fade transition

## 5 条硬底线

1. **像视频一样自动播放**: 用 scenes 时间轴 (JS 数组 + setTimeout 串行推进 phase),
   每个 phase 字幕 / HUD / 视觉同步切换; 不要按帧导航 / 不要互动按钮
2. **真物理参数**: 涉及具体数值时用真实工程数值
3. **视觉与物理坐标分离**:
   - 物理量(米/秒/牛/度等) ≠ 像素, 视觉是物理量的"投影"
   - 当模拟值超出可视范围 → 镜头跟随 / 比例尺自适应 / 显示当前可视范围标尺(如"1 格=100m")
   - 屏幕数字读数 与 视觉位置 永远保持一致 (不能数字说 200m 但物体已出屏)
4. **中英文双语字幕** 从头覆盖整个动画过程
5. **单文件 HTML**: `<!DOCTYPE html>` 到 `</html>`, 一屏内布局不滚动

剩下完全自由 — 3D / 物理引擎 / 任意 CDN 库都行。**浅薄比冗长糟**, 代码长度无上限。

直接输出完整 HTML, 不要任何解释/前言/代码块标记。
