"""Fact extractor (spec 014 T2.3).

Given a pending_fact_extraction row, pulls the session's unextracted
messages, asks an LLM to extract structured facts, and upserts them
into StudentFact. Supersede decisions use a second LLM call that
compares the new fact to the current one for the same
(user_id, knode_id, category) triple.

The extractor is side-effect-driven but does NOT manage pending-row
lifecycle — the worker (T2.5) claims / marks done / marks failed.
Raising an exception means the worker should record the failure.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any, Protocol

from langchain_core.messages import HumanMessage
from sqlalchemy.orm import Session

from systemedu.core.storage.db import ChatMessage, ChatSession, PendingFactExtraction
from systemedu.core.tutor.memory.student_fact import StudentFactDAO

log = logging.getLogger(__name__)


FACT_EXTRACTION_PROMPT = """分析以下师生对话，抽取关于学生的事实。每条事实必须符合：
- category ∈ {{interest, knowledge, struggle, goal, context}}
- content ≤ 200 字
- confidence 0.0-1.0

对 knowledge 类，标注 mastery_level (exposure/understand/apply/master)
对 struggle 类，标注 struggle_type (concept/calc/strategy)

只返回 JSON 数组，不要 markdown 代码块、不要解释。每个元素形如：
{{"category": "...", "content": "...", "confidence": 0.8,
  "knode_id": "k10", "metadata": {{"mastery_level": "understand"}},
  "evidence_msg_ids": [4521]}}

若没有可抽取的事实，返回 []。

当前 knode: {knode_id}
项目: {project_name}
对话:
{conversation}
"""

SUPERSEDE_PROMPT = """你在决定是否要用"新事实"覆盖同一学生、同一 knode、同一 category 下的"旧事实"。

旧事实（{old_days_ago} 天前）:
{old}

新事实（现在）:
{new}

从以下三种动作中选一个：
- overwrite: 新事实覆盖旧事实（学生水平变化 / 观点更新 / 旧信息过时）
- coexist: 旧事实仍然有效，新事实是补充（例如两个独立的兴趣点）
- ignore: 新事实是旧事实的弱化复述，不必入库

只返回 JSON: {{"action": "overwrite|coexist|ignore", "reason": "..."}}"""


class _LLM(Protocol):
    async def ainvoke(self, messages: list[Any]) -> Any: ...


@dataclass
class ExtractionStats:
    messages_read: int
    facts_extracted: int
    facts_inserted: int
    facts_superseded: int
    facts_ignored: int


class FactExtractor:
    """Extract facts from a session's conversation into StudentFact rows.

    Callers own the DB session lifecycle (commit / rollback).
    """

    def __init__(self, db: Session, llm: _LLM):
        self.db = db
        self.llm = llm
        self.dao = StudentFactDAO(db)

    # ------------------------------------------------------------------
    # Public entry
    # ------------------------------------------------------------------
    async def extract_session(self, pending_id: int) -> ExtractionStats:
        """Pull messages for the pending row's session, extract + upsert facts.

        Does not mark the pending row done/failed — the worker does that
        based on whether this call raises. If the LLM returns malformed
        JSON we raise `ValueError`.
        """
        pending = self._load_pending(pending_id)
        session = self._load_session(pending.session_id)
        messages = self._load_messages(
            session_id=pending.session_id,
            after_msg_id=pending.first_unextracted_msg_id,
        )
        if not messages:
            log.info("fact_extractor: no new messages for session %s", pending.session_id)
            return ExtractionStats(0, 0, 0, 0, 0)

        raw_facts = await self._llm_extract(
            conversation=messages,
            knode_id=session.knode_id,
            project_name=session.project_name,
        )

        inserted = superseded = ignored = 0
        for fact in raw_facts:
            action = await self._upsert_with_supersede(
                user_id=pending.user_id,
                project_name=session.project_name,
                source_session_id=pending.session_id,
                fact=fact,
            )
            if action == "overwrite":
                superseded += 1
                inserted += 1
            elif action == "insert":
                inserted += 1
            elif action == "ignore":
                ignored += 1

        return ExtractionStats(
            messages_read=len(messages),
            facts_extracted=len(raw_facts),
            facts_inserted=inserted,
            facts_superseded=superseded,
            facts_ignored=ignored,
        )

    # ------------------------------------------------------------------
    # Steps
    # ------------------------------------------------------------------
    def _load_pending(self, pending_id: int) -> PendingFactExtraction:
        row = (
            self.db.query(PendingFactExtraction)
            .filter(PendingFactExtraction.id == pending_id)
            .one_or_none()
        )
        if row is None:
            raise ValueError(f"pending_fact_extraction row {pending_id} not found")
        return row

    def _load_session(self, session_id: str) -> ChatSession:
        session = (
            self.db.query(ChatSession)
            .filter(ChatSession.id == session_id)
            .one_or_none()
        )
        if session is None:
            raise ValueError(f"chat session {session_id!r} not found")
        return session

    def _load_messages(
        self,
        *,
        session_id: str,
        after_msg_id: int | None,
    ) -> list[ChatMessage]:
        q = self.db.query(ChatMessage).filter(ChatMessage.session_id == session_id)
        if after_msg_id is not None:
            q = q.filter(ChatMessage.id > after_msg_id)
        return q.order_by(ChatMessage.id.asc()).all()

    async def _llm_extract(
        self,
        *,
        conversation: list[ChatMessage],
        knode_id: str | None,
        project_name: str | None,
    ) -> list[dict[str, Any]]:
        convo = "\n".join(
            f"[msg#{m.id} {m.role}] {m.content}" for m in conversation
        )
        prompt = FACT_EXTRACTION_PROMPT.format(
            knode_id=knode_id or "(none)",
            project_name=project_name or "(none)",
            conversation=convo,
        )
        resp = await self.llm.ainvoke([HumanMessage(content=prompt)])
        raw = _message_text(resp)
        return _parse_fact_json(raw)

    async def _upsert_with_supersede(
        self,
        *,
        user_id: str,
        project_name: str | None,
        source_session_id: str,
        fact: dict[str, Any],
    ) -> str:
        """Insert a fact, supersede the current one if LLM says so.

        Returns one of:
        - "insert":   no existing current fact, inserted fresh
        - "overwrite": existing fact retired, new one inserted
        - "coexist":  existing fact kept, new one inserted alongside
        - "ignore":   new fact discarded as weak restatement
        """
        category = fact["category"]
        content = fact["content"]
        knode_id = fact.get("knode_id")
        confidence = float(fact.get("confidence", 0.7))
        metadata = dict(fact.get("metadata") or {})
        if fact.get("evidence_msg_ids"):
            metadata["evidence_msg_ids"] = list(fact["evidence_msg_ids"])

        existing = self.dao.get_current(
            user_id=user_id, knode_id=knode_id, category=category,
        )
        if existing is None:
            self.dao.insert(
                user_id=user_id,
                project_name=project_name,
                knode_id=knode_id,
                category=category,
                content=content,
                confidence=confidence,
                fact_metadata=metadata,
                source_session_id=source_session_id,
            )
            return "insert"

        action = await self._decide_supersede(existing, fact)
        if action == "ignore":
            return "ignore"

        supersede = action == "overwrite"
        self.dao.insert_with_supersede(
            user_id=user_id,
            project_name=project_name,
            knode_id=knode_id,
            category=category,
            content=content,
            confidence=confidence,
            fact_metadata=metadata,
            source_session_id=source_session_id,
            supersede=supersede,
        )
        return "overwrite" if supersede else "coexist"

    async def _decide_supersede(
        self,
        old: Any,
        new: dict[str, Any],
    ) -> str:
        from datetime import datetime

        old_age = datetime.utcnow() - (old.valid_from or datetime.utcnow())
        prompt = SUPERSEDE_PROMPT.format(
            old_days_ago=max(old_age.days, 0),
            old=json.dumps(
                {"content": old.content, "confidence": old.confidence,
                 "metadata": old.fact_metadata},
                ensure_ascii=False,
            ),
            new=json.dumps(
                {"content": new["content"],
                 "confidence": new.get("confidence", 0.7),
                 "metadata": new.get("metadata") or {}},
                ensure_ascii=False,
            ),
        )
        resp = await self.llm.ainvoke([HumanMessage(content=prompt)])
        raw = _message_text(resp)
        try:
            data = json.loads(_strip_code_fence(raw))
            action = str(data.get("action", "coexist")).lower()
        except (json.JSONDecodeError, AttributeError):
            log.warning("supersede judge returned non-JSON, defaulting to coexist: %r", raw)
            return "coexist"

        if action not in {"overwrite", "coexist", "ignore"}:
            return "coexist"
        return action


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _message_text(resp: Any) -> str:
    """Extract text content from an LLM response (AIMessage or plain str)."""
    if hasattr(resp, "content"):
        content = resp.content
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts = []
            for chunk in content:
                if isinstance(chunk, str):
                    parts.append(chunk)
                elif isinstance(chunk, dict) and "text" in chunk:
                    parts.append(chunk["text"])
            return "".join(parts)
    return str(resp)


def _strip_code_fence(text: str) -> str:
    """Strip ```json ... ``` fences LLMs sometimes add despite instructions."""
    s = text.strip()
    if s.startswith("```"):
        s = s.split("\n", 1)[1] if "\n" in s else s[3:]
        if s.endswith("```"):
            s = s[:-3]
        if s.startswith("json\n"):
            s = s[5:]
    return s.strip()


def _parse_fact_json(raw: str) -> list[dict[str, Any]]:
    """Parse the extractor LLM's JSON response.

    Raises ValueError on malformed JSON so the worker retries.
    """
    stripped = _strip_code_fence(raw)
    try:
        data = json.loads(stripped)
    except json.JSONDecodeError as e:
        raise ValueError(f"fact extractor returned non-JSON: {raw!r}") from e

    if not isinstance(data, list):
        raise ValueError(f"fact extractor must return a list, got {type(data).__name__}")

    facts: list[dict[str, Any]] = []
    for entry in data:
        if not isinstance(entry, dict):
            raise ValueError(f"fact entry must be an object, got: {entry!r}")
        if "category" not in entry or "content" not in entry:
            raise ValueError(f"fact entry missing category/content: {entry!r}")
        facts.append(entry)
    return facts


__all__ = [
    "FactExtractor",
    "ExtractionStats",
    "FACT_EXTRACTION_PROMPT",
    "SUPERSEDE_PROMPT",
]
