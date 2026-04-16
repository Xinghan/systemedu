"""StudentFact DAO (spec 014 T2.1).

Wraps the StudentFact table from `src/systemedu/storage/db.py` with
the query patterns needed by MemoryInjector and FactExtractor.

Current-fact semantics: `valid_to IS NULL` marks a fact as current.
Supersede chain: when a new fact replaces an old one, the old row gets
`valid_to=now` and `superseded_by=new.id`, then the new row is
inserted fresh. Both rows remain queryable for the growth-timeline
(parent/teacher) view.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from systemedu.storage.db import StudentFact


class StudentFactDAO:
    """Database access for StudentFact rows.

    The DAO is stateless aside from the DB session it's given. Callers
    own the session lifecycle (commit / rollback).
    """

    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------
    # Reads
    # ------------------------------------------------------------------
    def get_current(
        self,
        *,
        user_id: str,
        knode_id: str | None,
        category: str,
    ) -> StudentFact | None:
        """Return the current (valid_to IS NULL) fact for the given key, or None.

        A `(user_id, knode_id, category)` triple has at most one current
        fact — supersede replaces in place.
        """
        return (
            self.db.query(StudentFact)
            .filter(
                StudentFact.user_id == user_id,
                StudentFact.knode_id == knode_id,
                StudentFact.category == category,
                StudentFact.valid_to.is_(None),
            )
            .one_or_none()
        )

    def list_by_user(
        self,
        user_id: str,
        *,
        project_name: str | None = None,
        category: str | None = None,
        current_only: bool = True,
    ) -> list[StudentFact]:
        """List facts for a user, optionally scoped to project/category.

        Default returns only current facts (`valid_to IS NULL`). Set
        `current_only=False` to include superseded rows for a growth-
        timeline query.
        """
        q = self.db.query(StudentFact).filter(StudentFact.user_id == user_id)
        if project_name is not None:
            q = q.filter(StudentFact.project_name == project_name)
        if category is not None:
            q = q.filter(StudentFact.category == category)
        if current_only:
            q = q.filter(StudentFact.valid_to.is_(None))
        return q.order_by(StudentFact.valid_from.desc()).all()

    def list_by_knode(
        self,
        *,
        user_id: str,
        knode_id: str,
        current_only: bool = True,
    ) -> list[StudentFact]:
        """List facts pinned to a specific knode (used by L3 recall)."""
        q = self.db.query(StudentFact).filter(
            StudentFact.user_id == user_id,
            StudentFact.knode_id == knode_id,
        )
        if current_only:
            q = q.filter(StudentFact.valid_to.is_(None))
        return q.order_by(StudentFact.valid_from.desc()).all()

    def get_supersede_chain(self, fact_id: int) -> list[StudentFact]:
        """Walk supersede chain forward from the given fact."""
        chain: list[StudentFact] = []
        current = self.db.query(StudentFact).filter(StudentFact.id == fact_id).one_or_none()
        while current is not None:
            chain.append(current)
            if current.superseded_by is None:
                break
            current = (
                self.db.query(StudentFact)
                .filter(StudentFact.id == current.superseded_by)
                .one_or_none()
            )
        return chain

    # ------------------------------------------------------------------
    # Writes
    # ------------------------------------------------------------------
    def insert(
        self,
        *,
        user_id: str,
        category: str,
        content: str,
        project_name: str | None = None,
        knode_id: str | None = None,
        confidence: float = 0.7,
        fact_metadata: dict[str, Any] | None = None,
        source_session_id: str | None = None,
    ) -> StudentFact:
        """Insert a brand-new current fact (no supersede check)."""
        fact = StudentFact(
            user_id=user_id,
            project_name=project_name,
            knode_id=knode_id,
            category=category,
            content=content,
            confidence=confidence,
            fact_metadata=fact_metadata or {},
            source_session_id=source_session_id,
        )
        self.db.add(fact)
        self.db.flush()  # populate fact.id
        return fact

    def insert_with_supersede(
        self,
        *,
        user_id: str,
        category: str,
        content: str,
        project_name: str | None = None,
        knode_id: str | None = None,
        confidence: float = 0.7,
        fact_metadata: dict[str, Any] | None = None,
        source_session_id: str | None = None,
        supersede: bool = True,
    ) -> StudentFact:
        """Insert a new fact; if `supersede=True`, retire any current fact
        for the same `(user_id, knode_id, category)` key.

        Returns the new fact. Caller is responsible for commit.
        """
        new_fact = self.insert(
            user_id=user_id,
            category=category,
            content=content,
            project_name=project_name,
            knode_id=knode_id,
            confidence=confidence,
            fact_metadata=fact_metadata,
            source_session_id=source_session_id,
        )

        if supersede:
            existing = (
                self.db.query(StudentFact)
                .filter(
                    StudentFact.user_id == user_id,
                    StudentFact.knode_id == knode_id,
                    StudentFact.category == category,
                    StudentFact.valid_to.is_(None),
                    StudentFact.id != new_fact.id,
                )
                .all()
            )
            now = datetime.utcnow()
            for old in existing:
                old.valid_to = now
                old.superseded_by = new_fact.id

        return new_fact


__all__ = ["StudentFactDAO"]
