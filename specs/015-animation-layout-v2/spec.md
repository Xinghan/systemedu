# 015-animation-layout-v2

**Status**: shipped (2026-04-17)
**Owner**: xinghan
**Created**: 2026-04-17

## 背景 / 问题

Animation 和 Game 中的 `lang-btn`（语言切换）和 `guide-panel`（操作说明）长期使用 `position:fixed` 浮在 canvas 上方，导致反复出现以下问题：

1. **遮挡**：固定浮层盖住 canvas 内容，需要计算"安全区域"绕开
2. **坐标偏移**：`getFrameElements(f, W, H)` 的 W/H 要扣除安全区域，内容代码需要额外的 ox/oy 偏移
3. **DPR 计算错误**：`customDrawElement` 中手动计算 DPR 导致在不同设备上画面位置不一致
4. **每次生成新动画都要调整**：`_IFRAME_LAYOUT_PATCH`（factory.py 中 `!important` 样式注入）作为 workaround，脆弱且难以维护

根因：UI 元素和 canvas 内容混在同一层，本质上是布局架构问题，不是个别动画的 CSS 参数问题。

## 方案

**sidebar 布局**：将 lang-btn 和 guide-panel 从 canvas 区域彻底分离到左侧栏，canvas 独占右侧全部空间。Animation 和 Game 统一采用 `flex-direction:row` 的左右分栏。

### Animation（runtime 内置，skeleton + runtime.js）

```
.wrapper (flex-direction:row, 100vh)
  .sidebar (200px, 文档流)
    button.lang-btn#langBtn
    h1#title
    .sub#subtitle
    .frame-ind#frameIndicator
    .guide-label#guideTitle
    .guide-content#guideContent
  .anim-main (flex:1)
    .canvas-wrap (flex:1, overflow:hidden)
      canvas#c
    .controls (prev/play/next)
    .hud (4 列数据)
```

- `.sidebar`：200px 固定宽度左侧栏，包含 lang-btn、标题、帧指示器、观看指南，始终可见
- `.anim-main`：`flex:1` 占据右侧全部空间
- `.canvas-wrap`：canvas 占满 `.anim-main` 剩余空间，没有任何 UI 元素重叠
- `_contentTransform` 不需要 safe-area offset（ox=0, oy=0）
- `customDrawElement(ctx, el, W, H)` 的 W/H 就是完整画布虚拟尺寸

### Game（无共享 runtime，需自行实现 sidebar）

```
.game-wrap (flex-direction:row, 100vh)
  .game-sidebar (200px, 文档流)
    button.sidebar-lang#langBtn
    .sidebar-title#sidebarTitle
    .sidebar-guide#guideContent
  .game-main (flex:1)
    .game-header (title + round info)
    .game-body (canvas, flex:1)
    .control-panel (buttons)
    .hud-bar (data display)
```

- `.game-sidebar`：200px 固定宽度左侧栏，包含 lang-btn、标题、操作说明，始终可见
- `.game-main`：`flex:1` 占据右侧全部空间
- **禁止 `position:fixed` / `position:absolute`** 将任何 UI 元素浮在游戏区上方
- I18N 必须包含 `guide` key，sidebar JS 自动填充

## 改动范围

| 文件 | 变更 |
|------|------|
| `course_factory/runtime/animation_skeleton.html` | 重写为 sidebar 布局（`.wrapper > .sidebar + .anim-main`） |
| `course_factory/runtime/animation_runtime.js` | 移除 `_measureSafeArea()`、`_safeInset`、safe-area 计算；简化 `_contentTransform()`；`_buildGuide()` 直接写入 sidebar 中的 `#guideTitle` / `#guideContent`（无折叠逻辑） |
| `course_factory/factory.py` | 删除 `_IFRAME_LAYOUT_PATCH` 常量；简化 `_inline_runtime()` |
| `course_factory/tests/anim/test_anim_k{13-17}_*.html` | 全部迁移到 sidebar 布局 |
| `.claude/skills/course_factory/SKILL.md` | 更新 Animation Runtime 章节为 sidebar 布局、Game 标准布局模板为 sidebar、i18n 规范、guide-panel 规范、自检清单、常见遗漏 |
| DB `lesson_content` K13-K17 game HTML | 全部重建为 `.game-wrap > .game-sidebar + .game-main` sidebar 布局 |

## 删除的代码 / 概念

- `_measureSafeArea()` 函数
- `_safeInset` 状态变量
- `_contentTransform()` 中的 ox/oy safe-area 偏移
- `_IFRAME_LAYOUT_PATCH`（factory.py 中注入 iframe 的 `!important` 样式）
- animation/game 中 `position:fixed` 的 `.lang-btn` 和 `.guide-panel` CSS
- animation 的 `.top-bar` + `.guide-bar`（可折叠）布局（中间方案，已被 sidebar 替代）
- `#guideToggle` 按钮和 guide 折叠/展开逻辑

## 设计原则

**为什么用 sidebar 而不是 top-bar + guide-bar？**

中间方案（`.top-bar` 一行放 lang-btn/title/guide-toggle + `.guide-bar` 可折叠）仍有问题：
- guide-bar 展开时占据大量垂直空间，挤压 canvas
- guide 内容多时 canvas 被推到页面下半部分
- 每次都要在"guide 可见"和"canvas 空间"之间权衡

sidebar 布局一劳永逸：
- 左侧 200px 固定栏，guide 始终可见，不影响 canvas 空间
- canvas 占据右侧全部垂直高度
- Animation 和 Game 统一方案，减少布局差异

## 验收标准

- [x] K13-K17 动画在浏览器中正常渲染，无 UI 遮挡
- [x] lang-btn 和 guide-panel 在文档流中，不使用 `position:fixed`
- [x] `customDrawElement(ctx, el, W, H)` 收到完整画布虚拟尺寸，无 DPR 手动计算
- [x] SKILL.md 已更新，所有 old-layout 引用已替换
- [x] DB 中 K13-K17 的 rendered_sections HTML 已同步更新
