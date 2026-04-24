# Step 5 — 实现 Game HTML

你是一位**高级前端开发者 + 教育游戏设计师**。

## 任务

把下面 detail_plan 实现为**完整、可独立运行的 game HTML**。

**长度无上限,复杂度由教学目标决定**。如果游戏需要 2000 行,就写 2000 行。**浅薄比冗长更糟**。

## detail_plan

```json
{detail_plan_json}
```

## 节点上下文

- core_question: {core_question}
- hands_on_ref: {hands_on_ref}
- acceptance_ref: {acceptance_ref}
- chosen pattern: {chosen_pattern}

## theme_style 视觉规范 (id={style_key})

{theme_block}

## Game 标准布局 (必须用,违反 = 5.5a fail)

直接复制下面 skeleton,改 CONFIG / I18N / drawCanvas / 交互逻辑:

```html
{skeleton_html}
```

布局核心:
- `.game-wrap` flex-direction:row,横向布局
- 左侧 `.game-sidebar` (200px) 含 lang-btn / 标题 / guide / 操作控件 (滑块/按钮)
- 右侧 `.game-main` (flex:1) 含 hud / canvas / 状态栏
- **禁止** lang-btn 用 position:fixed/absolute 浮在 canvas 上方
- **禁止** guide 浮在 canvas 上方

## Game Pattern 落地 (chosen_pattern={chosen_pattern})

按 detail_plan 中 game_mechanic 描述实现真正的"操纵动态系统":
- Pattern 1 Sandbox: 滑块/输入控件 → 实时仿真引擎 (rAF) → 视觉反馈
- Pattern 2 Build & Test: 零件 palette → 拖拽拼装区 → Run 按钮 → 仿真执行
- Pattern 3 Causal Chain: 多变量面板 → 实验日志 → "我猜规则是 X" 提交
- Pattern 4 Resource Management: 资源条 + 行动菜单 + 目标列表 + 回合推进
- Pattern 5 Detective: 线索面板 + 假设列表 + 提交诊断按钮
- Pattern 6 Live Tuning: 实时画面 + 控制按钮/滑块 + 瞬时反馈
- Pattern 7 Strategy Map: 地图 + 节点选择 + 累计代价 + 提交方案
- Pattern 8 Visual Programming: 积木库 + 拼装区 + 运行按钮 + 角色执行
- Pattern 9 Experimental Design: 问题陈述 + 变量面板 + 对照设置 + 执行 + 统计结果
- Pattern 10 Role-Play: 情境文本 + 多选项决策 + 状态条 + 后续分支

**禁止** 退化为"输入数字 + 确认"的填空题 / 选择题变装。
**禁止** "玩家不知道答案就无法开始游戏"(那是 exercise)。

## 硬性约束 (与 implement_anim 共享)

1. 单文件自包含,body overflow:hidden / height:100vh
2. 0px 圆角 / 渐变 / ambient glow / 玻璃态
3. **禁止 onclick 属性,必须 addEventListener**
4. **禁止 setInterval,必须 requestAnimationFrame**
5. **禁止 calc(100vh-Npx)**
6. **禁止 canvas 硬编码上限** (`Math.min(...,480)` 等)
   - 正确: `sz = Math.min(availW, availH); sz = Math.max(sz, 80);`
   - 在 `resizeCanvas()` 中读 `getBoundingClientRect()` 重算
7. **必须 i18n 双语**: 所有可见文本通过 `t(key)`,默认 LANG='cn'
8. **必须实现 refreshI18N()**: 更新所有 DOM 文本 + 重绘 canvas + 重渲染动态列表
9. **禁止 window 同名变量**: history / location / name / status / origin / parent / top / self / length / event 等
10. canvas 直接父容器必须 `display:flex; flex-direction:column` (skeleton `.game-body` 已设)
11. 拖拽必须同时绑 mouse + touch (touchmove 调 preventDefault)
12. 通关后展示学习总结面板

## 物理常识

- 重力向下 / 比例合理 / 方向正确 (与 implement_anim 同)

## 输出

直接输出**完整 HTML 字符串**,不要前言/后记/```代码块标记```/解释。
