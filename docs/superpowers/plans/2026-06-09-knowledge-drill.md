# 知识钻取 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 高亮课文并排加「知识钻取」按钮 → 弹窗调独立后端端点用专用 prompt 生成结构化下钻知识 → 存库 (用户+项目+knode+高亮文本) → knode 页顶部"本节钻取记录"折叠区可回访重看。

**Architecture:** 后端新建 drill 模块 (KnowledgeDrill 表 + alembic 038 + generator 调 get_llm 产结构化 JSON + POST/GET 端点, 去重复用)。前端 HighlightAskButton 扩双按钮, 新 DrillModal 展示 5 分区, knode 页顶部钻取记录折叠区。

**Tech Stack:** student-app (Starlette + SQLAlchemy + alembic, PG), core get_llm, student-web (Next.js + TS), library 反代 get_knode 拿上下文。

---

## File Structure
后端:
- `packages/student-app/src/systemedu/student/db.py` (Modify) — KnowledgeDrill 表 + DAO。
- `packages/student-app/alembic/versions/038_add_knowledge_drills.py` (Create) — 迁移。
- `packages/student-app/src/systemedu/student/drill/__init__.py` (Create) — ROUTES 导出。
- `packages/student-app/src/systemedu/student/drill/generator.py` (Create) — DRILL_PROMPT + LLM + JSON 解析。
- `packages/student-app/src/systemedu/student/drill/routes.py` (Create) — POST/GET 端点。
- `packages/student-app/src/systemedu/student/server.py` (Modify) — 注册 drill ROUTES。
- `tests/student/test_knowledge_drill.py` (Create) — 后端测试。

前端:
- `packages/student-web/src/lib/api/index.ts` (Modify) — knowledgeDrill api + 类型。
- `packages/student-web/src/components/learning/HighlightAskButton.tsx` (Modify) — 加「知识钻取」按钮。
- `packages/student-web/src/components/learning/DrillModal.tsx` (Create) — 下钻弹窗。
- `packages/student-web/src/components/learning/DrillRecords.tsx` (Create) — knode 页钻取记录折叠区。
- `packages/student-web/src/components/learning/course-content-view.tsx` (Modify) — 挂 DrillRecords + 让 HighlightAskButton 能开 DrillModal。

---

## Task 1: KnowledgeDrill 表 + alembic 038

**Files:**
- Modify: `packages/student-app/src/systemedu/student/db.py` (UserKnodeComplete 表后)
- Create: `packages/student-app/alembic/versions/038_add_knowledge_drills.py`

- [ ] **Step 1: db.py 加 KnowledgeDrill 表 (参考 UserKnodeComplete 模式)**

在 db.py UserKnodeComplete 类之后加:
```python
class KnowledgeDrill(Base):
    """知识钻取: 用户对某 knode 课文的高亮片段生成的结构化下钻知识 (spec 2026-06-09)."""

    __tablename__ = "knowledge_drills"
    __table_args__ = (
        Index("ix_knowledge_drills_user_slug_module", "user_id", "library_slug", "module_id"),
    )

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    library_slug = Column(String(128), nullable=False)
    module_id = Column(String(64), nullable=False)
    highlight_text = Column(Text, nullable=False)
    content = Column(JSON, nullable=False, default=dict)  # {simple_explanation, why_matters, analogy, key_points, go_deeper}
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
```

- [ ] **Step 2: db.py 加 DAO 函数 (文件末尾或 DAO 区)**

```python
def create_drill(user_id: str, library_slug: str, module_id: str,
                 highlight_text: str, content: dict) -> dict:
    with get_session() as s:
        d = KnowledgeDrill(
            user_id=user_id, library_slug=library_slug, module_id=module_id,
            highlight_text=highlight_text, content=content,
        )
        s.add(d); s.commit(); s.refresh(d)
        return _drill_to_dict(d)


def get_drill_by_highlight(user_id: str, library_slug: str, module_id: str,
                           highlight_text: str) -> dict | None:
    with get_session() as s:
        d = (s.query(KnowledgeDrill)
             .filter_by(user_id=user_id, library_slug=library_slug,
                        module_id=module_id, highlight_text=highlight_text)
             .order_by(KnowledgeDrill.created_at.desc())
             .first())
        return _drill_to_dict(d) if d else None


def list_drills(user_id: str, library_slug: str, module_id: str) -> list[dict]:
    with get_session() as s:
        rows = (s.query(KnowledgeDrill)
                .filter_by(user_id=user_id, library_slug=library_slug, module_id=module_id)
                .order_by(KnowledgeDrill.created_at.asc())
                .all())
        return [_drill_to_dict(d) for d in rows]


def _drill_to_dict(d: "KnowledgeDrill") -> dict:
    return {
        "id": d.id,
        "highlight_text": d.highlight_text,
        "content": d.content,
        "created_at": d.created_at.isoformat() if d.created_at else None,
    }
```
> 实现前确认 db.py 已 import Index/JSON/Text/Column/ForeignKey/datetime/_uuid (UserKnodeComplete 已用, 应都有)。get_session 是现有函数。

- [ ] **Step 3: 看 037 迁移格式 + 写 038**

Run: `cat packages/student-app/alembic/versions/037_add_chat_message_source.py`
记 037 的 revision (`037_chat_msg_source`) 作 038 down_revision。
Create `038_add_knowledge_drills.py`:
```python
"""038 add knowledge_drills

Revision ID: 038_knowledge_drills
Revises: 037_chat_msg_source
Create Date: 2026-06-09
"""
from alembic import op
import sqlalchemy as sa

revision = "038_knowledge_drills"
down_revision = "037_chat_msg_source"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "knowledge_drills",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("library_slug", sa.String(length=128), nullable=False),
        sa.Column("module_id", sa.String(length=64), nullable=False),
        sa.Column("highlight_text", sa.Text(), nullable=False),
        sa.Column("content", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_knowledge_drills_user_slug_module", "knowledge_drills",
                    ["user_id", "library_slug", "module_id"])
    op.create_index("ix_knowledge_drills_user_id", "knowledge_drills", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_knowledge_drills_user_id", table_name="knowledge_drills")
    op.drop_index("ix_knowledge_drills_user_slug_module", table_name="knowledge_drills")
    op.drop_table("knowledge_drills")
```
> down_revision 用 037 文件真实 revision (`037_chat_msg_source`, 已核对)。

- [ ] **Step 4: 验证模型 + alembic head**

Run: `source .venv/bin/activate && python -c "from systemedu.student.db import KnowledgeDrill; print('model OK')"`
Run: `cd packages/student-app && source ../../.venv/bin/activate && python -c "
from alembic.config import Config; from alembic.script import ScriptDirectory
print(ScriptDirectory.from_config(Config('alembic.ini')).get_heads())
"` — 应单 head 含 `038_knowledge_drills`。

- [ ] **Step 5: Commit**

```bash
cd /Users/xinghan/Dev/systemedu
git add packages/student-app/src/systemedu/student/db.py packages/student-app/alembic/versions/038_add_knowledge_drills.py
git commit -m "feat(student): KnowledgeDrill 表 + DAO + alembic 038"
```

---

## Task 2: drill generator (DRILL_PROMPT + LLM + JSON 解析)

**Files:**
- Create: `packages/student-app/src/systemedu/student/drill/__init__.py`
- Create: `packages/student-app/src/systemedu/student/drill/generator.py`
- Test: `tests/student/test_knowledge_drill.py`

- [ ] **Step 1: 写失败测试 — JSON 解析 (正常 + 非JSON降级)**

```python
# tests/student/test_knowledge_drill.py
"""知识钻取测试 (spec 2026-06-09)。"""
from __future__ import annotations

import json


def test_parse_drill_valid_json():
    from systemedu.student.drill.generator import parse_drill
    raw = json.dumps({
        "simple_explanation": "采样率是每秒采集信号的次数",
        "why_matters": "决定能不能还原信号",
        "analogy": "像拍视频的帧率",
        "key_points": ["fs>=2fmax", "EEG 常用 250Hz"],
        "go_deeper": "了解傅里叶变换",
    }, ensure_ascii=False)
    out = parse_drill(raw)
    assert out["simple_explanation"].startswith("采样率")
    assert isinstance(out["key_points"], list) and len(out["key_points"]) == 2


def test_parse_drill_strips_code_fence():
    from systemedu.student.drill.generator import parse_drill
    raw = '```json\n{"simple_explanation":"x","why_matters":"y","analogy":"z","key_points":["a"],"go_deeper":"w"}\n```'
    out = parse_drill(raw)
    assert out["simple_explanation"] == "x"


def test_parse_drill_non_json_degrades():
    from systemedu.student.drill.generator import parse_drill
    out = parse_drill("这不是 JSON 只是一段话")
    # 降级: 全部塞进 simple_explanation, 其余空, key_points 空 list
    assert "这不是 JSON" in out["simple_explanation"]
    assert out["key_points"] == []
    assert "why_matters" in out and "analogy" in out and "go_deeper" in out
```

- [ ] **Step 2: 运行 (失败)**

Run: `source .venv/bin/activate && python -m pytest tests/student/test_knowledge_drill.py -v 2>&1 | tail -8`
Expected: FAIL (模块不存在)。

- [ ] **Step 3: 写 generator.py**

```python
# packages/student-app/src/systemedu/student/drill/generator.py
"""知识钻取: 专用 prompt 调 LLM 生成结构化下钻知识 (spec 2026-06-09).

与 tutor chat 区分: 直接、完整、儿童友好地讲解高亮知识点 (不反问/不苏格拉底)。
输出固定 5 字段 JSON。
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

log = logging.getLogger(__name__)

DRILL_PROMPT = """你是一个面向 6-18 岁孩子的科学知识讲解员。学生在课文里高亮了一个不熟悉的知识点，
想要一份直接、完整、好懂的资料 (不是反问引导，就是把它讲清楚)。

当前课程节点: {knode_title}
课程上下文 (节选): {knode_context}

学生高亮的知识点:
{highlight_text}

请生成一份结构化讲解，严格输出如下 JSON (不要 markdown 代码块、不要多余文字):
{{
  "simple_explanation": "用一句大白话讲清这是什么",
  "why_matters": "为什么重要 / 用在哪",
  "analogy": "一个生活化类比帮孩子理解",
  "key_points": ["关键点1", "关键点2", "关键点3"],
  "go_deeper": "想更深可以了解的延伸方向"
}}
要求: 中文、口吻友好、准确、贴合孩子认知; key_points 给 3-5 条。"""

_FIELDS = ("simple_explanation", "why_matters", "analogy", "key_points", "go_deeper")


def _strip_fence(t: str) -> str:
    t = t.strip()
    if t.startswith("```"):
        t = re.sub(r"^```(?:json)?\s*", "", t)
        t = re.sub(r"\s*```$", "", t)
    return t.strip()


def parse_drill(raw: str) -> dict[str, Any]:
    """解析 LLM 输出为固定 5 字段 dict。非 JSON 降级: raw 进 simple_explanation。"""
    try:
        obj = json.loads(_strip_fence(raw))
        if not isinstance(obj, dict):
            raise ValueError("not a dict")
    except Exception:
        log.warning("drill output not JSON, degrading: %r", raw[:120])
        return {
            "simple_explanation": raw.strip(),
            "why_matters": "",
            "analogy": "",
            "key_points": [],
            "go_deeper": "",
        }
    out: dict[str, Any] = {}
    for f in _FIELDS:
        v = obj.get(f)
        if f == "key_points":
            out[f] = v if isinstance(v, list) else ([] if v in (None, "") else [str(v)])
        else:
            out[f] = str(v) if v is not None else ""
    return out


async def generate_drill(highlight_text: str, knode_title: str, knode_context: str) -> dict[str, Any]:
    """调 LLM 生成下钻知识。失败抛异常由调用方处理。"""
    from systemedu.core.llm_client import get_llm
    from langchain_core.messages import HumanMessage

    prompt = DRILL_PROMPT.format(
        knode_title=knode_title or "(未知)",
        knode_context=(knode_context or "")[:1500],
        highlight_text=highlight_text[:500],
    )
    llm = get_llm()
    resp = await llm.ainvoke([HumanMessage(content=prompt)])
    raw = resp.content if hasattr(resp, "content") else str(resp)
    raw = raw if isinstance(raw, str) else str(raw)
    return parse_drill(raw)


__all__ = ["DRILL_PROMPT", "parse_drill", "generate_drill"]
```

```python
# packages/student-app/src/systemedu/student/drill/__init__.py
from .routes import ROUTES

__all__ = ["ROUTES"]
```
> __init__ import routes (Task 3 建)。本 Task 先只建 generator + 空 __init__ (暂 `__all__ = []`), Task 3 再补 routes import。为避免 import 顺序问题, 本 Task 的 __init__.py 先写 `__all__ = []` 空内容, Task 3 改。

- [ ] **Step 4: 运行 parse 测试**

Run: `source .venv/bin/activate && python -m pytest tests/student/test_knowledge_drill.py -v 2>&1 | tail -10`
Expected: 3 PASS。

- [ ] **Step 5: 真实 LLM 验证 generate_drill (CLAUDE.md 要求 LLM 行为真实验证)**

Run: `source .venv/bin/activate && NO_PROXY=127.0.0.1,localhost python3 -c "
import asyncio
from systemedu.student.drill.generator import generate_drill
async def go():
    d = await generate_drill('奈奎斯特定理', '采样率与奈奎斯特', '本节讲采样率 fs>=2fmax')
    print('keys:', sorted(d.keys()))
    print('simple:', d['simple_explanation'][:60])
    print('key_points n:', len(d['key_points']))
asyncio.run(go())
"`
Expected: 5 字段齐全, simple_explanation 是对奈奎斯特的直接讲解, key_points 非空。(需真实 LLM key; 无 key 则跳过并报告。)

- [ ] **Step 6: Commit**

```bash
cd /Users/xinghan/Dev/systemedu
git add packages/student-app/src/systemedu/student/drill/__init__.py packages/student-app/src/systemedu/student/drill/generator.py tests/student/test_knowledge_drill.py
git commit -m "feat(student): drill generator (DRILL_PROMPT + LLM + JSON 解析)"
```

---

## Task 3: drill 端点 (POST 生成/复用 + GET 列表)

**Files:**
- Create: `packages/student-app/src/systemedu/student/drill/routes.py`
- Modify: `packages/student-app/src/systemedu/student/drill/__init__.py` (import routes)
- Modify: `packages/student-app/src/systemedu/student/server.py` (注册)
- Test: `tests/student/test_knowledge_drill.py` (追加)

- [ ] **Step 1: 写 routes.py**

```python
# packages/student-app/src/systemedu/student/drill/routes.py
"""知识钻取端点 (spec 2026-06-09).

POST /api/knowledge/drill  body {library_slug, module_id, highlight_text}
  → 已存 (user,slug,module,highlight) 则复用; 否则取 knode 上下文 + LLM 生成 + 存。
GET  /api/knowledge/drill?library_slug=&module_id=
  → 列该 user 在该 knode 的所有钻取记录。
"""
from __future__ import annotations

import logging

from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from ..auth.deps import require_login
from ..library_proxy.client import get_library_client
from .. import db as _db
from .generator import generate_drill

log = logging.getLogger(__name__)


async def api_drill_create(request: Request) -> JSONResponse:
    user_id, err = await require_login(request)
    if err:
        return err
    try:
        body = await request.json()
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=400)
    slug = (body.get("library_slug") or "").strip()
    module_id = (body.get("module_id") or "").strip()
    highlight = (body.get("highlight_text") or "").strip()
    if not (slug and module_id and highlight):
        return JSONResponse({"error": "library_slug/module_id/highlight_text required"}, status_code=400)

    # 复用已存
    existing = _db.get_drill_by_highlight(user_id, slug, module_id, highlight)
    if existing:
        return JSONResponse(existing)

    # 取 knode 上下文
    knode_title, knode_context = "", ""
    try:
        k = await get_library_client().get_knode(slug, module_id)
        knode_title = getattr(k, "title", "") or ""
        knode_context = getattr(k, "plan_markdown", "") or ""
    except Exception:
        log.warning("drill: get_knode failed slug=%s module=%s", slug, module_id)

    try:
        content = await generate_drill(highlight, knode_title, knode_context)
    except Exception as e:
        log.exception("drill generate failed")
        return JSONResponse({"error": "drill_generate_failed", "detail": str(e)}, status_code=500)

    saved = _db.create_drill(user_id, slug, module_id, highlight, content)
    return JSONResponse(saved, status_code=201)


async def api_drill_list(request: Request) -> JSONResponse:
    user_id, err = await require_login(request)
    if err:
        return err
    slug = request.query_params.get("library_slug", "")
    module_id = request.query_params.get("module_id", "")
    if not (slug and module_id):
        return JSONResponse({"error": "library_slug/module_id required"}, status_code=400)
    return JSONResponse({"drills": _db.list_drills(user_id, slug, module_id)})


ROUTES = [
    Route("/api/knowledge/drill", api_drill_create, methods=["POST"]),
    Route("/api/knowledge/drill", api_drill_list, methods=["GET"]),
]
```

- [ ] **Step 2: __init__.py 补 import**

```python
# packages/student-app/src/systemedu/student/drill/__init__.py
from .routes import ROUTES

__all__ = ["ROUTES"]
```

- [ ] **Step 3: server.py 注册 drill ROUTES**

server.py 顶部 import 加: `from .drill import ROUTES as _drill_routes` (与其它 routes import 并列)。
routes 列表 (约 61-67) 加 `*_drill_routes,` (与 *_chat_routes 并列)。

- [ ] **Step 4: 写端点测试 (ASGI 进程内, mock LLM + library)**

参照 tests/student/test_route_asgi.py 的 asgi_client + monkeypatch 模式 (它用进程内 ASGI)。追加到 test_knowledge_drill.py:
```python
import pytest


@pytest.fixture
def mock_drill_deps(monkeypatch):
    # mock generate_drill 不调真 LLM
    async def fake_gen(highlight, title, ctx):
        return {"simple_explanation": f"讲解:{highlight}", "why_matters": "w",
                "analogy": "a", "key_points": ["k1"], "go_deeper": "g"}
    import systemedu.student.drill.routes as r
    monkeypatch.setattr(r, "generate_drill", fake_gen)
    # mock get_knode
    class _K:
        title = "采样率"; plan_markdown = "ctx"
    class _Client:
        async def get_knode(self, slug, mod): return _K()
    monkeypatch.setattr(r, "get_library_client", lambda: _Client())


async def test_drill_create_and_reuse(asgi_client, mock_drill_deps):
    # register
    await asgi_client.post("/api/auth/register", json={"username": "drilluser", "password": "pw123456"})
    tok = (await asgi_client.post("/api/auth/login", json={"username": "drilluser", "password": "pw123456"})).json()["token"]
    H = {"Authorization": f"Bearer {tok}"}
    body = {"library_slug": "eeg", "module_id": "M01", "highlight_text": "奈奎斯特"}
    r1 = await asgi_client.post("/api/knowledge/drill", json=body, headers=H)
    assert r1.status_code == 201
    assert r1.json()["content"]["simple_explanation"].startswith("讲解:奈奎斯特")
    drill_id = r1.json()["id"]
    # 复用: 同 highlight 再 POST → 返回已存 (200, 同 id)
    r2 = await asgi_client.post("/api/knowledge/drill", json=body, headers=H)
    assert r2.status_code == 200
    assert r2.json()["id"] == drill_id
    # list
    rl = await asgi_client.get("/api/knowledge/drill?library_slug=eeg&module_id=M01", headers=H)
    assert rl.status_code == 200
    assert len(rl.json()["drills"]) == 1
```
> asgi_client fixture 在 tests/student/conftest.py (test_route_asgi 用的)。drill 测试是 async, 仓库 asyncio_mode=auto。register username 3-32 位、pw>=6。

- [ ] **Step 5: 运行端点测试**

Run: `source .venv/bin/activate && python -m pytest tests/student/test_knowledge_drill.py -v 2>&1 | tail -12`
Expected: create+reuse+list 全 PASS (parse 测试也仍 PASS)。

- [ ] **Step 6: 不破坏现有 + server 能起**

Run: `source .venv/bin/activate && python -c "from systemedu.student.server import create_app; create_app(); print('app OK')"` (需基础 env; 若报缺 env 用 test_route_asgi 同款 monkeypatch 思路, 或跳过信任端点测试)。
Run: `source .venv/bin/activate && python -m pytest tests/student/test_route_asgi.py -q 2>&1 | tail -3` — 现有 route 测试不破。

- [ ] **Step 7: Commit**

```bash
cd /Users/xinghan/Dev/systemedu
git add packages/student-app/src/systemedu/student/drill/ packages/student-app/src/systemedu/student/server.py tests/student/test_knowledge_drill.py
git commit -m "feat(student): 知识钻取端点 (POST 生成/复用 + GET 列表)"
```

---

## Task 4: 前端 api + 类型

**Files:**
- Modify: `packages/student-web/src/lib/api/index.ts`

- [ ] **Step 1: 加类型 + api**

index.ts 适当位置 (如 library export 附近) 加:
```typescript
export interface DrillContent {
  simple_explanation: string
  why_matters: string
  analogy: string
  key_points: string[]
  go_deeper: string
}

export interface DrillRecord {
  id: string
  highlight_text: string
  content: DrillContent
  created_at: string | null
}

export const knowledgeDrill = {
  create: (librarySlug: string, moduleId: string, highlightText: string) =>
    api.post<DrillRecord>("/api/knowledge/drill", {
      library_slug: librarySlug, module_id: moduleId, highlight_text: highlightText,
    }),
  list: (librarySlug: string, moduleId: string) =>
    api.get<{ drills: DrillRecord[] }>(
      `/api/knowledge/drill?library_slug=${encodeURIComponent(librarySlug)}&module_id=${encodeURIComponent(moduleId)}`,
    ),
}
```
> 确认 api.post/api.get 签名 (index.ts 顶部, 现有 auth/library 都用)。api.post 第二参是 body。

- [ ] **Step 2: 类型检查**

Run: `cd packages/student-web && npx tsc --noEmit 2>&1 | grep -iE "api/index|DrillContent|error TS" | head -5 || echo "no index type errors"`
Expected: 无 index.ts 相关错误。

- [ ] **Step 3: Commit**

```bash
cd /Users/xinghan/Dev/systemedu
git add packages/student-web/src/lib/api/index.ts
git commit -m "feat(web): knowledgeDrill api + 类型"
```

---

## Task 5: DrillModal 弹窗

**Files:**
- Create: `packages/student-web/src/components/learning/DrillModal.tsx`

- [ ] **Step 1: 写 DrillModal (受控: open + 输入 = 高亮文本 或 已存 record)**

```tsx
"use client"

/**
 * 知识钻取弹窗 (spec 2026-06-09)。
 * 两种用法:
 *  - 新钻取: 传 {librarySlug, moduleId, highlightText} → POST 生成/复用 → 展示。
 *  - 回访: 传 {record} → 直接展示已存 content (不请求)。
 * 纯展示 + 关闭 (MVP A1)。
 */

import { useEffect, useState } from "react"
import { X, Sparkles } from "lucide-react"

import { knowledgeDrill, type DrillContent, type DrillRecord } from "@/lib/api"

interface Props {
  open: boolean
  onClose: () => void
  librarySlug: string
  moduleId: string
  highlightText?: string   // 新钻取时传
  record?: DrillRecord     // 回访时传 (优先)
}

export function DrillModal({ open, onClose, librarySlug, moduleId, highlightText, record }: Props) {
  const [content, setContent] = useState<DrillContent | null>(record?.content ?? null)
  const [title, setTitle] = useState<string>(record?.highlight_text ?? highlightText ?? "")
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(false)

  useEffect(() => {
    if (!open) return
    if (record) { setContent(record.content); setTitle(record.highlight_text); return }
    if (!highlightText) return
    let cancelled = false
    setLoading(true); setErr(false); setContent(null); setTitle(highlightText)
    knowledgeDrill.create(librarySlug, moduleId, highlightText)
      .then((r) => { if (!cancelled) { setContent(r.content); setTitle(r.highlight_text) } })
      .catch(() => { if (!cancelled) setErr(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, record, highlightText, librarySlug, moduleId])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-[var(--card)] p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-[var(--ink)]">
            <Sparkles size={18} className="text-[var(--primary)]" /> 知识钻取
          </h3>
          <button type="button" onClick={onClose} className="text-[var(--sub)] hover:text-[var(--ink)]">
            <X size={20} />
          </button>
        </div>
        <p className="mb-4 rounded-lg bg-[var(--paper-2)] px-3 py-2 text-sm text-[var(--sub)]">
          "{title}"
        </p>

        {loading && <p className="py-8 text-center text-sm text-[var(--sub)]">正在为你钻取这个知识点...</p>}
        {err && <p className="py-8 text-center text-sm text-red-500">钻取失败, 请重试</p>}
        {content && (
          <div className="space-y-5 text-[var(--ink)]">
            <Section label="这是什么">{content.simple_explanation}</Section>
            <Section label="为什么重要">{content.why_matters}</Section>
            <Section label="打个比方">{content.analogy}</Section>
            {content.key_points?.length > 0 && (
              <div>
                <div className="mb-1.5 text-sm font-semibold text-[var(--primary)]">关键点</div>
                <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
                  {content.key_points.map((k, i) => <li key={i}>{k}</li>)}
                </ul>
              </div>
            )}
            <Section label="想更深一点">{content.go_deeper}</Section>
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  if (!children) return null
  return (
    <div>
      <div className="mb-1.5 text-sm font-semibold text-[var(--primary)]">{label}</div>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{children}</p>
    </div>
  )
}
```

- [ ] **Step 2: 类型检查**

Run: `cd packages/student-web && npx tsc --noEmit 2>&1 | grep -iE "DrillModal|error TS" | head -5 || echo "no DrillModal errors"`
Expected: 无 DrillModal 相关错误。

- [ ] **Step 3: Commit**

```bash
cd /Users/xinghan/Dev/systemedu
git add packages/student-web/src/components/learning/DrillModal.tsx
git commit -m "feat(web): DrillModal 知识钻取弹窗 (5 分区展示)"
```

---

## Task 6: HighlightAskButton 加「知识钻取」按钮 + DrillRecords 列表 + 挂载

**Files:**
- Modify: `packages/student-web/src/components/learning/HighlightAskButton.tsx`
- Create: `packages/student-web/src/components/learning/DrillRecords.tsx`
- Modify: `packages/student-web/src/components/learning/course-content-view.tsx`

- [ ] **Step 1: HighlightAskButton 改双按钮 + 触发 DrillModal**

当前单按钮(深入学习)。改: 浮层并排两个按钮; 「知识钻取」点击 → 通过回调把 highlightText 上抛, 由父组件开 DrillModal。给组件加可选 prop `onDrill?: (text: string) => void`:
```tsx
export function HighlightAskButton({ containerRef, onDrill }: {
  containerRef: React.RefObject<HTMLElement | null>
  onDrill?: (text: string) => void
}) {
```
在 onAsk 旁加:
```tsx
  const onDrillClick = () => {
    if (pos) onDrill?.(pos.text)
    setPos(null)
    window.getSelection()?.removeAllRanges()
  }
```
return 改为浮层包两个按钮 (深入学习 + 知识钻取):
```tsx
  return (
    <div
      onMouseDown={(e) => e.preventDefault()}
      style={{ position: "fixed", top: pos.top, left: pos.left, transform: "translateX(-50%)", zIndex: 50, display: "flex", gap: 8 }}
    >
      <button type="button" onClick={onAsk}
        className="inline-flex items-center gap-1 rounded-full bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-[var(--primary-ink)]">
        <Sparkles size={13} /> 深入学习
      </button>
      <button type="button" onClick={onDrillClick}
        className="inline-flex items-center gap-1 rounded-full bg-[var(--card)] border border-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary)] shadow-lg hover:bg-[var(--paper-2)]">
        <BookOpen size={13} /> 知识钻取
      </button>
    </div>
  )
```
import 加 `BookOpen` (lucide)。

- [ ] **Step 2: 写 DrillRecords (knode 页顶部折叠区)**

```tsx
"use client"

/**
 * knode 页"本节钻取记录"折叠区 (spec 2026-06-09, MVP B1)。
 * 进 knode 拉 list, N>0 才显示; 点某条 → DrillModal 展示已存 content。
 */

import { useEffect, useState } from "react"
import { ChevronDown, ChevronRight, BookOpen } from "lucide-react"

import { knowledgeDrill, type DrillRecord } from "@/lib/api"
import { DrillModal } from "./DrillModal"

export function DrillRecords({ librarySlug, moduleId }: { librarySlug: string; moduleId: string }) {
  const [records, setRecords] = useState<DrillRecord[]>([])
  const [openList, setOpenList] = useState(false)
  const [active, setActive] = useState<DrillRecord | null>(null)

  useEffect(() => {
    let cancelled = false
    knowledgeDrill.list(librarySlug, moduleId)
      .then((r) => { if (!cancelled) setRecords(r.drills) })
      .catch(() => { if (!cancelled) setRecords([]) })
    return () => { cancelled = true }
  }, [librarySlug, moduleId])

  if (records.length === 0) return null

  return (
    <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--paper-2)]">
      <button type="button" onClick={() => setOpenList((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-[var(--ink)]">
        {openList ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        <BookOpen size={15} className="text-[var(--primary)]" />
        本节钻取记录 ({records.length})
      </button>
      {openList && (
        <ul className="border-t border-[var(--border)] px-4 py-2">
          {records.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => setActive(r)}
                className="block w-full truncate py-1.5 text-left text-sm text-[var(--sub)] hover:text-[var(--primary)]">
                · {r.highlight_text}
              </button>
            </li>
          ))}
        </ul>
      )}
      <DrillModal
        open={active !== null}
        onClose={() => setActive(null)}
        librarySlug={librarySlug}
        moduleId={moduleId}
        record={active ?? undefined}
      />
    </div>
  )
}
```

- [ ] **Step 3: course-content-view 挂载 (DrillRecords + 让 HighlightAskButton 开 DrillModal)**

`course-content-view.tsx`:
1. import DrillRecords + DrillModal + useState。
2. 在挂 HighlightAskButton 的课文阅读区根容器 (上次 highlight 挂的那个 `max-w-4xl mx-auto ... relative` div) 内:
   - 顶部加 `<DrillRecords librarySlug={projectName} moduleId={<moduleId>} />` (moduleId 来源: 上次 highlight 用 knode?.module_id ?? String(nodeId), 复用同值)。
   - HighlightAskButton 传 `onDrill={(text) => setDrillText(text)}`。
   - 容器内加一个"新钻取"DrillModal: `<DrillModal open={!!drillText} onClose={() => setDrillText(null)} librarySlug={projectName} moduleId={mid} highlightText={drillText ?? undefined} />`。
3. 组件顶部加 `const [drillText, setDrillText] = useState<string | null>(null)`。
4. moduleId 值: 复用 highlight 挂载时用的同一表达式 (grep `module_id` 在该组件确认, 上次是 `knode?.module_id ?? String(nodeId)`); 抽成局部 `const mid = knode?.module_id ?? String(nodeId)` 给 DrillRecords/DrillModal/HighlightAskButton 共用。

> 实现前读 course-content-view.tsx 上次 HighlightAskButton 挂载处 (grep `HighlightAskButton`), 在同一容器同一 moduleId 来源挂 DrillRecords + 新钻取 DrillModal。保持最小侵入。

- [ ] **Step 4: 类型检查**

Run: `cd packages/student-web && npx tsc --noEmit 2>&1 | grep -iE "HighlightAskButton|DrillRecords|DrillModal|course-content" | grep -i error | head -8 || echo "no relevant errors"`
Expected: 无本特性文件相关错误。

- [ ] **Step 5: Commit**

```bash
cd /Users/xinghan/Dev/systemedu
git add packages/student-web/src/components/learning/HighlightAskButton.tsx packages/student-web/src/components/learning/DrillRecords.tsx packages/student-web/src/components/learning/course-content-view.tsx
git commit -m "feat(web): 双按钮(深入学习+知识钻取) + DrillRecords 回访列表 + 挂载"
```

---

## Task 7: 端到端验收 + 文档

**Files:**
- Modify: `docs/superpowers/specs/2026-06-09-knowledge-drill-design.md`, `docs/todolist.md`

- [ ] **Step 1: 全量后端回归**

Run: `source .venv/bin/activate && python -m pytest tests/student/ -q 2>&1 | tail -4`
Expected: 全 PASS (含 test_knowledge_drill)。

- [ ] **Step 2: PG 应用 038 + 重启**

Run: `cd packages/student-app && source ../../.venv/bin/activate && alembic upgrade head 2>&1 | tail -3` (应跑 038)。
Run: `cd /Users/xinghan/Dev/systemedu && bash scripts/restart-student.sh 2>&1 | tail -5`

- [ ] **Step 3: 端到端验证 (python, 真实 LLM)**

Run: `source .venv/bin/activate && NO_PROXY=127.0.0.1,localhost python3 -c "
import httpx, time
c=httpx.Client(base_url='http://127.0.0.1:18820', timeout=120, trust_env=False)
u=f'drv_{int(time.time())}'
tok=c.post('/api/auth/register', json={'username':u,'password':'pw123456'}).json()['token']
H={'Authorization':f'Bearer {tok}'}
c.post('/api/my/projects/eeg-minecraft-bci', headers=H)
r=c.post('/api/knowledge/drill', headers=H, json={'library_slug':'eeg-minecraft-bci','module_id':'M01','highlight_text':'奈奎斯特定理'})
d=r.json(); print('create:', r.status_code, '| 5字段:', sorted(d['content'].keys()))
l=c.get('/api/knowledge/drill?library_slug=eeg-minecraft-bci&module_id=M01', headers=H).json()
print('list:', len(l['drills']))
"`
Expected: create 201 + 5 字段齐 + list 1 条。

- [ ] **Step 4: 浏览器手动验收**

http://localhost:4000 → 登录 → pull eeg → M01 学习页 → 高亮课文 → 浮层两个按钮 →
点「知识钻取」→ 弹窗 loading → 5 分区展示 → 关闭 → 顶部出现"本节钻取记录(1)" →
退出 M01 进别的节点 → 回 M01 → 顶部仍有记录 → 点击 → 弹窗展示已存内容 (秒开不重新生成)。

- [ ] **Step 5: 文档**

- spec 加 `Status: shipped (2026-06-09)` + 验收结果。
- todolist 加后续: 钻取弹窗"转问 AI 导师"联动 (A2) / 重新生成 (A3) / 全局钻取列表。

- [ ] **Step 6: Commit**

```bash
cd /Users/xinghan/Dev/systemedu
git add docs/superpowers/specs/2026-06-09-knowledge-drill-design.md docs/todolist.md
git commit -m "docs: 知识钻取 shipped + todolist 后续项"
```

---

## 验收标准
- 后端: KnowledgeDrill 表 + 038; POST 生成/复用 (相同 highlight 返回已存); GET 列表 (user+knode 隔离); generator JSON 解析含降级; 真实 LLM 产 5 字段。
- 前端: 高亮浮双按钮; 知识钻取 → DrillModal 5 分区; knode 页"本节钻取记录(N)" → 点击回访展示已存 (不重新生成)。
- 持久化: 退出 knode 再回来 (甚至换设备) 仍能展开已存下钻知识 (存 PG)。
- 全量 tests/student 绿。
```
