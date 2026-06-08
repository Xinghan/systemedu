# 高亮课文 → "深入学习" 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 学习页高亮一段课文 → 浮「深入学习」按钮 → 点击自动把"解释 prompt+高亮内容"发给常驻 chatbot 由 tutor 解释，并把这类消息标记为 source="highlight_ask"（用户询问）。

**Architecture:** 后端先行——ChatPayload + ChatMessage 加 source 字段（alembic 037），落库带 source。前端用 chat-store 的 pendingAsk 作桥：课文区选区 hook 检测 → 浮按钮 → 写 pendingAsk → 常驻 ChatPanel 监听后 handleSend(带 source) + 聚焦 + 清空。

**Tech Stack:** student-app (Starlette + SQLAlchemy + alembic, PG; pytest SQLite), student-web (Next.js + TS + zustand), DOM Selection API。

---

## File Structure

后端:
- `packages/student-app/src/systemedu/student/chat/payload.py` (Modify) — ChatPayload 加 source。
- `packages/student-app/src/systemedu/student/chat/session.py` (Modify) — append_message 加 source 参数。
- `packages/student-app/src/systemedu/student/db.py` (Modify) — ChatMessage 加 source 列。
- `packages/student-app/src/systemedu/student/chat/routes.py` (Modify) — 落 user msg 传 source。
- `packages/student-app/alembic/versions/037_*.py` (Create) — source 列迁移。
- `tests/student/test_highlight_ask.py` (Create) — 后端 source 测试。

前端:
- `packages/student-web/src/lib/stores/chat-store.ts` (Modify) — pendingAsk 字段。
- `packages/student-web/src/lib/hooks/use-websocket-chat.ts` (Modify) — SendOptions/WS payload 加 source。
- `packages/student-web/src/lib/highlight-ask.ts` (Create) — 纯函数 buildAskMessage + isValidSelection (可单测)。
- `packages/student-web/src/components/learning/HighlightAskButton.tsx` (Create) — 选区检测 + 浮按钮。
- `packages/student-web/src/components/chat/chat-panel.tsx` (Modify) — 监听 pendingAsk + handleSend 带 source。
- `packages/student-web/src/components/learning/course-content-view.tsx` (Modify) — 挂 HighlightAskButton。

---

## Task 1: ChatMessage 加 source 列 + alembic 037

**Files:**
- Modify: `packages/student-app/src/systemedu/student/db.py:220` (skill 列后)
- Create: `packages/student-app/alembic/versions/037_add_chat_message_source.py`

- [ ] **Step 1: db.py ChatMessage 加 source 列**

在 `db.py` ChatMessage 类 `skill = Column(String(64), nullable=True)` (约 220) 之后加：

```python
    skill = Column(String(64), nullable=True)
    source = Column(String(32), nullable=False, default="chat")  # chat | highlight_ask
```

- [ ] **Step 2: 看现有迁移格式 + down_revision**

Run: `cd /Users/xinghan/Dev/systemedu && cat packages/student-app/alembic/versions/a8b3c2d1e036_036_add_user_knode_complete.py`
记下它的 `revision` 值 (作为 037 的 down_revision) + upgrade/downgrade 写法风格。

- [ ] **Step 3: 写 037 迁移**

Create `packages/student-app/alembic/versions/037_add_chat_message_source.py`：

```python
"""037 add chat_messages.source

Revision ID: 037_chat_msg_source
Revises: a8b3c2d1e036
Create Date: 2026-06-08

"""
from alembic import op
import sqlalchemy as sa

revision = "037_chat_msg_source"
down_revision = "a8b3c2d1e036"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "chat_messages",
        sa.Column("source", sa.String(length=32), nullable=False, server_default="chat"),
    )


def downgrade() -> None:
    op.drop_column("chat_messages", "source")
```

> `down_revision` 必须等于 036 文件里的真实 `revision` 值 (Step 2 确认；上面 `a8b3c2d1e036` 是从文件名推的，以文件内 revision 为准)。`server_default="chat"` 保证已有行有值。

- [ ] **Step 4: 验证模型列存在**

Run: `cd /Users/xinghan/Dev/systemedu && source .venv/bin/activate && python -c "
from systemedu.student.db import ChatMessage
assert hasattr(ChatMessage, 'source'), 'source missing'
print('source column OK')
"`
Expected: `source column OK`

- [ ] **Step 5: 验证 alembic 迁移链可解析**

Run: `cd /Users/xinghan/Dev/systemedu/packages/student-app && source ../../.venv/bin/activate && python -c "
from alembic.config import Config
from alembic.script import ScriptDirectory
cfg = Config('alembic.ini')
sd = ScriptDirectory.from_config(cfg)
heads = sd.get_heads()
print('heads:', heads)
assert '037_chat_msg_source' in heads, heads
print('037 is head OK')
"`
Expected: `037 is head OK`（若报多 head/链断，说明 down_revision 不对，按 Step 2 真实 revision 修）。

- [ ] **Step 6: Commit**

```bash
cd /Users/xinghan/Dev/systemedu
git add packages/student-app/src/systemedu/student/db.py packages/student-app/alembic/versions/037_add_chat_message_source.py
git commit -m "feat(student): ChatMessage 加 source 列 + alembic 037"
```

---

## Task 2: ChatPayload 加 source + append_message 透传 + 落库

**Files:**
- Modify: `packages/student-app/src/systemedu/student/chat/payload.py:27` (page_kind 后)
- Modify: `packages/student-app/src/systemedu/student/chat/session.py:128` (append_message 签名)
- Modify: `packages/student-app/src/systemedu/student/chat/routes.py:68,129` (落 user msg)
- Test: `tests/student/test_highlight_ask.py`

- [ ] **Step 1: 写失败测试 — payload source 默认 + 接受 highlight_ask**

```python
# tests/student/test_highlight_ask.py
"""高亮深入学习 — source 字段链路测试 (spec 2026-06-08)。"""
from __future__ import annotations


def test_payload_source_default_chat():
    from systemedu.student.chat.payload import ChatPayload
    p = ChatPayload(message="hi")
    assert p.source == "chat"


def test_payload_source_highlight_ask():
    from systemedu.student.chat.payload import ChatPayload
    p = ChatPayload(message="解释这段", source="highlight_ask")
    assert p.source == "highlight_ask"
```

- [ ] **Step 2: 运行测试 (失败)**

Run: `cd /Users/xinghan/Dev/systemedu && source .venv/bin/activate && python -m pytest tests/student/test_highlight_ask.py -v 2>&1 | tail -8`
Expected: FAIL（ChatPayload 无 source 属性 / 不接受 source kwarg）。

- [ ] **Step 3: ChatPayload 加 source**

在 `payload.py` ChatPayload 的 `page_kind: PageKind = "global"` (约 27) 之后加：

```python
    page_kind: PageKind = "global"
    source: str = "chat"  # chat | highlight_ask (spec 2026-06-08)
```

- [ ] **Step 4: append_message 加 source 参数 + 写入**

在 `session.py` append_message 签名 `skill: str | None = None,` 之后加参数 `source: str = "chat",`；并在构造 `ChatMessage(...)` 时加 `source=source`。完整签名：

```python
def append_message(
    session_id: str,
    user_id: str,
    library_slug: str | None,
    module_id: str | None,
    role: str,
    content: str,
    tool_calls: Any | None = None,
    skill: str | None = None,
    source: str = "chat",
) -> dict:
```

ChatMessage 构造处加 `source=source,`（与 role/content 并列）。

- [ ] **Step 5: routes.py 落 user msg 传 source (两处)**

`routes.py` api_chat (约 68) 与 ws_chat_stream (约 129) 落 **user** message 的 append_message 调用，加 `source=payload.source,`。**只改 role="user" 的两处**，assistant 的不动 (保持默认 "chat")。

api_chat 处：
```python
    session_store.append_message(
        session_id=session_id,
        user_id=user_id,
        library_slug=payload.library_slug,
        module_id=payload.module_id,
        role="user",
        content=payload.message,
        source=payload.source,
    )
```
ws 处同理 (在 role="user" 的 append_message 加 source=payload.source)。

- [ ] **Step 6: 写落库测试 (append_message 写 source 入 DB)**

追加到 `tests/student/test_highlight_ask.py`：

```python
import uuid


def _tmp_db(tmp_path, monkeypatch):
    monkeypatch.setenv("STUDENT_DB_PATH", str(tmp_path / "s.db"))
    monkeypatch.delenv("STUDENT_DB_URL", raising=False)
    from systemedu.student import db as _db
    _db.reset_engine_for_tests()
    _db.init_db()
    return _db


def test_append_message_persists_source(tmp_path, monkeypatch):
    _db = _tmp_db(tmp_path, monkeypatch)
    from systemedu.student.chat import session as sess_store
    u = _db.create_user(f"u_{uuid.uuid4().hex[:6]}", "h")
    s = _db.create_chat_session(user_id=u.id, library_slug="eeg", module_id="M01", title="t")
    sid = s["id"] if isinstance(s, dict) else s.id
    sess_store.append_message(
        session_id=sid, user_id=u.id, library_slug="eeg", module_id="M01",
        role="user", content="解释这段", source="highlight_ask",
    )
    with _db.get_session() as db:
        rows = db.query(_db.ChatMessage).filter_by(session_id=sid).all()
        assert len(rows) == 1
        assert rows[0].source == "highlight_ask"
```

> 注：`create_chat_session` 的真实函数名/返回以 db.py 为准——实现前 `grep -n "def create_chat_session\|def create_session" packages/student-app/src/systemedu/student/db.py packages/student-app/src/systemedu/student/chat/session.py` 确认，按真实签名建 session。若 session 创建走 session_store.create_session，用它。

- [ ] **Step 7: 运行全部 source 测试**

Run: `cd /Users/xinghan/Dev/systemedu && source .venv/bin/activate && python -m pytest tests/student/test_highlight_ask.py -v 2>&1 | tail -10`
Expected: 全 PASS。

- [ ] **Step 8: 不破坏现有 chat 测试**

Run: `cd /Users/xinghan/Dev/systemedu && source .venv/bin/activate && python -m pytest tests/student/test_chat_routes.py tests/student/test_chat_session.py tests/student/test_chat_payload.py -q 2>&1 | tail -3`
Expected: 全 PASS（source 有默认值，向后兼容）。

- [ ] **Step 9: Commit**

```bash
cd /Users/xinghan/Dev/systemedu
git add packages/student-app/src/systemedu/student/chat/payload.py packages/student-app/src/systemedu/student/chat/session.py packages/student-app/src/systemedu/student/chat/routes.py tests/student/test_highlight_ask.py
git commit -m "feat(student): chat source 透传 (payload->append_message->DB), 落 highlight_ask"
```

---

## Task 3: 前端 source 透传 (SendOptions + WS payload)

**Files:**
- Modify: `packages/student-web/src/lib/hooks/use-websocket-chat.ts:17` (SendOptions) + `:205` (WS payload)

- [ ] **Step 1: SendOptions 加 source**

`use-websocket-chat.ts` SendOptions interface (约 17) 加：

```typescript
interface SendOptions {
  library_slug?: string
  module_id?: string | null
  page_kind?: PageKind
  confirm_response?: Record<string, unknown>
  source?: string
}
```

- [ ] **Step 2: WS payload 透传 source**

WS `wsRef.current.send(JSON.stringify({...}))` (约 205) 的对象里加 `source: options?.source || "chat",`：

```typescript
      wsRef.current.send(
        JSON.stringify({
          message,
          session_id: currentSessionId,
          library_slug: options?.library_slug,
          module_id: options?.module_id,
          page_kind: options?.page_kind || "global",
          confirm_response: options?.confirm_response,
          source: options?.source || "chat",
        }),
      )
```

- [ ] **Step 3: 类型检查**

Run: `cd /Users/xinghan/Dev/systemedu/packages/student-web && npx tsc --noEmit 2>&1 | grep -iE "use-websocket-chat|error TS" | head -5 || echo "no ws type errors"`
Expected: 无 use-websocket-chat 相关错误。

- [ ] **Step 4: Commit**

```bash
cd /Users/xinghan/Dev/systemedu
git add packages/student-web/src/lib/hooks/use-websocket-chat.ts
git commit -m "feat(web): WS sendMessage 透传 source"
```

---

## Task 4: chat-store pendingAsk 桥 + ChatPanel 消费

**Files:**
- Modify: `packages/student-web/src/lib/stores/chat-store.ts` (ChatState 加 pendingAsk)
- Modify: `packages/student-web/src/components/chat/chat-panel.tsx` (handleSend 加 source + 监听 pendingAsk)

- [ ] **Step 1: chat-store 加 pendingAsk**

`chat-store.ts` ChatState interface 加字段 + action（在 setContext 附近）：

```typescript
  // 桥: 高亮"深入学习"按钮 → 常驻 ChatPanel 自动发送 (spec 2026-06-08)
  pendingAsk: string | null
  setPendingAsk: (text: string | null) => void
```

在 `create<ChatState>` 的初始 state 加 `pendingAsk: null,`；actions 区加：

```typescript
  setPendingAsk: (text) => set({ pendingAsk: text }),
```

- [ ] **Step 2: ChatPanel handleSend 支持 source**

`chat-panel.tsx` handleSend (约 133) 改为可带 source：

```typescript
  const handleSend = (message: string, source = "chat") => {
    sendMessage(message, {
      library_slug: librarySlug ?? pageCtx.library_slug,
      module_id: moduleId ?? pageCtx.module_id,
      page_kind: pageCtx.page_kind,
      source,
    })
  }
```

（`<ChatInput onSend={handleSend} />` 调用 onSend(message) 单参，source 默认 "chat"，不受影响。）

- [ ] **Step 3: ChatPanel 监听 pendingAsk → 自动发送**

在 chat-panel.tsx 从 useChatStore 解构里加 `pendingAsk, setPendingAsk,`；加 useEffect（放在 handleSend 定义之后）：

```typescript
  // 高亮"深入学习"触发: pendingAsk 有值时自动发送 (source=highlight_ask) 并清空
  useEffect(() => {
    if (!pendingAsk) return
    handleSend(pendingAsk, "highlight_ask")
    setPendingAsk(null)
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAsk])
```

> 注：handleSend 依赖 sendMessage/pageCtx，useEffect 依赖列表只放 pendingAsk（消费后清空防重发）；exhaustive-deps 用注释豁免，与文件现有风格一致（若文件用其它 lint 风格，照搬）。

- [ ] **Step 4: 类型检查**

Run: `cd /Users/xinghan/Dev/systemedu/packages/student-web && npx tsc --noEmit 2>&1 | grep -iE "chat-store|chat-panel|error TS" | head -8 || echo "no chat type errors"`
Expected: 无 chat-store/chat-panel 相关错误。

- [ ] **Step 5: Commit**

```bash
cd /Users/xinghan/Dev/systemedu
git add packages/student-web/src/lib/stores/chat-store.ts packages/student-web/src/components/chat/chat-panel.tsx
git commit -m "feat(web): chat-store pendingAsk 桥 + ChatPanel 自动发送 highlight_ask"
```

---

## Task 5: highlight-ask 纯函数 (可单测)

**Files:**
- Create: `packages/student-web/src/lib/highlight-ask.ts`
- Test: `packages/student-web/src/lib/highlight-ask.test.ts`（若仓库有前端测试 runner；否则跳过 test，见 Step 3 说明）

- [ ] **Step 1: 写纯函数**

```typescript
// packages/student-web/src/lib/highlight-ask.ts
/**
 * 高亮"深入学习"的纯逻辑 (与 DOM 解耦, 便于测试)。
 * spec 2026-06-08。
 */

export const MIN_HIGHLIGHT = 4
export const MAX_HIGHLIGHT = 500

/** 选区文本是否够格弹"深入学习" (trim 后长度 4..500)。 */
export function isValidSelection(raw: string): boolean {
  const t = raw.trim()
  return t.length >= MIN_HIGHLIGHT && t.length <= MAX_HIGHLIGHT * 4
  // 上限放宽到 4x: 过长也允许弹, 由 buildAskMessage 截断 (UX: 别因为选多了就没按钮)
}

/** 组装发给 tutor 的解释消息 (过长截断到 MAX_HIGHLIGHT)。 */
export function buildAskMessage(raw: string): string {
  const t = raw.trim().slice(0, MAX_HIGHLIGHT)
  return `请帮我解释这段课文的含义："${t}"。用我能听懂的方式讲清它说的是什么、为什么重要。`
}
```

- [ ] **Step 2: 确认前端是否有测试 runner**

Run: `cd /Users/xinghan/Dev/systemedu/packages/student-web && cat package.json | grep -E "vitest|jest|\"test\"" | head`
- 若有 vitest/jest：写 `highlight-ask.test.ts` 测 isValidSelection (空/3字 false、4字 true)、buildAskMessage (含模板 + 截断)，并跑。
- 若无前端测试 runner：跳过测试文件，纯函数逻辑在 Task 7 手动验收覆盖；在 commit message 注明"前端无 test runner，纯函数逻辑手动验收"。

```typescript
// highlight-ask.test.ts (仅当有 runner)
import { describe, it, expect } from "vitest"
import { isValidSelection, buildAskMessage, MAX_HIGHLIGHT } from "./highlight-ask"

describe("highlight-ask", () => {
  it("rejects short selection", () => {
    expect(isValidSelection("ab")).toBe(false)
    expect(isValidSelection("   ")).toBe(false)
  })
  it("accepts >=4 char selection", () => {
    expect(isValidSelection("奈奎斯特定理")).toBe(true)
  })
  it("builds prompt with highlight + truncates", () => {
    const msg = buildAskMessage("采样率")
    expect(msg).toContain("采样率")
    expect(msg).toContain("请帮我解释")
    const long = buildAskMessage("x".repeat(MAX_HIGHLIGHT + 100))
    expect(long.length).toBeLessThan(MAX_HIGHLIGHT + 60)
  })
})
```

- [ ] **Step 3: 运行测试 (若有 runner)**

Run: `cd /Users/xinghan/Dev/systemedu/packages/student-web && npx vitest run src/lib/highlight-ask.test.ts 2>&1 | tail -8`（无 vitest 则 `npx tsc --noEmit` 确认纯函数无类型错误）
Expected: PASS（或无类型错误）。

- [ ] **Step 4: Commit**

```bash
cd /Users/xinghan/Dev/systemedu
git add packages/student-web/src/lib/highlight-ask.ts
[ -f packages/student-web/src/lib/highlight-ask.test.ts ] && git add packages/student-web/src/lib/highlight-ask.test.ts
git commit -m "feat(web): highlight-ask 纯函数 (isValidSelection + buildAskMessage)"
```

---

## Task 6: HighlightAskButton 组件 + 挂载

**Files:**
- Create: `packages/student-web/src/components/learning/HighlightAskButton.tsx`
- Modify: `packages/student-web/src/components/learning/course-content-view.tsx` (挂组件)

- [ ] **Step 1: 写 HighlightAskButton**

```tsx
"use client"

/**
 * 高亮课文 → 浮出"深入学习"按钮 (spec 2026-06-08)。
 * 监听课文区 mouseup/selectionchange, 选区合格时在选区下方浮按钮;
 * 点击 → 写 chat-store.pendingAsk (常驻 ChatPanel 监听后自动发送)。
 */

import { useEffect, useState, useCallback } from "react"
import { Sparkles } from "lucide-react"

import { useChatStore } from "@/lib/stores/chat-store"
import { isValidSelection, buildAskMessage } from "@/lib/highlight-ask"

interface Pos {
  top: number
  left: number
  text: string
}

export function HighlightAskButton({ containerRef }: { containerRef: React.RefObject<HTMLElement | null> }) {
  const [pos, setPos] = useState<Pos | null>(null)
  const setPendingAsk = useChatStore((s) => s.setPendingAsk)

  const recompute = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setPos(null)
      return
    }
    const raw = sel.toString()
    if (!isValidSelection(raw)) {
      setPos(null)
      return
    }
    const range = sel.getRangeAt(0)
    // 选区必须落在课文容器内
    const container = containerRef.current
    if (!container || !container.contains(range.commonAncestorContainer)) {
      setPos(null)
      return
    }
    const rect = range.getBoundingClientRect()
    setPos({
      top: rect.bottom + window.scrollY + 6,
      left: rect.left + window.scrollX + rect.width / 2,
      text: raw,
    })
  }, [containerRef])

  useEffect(() => {
    const onUp = () => setTimeout(recompute, 0)
    const onScroll = () => setPos(null)
    document.addEventListener("mouseup", onUp)
    document.addEventListener("scroll", onScroll, true)
    return () => {
      document.removeEventListener("mouseup", onUp)
      document.removeEventListener("scroll", onScroll, true)
    }
  }, [recompute])

  if (!pos) return null

  const onAsk = () => {
    setPendingAsk(buildAskMessage(pos.text))
    setPos(null)
    window.getSelection()?.removeAllRanges()
  }

  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}  // 防止点击时清掉选区
      onClick={onAsk}
      style={{
        position: "absolute",
        top: pos.top,
        left: pos.left,
        transform: "translateX(-50%)",
        zIndex: 50,
      }}
      className="inline-flex items-center gap-1 rounded-full bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-[var(--primary-ink)]"
    >
      <Sparkles size={13} /> 深入学习
    </button>
  )
}
```

> 注：按钮用 `position:absolute` + scrollY/scrollX，挂在 body 流里需父容器是定位上下文或直接挂在课文区。简化：挂在 CourseContentView 根（Step 2），top/left 用页面绝对坐标 (scrollY)，按钮渲染在根 div 内即可。若根 div 非 relative，按钮用 fixed 更稳——见 Step 2 决策。

- [ ] **Step 2: 挂载到 CourseContentView 课文区**

`course-content-view.tsx` 主 return (约 315)。给课文根容器加一个 ref，并在容器内渲染 `<HighlightAskButton containerRef={ref} />`。
先读 315 起的 return 结构：`sed -n '315,345p' packages/student-web/src/components/learning/course-content-view.tsx`，找到包裹 plan_markdown/SectionBlock 的根 div。
- 给该根 div 加 `ref={contentRef}`（组件顶部 `const contentRef = useRef<HTMLDivElement>(null)`）。
- 在根 div 内 (作为第一个子元素) 加 `<HighlightAskButton containerRef={contentRef} />`。
- import：`import { HighlightAskButton } from "./HighlightAskButton"`。

**定位决策**：HighlightAskButton 的按钮改用 `position: fixed` + `rect.bottom`/`rect.left`（不加 scrollY），避免父容器定位上下文问题。修改组件 pos 计算为：
```typescript
    setPos({
      top: rect.bottom + 6,
      left: rect.left + rect.width / 2,
      text: raw,
    })
```
并把 button style 的 `position: "absolute"` 改为 `position: "fixed"`。scroll 时 setPos(null) 已隐藏，fixed 不会错位。

- [ ] **Step 3: 类型检查 + 构建**

Run: `cd /Users/xinghan/Dev/systemedu/packages/student-web && npx tsc --noEmit 2>&1 | grep -iE "HighlightAskButton|course-content-view|error TS" | head -8 || echo "no relevant type errors"`
Expected: 无 HighlightAskButton 相关错误（course-content-view 既存无关错误不算，只看新增 ref/import/组件行）。

- [ ] **Step 4: Commit**

```bash
cd /Users/xinghan/Dev/systemedu
git add packages/student-web/src/components/learning/HighlightAskButton.tsx packages/student-web/src/components/learning/course-content-view.tsx
git commit -m "feat(web): HighlightAskButton 选区浮按钮 + 挂载课文区"
```

---

## Task 7: 端到端验收 + 文档

**Files:**
- Modify: `docs/todolist.md`, `docs/superpowers/specs/2026-06-08-highlight-deep-learn-design.md`, `docs/prd.md`

- [ ] **Step 1: 全量后端回归**

Run: `cd /Users/xinghan/Dev/systemedu && source .venv/bin/activate && python -m pytest tests/student/ -q 2>&1 | tail -4`
Expected: 全 PASS（含新 test_highlight_ask）。

- [ ] **Step 2: 重启系统**

Run: `cd /Users/xinghan/Dev/systemedu && bash scripts/restart-student.sh 2>&1 | tail -5`
Expected: backend ready + web pid。

> 注：source 列已通过 db.init_db (SQLite 测试) 或 alembic (PG 生产) 建好。本地若 student-app 用 PG，重启前跑 `cd packages/student-app && alembic upgrade head` 应用 037。若用 SQLite 本地，init_db 自动建列。重启前确认本地 DB 类型 (STUDENT_DB_PATH=SQLite / STUDENT_DB_URL=PG)。

- [ ] **Step 3: 端到端验证 source 落库**

Run: `cd /Users/xinghan/Dev/systemedu && B=http://127.0.0.1:18820; U="hl_$(date +%s)"; TOK=$(curl -s --noproxy '*' -X POST $B/api/auth/register -H 'Content-Type: application/json' -d "{\"username\":\"$U\",\"password\":\"pw123456\"}" | python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))"); curl -s --noproxy '*' -X POST $B/api/my/projects/eeg-minecraft-bci -H "Authorization: Bearer $TOK" -o /dev/null; curl -s --noproxy '*' -X POST $B/api/chat -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{"message":"请帮我解释这段课文的含义：\"奈奎斯特定理\"","library_slug":"eeg-minecraft-bci","module_id":"M01","page_kind":"learn","source":"highlight_ask"}' | python3 -c "import sys,json;d=json.load(sys.stdin);print('chat ok, session:', bool(d.get('session_id')))"`
Expected: `chat ok, session: True`（chat 接受 source 字段不报错）。
> 验证 DB source: 可选——查该 session 的 user 消息 source=highlight_ask（需 DB 访问；或信任 Task 2 单测已锁）。

- [ ] **Step 4: 浏览器手动验收**

打开 http://localhost:4000 → 登录 → pull eeg → 进 M01 学习页 → 鼠标高亮一段课文 → 应浮出「深入学习」按钮 → 点击 → chat 面板自动发出"请帮我解释这段课文的含义..."→ tutor 流式解释。

- [ ] **Step 5: 更新文档**

- spec 加 `Status: shipped (2026-06-08)` + 验收结果。
- todolist 加一条（可选）："用户询问"回顾列表 (按 source=highlight_ask 聚合展示学生问过的问题)。
- prd 第 10 章或相应处提一句 highlight-ask 特性（简短）。

- [ ] **Step 6: Commit**

```bash
cd /Users/xinghan/Dev/systemedu
git add docs/todolist.md docs/superpowers/specs/2026-06-08-highlight-deep-learn-design.md docs/prd.md
git commit -m "docs: 高亮深入学习 shipped + todolist 用户询问回顾项"
```

---

## 验收标准
- 后端: ChatPayload.source 默认 chat、接受 highlight_ask；append_message 写入 ChatMessage.source；alembic 037 是 head；现有 chat 测试不破。
- 前端: 高亮课文 (4+ 字, 课文区内) → 浮「深入学习」→ 点击 → ChatPanel 自动发送 (source=highlight_ask) → tutor 解释。
- DB: highlight_ask 发起的 user 消息 source="highlight_ask"，普通输入 source="chat"。
- 全量 tests/student/ 绿。
```
