"""StudentDataProvider — tutor tool data access over student-app storage.

spec 043 P1 (direction A). The core tutor tools were written against the
cloud-app schema (`ProgressRecord` / `LessonContent`), which the current
student-app deployment does not use. This provider implements the
`TutorDataProvider` contract against student-app's real sources:

- progress      -> `user_knode_complete` (list_completed_knodes)
- knode content -> library-app over HTTP (AsyncLibraryClient.get_knode)
- exercises     -> library-app course_content.rendered_sections
- grading       -> library-app answer key + record an ExerciseAttempt
- facts         -> student-app `student_facts` (list_current_facts)

Identifier mapping: the tutor tools speak `project` (= library slug) and
`knode` (= module id). student-app tables use `library_slug` / `module_id`
and `project_slug` / `knode_id`; this class bridges them.

DB helpers run sync SQLAlchemy, so we hop to a thread to avoid blocking
the event loop. The library client is already async.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

log = logging.getLogger(__name__)


def _collect_exercises(k: Any) -> list[dict]:
    """Extract exercises from a library KnodeContent's rendered_sections."""
    rs = getattr(k, "rendered_sections", None) or {}
    rendered = rs.get("rendered_sections") if isinstance(rs, dict) else None
    out: list[dict] = []
    seen: set[str] = set()
    if isinstance(rendered, dict):
        for sec in rendered.values():
            if not isinstance(sec, dict) or sec.get("mode") != "exercise":
                continue
            for ex in sec.get("exercises") or []:
                q = ex.get("question", "") if isinstance(ex, dict) else ""
                if q and q not in seen:
                    seen.add(q)
                    out.append(ex)
    return out


def _strip_answer(ex: dict) -> dict:
    safe = dict(ex)
    safe.pop("correct", None)
    safe.pop("answer", None)
    return safe


class StudentDataProvider:
    """Implements `TutorDataProvider` over student-app storage + library."""

    def __init__(self, library_client: Any | None = None):
        self._library = library_client

    # ---- progress ---------------------------------------------------
    async def get_progress(self, user_id: str, project: str) -> dict[str, Any]:
        from systemedu.student.catalog.user_lit import get_completed_knode_ids

        done = await asyncio.to_thread(get_completed_knode_ids, user_id, project)
        return {
            "project": project,
            "passed_nodes": len(done),
            "passed_knode_ids": list(done),
            "note": "总节点数需从 library 项目结构获取; 此处仅统计已完成",
        }

    # ---- knode content ----------------------------------------------
    async def get_knode_content(self, project: str, knode: str) -> dict[str, Any]:
        if self._library is None:
            return {"found": False, "knode": knode, "error": "library not configured"}
        try:
            k = await self._library.get_knode(project, knode)
        except Exception as e:  # noqa: BLE001
            log.warning("get_knode_content failed %s/%s: %s", project, knode, e)
            return {"found": False, "knode": knode, "error": "fetch failed"}
        if k is None:
            return {"found": False, "knode": knode}
        theories = getattr(k, "theories", None) or []
        theory_txt = "\n".join(
            t.get("body_markdown", "") if isinstance(t, dict) else str(t)
            for t in (theories[:3] if isinstance(theories, list) else [])
        )
        return {
            "found": True,
            "knode": knode,
            "title": getattr(k, "title", "") or "",
            "content": (getattr(k, "plan_markdown", "") or "")[:1200],
            "theories": theory_txt[:1200],
        }

    # ---- prerequisites ----------------------------------------------
    async def get_knode_prerequisites(self, project: str, knode: str) -> dict[str, Any]:
        if self._library is None:
            return {"found": False, "knode": knode, "prerequisites": []}
        try:
            k = await self._library.get_knode(project, knode)
        except Exception as e:  # noqa: BLE001
            log.warning("get_knode_prerequisites failed %s/%s: %s", project, knode, e)
            return {"found": False, "knode": knode, "prerequisites": []}
        if k is None:
            return {"found": False, "knode": knode, "prerequisites": []}
        prereqs = getattr(k, "prerequisites", None) or getattr(k, "prereqs", None) or []
        norm: list[dict] = []
        for p in prereqs if isinstance(prereqs, list) else []:
            if isinstance(p, dict):
                norm.append({"knode_id": p.get("knode_id") or p.get("id"), "title": p.get("title", "")})
            else:
                norm.append({"knode_id": str(p), "title": ""})
        return {"found": True, "knode": knode, "prerequisites": norm}

    # ---- practice exercises -----------------------------------------
    async def get_practice_exercises(self, project: str, knode: str) -> dict[str, Any]:
        if self._library is None:
            return {"found": False, "knode": knode, "exercises": []}
        try:
            k = await self._library.get_knode(project, knode)
        except Exception as e:  # noqa: BLE001
            log.warning("get_practice_exercises failed %s/%s: %s", project, knode, e)
            return {"found": False, "knode": knode, "exercises": []}
        if k is None:
            return {"found": False, "knode": knode, "exercises": []}
        exercises = [_strip_answer(ex) for ex in _collect_exercises(k)]
        return {"found": True, "knode": knode, "exercises": exercises}

    # ---- grading ----------------------------------------------------
    async def grade_submission(
        self, user_id: str, project: str, knode: str, exercise_id: str, student_answer: str,
    ) -> dict[str, Any]:
        if self._library is None:
            return {"graded": False, "reason": "library not configured"}
        try:
            k = await self._library.get_knode(project, knode)
        except Exception as e:  # noqa: BLE001
            log.warning("grade_submission fetch failed %s/%s: %s", project, knode, e)
            return {"graded": False, "reason": "fetch failed"}
        if k is None:
            return {"graded": False, "reason": "knode not found"}

        correct_answer: Any = None
        question: str = ""
        for ex in _collect_exercises(k):
            if str(ex.get("exercise_id")) == str(exercise_id):
                correct_answer = ex.get("correct") or ex.get("answer")
                question = ex.get("question", "")
                break
        if correct_answer is None:
            return {"graded": False, "reason": "exercise not found"}

        is_correct = student_answer.strip().lower() == str(correct_answer).strip().lower()

        # Record the attempt so P2's formative loop (and L3 memory) can
        # read it back. Best-effort — never fail grading on a write error.
        try:
            from systemedu.student.db import record_exercise_attempt

            await asyncio.to_thread(
                record_exercise_attempt,
                user_id=user_id,
                library_slug=project,
                module_id=knode,
                idea_id=str(exercise_id),
                question=question,
                student_answer=student_answer,
                correct=is_correct,
            )
        except Exception as e:  # noqa: BLE001
            log.warning("record_exercise_attempt failed: %s", e)

        return {
            "graded": True,
            "exercise_id": exercise_id,
            "is_correct": is_correct,
            "correct_answer": correct_answer,
        }

    # ---- mark complete ----------------------------------------------
    async def mark_complete(self, user_id: str, project: str, knode: str) -> dict[str, Any]:
        try:
            from systemedu.student.catalog.user_lit import toggle_complete

            await asyncio.to_thread(
                toggle_complete, user_id, project, knode, "complete",
            )
            return {"ok": True, "knode": knode}
        except Exception as e:  # noqa: BLE001
            log.warning("mark_complete failed %s/%s: %s", project, knode, e)
            return {"ok": False, "knode": knode, "error": "write failed"}

    # ---- facts ------------------------------------------------------
    async def search_student_facts(
        self, user_id: str, query: str | None = None, category: str | None = None,
        project: str | None = None, knode: str | None = None, limit: int = 10,
    ) -> dict[str, Any]:
        from systemedu.student.db import list_current_facts

        rows = await asyncio.to_thread(
            list_current_facts, user_id, None, project, knode, limit,
        )
        facts = [
            {"category": r.get("category"), "key": r.get("key"), "value": r.get("value")}
            for r in rows
            if not category or r.get("category") == category
        ]
        return {"facts": facts, "count": len(facts)}


__all__ = ["StudentDataProvider"]
