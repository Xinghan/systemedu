# Game 核心逻辑生成

你是一位精通 DOM 交互的前端工程师。你需要为教育游戏编写核心 JS 逻辑代码。

## 上下文

### Idea 信息
```
__IDEA_JSON__
```

### Base Template 说明
你的代码将被注入到 game_base.html 的 `/* __CORE_LOGIC__ */` 位置。模板已经提供了：
- `container` — 游戏容器 div（600x560）
- `TITLE` — 游戏标题字符串
- `el(tag, attrs, children)` — DOM 元素创建工具函数
- `shuffle(arr)` — 数组随机排列

模板已包含的 CSS class（直接使用，不要重复定义）：
- `.sci-card` — sci-fi 风格卡片（半透明背景、蓝色边框、圆角）
- `.sci-btn` — sci-fi 按钮（渐变背景、hover 发光）
- `.neon-text` — 霓虹蓝色文字 + 发光
- `.glow-border` — 外发光边框
- `.game-title` — 游戏标题样式
- `.score-bar` — 顶部分数栏
- `.draggable` — 可拖拽元素
- `.drop-zone` / `.drop-zone.hover` / `.drop-zone.correct` / `.drop-zone.wrong` — 放置区
- `.pulse` / `.fade-in` — 反馈动画
- `.progress-bar` / `.progress-fill` — 进度条

### 高质量参考游戏
```
__SAMPLE_GAME__
```

## 你需要输出的内容

仅输出 `/* __CORE_LOGIC__ */` 部分的 JavaScript 代码。不要输出完整的 HTML 文件。不要包含 ```javascript 标记。

代码必须包含：
1. **游戏数据** — 题目、选项、正确答案等（中文内容）
2. **状态管理** — 分数、当前题号、已回答列表
3. **渲染函数 `render()`** — 每次状态变化后重新渲染整个 UI
4. **交互逻辑** — 拖拽/点击/选择事件处理
5. **反馈系统** — 正确/错误的视觉反馈（使用 `.correct`/`.wrong` class + `.pulse` 动画）
6. **完成状态** — 全部完成后显示得分和「重新挑战」按钮

## 游戏机制对应实现

根据 idea 中的 `game_mechanic` 字段：

### drag_match（拖拽匹配）
- 左侧：可拖拽卡片（描述/特征）
- 右侧：放置区（分类/名称）
- 使用 HTML5 Drag & Drop API + 触摸兼容

### sort_order（排序）
- 显示乱序的步骤/流程卡片
- 用户通过拖拽或上下箭头按钮排序
- 提交后检查顺序是否正确

### quiz_choice（选择题）
- 逐题展示，每题 3-4 个选项
- 选中后即时反馈（绿色/红色）
- 附带解释说明

### fill_blank（填空）
- 显示带空白的描述
- 提供候选词让用户填入
- 支持输入或拖拽填入

## 代码质量要求

- 使用 `var` 声明变量（兼容 IIFE strict mode）
- 不使用 ES6+ 语法（no let/const/arrow/class/template literal）
- 不引入外部库
- 使用模板提供的 `el()` 函数创建 DOM 元素
- 支持触摸设备（touch event 兼容）
- 中文界面文字
- 5-8 道题目/匹配项（数量适中）
- 代码总行数控制在 100-250 行

直接输出 JavaScript 代码，不要任何解释文字或 markdown 包裹。
