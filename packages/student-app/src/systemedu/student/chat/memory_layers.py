"""spec 031 P3.2: student-app 版本 5 层 MemoryInjector.

不复用老 core/tutor/memory/layers.py (它查 cloud-app schema). 这里:
- L1 学生画像:        student.db student_facts WHERE scope='global'
- L2 项目上下文:      student.db user_projects + last_visited (按 page_kind)
- L3 当前 knode 内容: Redis cache + library API
- L3 答题历史:        student.db exercise_attempts
- L4 Mem0 召回:       Mem0 (Qdrant) filter by user_id (+ slug/module_id)
- L5 skill 状态:      LangGraph state.skill_state

签名兼容 cloud-app MemoryInjector, 让 LangGraph memory_inject node 透明替换.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal, Protocol

from systemedu.core.tutor.state import MemorySnapshot

log = logging.getLogger(__name__)

PageKind = Literal["global", "home", "library_detail", "learn"]

# Page-kind activation matrix
PAGES_WITH_L1 = {"global", "home", "library_detail", "learn"}
PAGES_WITH_L2 = {"home", "library_detail", "learn"}
PAGES_WITH_L3_KNODE = {"learn"}
PAGES_WITH_L3_HISTORY = {"learn"}
PAGES_WITH_L4 = {"global", "home", "library_detail", "learn"}
PAGES_WITH_L5 = {"learn"}


class _Mem0Client(Protocol):
    async def search(
        self,
        query: str,
        *,
        user_id: str,
        filters: dict[str, Any] | None = None,
        limit: int = 3,
    ) -> list[dict[str, Any]]: ...


class _LibraryClient(Protocol):
    async def get_knode(self, slug: str, knode_id: str) -> Any: ...


@dataclass
class StudentMemoryInjector:
    """student-app 版 5 层 memory injector.

    与 cloud-app MemoryInjector 的 inject(...) 签名兼容, 但实现独立.
    """

    mem0_client: _Mem0Client | None = None
    library_client: _LibraryClient | None = None
    l4_top_k: int = 3
    knode_summary_ttl: int = 300  # 5 min

    async def inject(
        self,
        *,
        user_id: str,
        page_kind: PageKind = "global",
        library_slug: str | None = None,
        module_id: str | None = None,
        last_user_msg: str = "",
        active_skill_state: dict[str, Any] | None = None,
    ) -> MemorySnapshot:
        """按 page_kind 决定激活哪些层, 并发 gather, 任一层挂兜底."""
        tasks: list[tuple[str, Any]] = []

        if page_kind in PAGES_WITH_L1:
            tasks.append(("l1", self._l1_profile(user_id)))
        if page_kind in PAGES_WITH_L2:
            tasks.append(("l2", self._l2_project_ctx(user_id, library_slug, page_kind)))
        if page_kind in PAGES_WITH_L3_KNODE and library_slug and module_id:
            tasks.append(("l3_content", self._l3_knode_content(library_slug, module_id)))
        if page_kind in PAGES_WITH_L3_HISTORY and library_slug and module_id:
            tasks.append(("l3_history", self._l3_exercise_history(user_id, library_slug, module_id)))
        if page_kind in PAGES_WITH_L4:
            tasks.append((
                "l4",
                self._l4_semantic_recall(user_id, last_user_msg, library_slug, module_id, page_kind),
            ))
        if page_kind in PAGES_WITH_L5:
            tasks.append(("l5", self._l5_skill_ctx(active_skill_state)))

        labels = [t[0] for t in tasks]
        coros = [t[1] for t in tasks]
        results = await asyncio.gather(*coros, return_exceptions=True)

        out: dict[str, Any] = {}
        for label, r in zip(labels, results):
            if isinstance(r, Exception):
                log.warning("memory layer %s raised: %s", label, r)
                out[label] = [] if label == "l4" else ""
            else:
                out[label] = r

        # L3 history 合并到 knode content (老 cloud-app 兼容 — MemorySnapshot 字段)
        l3_content = out.get("l3_content", "")
        l3_hist = out.get("l3_history", "")
        if l3_hist:
            l3_content = (l3_content + "\n\n" + l3_hist) if l3_content else l3_hist

        return MemorySnapshot(
            l1_profile=out.get("l1", ""),
            l2_project_ctx=out.get("l2", ""),
            l3_knode_state="",  # 老 cloud-app 字段, student-app 不分 state / content
            l3_knode_content=l3_content,
            l4_semantic_recall=out.get("l4", []) if isinstance(out.get("l4"), list) else [],
            l5_skill_ctx=out.get("l5", ""),
            injected_at=datetime.utcnow(),
        )

    # ------------------------------------------------------------------
    # L1 学生画像
    # ------------------------------------------------------------------
    async def _l1_profile(self, user_id: str) -> str:
        """跨项目稳定事实 (scope='global')."""
        return await asyncio.to_thread(self._l1_query, user_id)

    @staticmethod
    def _l1_query(user_id: str) -> str:
        from systemedu.student.db import list_current_facts
        facts = list_current_facts(user_id, scope="global", limit=20)
        if not facts:
            return ""
        # 按 category 分组
        by_cat: dict[str, list[str]] = {}
        for f in facts:
            by_cat.setdefault(f["category"], []).append(f"{f['key']}={f['value']}")
        lines = []
        for cat in ("interest", "goal", "skill_level", "family", "preference", "misconception"):
            if cat in by_cat:
                lines.append(f"{cat}: " + ", ".join(by_cat[cat]))
        # 杂项
        for cat, items in by_cat.items():
            if cat not in ("interest", "goal", "skill_level", "family", "preference", "misconception"):
                lines.append(f"{cat}: " + ", ".join(items))
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # L2 项目上下文
    # ------------------------------------------------------------------
    async def _l2_project_ctx(
        self, user_id: str, library_slug: str | None, page_kind: PageKind,
    ) -> str:
        return await asyncio.to_thread(self._l2_query, user_id, library_slug, page_kind)

    @staticmethod
    def _l2_query(user_id: str, library_slug: str | None, page_kind: PageKind) -> str:
        from systemedu.student.db import list_user_projects, get_last_visited
        if page_kind == "home":
            # top 3 recent pulled
            projects = list_user_projects(user_id, include_removed=False)
            projects = sorted(
                projects, key=lambda p: p.pulled_at or datetime.min, reverse=True,
            )[:3]
            if not projects:
                return ""
            lines = []
            for p in projects:
                lv = get_last_visited(user_id, p.library_slug)
                last = f"M={lv.last_module_id}" if lv else "未开始"
                lines.append(f"- {p.library_slug} (v{p.library_version or '?'}, {last})")
            return "已 Pull 项目 (top 3):\n" + "\n".join(lines)
        elif page_kind in ("library_detail", "learn") and library_slug:
            # 单项目细节
            projects = list_user_projects(user_id, include_removed=False)
            cur = next((p for p in projects if p.library_slug == library_slug), None)
            if cur is None:
                return f"{library_slug} 尚未 Pull"
            lv = get_last_visited(user_id, library_slug)
            last = lv.last_module_id if lv else "未开始"
            return f"当前项目: {library_slug} v{cur.library_version or '?'}, 学到 {last}"
        return ""

    # ------------------------------------------------------------------
    # L3 当前 knode 内容
    # ------------------------------------------------------------------
    async def _l3_knode_content(self, library_slug: str, module_id: str) -> str:
        from systemedu.student.cache import get_cache
        cache = get_cache()
        key = f"knode:{library_slug}:{module_id}:summary"
        try:
            cached = await cache.get(key)
            if cached:
                return cached.decode("utf-8") if isinstance(cached, bytes) else cached
        except Exception as e:
            log.warning("redis cache get failed: %s", e)

        if self.library_client is None:
            return ""
        try:
            k = await self.library_client.get_knode(library_slug, module_id)
        except Exception as e:
            log.warning("library get_knode failed: %s", e)
            return ""
        summary = self._build_knode_summary(k)
        try:
            await cache.setex(key, self.knode_summary_ttl, summary.encode("utf-8"))
        except Exception:
            pass
        return summary

    @staticmethod
    def _build_knode_summary(k: Any) -> str:
        """从 KnodeContent dataclass 抽取简要 summary 给 agent."""
        title = getattr(k, "title", "") or ""
        plan_md = (getattr(k, "plan_markdown", "") or "")[:300]
        # rendered_sections / theories 数
        rs = getattr(k, "rendered_sections", None) or {}
        theories = getattr(k, "theories", None) or []
        ideas = rs.get("ideas") if isinstance(rs, dict) else None
        rendered = rs.get("rendered_sections") if isinstance(rs, dict) else None
        n_exercises = 0
        n_anim = 0
        n_game = 0
        if isinstance(rendered, dict):
            for sec in rendered.values():
                mode = sec.get("mode") if isinstance(sec, dict) else None
                if mode == "exercise":
                    exs = sec.get("exercises") or []
                    n_exercises += len(exs)
                elif mode == "animation":
                    n_anim += 1
                elif mode == "game":
                    n_game += 1
        parts = []
        if title:
            parts.append(f"标题: {title}")
        if plan_md:
            parts.append(f"学习计划 (首段):\n{plan_md}")
        meta_bits = []
        if theories:
            meta_bits.append(f"{len(theories)} 个理论卡")
        if n_exercises:
            meta_bits.append(f"{n_exercises} 题练习")
        if n_anim:
            meta_bits.append(f"{n_anim} 个动画")
        if n_game:
            meta_bits.append(f"{n_game} 个游戏")
        if meta_bits:
            parts.append("含 " + " · ".join(meta_bits))
        return "\n".join(parts)

    # ------------------------------------------------------------------
    # L3 答题历史
    # ------------------------------------------------------------------
    async def _l3_exercise_history(
        self, user_id: str, library_slug: str, module_id: str,
    ) -> str:
        return await asyncio.to_thread(
            self._l3_history_query, user_id, library_slug, module_id,
        )

    @staticmethod
    def _l3_history_query(user_id: str, library_slug: str, module_id: str) -> str:
        from systemedu.student.db import list_exercise_attempts
        # 当前 module 全部
        current = list_exercise_attempts(user_id, library_slug, module_id, limit=20)
        # 项目级最近 5 条错的 (跨 module)
        recent_wrong = list_exercise_attempts(
            user_id, library_slug, only_wrong=True, limit=5,
        )
        if not current and not recent_wrong:
            return ""

        lines = []
        if current:
            n_total = len(current)
            n_correct = sum(1 for a in current if a.get("correct"))
            lines.append(
                f"{module_id} 答题: {n_total} 题, 对 {n_correct} 错 {n_total - n_correct}"
            )
            wrongs = [a for a in current if a.get("correct") is False][:3]
            for w in wrongs:
                q = (w.get("question") or "")[:60]
                ans = (w.get("student_answer") or "")[:30]
                lines.append(f"  错题: {q!r}  你答: {ans!r}")
        # 项目级近期错点 (排除当前 module 已展示的)
        recent_other = [
            a for a in recent_wrong
            if a.get("module_id") != module_id
        ][:3]
        if recent_other:
            lines.append("项目近期错点:")
            for a in recent_other:
                q = (a.get("question") or "")[:60]
                m = a.get("module_id")
                lines.append(f"  ({m}) {q!r}")
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # L4 Mem0 语义召回
    # ------------------------------------------------------------------
    async def _l4_semantic_recall(
        self,
        user_id: str,
        query: str,
        library_slug: str | None,
        module_id: str | None,
        page_kind: PageKind,
    ) -> list[str]:
        if self.mem0_client is None or not query:
            return []
        filters: dict[str, Any] = {"user_id": user_id}
        if page_kind in ("library_detail", "learn") and library_slug:
            filters["library_slug"] = library_slug
        if page_kind == "learn" and module_id:
            filters["module_id"] = module_id
        try:
            hits = await self.mem0_client.search(
                query=query, user_id=user_id, filters=filters, limit=self.l4_top_k,
            )
        except Exception as e:
            log.warning("L4 Mem0 search failed: %s", e)
            return []
        return [h.get("memory", "") for h in hits if isinstance(h, dict) and h.get("memory")]

    # ------------------------------------------------------------------
    # L5 当前 skill 状态
    # ------------------------------------------------------------------
    async def _l5_skill_ctx(self, active_skill_state: dict[str, Any] | None) -> str:
        if not active_skill_state:
            return ""
        skill = active_skill_state.get("skill", "?")
        turn = active_skill_state.get("turn", 0)
        stuck = active_skill_state.get("stuck_signal", "")
        parts = [f"active skill: {skill}, turn {turn}"]
        if stuck:
            parts.append(f"stuck signal: {stuck}")
        return ", ".join(parts)


# ------------------------------------------------------------------
# Render
# ------------------------------------------------------------------

MEMORY_TEMPLATE = """## L1 学生画像
{l1}

## L2 项目上下文
{l2}

## L3 当前 knode 内容
{l3_content}

## L4 相关历史对话 (语义召回 top {l4_top_k})
{l4_bullets}

## L5 当前教学策略
{l5}"""


def render_memory(snapshot: MemorySnapshot, *, l4_top_k: int = 3) -> str:
    """Render snapshot as system-prompt block. 空层渲染 (空) 占位保持结构稳定."""
    l4 = snapshot.get("l4_semantic_recall") or []
    bullets = "\n".join(f"- {s}" for s in l4) if l4 else "(空)"
    return MEMORY_TEMPLATE.format(
        l1=snapshot.get("l1_profile") or "(空)",
        l2=snapshot.get("l2_project_ctx") or "(空)",
        l3_content=snapshot.get("l3_knode_content") or "(空)",
        l4_bullets=bullets,
        l5=snapshot.get("l5_skill_ctx") or "(空)",
        l4_top_k=l4_top_k,
    )


class CloudInjectorAdapter:
    """Adapter — 把 StudentMemoryInjector 适配成 core/tutor 的 MemoryInjector 签名,
    让 LangGraph make_memory_inject_node(...) 透明替换不用改 core.

    映射:
      project_name -> library_slug
      knode_id     -> module_id
      context_scope=project/global → page_kind 派生:
        active_tab 字段被复用作 page_kind 传递 (spec 031 P3.1 也加了 state.page_kind 字段)
        优先读 state['page_kind'] 但 inject() 签名拿不到 state, 这里只能用启发式推断
    """

    def __init__(self, injector: "StudentMemoryInjector"):
        self._inner = injector

    async def inject(
        self,
        *,
        user_id: str,
        project_name: str | None,
        knode_id: str | None,
        last_user_msg: str,
        active_skill_state: dict[str, Any] | None = None,
        context_scope: str = "project",
        active_tab: str | None = None,
    ) -> MemorySnapshot:
        # active_tab 在 spec 031 中被复用透传 page_kind (memory_inject_node 改造时把
        # state['page_kind'] 塞进 active_tab; 见 tutor_runner 改造)
        page_kind: PageKind = "global"
        if active_tab in ("global", "home", "library_detail", "learn"):
            page_kind = active_tab  # type: ignore[assignment]
        else:
            # 启发: 有 knode = learn, 有 slug = library_detail, 否则 global
            if knode_id and project_name:
                page_kind = "learn"
            elif project_name:
                page_kind = "library_detail"
            else:
                page_kind = "global"
        return await self._inner.inject(
            user_id=user_id,
            page_kind=page_kind,
            library_slug=project_name,
            module_id=knode_id,
            last_user_msg=last_user_msg,
            active_skill_state=active_skill_state,
        )


__all__ = [
    "StudentMemoryInjector",
    "CloudInjectorAdapter",
    "PageKind",
    "MEMORY_TEMPLATE",
    "render_memory",
    "PAGES_WITH_L1",
    "PAGES_WITH_L2",
    "PAGES_WITH_L3_KNODE",
    "PAGES_WITH_L3_HISTORY",
    "PAGES_WITH_L4",
    "PAGES_WITH_L5",
]
