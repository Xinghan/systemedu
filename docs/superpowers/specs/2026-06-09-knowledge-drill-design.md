# 知识钻取 (高亮 → 下钻知识 + 持久化回访) 设计文档

- Status: shipped (2026-06-09)
- 验收结果: 全链路打通 — 高亮双按钮(深入学习+知识钻取) -> DrillModal 调 /api/knowledge/drill 专用 prompt 生成 5 分区结构化下钻 -> KnowledgeDrill 表存储(alembic 038) -> knode 页"本节钻取记录"折叠区回访(record 模式不重生成)。端到端: 真实 LLM 产 5 字段儿童友好讲解, 复用 200 同id, list 回访 1 条。全量 tests/student 203 passed。
- Date: 2026-06-09
- 关联: spec 2026-06-08-highlight-deep-learn (高亮深入学习, 兄弟功能), student-app db/routes
- 分支: feat/highlight-ask (延续高亮功能)

## 1. 背景与目标

高亮课文已有"深入学习"(走 chat 苏格拉底引导)。本特性并排加第二个按钮「知识钻取」:
点击不进 chatbot, 而是弹窗对高亮知识点调后端 agent 做**直接、详细、结构化**的展开
(用户对该知识点不熟, 要一份资料看懂)。生成后存库, 在 knode 学习页留入口,
用户退出节点再回来仍能重新展开这条下钻知识。

钻取(直接讲) 与 深入学习(引导问) 互补。

### 目标
- G1 高亮选区浮按钮: 「深入学习」(已有) 并排「知识钻取」(新)。
- G2 点钻取 → 弹窗 → 调独立后端端点 → 专用 prompt 生成结构化下钻知识 → 弹窗分区展示。
- G3 下钻知识存库 (用户+项目+knode+高亮文本维度)。
- G4 回访: knode 学习页顶部"本节钻取记录(N)"可折叠区, 列高亮片段, 点击重开弹窗展示已存内容。

### 非目标 (MVP 边界)
- 弹窗纯展示 + 关闭 (A1), 不做"转问 AI 导师"联动 / 重新生成 (后续)。
- 不做跨 knode 全局钻取列表 (挂 knode 维度即可)。
- 不做课文原位置内联锚点 (位置锚定脆弱)。

## 2. 数据模型

新表 `knowledge_drills` (student-app PG, alembic 038):
```
id            String PK (uuid)
user_id       String FK users, index
library_slug  String index      -- 项目
module_id     String index      -- knode
highlight_text Text             -- 钻取的高亮原文
content       JSON              -- 结构化下钻知识 (见 §3)
created_at    DateTime
```
查询维度: (user_id, library_slug, module_id) → 该 knode 的所有钻取记录 (按 created_at)。
去重: 同一 (user, slug, module, highlight_text) 重复钻取 → 复用已存的 (不重复调 LLM), 或允许多条 (MVP 取: 命中相同 highlight_text 直接返回已存, 省 LLM)。

## 3. 下钻知识结构 (content JSON)

专用 prompt 让 LLM 输出固定 JSON, 面向 6-18 岁:
```json
{
  "simple_explanation": "一句话大白话讲清是什么",
  "why_matters": "为什么重要 / 用在哪",
  "analogy": "生活化类比帮理解",
  "key_points": ["关键点1", "关键点2", "..."],   // 3-5 条
  "go_deeper": "想更深可以了解的延伸方向"
}
```
弹窗按这 5 块分区渲染 (标题 + 内容)。存库存该 JSON。

## 4. 后端

### 端点 (新 drill_routes.py)
- `POST /api/knowledge/drill` body `{library_slug, module_id, highlight_text}` (require_login)
  1. 查 knowledge_drills 是否已有该 (user,slug,module,highlight_text) → 有则直接返回 (省 LLM)。
  2. 无则: 取该 knode 内容做上下文 (经 library 反代 get_knode 拿 plan_markdown/title 摘要),
     用专用 DRILL_PROMPT (高亮文本 + knode 上下文) 调 get_llm().ainvoke → 解析 JSON →
     存 knowledge_drills → 返回 {id, content, ...}。
- `GET /api/knowledge/drill?library_slug=&module_id=` (require_login)
  → 列该 user 在该 knode 的所有钻取记录 [{id, highlight_text, content, created_at}]。

### 模块 (chat 同级 或 新 drill/ 目录)
- `drill/routes.py`: 两个端点。
- `drill/generator.py`: DRILL_PROMPT + 调 LLM + 解析 JSON (容错: 非 JSON 降级)。
- db.py: KnowledgeDrill 表 + DAO (create_drill / get_drill_by_highlight / list_drills)。
- server.py 注册 drill ROUTES。

### DRILL_PROMPT 要点
直接、完整、儿童友好; 输出严格 JSON (5 字段); 结合 knode 上下文但聚焦高亮点;
不反问、不苏格拉底 (与 chat 区分)。

## 5. 前端

### 选区浮按钮 (改 HighlightAskButton)
当前单按钮。改为并排两个: 「深入学习」(原, 走 pendingAsk) + 「知识钻取」(新, 触发 drill)。
组件可重命名为 HighlightActionBar 或保留名加第二按钮。点钻取 → 打开 DrillModal(highlight_text)。

### DrillModal (新组件)
- 打开后 loading → POST /api/knowledge/drill → 渲染 5 分区结构化内容。
- 纯展示 + 关闭 (A1)。失败显示重试/错误。
- 复用现有 markdown 渲染 (key_points 可纯文本)。

### knode 页钻取列表 (B1)
- 学习页顶部 (或课文区上方) 一个可折叠区 "本节钻取记录 (N)"。
- 进 knode 页时 GET /api/knowledge/drill?slug&module 拉列表, N>0 才显示。
- 每条显示 highlight_text 片段 (截断), 点击 → DrillModal 展示该条已存 content (不重新生成)。
- 挂载位置参考高亮按钮: course-content-view 课文阅读区附近 / learn page 顶部。

### 前端 API
- lib/api 加 knowledgeDrill.create({slug,module,text}) / .list({slug,module})。
- 类型 DrillContent (5 字段) + DrillRecord (id/highlight_text/content/created_at)。

## 6. 数据流
```
高亮 → [知识钻取] → DrillModal
  → POST /api/knowledge/drill (已存? 返回 : LLM 生成+存)
  → 弹窗展示 5 分区
退出 knode → 回到 knode → 顶部"钻取记录(N)" (GET list)
  → 点某条 → DrillModal 展示已存 content
```

## 7. 测试
- 后端: generator 解析 JSON (正常/非JSON降级); create_drill 去重 (相同 highlight 复用); list_drills 按 knode 过滤 + user 隔离; 端点 require_login; alembic 038。
- 前端: DrillModal loading/展示/错误; 钻取列表 N>0 显示 + 点击展示已存。组件测试或手动。
- E2E 手动: 高亮→钻取→弹窗看5分区→退出→回来→顶部记录→点击重看。

## 8. 风险
- LLM 输出非严格 JSON → generator 容错 (提取 JSON / 降级返回 raw 到 simple_explanation)。
- knode 上下文太长 → 摘要截断喂 prompt。
- 去重键 highlight_text 完全匹配 (空格/标点差异算不同) → MVP 接受, 文本规范化 (trim) 后比对。
- 内存/成本: 钻取按需调 LLM, 已存复用, 可控。

## 9. 与高亮深入学习的关系
- 共用选区检测 (HighlightAskButton 扩成双按钮)。
- 深入学习 → chat (source=highlight_ask, 苏格拉底引导)。
- 知识钻取 → drill 端点 (直接结构化资料 + 持久化)。
- 两者独立后端, 前端共用浮按钮。
