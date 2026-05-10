"""5-layer memory injector (spec 014 T2.2).

`MemoryInjector.inject(...)` concurrently recalls five memory layers
and returns a `MemorySnapshot`. Layers are gated by `context_scope`:

- `project`: L1 + L2 + L3 + L4(project-filtered) + L5
- `global`:  L1 + L4(cross-project); L2 / L3 / L5 return ""

All layers share an `asyncio.gather(return_exceptions=True)` call —
one flaky layer (e.g. Mem0 timeout) never blocks the others. The
factory pattern `db_session_factory()` gives each layer its own DB
session so the gather is safe to run against a single SQLAlchemy
engine.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Literal, Protocol

from sqlalchemy.orm import Session

from systemedu.core.storage.db import (
    Enrollment,
    ExerciseAttempt,
    LessonContent,
    ProgressRecord,
    StudentFact,
)
from systemedu.core.tutor.state import MemorySnapshot

log = logging.getLogger(__name__)

ContextScope = Literal["project", "global"]


class _Mem0Client(Protocol):
    """Duck-typed Mem0 client used by L4.

    T2.6 replaces this with the real client. For now we only rely on
    an async `search(query, user_id, filters)` returning a list of
    {"memory": str, ...} dicts.
    """

    async def search(
        self,
        query: str,
        *,
        user_id: str,
        filters: dict[str, Any] | None = None,
        limit: int = 3,
    ) -> list[dict[str, Any]]: ...


@dataclass
class MemoryInjector:
    """Recalls 5 memory layers in parallel, gated by context_scope."""

    db_session_factory: Callable[[], Session]
    mem0_client: _Mem0Client | None = None
    l4_top_k: int = 3

    async def inject(
        self,
        *,
        user_id: str,
        project_name: str | None,
        knode_id: str | None,
        last_user_msg: str,
        active_skill_state: dict[str, Any] | None = None,
        context_scope: ContextScope = "project",
        active_tab: str | None = None,
    ) -> MemorySnapshot:
        """Recall all applicable layers concurrently.

        Layers deactivated by the scope return "" without touching I/O,
        so they add zero latency.
        """
        if context_scope == "project" and not project_name:
            log.warning(
                "MemoryInjector: context_scope=project without project_name; "
                "treating as global to avoid leaking global L4 into a 'project' snapshot",
            )
            context_scope = "global"

        tasks = [
            self._l1_profile(user_id),
            self._l2_project_ctx(user_id, project_name, context_scope),
            self._l3_knode_state(user_id, project_name, context_scope),
            self._l3_knode_content(project_name, knode_id, context_scope, active_tab),
            self._l3_exercise_history(user_id, project_name, knode_id, context_scope),
            self._l4_semantic_recall(
                user_id, last_user_msg, project_name, context_scope,
            ),
            self._l5_skill_ctx(active_skill_state, context_scope),
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        def _safe(r: Any, label: str) -> Any:
            if isinstance(r, Exception):
                log.warning("memory layer %s raised: %s", label, r)
                return [] if label == "l4" else ""
            return r

        l1 = _safe(results[0], "l1")
        l2 = _safe(results[1], "l2")
        l3 = _safe(results[2], "l3")
        l3_content = _safe(results[3], "l3_content")
        l3_exercises = _safe(results[4], "l3_exercises")
        l4 = _safe(results[5], "l4")
        l5 = _safe(results[6], "l5")

        # Merge exercise history into knode content
        if l3_exercises:
            l3_content = (l3_content + "\n\n" + l3_exercises) if l3_content else l3_exercises

        return MemorySnapshot(
            l1_profile=l1,
            l2_project_ctx=l2,
            l3_knode_state=l3,
            l3_knode_content=l3_content,
            l4_semantic_recall=l4 if isinstance(l4, list) else [],
            l5_skill_ctx=l5,
            injected_at=datetime.utcnow(),
        )

    # ------------------------------------------------------------------
    # Layer implementations
    # ------------------------------------------------------------------
    async def _l1_profile(self, user_id: str) -> str:
        """L1 aggregates stable interests + goals across all projects."""

        def _query() -> str:
            with _session(self.db_session_factory) as db:
                facts = (
                    db.query(StudentFact)
                    .filter(
                        StudentFact.user_id == user_id,
                        StudentFact.category.in_(["interest", "goal"]),
                        StudentFact.valid_to.is_(None),
                    )
                    .order_by(StudentFact.confidence.desc())
                    .limit(10)
                    .all()
                )
                if not facts:
                    return ""
                lines = [
                    f"- [{f.category}] {f.content}"
                    for f in facts
                ]
                return "\n".join(lines)

        return await asyncio.to_thread(_query)

    async def _l2_project_ctx(
        self,
        user_id: str,
        project_name: str | None,
        scope: ContextScope,
    ) -> str:
        if scope != "project" or not project_name:
            return ""

        def _query() -> str:
            with _session(self.db_session_factory) as db:
                enrollment = (
                    db.query(Enrollment)
                    .filter(
                        Enrollment.user_id == user_id,
                        Enrollment.project_name == project_name,
                    )
                    .one_or_none()
                )
                if enrollment is None:
                    return ""
                parts = [
                    f"- 项目: {project_name}",
                    f"- 状态: {enrollment.status}",
                    f"- 已通过节点: {enrollment.nodes_passed}/{enrollment.total_nodes}",
                ]
                if enrollment.last_activity_at:
                    parts.append(f"- 最近活动: {enrollment.last_activity_at:%Y-%m-%d}")
                return "\n".join(parts)

        return await asyncio.to_thread(_query)

    async def _l3_knode_state(
        self,
        user_id: str,
        project_name: str | None,
        scope: ContextScope,
    ) -> str:
        """L3 returns all current facts for the project (scope=project).

        Per context-matrix §4: within a project, memory is fully open
        across every knode — we do NOT filter by knode_id.
        """
        if scope != "project" or not project_name:
            return ""

        def _query() -> str:
            with _session(self.db_session_factory) as db:
                facts = (
                    db.query(StudentFact)
                    .filter(
                        StudentFact.user_id == user_id,
                        StudentFact.project_name == project_name,
                        StudentFact.category.in_(
                            ["knowledge", "struggle", "context"]
                        ),
                        StudentFact.valid_to.is_(None),
                        StudentFact.confidence >= 0.5,
                    )
                    .order_by(
                        StudentFact.knode_id.asc(),
                        StudentFact.confidence.desc(),
                    )
                    .limit(20)
                    .all()
                )
                progress = (
                    db.query(ProgressRecord)
                    .filter(
                        ProgressRecord.user_id == user_id,
                        ProgressRecord.project_name == project_name,
                    )
                    .all()
                )
                if not facts and not progress:
                    return ""
                lines: list[str] = []
                for f in facts:
                    knode_tag = f"k{f.knode_id}" if f.knode_id else "无节点"
                    extra = ""
                    if f.fact_metadata:
                        if "mastery_level" in f.fact_metadata:
                            extra = f" ({f.fact_metadata['mastery_level']})"
                        elif "struggle_type" in f.fact_metadata:
                            extra = f" ({f.fact_metadata['struggle_type']})"
                    lines.append(f"- [{f.category}@{knode_tag}]{extra} {f.content}")
                if progress:
                    passed = [p for p in progress if p.status == "passed"]
                    if passed:
                        lines.append(
                            f"- 已通过 {len(passed)} 个节点: "
                            + ", ".join(f"k{p.knode_id}" for p in passed[:8])
                        )
                return "\n".join(lines)

        return await asyncio.to_thread(_query)

    async def _l3_knode_content(
        self,
        project_name: str | None,
        knode_id: str | None,
        scope: ContextScope,
        active_tab: str | None = None,
    ) -> str:
        """Load current knode's course content, prioritized by active_tab.

        Different tabs foreground different content:
        - concept (default): plan_markdown full + exercises summary
        - practice:          exercises full (with options) + plan_markdown summary
        - project_assignment: assignment text full + plan_markdown summary

        This gives the skill LLM actual knowledge of what the student is
        studying, so it can answer in-context instead of hallucinating.
        """
        if scope != "project" or not project_name or not knode_id:
            return ""

        tab = active_tab or "concept"

        def _query() -> str:
            import json as _json

            with _session(self.db_session_factory) as db:
                try:
                    kid = int(knode_id)
                except (ValueError, TypeError):
                    return ""
                row = (
                    db.query(LessonContent)
                    .filter(
                        LessonContent.project_name == project_name,
                        LessonContent.knode_id == kid,
                    )
                    .one_or_none()
                )
                if row is None:
                    return ""

                parts: list[str] = []
                plan = ""
                exercises: list[dict] = []

                # Parse course_content JSON
                if row.course_content:
                    try:
                        cc = _json.loads(row.course_content)
                        plan = cc.get("plan_markdown") or ""
                        for sec in (cc.get("rendered_sections") or {}).values():
                            if sec.get("mode") == "exercise":
                                for ex in sec.get("exercises") or []:
                                    exercises.append(ex)
                        for ex in cc.get("exercises") or []:
                            exercises.append(ex)
                    except (_json.JSONDecodeError, TypeError):
                        pass

                # --- Tab-specific content assembly ---

                if tab == "practice":
                    # Exercises are primary; plan is secondary context
                    parts.append("(学生当前正在查看: 练习题页面)")
                    if exercises:
                        parts.append(
                            "## 练习题（完整）\n"
                            + _format_exercises(exercises, detailed=True)
                        )
                    if plan:
                        short = plan[:600] + "\n..." if len(plan) > 600 else plan
                        parts.append(f"## 课程内容（摘要）\n{short}")

                elif tab == "project_assignment":
                    # Assignment is primary; plan is secondary
                    parts.append("(学生当前正在查看: 作业页面)")
                    assignment = row.project_assignment or ""
                    if assignment:
                        if len(assignment) > 2000:
                            assignment = assignment[:2000] + "\n...(truncated)"
                        parts.append(f"## 作业要求（完整）\n{assignment}")
                    if plan:
                        short = plan[:600] + "\n..." if len(plan) > 600 else plan
                        parts.append(f"## 课程内容（摘要）\n{short}")

                else:
                    # concept / default: plan is primary, exercises secondary
                    parts.append("(学生当前正在查看: 课文页面)")
                    if plan:
                        if len(plan) > 1500:
                            plan = plan[:1500] + "\n...(truncated)"
                        parts.append(f"## 课程内容\n{plan}")
                    if exercises:
                        parts.append(
                            "## 练习题\n"
                            + _format_exercises(exercises, detailed=False)
                        )

                # Fallback: legacy concept field
                has_real_content = any(
                    not p.startswith("(") for p in parts
                )
                if not has_real_content:
                    if row.concept:
                        text = row.concept
                        if len(text) > 1500:
                            text = text[:1500] + "\n...(truncated)"
                        parts.append(f"## 课程内容\n{text}")
                    else:
                        # No valid content at all (bad JSON, empty fields)
                        return ""

                return "\n\n".join(parts)

        return await asyncio.to_thread(_query)

    async def _l3_exercise_history(
        self,
        user_id: str,
        project_name: str | None,
        knode_id: str | None,
        scope: ContextScope,
    ) -> str:
        """Load student's exercise attempt history for this knode.

        Produces a concise summary: accuracy, weak spots, recent wrong answers.
        This lets the tutor know exactly what the student struggles with.
        """
        if scope != "project" or not project_name or not knode_id:
            return ""

        def _query() -> str:
            with _session(self.db_session_factory) as db:
                try:
                    kid = int(knode_id)
                except (ValueError, TypeError):
                    return ""
                rows = (
                    db.query(ExerciseAttempt)
                    .filter(
                        ExerciseAttempt.user_id == user_id,
                        ExerciseAttempt.project_name == project_name,
                        ExerciseAttempt.knode_id == kid,
                    )
                    .order_by(ExerciseAttempt.created_at.desc())
                    .limit(50)
                    .all()
                )
                if not rows:
                    return ""

                total = len(rows)
                correct = sum(1 for r in rows if r.is_correct)
                first_tries = [r for r in rows if r.attempt_seq == 1]
                first_correct = sum(1 for r in first_tries if r.is_correct)
                times = [r.time_spent_ms for r in rows if r.time_spent_ms]
                avg_time = round(sum(times) / max(len(times), 1) / 1000, 1) if times else 0

                parts = [
                    f"## 学生做题记录（knode {kid}）",
                    f"- 总答题 {total} 次，正确 {correct} 次（正确率 {round(correct/total*100)}%）",
                    f"- 首次作答正确率 {round(first_correct/max(len(first_tries),1)*100)}%",
                ]
                if avg_time:
                    parts.append(f"- 平均用时 {avg_time} 秒")

                # list wrong answers with error analysis
                wrong = [r for r in rows if not r.is_correct and r.attempt_seq == 1]
                if wrong:
                    parts.append("- 答错的题目:")
                    for w in wrong[:5]:
                        line = f"  - [{w.quiz_type}] {w.question[:60]}"
                        if w.error_analysis:
                            line += f" | 分析: {w.error_analysis[:80]}"
                        parts.append(line)
                    retried = [r for r in rows if r.attempt_seq > 1 and r.is_correct]
                    if retried:
                        parts.append(f"- 其中 {len(retried)} 题重试后答对")

                return "\n".join(parts)

        return await asyncio.to_thread(_query)

    async def _l4_semantic_recall(
        self,
        user_id: str,
        query: str,
        project_name: str | None,
        scope: ContextScope,
    ) -> list[str]:
        """L4 hits Mem0 — per-scope filter per context-matrix §4.

        Returns list[str] of raw memory snippets; formatter lives in §6.4
        rendering code so the tutor can decide bullet style.
        """
        if self.mem0_client is None or not query.strip():
            return []

        filters: dict[str, Any] | None = None
        if scope == "project" and project_name:
            filters = {"project_name": project_name}

        results = await self.mem0_client.search(
            query=query,
            user_id=user_id,
            filters=filters,
            limit=self.l4_top_k,
        )
        snippets: list[str] = []
        for r in results:
            snippet = r.get("memory") or r.get("text") or ""
            if snippet:
                snippets.append(snippet)
        return snippets

    async def _l5_skill_ctx(
        self,
        active_skill_state: dict[str, Any] | None,
        scope: ContextScope,
    ) -> str:
        if scope != "project" or not active_skill_state:
            return ""
        # The skill subgraph owns the final formatter (T3.x summarize_state).
        # For Phase 2 we render a minimal summary from known fields.
        name = active_skill_state.get("skill_name", "unknown")
        turn = active_skill_state.get("turn_count", 0)
        notes = active_skill_state.get("summary")
        lines = [f"- 当前策略: {name} (turn {turn})"]
        if notes:
            lines.append(f"- 进展: {notes}")
        return "\n".join(lines)


# ---------------------------------------------------------------------------
# Exercise formatting helper
# ---------------------------------------------------------------------------
def _format_exercises(exercises: list[dict], *, detailed: bool) -> str:
    """Format exercises for LLM context.

    detailed=True:  full question + all options (for practice tab)
    detailed=False: question summary only (for concept tab)
    """
    lines: list[str] = []
    for ex in exercises[:10]:
        q = ex.get("question", "")
        eid = ex.get("exercise_id", "")
        etype = ex.get("type", "")
        opts = ex.get("options")
        correct = ex.get("correct")

        if detailed:
            line = f"- [{eid}] ({etype}) {q}"
            if opts and isinstance(opts, list):
                for j, opt in enumerate(opts):
                    marker = " <-- correct" if correct is not None and j == correct else ""
                    line += f"\n    {chr(65 + j)}. {opt}{marker}"
                # If correct is a string letter (legacy)
                if isinstance(correct, str) and not marker:
                    line += f"\n  正确答案: {correct}"
            elif correct is not None:
                line += f" [答案: {correct}]"
        else:
            line = f"- [{eid}] ({etype}) {q}"
            if opts and isinstance(opts, list):
                line += " | " + " / ".join(str(o) for o in opts)

        lines.append(line)
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Rendering (design §6.4)
# ---------------------------------------------------------------------------
MEMORY_TEMPLATE = """## L1 学生画像（稳定）
{l1_profile}

## L2 项目上下文
{l2_project_ctx}

## L3 当前 knode 状态
{l3_knode_state}

## L3 当前课程内容
{l3_knode_content}

## L4 相关历史对话（语义召回 top {l4_top_k}）
{l4_semantic_recall_bullets}

## L5 当前教学策略进度
{l5_skill_ctx}"""


def render_memory(snapshot: MemorySnapshot, *, l4_top_k: int = 3) -> str:
    """Render a MemorySnapshot as the system-prompt block per §6.4.

    Empty layers still render their heading but with `(空)` body so the
    tutor LLM gets a consistent structure; drop completely if you want
    tighter prompts.
    """
    l4 = snapshot.get("l4_semantic_recall") or []
    bullets = "\n".join(f"- {s}" for s in l4) if l4 else "(空)"
    return MEMORY_TEMPLATE.format(
        l1_profile=snapshot.get("l1_profile") or "(空)",
        l2_project_ctx=snapshot.get("l2_project_ctx") or "(空)",
        l3_knode_state=snapshot.get("l3_knode_state") or "(空)",
        l3_knode_content=snapshot.get("l3_knode_content") or "(空)",
        l4_semantic_recall_bullets=bullets,
        l5_skill_ctx=snapshot.get("l5_skill_ctx") or "(空)",
        l4_top_k=l4_top_k,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
class _session:
    """Tiny context manager wrapping the session_factory callable.

    Factories may return either a Session directly (usage:
    ``with factory() as s``) or something that needs closing; either
    way we just close it.
    """

    def __init__(self, factory: Callable[[], Session]):
        self.factory = factory
        self.s: Session | None = None

    def __enter__(self) -> Session:
        self.s = self.factory()
        return self.s

    def __exit__(self, *exc) -> None:
        if self.s is not None:
            self.s.close()


__all__ = [
    "MemoryInjector",
    "ContextScope",
    "MEMORY_TEMPLATE",
    "render_memory",
]
