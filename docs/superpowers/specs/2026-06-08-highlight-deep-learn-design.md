# 高亮课文 → "深入学习" → tutor 解释 + "用户询问"记录 设计文档

- Status: shipped (2026-06-08)
- 验收结果: 全链路打通 (前端选区 hook + HighlightAskButton 浮按钮 → chat-store pendingAsk 桥 → ChatPanel 自动发送 source=highlight_ask → 后端 ChatPayload/append_message/ChatMessage.source 落库, alembic 037)。端到端验证: highlight_ask 消息 → user 消息 source=highlight_ask, assistant source=chat, tutor 正常解释。全量 tests/student 199 passed。挂载点挂在课文阅读区根容器 (未污染共享 MarkdownBlock)。
- Date: 2026-06-08
- 关联: spec 028 (tutor chat), spec 031 (chat memory), ChatPanel 常驻面板, ChatMessage 表

## 1. 背景与目标

学生在学习详情页读课文时，遇到不懂的句子，希望一键问 AI 导师。本特性: 鼠标高亮一段课文 →
浮出「深入学习」按钮 → 点击自动把"解释 prompt + 高亮内容"作为一条消息发给常驻 chatbot，
tutor 流式解释。这类问题在 chat 记录里单独标记为「用户询问」(source 标签)，可筛选/统计。

### 目标
- G1 课文区选中文本 → 选区附近浮出「深入学习」按钮 (选区过短/非课文区不弹)。
- G2 点击 → 自动组装消息 (prompt 模板 + 高亮内容) → 发给常驻 ChatPanel → tutor 流式解释。
- G3 这类消息打 `source="highlight_ask"` 标签，落 ChatMessage.source，可与普通对话区分。

### 非目标
- 不做高亮持久化 (划线笔记)。本特性的"高亮"是一次性选区，用完即走。
- 不做跨知识点引用 / 多选区。
- 不改 tutor 解释逻辑 (走现有 chat 流)。

## 2. 交互流 (前端)

1. learn page 的课文区 (article) 监听 `mouseup`/`selectionchange`。
2. 有选区 + 选中文本 trim 后长度 >= 4 且 <= 500 + 选区落在课文容器内 → 在选区下方浮出
   「深入学习」按钮 (绝对定位, 跟随选区 rect)。点击空白/选区消失 → 按钮隐藏。
3. 点击「深入学习」→ 组装 `prompt模板 + 高亮内容` → 写入 chat-store 的 `pendingAsk` →
   ChatPanel useEffect 监听到 → 调 handleSend(消息, {source:"highlight_ask"}) + 滚动聚焦 →
   清空 pendingAsk → 隐藏按钮 + 清选区。
4. tutor 正常流式回答。

### prompt 模板 (前端组装，用户可见自己问了什么)
```
请帮我解释这段课文的含义："{高亮内容}"。用我能听懂的方式讲清它说的是什么、为什么重要。
```
(高亮内容过长截断到 500 字。)

## 3. 数据落点 — "用户询问" (后端, source 标签)

- `ChatPayload` (payload.py) 加 `source: str = "chat"` 字段 (取值 "chat" | "highlight_ask")。
- 前端 SendOptions + WS payload 透传 source。
- `ChatMessage` 表加 `source` 列 (String(32), nullable=False, default="chat")。
  迁移: alembic 037 (student-app 用 PG + alembic; versions 最新是 036)。
- chat routes (api_chat + ws_chat_stream) 落 user message 时传 `source=payload.source`。
- assistant message 仍 source="chat" (只标用户发起的那条)。
- 筛选: `source="highlight_ask"` 的 user 消息 = 「用户询问」这一类，后续可做统计/回顾列表。

## 4. 组件边界

| 单元 | 职责 | 依赖 |
|---|---|---|
| `useTextSelectionAsk` (新 hook) | 监听课文区选区, 算浮按钮位置, 暴露 {selectedText, rect, clear} | DOM Selection API |
| `HighlightAskButton` (新组件) | 浮动「深入学习」按钮, 点击触发 onAsk(text) | useTextSelectionAsk |
| chat-store `pendingAsk` | 跨组件桥: 高亮按钮 → ChatPanel | zustand |
| ChatPanel (改) | useEffect 监听 pendingAsk → handleSend + 聚焦 + 清空 | chat-store |
| use-websocket-chat (改) | SendOptions/WS payload 加 source | — |
| ChatPayload (改) | 加 source 字段 | — |
| ChatMessage + 落库 (改) | 加 source 列 + 落 user msg source | alembic 037 |

前端按钮挂在 learn page 课文容器 (CourseContentView 渲染区) 上。pendingAsk 桥避免高亮区与 ChatPanel 直接耦合。

## 5. 边界与异常
- 选区 trim < 4 字 或 > 500 字: 不弹按钮 (< 4 太碎, > 500 截断到 500 再问)。
- 选区不在课文容器内 (如选中 UI 文字): 不弹。
- ChatPanel 未就绪 (WS 未连): handleSend 现有逻辑已自带重连/setTimeout 重试 (use-websocket-chat:170), 复用。
- pendingAsk 桥: 消费后立即清空, 防重复发送。
- 移动端: 长按选区同样触发 selectionchange, 浮按钮按 rect 定位即可 (不做额外手势)。

## 6. 测试
- 后端: ChatPayload source 默认 "chat" + 接受 "highlight_ask" (单测); api_chat 落 user msg 带 source (路由测, 查 DB ChatMessage.source); alembic 037 升级/降级。
- 前端: useTextSelectionAsk 选区长度边界 (mock Selection); pendingAsk 桥 → ChatPanel 发送 (组件测试或手动); 端到端手动: 高亮课文→按钮→自动发→tutor 解释→DB source=highlight_ask。

## 7. 验收
- 学习页高亮一段课文 → 浮出「深入学习」→ 点击 → chat 面板自动发出"请帮我解释..."→ tutor 解释。
- DB 查该 user 消息 source="highlight_ask"; 普通输入消息 source="chat"。

## 8. 风险
- selectionchange 频繁触发 → debounce + 仅 mouseup 时算 rect, 避免抖动。
- 浮按钮定位用 `window.getSelection().getRangeAt(0).getBoundingClientRect()` + 滚动偏移; 滚动时隐藏按钮 (简单稳妥)。
- alembic 037 在 PG 上跑; pytest 走 SQLite (default 值兼容)。
