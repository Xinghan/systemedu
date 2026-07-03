"""TutorDataProvider protocol (spec 043 P1, direction A).

The built-in tutor tools must not query concrete tables directly:
the tables they were originally written against (`core.storage.db`'s
`ProgressRecord` / `LessonContent`) are the cloud-app schema, which the
current student-app deployment does NOT use. student-app stores the
same concepts in different places (`UserKnodeComplete`,
`ExerciseAttempt`, its own `StudentFact`, and course content served over
HTTP by library-app).

To keep the core→student dependency direction one-way, core defines this
abstract data-access contract; the host application (student-app)
implements it and injects an instance through `ToolContext.data`. Tools
call `ctx.data.*` and stay ignorant of where the data actually lives.

All methods are async and return plain JSON-able dicts/lists so the
results drop straight into tool return values.

`project` / `knode` in these signatures are the tutor-facing identifiers
the LLM passes (project slug + knode/module id). The provider maps them
onto whatever its storage calls them.
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class TutorDataProvider(Protocol):
    """Data-access contract the host app implements for tutor tools."""

    async def get_progress(self, user_id: str, project: str) -> dict[str, Any]:
        """Return the student's progress in a project.

        Shape: {"project": str, "total_nodes": int, "passed_nodes": int,
        "pct": float, "nodes": [{"knode_id": str, "status": str}, ...]}.
        """
        ...

    async def get_knode_content(self, project: str, knode: str) -> dict[str, Any]:
        """Return course content for one knode.

        Shape: {"found": bool, "knode": str, "title": str,
        "content": str}. `content` is a compact text summary the tutor
        can quote; the provider decides how to condense it.
        """
        ...

    async def get_knode_prerequisites(self, project: str, knode: str) -> dict[str, Any]:
        """Return the prerequisite knodes for one knode.

        Shape: {"found": bool, "knode": str,
        "prerequisites": [{"knode_id": str, "title": str}, ...]}.
        """
        ...

    async def get_practice_exercises(self, project: str, knode: str) -> dict[str, Any]:
        """Return practice exercises for a knode, WITHOUT correct answers.

        Shape: {"found": bool, "knode": str,
        "exercises": [{"exercise_id": str, "question": str, ...}, ...]}.
        The provider strips `correct`/`answer` fields.
        """
        ...

    async def grade_submission(
        self, user_id: str, project: str, knode: str, exercise_id: str, student_answer: str,
    ) -> dict[str, Any]:
        """Grade one submitted answer and record the attempt.

        Shape: {"graded": bool, "exercise_id": str, "is_correct": bool,
        "correct_answer": str}. Recording the attempt (so P2's formative
        loop can read it back) is the provider's responsibility.
        """
        ...

    async def mark_complete(self, user_id: str, project: str, knode: str) -> dict[str, Any]:
        """Mark a knode complete for the student (write, confirm-gated).

        Shape: {"ok": bool, "knode": str}.
        """
        ...

    async def search_student_facts(
        self, user_id: str, query: str | None = None, category: str | None = None,
        project: str | None = None, knode: str | None = None, limit: int = 10,
    ) -> dict[str, Any]:
        """Return current (non-superseded) structured facts about the student.

        Shape: {"facts": [{"category": str, "key": str, "value": str}, ...]}.
        """
        ...


__all__ = ["TutorDataProvider"]
