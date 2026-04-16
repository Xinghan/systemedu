# Chatbot 调用上下文矩阵

**Spec**: 014-tutor-memory-system / **Task**: T0.1 + T0.2
**Date**: 2026-04-16
**Purpose**:固化现有 chatbot 入口的 context 字段与新 tutor graph 的记忆层激活规则,作为 Phase 1-6 的实施依据。

---

## 1. 现有 chatbot 调用入口

SystemEdu 已有 **4 个真实的 chatbot 入口**,分散在不同业务场景下,context 透传完全不一致。

### 1.1 入口总览

| # | 名称 | 前端入口 | 后端路径 | 透传字段 |
|---|------|---------|---------|---------|
| A | 学习页内置(Learn Page) | `web/src/app/(learning)/learn/[projectName]/page.tsx` → `<ChatPanel project nodeId activeTab pageIndex agent />` | WS `/api/chat/stream` | project + node_id + active_tab + page_index + agent |
| B | 全局浮层(Floating Chat) | `web/src/components/learning/floating-chat.tsx` → `<ChatPanel project agent nodeId? activeTab? pageIndex?/>` | WS `/api/chat/stream` | 同 A,但 nodeId/activeTab/pageIndex 可能为 null |
| C | 独立聊天页 | `web/src/app/(chat)/chat/page.tsx` / `chat/[sessionId]/page.tsx` → `<ChatPanel />`(无参) | WS `/api/chat/stream` | session_id 为主,余字段缺失 |
| D | 练习/作业页(推断) | 练习页尚未集成 chatbot,但 tasks.md 假设未来会用 | 待实现 | project + node_id + exercise_id(未实现) |

### 1.2 关键文件定位

| 文件 | 行号 | 关键点 |
|------|------|--------|
| `src/systemedu/gateway/server.py` | 241 | `POST /api/chat`(同步,仅 project+agent) |
| `src/systemedu/gateway/server.py` | 284-342 | `WS /api/chat/stream`(流式,含 node_id/active_tab/page_index) |
| `src/systemedu/gateway/server.py` | 305-307 | `data.get("node_id") / ("active_tab") / ("page_index")` 从 payload 读 |
| `src/systemedu/gateway/server.py` | 337 | `runtime.stream_message(...)` 透传字段到老 deepagents runtime |
| `src/systemedu/core/session.py` | 28-43 | `Session` dataclass:仅 id/agent_name/project_name/messages |
| `src/systemedu/storage/db.py` | 25-36 | `ChatSession` 表:id/agent_name/project_name/created_at/updated_at(**无 user_id/knode_id/active_skill**) |
| `src/systemedu/storage/db.py` | 39-50 | `ChatMessage` 表:session_id/role/content/created_at |
| `src/systemedu/memory/client.py` | 77-99 | `retrieve_memories(user_id, query, project_id=None, limit=5)` — **不支持 knode_id** |
| `src/systemedu/memory/client.py` | 102-124 | `store_conversation(user_id, messages, project_id=None, knode_id=None)` — metadata 写 knode_id 但无法按其过滤 |
| `web/src/lib/hooks/use-websocket-chat.ts` | 119 | `sendMessage(message, options)`,options = `{project?, agent?, node_id?, active_tab?, page_index?}` |
| `web/src/lib/hooks/use-websocket-chat.ts` | 155-161 | WebSocket payload:`{message, session_id, ...options}`(**无 user_id、无 page_context**) |
| `web/src/components/learning/floating-chat.tsx` | 21 | `FloatingChat({project, agent, nodeId, activeTab, pageIndex})` — nodeId 可 null |
| `web/src/components/learning/floating-chat.tsx` | 122-128 | 直接透传 nodeId 到 ChatPanel(即使为 null) |

---

## 2. 存量系统的 4 个缺口(Phase 1-5 必须修复)

### 缺口 1:ChatSession 表无 user_id / knode_id / active_skill 字段
**证据**:`src/systemedu/storage/db.py:25-36`

**影响**:
- LangGraph checkpoint 需要 `thread_id` 绑定用户 session,但现 schema 无 user_id,只能退化到"所有用户共享 session"或强制前端生成
- skill_state / active_skill 在 checkpoint 中保存,但 session 层找不到对应"这条 session 当前在哪个 skill"的索引,运营端难排查
- knode_id 不入库,无法查"学生在 knode X 上的 session 历史"

**修复**:T1.3 Alembic 迁移给 chat_sessions 加字段(见 §6 Schema 决策)

### 缺口 2:Mem0 不支持按 knode_id 过滤
**证据**:`src/systemedu/memory/client.py:90-92`
```python
kwargs: dict = {"query": query, "user_id": user_id, "limit": limit}
if project_id:
    kwargs["filters"] = {"project_id": project_id}
# knode_id 永远不在 filters 里
```

**影响**:
- L4 语义召回只能按 project 粒度,无法针对"学生在 knode A 的历史对话"做精准召回
- 学习页切 knode 时,L4 召回可能混入其他 knode 的对话,违反 E2E 场景 6 断言

**修复**:T2.6 扩展 `retrieve_memories(user_id, query, *, project_id=None, knode_id=None, limit=5)`

### 缺口 3:WebSocket payload 不带 user_id
**证据**:`web/src/lib/hooks/use-websocket-chat.ts:155-161`
```typescript
wsRef.current.send(JSON.stringify({ message, session_id: currentSessionId, ...options }))
// options 无 user_id;后端也没从认证会话取 user_id(server.py:337 只传 user_id="default")
```

**影响**:
- 所有操作的 user_id 全局默认 `"default"`,多用户时数据互相覆盖
- 无法做 tool 的 scope 隔离(`@tutor_tool(scope="user_self")` 无 user_id 可校验)
- 审计日志无法追责

**修复**:T5.1 gateway 从认证会话强制注入 user_id;前端不传(即使传也被覆盖)

### 缺口 4:没有 context_scope 字段区分"项目内 / 项目外"
**证据**:`floating-chat.tsx:21, 122-128`

`FloatingChat` 当学习页嵌入时 nodeId 非 null;当作为独立浮层(不在学习页)时 nodeId 为 null 但**仍向后端透传**(WebSocket 会把 `node_id: null` 发出去)。

**影响**:
- 后端无法区分"在项目内打开浮层"与"在 dashboard 打开浮层":两种场景记忆开放度不同
- 项目外浮层若误用项目级记忆,会把其他项目的学习事实污染进对话

**修复**:T5.1 增加 `context_scope` 枚举字段:`project / global`,前端按使用场景显式标注;后端按 context_scope 校验字段完整性(project scope 必须 project_name 非空)

---

## 3. 简化的 2-context 模型(2026-04-16 决策)

**决策依据**:用户要求简化为两类 context,避免 learn/floating/floating-learn/exercise 多维度导致前后端实现爆炸。

### 3.1 Context 1:项目内(`context_scope="project"`)

**定义**:用户当前位于某个具体项目中(学习页 / 浮层挂在学习页之上 / 练习页 / 项目知识树页),任何从这些位置打开的 chatbot。

**记忆开放度**:**完整开放** — 该项目下所有 knode 的 StudentFact、Mem0 历史、进度、练习记录全部可被召回。不按 knode 做二次过滤。

**前端必须传**:`project_name` 必填;`knode_id` 可选(学习页 / 练习页传当前节点,项目树页可为空)。

**记忆层激活**:
| 层 | 激活状态 | 过滤条件 |
|---|---------|---------|
| L1 学生画像 | on | 按 `user_id` |
| L2 项目上下文 | on | 按 `(user_id, project_name)` |
| L3 当前 knode 状态 | on | **按 `(user_id, project_name)` 全项目,不按 knode 过滤**(用户决策:"项目内记忆全开放") |
| L4 语义召回 | on | Mem0 filter `project_id=project_name`(跨 knode) |
| L5 active skill | on | 当前 session 内 skill 状态 |

### 3.2 Context 2:项目外(`context_scope="global"`)

**定义**:用户从 dashboard / 独立聊天页 / 项目选择页打开 chatbot,没有明确的项目归属。

**记忆开放度**:**只开放跨项目通用记忆** — L1 学生画像(兴趣、目标、长期风格),L4 可跨项目语义召回。不开放任何项目级进度和 knode 事实。

**前端必须传**:`project_name=null`。

**前端必须展示**(**spec 015 前端 TODO**):
- 在 chatbot 顶部明确 banner:"当前是通用对话,没有进入任何项目的记忆 context"
- 提供"进入某个项目"的快捷入口(列出学生最近活跃的 2-3 个项目,点击后 chatbot 切到 `context_scope=project`)
- 用户选择项目后,立即新开一条 project scope 的 thread(不沿用 global 的 messages)

**记忆层激活**:
| 层 | 激活状态 | 过滤条件 |
|---|---------|---------|
| L1 学生画像 | on | 按 `user_id` |
| L2 项目上下文 | off | N/A |
| L3 当前 knode 状态 | off | N/A |
| L4 语义召回 | on | Mem0 无 project filter(跨项目) |
| L5 active skill | on | 当前 session 内 skill 状态 |

### 3.3 对照表:入口 × context_scope

| 入口 | context_scope | project_name | knode_id |
|------|:------------:|:-----------:|:--------:|
| A 学习页 `learn/[projectName]` | `project` | 必传 | 必传(当前节点) |
| B 浮层(在学习页内) | `project` | 必传 | 必传(当前节点) |
| B 浮层(在 dashboard) | `global` | null | null |
| C 独立聊天页 | `global` | null | null |
| D 练习页 | `project` | 必传 | 必传 + `exercise_id` |
| E 项目知识树页(项目内但未进节点) | `project` | 必传 | null |

---

## 4. 记忆层激活规则(按 2-context 模型)

见 §3.1 / §3.2 的激活表。**核心原则简化为**:

1. **L1 / L4 永远 on**:学生画像与语义召回不受项目边界限制(L4 在 global 下跨项目召回,帮助学生做"我之前学过什么"类查询)
2. **L2 / L3 仅在 `project` scope 下 on**:一旦 global,项目级信息全部隔离
3. **L3 开放度**:项目内任意 knode 的事实都能被 L3 召回(用户决策:项目内记忆全开放,不按 knode 二次过滤)
4. **不按 knode_id 过滤 Mem0 L4**:Mem0 只按 `project_id` 过滤,不再细到 knode 级(T2.6 `retrieve_memories` 新增 knode_id 参数**取消**,仅加 project_id 过滤即可)

---

## 5. Session / thread 隔离规则(按 2-context 模型)

`thread_id` 的生成规则:

| context_scope + project | thread_id 组成 | 切换时是否新建 session |
|--------------------------|----------------|:--------------------:|
| `project`, project=P | `user_id + P + "project-main"`(**单一 thread 跨 knode**) | 切项目才新建 |
| `global` | `user_id + "global"`(单一 thread) | 用户手动清空或切到 project scope 时新建 |

**关键设计(对应用户决策问题 1 答 B)**:

- **项目内单一 thread 跨 knode**:用户在 project P 内任何节点打开 chatbot,都连接到同一条 project-level thread,messages 连续
- **但 skill_state 在切节点时重置**:学习页切 knode 时,前端在 WebSocket payload 里发 `knode_switched=true`,后端 `confirm_handler` 节点检测到后清空 `active_skill` + `skill_turn_count`(messages 保留)
  - 原因:避免"苏格拉底正在追问 knode A 的问题,学生切到 knode B 后 AI 还在问旧问题"
  - 实现位置:T3.3 skill_router 节点入口增加重置逻辑
- **global → project 切换总是新建 thread**:不沿用 global 的 messages(用户决策问题 2:spec 015 的快捷入口行为)

---

**设计意图**:
- 学习页单一 thread 保证跨 knode 切换时 messages 连贯(E2E 场景 6),但 L3/L4 按 knode_id 动态过滤
- 浮层短期 session,不污染学习页(E2E 场景 7)
- 练习页精细到单题,方便后续回溯(E2E 场景 9)

---

## 6. Schema 决策(T0.2)

### 6.1 选项 A:扩展现有 `chat_sessions` 表
加字段:`user_id` / `knode_id`(首次 session 激活的 knode)/ `active_skill` / `skill_turn_count` / `page_context`

**优点**:
- 单一 session 表,代码改动面小
- 现有 Session 加载逻辑 `SessionManager._load_from_db`(session.py:80-103)继续工作,加新字段默认值即可
- 运营端查询简单:一张表即可看到所有对话

**缺点**:
- `chat_sessions` 原本服务于所有 agent(tutor/teacher/student),加 tutor 专属字段会污染表
- 字段默认 NULL,旧数据不兼容 page_context 枚举约束

### 6.2 选项 B:新建 `tutor_sessions` 专表
专表:`tutor_sessions(id, chat_session_id FK, user_id, knode_id, active_skill, skill_turn_count, page_context, ...)`

**优点**:
- tutor 独立数据域,与 teacher/student 解耦
- 字段可强约束(page_context 非空枚举)
- 未来 planner/assessor agent(spec 017)不受影响

**缺点**:
- 两表 JOIN 查询复杂
- LangGraph checkpoint 的 thread_id 与业务 session_id 的 1:1 关系需要多一层映射

### 6.3 决策:选项 A(扩展现有表)

**理由**:
1. **YAGNI**:teacher / student agent 现阶段是 pass-through,不产生 tutor 专属字段的冲突;真正需要隔离时再拆,不提前建表
2. **运维成本低**:单表迁移一次 Alembic 到位,T5.5 删老 runtime 时不会遗留孤儿表
3. **page_context 非空约束**:通过应用层而非 DB 层约束(`@field_validator`),不用 B 方案的 DB 枚举
4. **LangGraph thread_id = chat_session.id**:1:1 关系保持,不用中间映射表

**具体迁移**(T1.3 实施):
```python
# alembic/versions/NNNN_extend_chat_sessions.py
def upgrade():
    with op.batch_alter_table("sessions") as batch_op:
        batch_op.add_column(Column("user_id", String(100), nullable=True, index=True))
        batch_op.add_column(Column("knode_id", String(100), nullable=True))
        batch_op.add_column(Column("active_skill", String(50), nullable=True))
        batch_op.add_column(Column("skill_turn_count", Integer, default=0))
        batch_op.add_column(Column("page_context", String(20), nullable=True))
        batch_op.create_index("ix_sessions_user_project", ["user_id", "project_name"])

def downgrade():
    with op.batch_alter_table("sessions") as batch_op:
        batch_op.drop_index("ix_sessions_user_project")
        batch_op.drop_column("page_context")
        batch_op.drop_column("skill_turn_count")
        batch_op.drop_column("active_skill")
        batch_op.drop_column("knode_id")
        batch_op.drop_column("user_id")
```

**向后兼容**:
- 旧 session 无这些字段,Session dataclass 中 getter 返回 None 即可;老 runtime 退役后(T5.5)这些字段才开始写入
- MemoryInjector 遇 None 走"降级模式"(对应 standalone / floating 场景)

---

## 7. Phase 1-6 对本矩阵的引用位置

| Task | 引用本文档的段落 |
|------|----------------|
| T1.3 Alembic 迁移 | §6.3 上面的 upgrade/downgrade |
| T2.2 MemoryInjector 5 层 | §4 的 5 种 page_context 激活组合 |
| T2.6 Mem0 L4 扩展 | §2 缺口 2 |
| T3.3 skill_router | §5 thread_id 规则(决定 checkpoint 边界) |
| T5.1 gateway payload 扩展 | §3 所有入口的期望透传;§2 缺口 3、4 |
| T5.2 /api/chat 切换 | §1.2 的 session_id / config 组装 |
| T6.2 E2E 场景 6-9 | §4 / §5 的断言依据 |

---

## 8. 未覆盖的已知问题(非本 spec 范围)

1. **practice 页尚未集成 chatbot**:`<ChatPanel>` 未在练习页使用。D 入口是为 tasks.md T6.2 场景 9 预留的未来入口,但本 spec 只做后端支持,前端集成由 spec 015 完成。
2. **多用户并发 session 数量无上限**:当前设计无 session TTL,可能长期累积。`DELETE /api/tutor/session/:id` 端点提供手动清理,但自动 GC 策略留 spec 016 或后续。
3. **`/api/chat` 同步端点(server.py:241)** 是否也切 tutor graph:T5.2 只切 `/api/chat/stream`,同步端点暂保留老语义用于非流式场景(如脚本调用),退役时机另议。

---

**本文档状态**:待用户 review,review 后作为 Phase 1 开始的基准。
