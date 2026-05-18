"""spec 031 P4.1: student-app FactExtractor.

输入: 一个 pending_extraction.id
流程:
  1. 加载 session 的 chat_messages (按 created_at 升序)
  2. LLM (qwen-plus) 抽事实 → list[{scope, category, key, value, library_slug?, module_id?, confidence}]
  3. 调 upsert_fact(...) 写 StudentFact (supersede chain 内置)
  4. 调 Mem0.add(...) 把对话语义写 L4 向量库 (若 Mem0 可用)

注: 我们不重用 core/tutor/memory/fact_extractor.py — 那个版本绑定 cloud-app
的 project_name/knode_id 字段名, 而我们的 schema 是 library_slug/module_id, 且
我们的 fact 模型是 scope+key+value (而非 cloud-app 的 category+content)。直接写
一个对齐 spec 031 schema 的新版本更清晰。
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import Any, Protocol

from langchain_core.messages import HumanMessage

from systemedu.student import db as _db

log = logging.getLogger(__name__)


FACT_PROMPT = """你是一个事实抽取器。下面是师生对话, 抽取关于学生本人的长期事实(跨 session 仍然有用的画像/兴趣/技能/家庭背景/学习偏好等)。

输出严格 JSON 数组, 每条形如:
{{"scope": "global|project|knode",
  "category": "interest|goal|skill_level|family|misconception|preference",
  "key": "短英文 snake_case 主键, <=64字",
  "value": "中文描述, <=200字",
  "confidence": 0.0-1.0,
  "library_slug": "可选, scope=project|knode 时必填",
  "module_id": "可选, scope=knode 时必填"}}

规则:
- 只抽 "事实" 不抽 "事件"。"学生今天问了 PM2.5" 不是事实; "学生关注空气质量对哮喘的影响, 因为弟弟有哮喘" 是事实。
- scope=global: 跨项目仍然有用 (兴趣/家庭/学习风格)
- scope=project: 仅在当前 library_slug 内有用 (项目目标/对项目某模块的偏好)
- scope=knode: 仅对某 module 有用 (对该 knode 的具体 misconception)
- 若没有可抽取事实, 返回空数组 []
- 不要返回 markdown 代码块, 不要解释, 只要 JSON 数组

当前项目: {library_slug}
当前 knode: {module_id}

对话:
{conversation}
"""


class _LLM(Protocol):
    async def ainvoke(self, messages: list[Any]) -> Any: ...


class _Mem0(Protocol):
    async def add(self, messages: list[dict], *, user_id: str, metadata: dict | None = None) -> Any: ...


@dataclass
class ExtractStats:
    messages_read: int
    facts_extracted: int
    facts_written: int
    mem0_added: bool


class StudentFactExtractor:
    def __init__(self, llm: _LLM, mem0_client: _Mem0 | None = None):
        self.llm = llm
        self.mem0 = mem0_client

    async def extract_session(self, pending_id: str) -> ExtractStats:
        """读 pending row → session messages → LLM → upsert facts + Mem0 add."""
        with _db.get_session() as sess:
            p = sess.get(_db.PendingExtraction, pending_id)
            if p is None:
                raise ValueError(f"pending {pending_id} not found")
            session = sess.get(_db.ChatSession, p.session_id)
            if session is None:
                raise ValueError(f"chat_session {p.session_id} not found")
            user_id = p.user_id
            library_slug = session.library_slug or ""
            module_id = session.module_id or ""

            from sqlalchemy import select
            msgs = sess.execute(
                select(_db.ChatMessage)
                .where(_db.ChatMessage.session_id == p.session_id)
                .order_by(_db.ChatMessage.created_at)
            ).scalars().all()
            msg_dicts = [
                {"role": m.role, "content": m.content}
                for m in msgs
                if m.role in ("user", "assistant")
            ]

        if not msg_dicts:
            return ExtractStats(0, 0, 0, False)

        # ---- LLM 抽取 ----
        convo = "\n".join(f"[{m['role']}] {m['content']}" for m in msg_dicts)
        prompt = FACT_PROMPT.format(
            library_slug=library_slug or "(无)",
            module_id=module_id or "(无)",
            conversation=convo[:8000],  # 截断, 避免 prompt 爆炸
        )
        resp = await self.llm.ainvoke([HumanMessage(content=prompt)])
        raw = _text(resp)
        facts = _parse_facts(raw)

        # ---- upsert StudentFact ----
        written = 0
        for f in facts:
            try:
                scope = f.get("scope", "global")
                if scope not in ("global", "project", "knode"):
                    continue
                cat = f.get("category", "")
                key = (f.get("key") or "").strip()[:64]
                value = (f.get("value") or "").strip()[:1000]
                if not (cat and key and value):
                    continue
                slug_arg = f.get("library_slug") if scope != "global" else None
                mod_arg = f.get("module_id") if scope == "knode" else None
                _db.upsert_fact(
                    user_id,
                    scope,
                    cat,
                    key,
                    value,
                    library_slug=slug_arg,
                    module_id=mod_arg,
                    source_session=p.session_id,
                    confidence=float(f.get("confidence", 0.7)),
                )
                written += 1
            except Exception:
                log.exception("upsert_fact failed for %s", f)

        # ---- Mem0.add (语义向量) ----
        mem0_ok = False
        if self.mem0 is not None and msg_dicts:
            try:
                meta = {"session_id": p.session_id}
                if library_slug:
                    meta["library_slug"] = library_slug
                if module_id:
                    meta["module_id"] = module_id
                await self.mem0.add(msg_dicts, user_id=user_id, metadata=meta)
                mem0_ok = True
            except Exception:
                log.exception("mem0.add failed for session %s", p.session_id)

        return ExtractStats(
            messages_read=len(msg_dicts),
            facts_extracted=len(facts),
            facts_written=written,
            mem0_added=mem0_ok,
        )


# ----------------------- helpers -----------------------

_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def _text(resp: Any) -> str:
    if hasattr(resp, "content"):
        c = resp.content
        if isinstance(c, str):
            return c
        if isinstance(c, list):
            return "".join(
                p if isinstance(p, str) else p.get("text", "") if isinstance(p, dict) else ""
                for p in c
            )
    return str(resp)


def _parse_facts(raw: str) -> list[dict]:
    s = _FENCE_RE.sub("", raw).strip()
    if not s:
        return []
    try:
        data = json.loads(s)
    except json.JSONDecodeError:
        log.warning("fact extractor returned non-JSON: %r", raw[:200])
        return []
    if not isinstance(data, list):
        return []
    return [d for d in data if isinstance(d, dict)]


__all__ = ["StudentFactExtractor", "ExtractStats", "FACT_PROMPT"]
