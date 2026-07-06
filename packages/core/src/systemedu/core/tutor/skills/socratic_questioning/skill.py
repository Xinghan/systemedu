"""Socratic-questioning skill (spec 014 T3.4, state machine spec 043 T2.6).

A real multi-node state machine (not "one prompt, one call"):

    assess ──> ask_question         (exploring / breakthrough)
          └──> scaffold_down        (stuck: 2+ rounds without progress)

`assess` classifies the student's last reply into exploring / breakthrough /
stuck using the LLM (with a deterministic fast-path for the explicit
"直接告诉我" exit and a keyword fallback when the LLM is unavailable), so the
transitions react to what the student actually said — not just keyword matches.

`scaffold_down` is the fix for the old behaviour that leaked an internal routing
hint into the student's chat: on repeated stuck it gives the student a *genuinely
easier* entry (smallest sub-question / analogy / partial worked step), and the
router-facing `escalation_hint` is written to skill_state only — never shown to
the student. `ask_question` also lowers the scaffold by one notch on a single
stuck round before we escalate.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal, TypedDict

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages

from systemedu.core.tutor.skills._common import call_llm, render_memory_block
from systemedu.core.tutor.skills.base import SkillBase


Progress = Literal["exploring", "converging", "breakthrough", "stuck"]


class SocraticState(TypedDict, total=False):
    messages: Annotated[list[BaseMessage], add_messages]
    turn_count: int
    questions_asked: list[str]
    stuck_streak: int
    progress: Progress
    escalation_hint: str | None
    summary: str
    last_step: str
    memory: dict[str, Any]


_EARLY_EXIT_MARKERS = ("直接告诉我", "告诉答案", "别问了", "给答案", "直接说答案")
_STUCK_MARKERS = ("不知道", "没头绪", "不会", "没想法", "想不出", "卡住", "看不懂", "不懂")
_BREAKTHROUGH_MARKERS = ("我明白了", "我懂了", "原来", "我知道了", "所以是", "答案是")


def _last_student_text(messages: list[BaseMessage]) -> str:
    for m in reversed(messages):
        if isinstance(m, HumanMessage):
            return m.content if isinstance(m.content, str) else str(m.content)
    return ""


def _student_wants_answer(text: str) -> bool:
    return any(marker in text for marker in _EARLY_EXIT_MARKERS)


def _keyword_progress(text: str) -> Progress:
    """Deterministic fallback classifier (used when the LLM can't be reached)."""
    if any(m in text for m in _BREAKTHROUGH_MARKERS):
        return "breakthrough"
    if any(m in text for m in _STUCK_MARKERS):
        return "stuck"
    return "exploring"


_ASSESS_PROMPT = (
    "你在判断一个学生在苏格拉底式对话里的状态。只看他最新这句回复，判断属于哪一类，"
    "只回一个词，不要解释：\n"
    "- breakthrough：他推进了/想通了/给出了正确方向或结论\n"
    "- stuck：他明确卡住、说不知道/不会/看不懂、或答得完全跑偏\n"
    "- exploring：他在尝试思考、给了部分想法但还没到位\n\n"
    "学生最新回复：{text}\n\n"
    "答（breakthrough / stuck / exploring 三选一）："
)


async def _llm_classify(llm: Any, text: str) -> Progress | None:
    """Ask the LLM to classify the reply. None if it fails / returns garbage."""
    if not text.strip():
        return None
    try:
        raw = await call_llm(llm, "你是简洁的分类器。", _ASSESS_PROMPT.format(text=text[:400]))
    except Exception:  # noqa: BLE001
        return None
    low = (raw or "").strip().lower()
    for tag in ("breakthrough", "stuck", "exploring"):
        if tag in low:
            return tag  # type: ignore[return-value]
    return None


class SocraticSkill(SkillBase):
    def build_subgraph(self, llm: Any, tools: list[Any]) -> Any:
        body = self.config.body or self.config.description

        async def assess(state: SocraticState) -> dict:
            text = _last_student_text(state.get("messages") or [])
            prev_stuck = state.get("stuck_streak") or 0

            # Explicit "just tell me" is a hard, unambiguous exit signal —
            # honour it without spending an LLM call.
            if _student_wants_answer(text):
                return {"progress": "breakthrough", "stuck_streak": 0}

            # LLM-driven classification (robust to phrasing), keyword fallback.
            progress = await _llm_classify(llm, text)
            if progress is None:
                progress = _keyword_progress(text)

            stuck = prev_stuck + 1 if progress == "stuck" else 0
            # Two consecutive stuck rounds → escalate (drop to scaffold_down).
            if stuck >= 2:
                return {"progress": "stuck", "stuck_streak": stuck}
            # A single stuck round stays in the questioning loop but the
            # ask_question node will lower the scaffold.
            eff = "exploring" if progress == "stuck" else progress
            return {"progress": eff, "stuck_streak": stuck}

        async def ask_question(state: SocraticState) -> dict:
            messages = state.get("messages") or []
            user_text = _last_student_text(messages)
            memory = render_memory_block(state.get("memory"))
            stuck = state.get("stuck_streak") or 0
            progress = state.get("progress") or "exploring"

            if stuck >= 1:
                ladder = (
                    "\n\n【降阶】学生这一轮没跟上：把问题拆得更小，或换一个更具体的"
                    "类比/反例切入，必要时先给一个明显的例子再问。仍然只问一个问题，不给答案。"
                )
            elif progress == "breakthrough":
                ladder = (
                    "\n\n【收敛】学生刚有突破：用一个问题帮他把结论说清、或迁移到一个新情境验证，"
                    "不要重复已经问过的。"
                )
            else:
                ladder = "\n\n只问一个问题，从学生已知逐步逼近未知，不要给答案。"

            user_block = (
                f"{memory}\n\n"
                f"## 学生消息\n{user_text}\n\n"
                f"## 当前进度\nturn={(state.get('turn_count') or 0) + 1}, "
                f"progress={progress}, stuck_streak={stuck}{ladder}"
            )
            reply = await call_llm(llm, body, user_block)
            turn = (state.get("turn_count") or 0) + 1
            return {
                "messages": [AIMessage(content=reply)],
                "questions_asked": (state.get("questions_asked") or []) + [reply],
                "turn_count": turn,
                "summary": f"question {turn} ({progress})",
                "last_step": f"ask_{turn}",
            }

        async def scaffold_down(state: SocraticState) -> dict:
            """Repeated stuck: give the student a REAL easier entry (not a routing
            hint). The router-facing escalation_hint lives only in skill_state."""
            messages = state.get("messages") or []
            user_text = _last_student_text(messages)
            memory = render_memory_block(state.get("memory"))
            user_block = (
                f"{memory}\n\n"
                f"## 学生消息\n{user_text}\n\n"
                "学生已经连续两轮卡住了。**这一次不要再只抛问题**：先用一两句给他一个具体的"
                "小例子或明显的线索（把最难的一步替他起个头），再问一个非常小、几乎能直接答上来的"
                "问题，帮他重新上路。语气鼓励，不要让他觉得自己笨。"
            )
            reply = await call_llm(llm, body, user_block)
            turn = (state.get("turn_count") or 0) + 1
            return {
                "messages": [AIMessage(content=reply)],
                "questions_asked": (state.get("questions_asked") or []) + [reply],
                "turn_count": turn,
                # Router-only signal; NOT shown to the student.
                "escalation_hint": (
                    "学生连续 2 轮卡壳，已降阶给出线索；若下一轮仍卡住，建议切 "
                    "scaffolding（拆前置）或 direct-instruction（直接讲解）。"
                ),
                "progress": "stuck",
                "summary": f"scaffold_down (turn {turn})",
                "last_step": "scaffold_down",
            }

        def route_after_assess(state: SocraticState) -> str:
            return "scaffold_down" if state.get("progress") == "stuck" else "ask_question"

        g = StateGraph(SocraticState)
        g.add_node("assess", assess)
        g.add_node("ask_question", ask_question)
        g.add_node("scaffold_down", scaffold_down)
        g.add_edge(START, "assess")
        g.add_conditional_edges(
            "assess",
            route_after_assess,
            {"ask_question": "ask_question", "scaffold_down": "scaffold_down"},
        )
        g.add_edge("ask_question", END)
        g.add_edge("scaffold_down", END)
        return g.compile()

    def summarize_state(self, skill_state: dict[str, Any]) -> str:
        turn = skill_state.get("turn_count", 0)
        progress = skill_state.get("progress", "exploring")
        asked = len(skill_state.get("questions_asked") or [])
        lines = [
            f"- 当前策略: socratic-questioning (turn {turn}, progress={progress})",
            f"- 已问 {asked} 个问题",
        ]
        hint = skill_state.get("escalation_hint")
        if hint:
            lines.append(f"- escalation: {hint}")
        return "\n".join(lines)


SKILL_CLASS = SocraticSkill

__all__ = ["SocraticSkill", "SKILL_CLASS"]
