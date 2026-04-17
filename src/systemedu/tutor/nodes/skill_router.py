"""Skill router node (spec 014 T3.3, design §7.3).

Decides what happens to the active teaching skill each turn:

- `continue` — keep the current skill running
- `switch`   — jump to a different skill (`target_skill` must be set)
- `exit`     — leave the skill system entirely (go straight to output)

## Decision pipeline (in order)

1. **knode switch detection** — if `state.knode_id` changed since the
   last turn, clear `active_skill` + `skill_turn_count` and fall
   through to the fresh-routing path (LLM decides next skill).
2. **max_turns override** — if the active skill has hit its
   configured `max_turns`, we force `switch` regardless of what the
   LLM says.
3. **LLM decision** — catalog + state + last 3 messages + L3 memory
   are rendered into a JSON-only prompt. Malformed JSON falls back to
   `switch → direct-instruction` (safe default per design §7.3).
4. **fallback** — no skills loaded, no active skill, empty state:
   default to `switch → direct-instruction`.

The node only *decides*. Actually running the skill subgraph is
handled by the conditional edge in `graph.py` (T3.10).
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import Any, Callable

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage

from systemedu.tutor.skills import SkillBase, SkillLoader
from systemedu.tutor.state import SkillDecision, TutorState

log = logging.getLogger(__name__)


ROUTER_PROMPT = """你是教学策略调度器。

# 可用 skills
{skill_catalog}

# 当前状态
- active_skill: {active_skill}
- 已连续运行: {turn_count} / {max_turns}

# 最近对话（最后 3 条）
{recent_messages}

# 学生当前卡点（L3 记忆）
{knode_state}

# 当前课程内容
{knode_content}

# 决策规则
1. active_skill 未超 max_turns → continue
2. 话题切换 / skill 目标达成 → switch
3. 学生想结束 → exit
4. 默认路由优先级：
   - "我搞懂了"/结束信号 → reflection-prompt
   - 连续答错 2 次 → error-diagnosis
   - "不会"/"没头绪" + 前置 knode 未过 → scaffolding
   - 概念理解类 + 有能力推导 → socratic-questioning
   - 事实查询 / "直接告诉我" / socratic 已达 max_turns → direct-instruction
   - 新 knode 启动 + 学生尚未表达 → pbl-driving-question

只返回一行 JSON，形如：
{{"action": "continue", "target_skill": null, "reason": "..."}}

不要包含 markdown 代码块、解释或其他文字。"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _format_catalog(skills: list[SkillBase]) -> str:
    if not skills:
        return "(no skills available)"
    lines = []
    for s in skills:
        triggers = "; ".join(s.config.triggers) if s.config.triggers else "-"
        lines.append(
            f"- {s.config.name} (max_turns={s.config.max_turns}, "
            f"priority={s.config.priority}): {s.config.description} "
            f"[triggers: {triggers}]"
        )
    return "\n".join(lines)


def _recent_messages(messages: list[BaseMessage], n: int = 3) -> str:
    if not messages:
        return "(no prior messages)"
    tail = messages[-n:]
    parts = []
    for m in tail:
        content = m.content if isinstance(m.content, str) else str(m.content)
        if isinstance(m, HumanMessage):
            parts.append(f"student: {content}")
        elif isinstance(m, AIMessage):
            parts.append(f"tutor: {content}")
        else:
            role = getattr(m, "type", "system")
            parts.append(f"{role}: {content}")
    return "\n".join(parts)


def _strip_code_fence(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```(?:json)?\s*", "", t)
        t = re.sub(r"\s*```$", "", t)
    return t.strip()


def _parse_decision(text: str) -> SkillDecision | None:
    """Parse `{"action":..., "target_skill":..., "reason":...}`. None on failure."""
    try:
        obj = json.loads(_strip_code_fence(text))
    except (json.JSONDecodeError, TypeError):
        return None
    if not isinstance(obj, dict):
        return None
    action = obj.get("action")
    if action not in ("continue", "switch", "exit"):
        return None
    target = obj.get("target_skill")
    if target in ("null", ""):
        target = None
    return SkillDecision(
        action=action,
        target_skill=target,
        reason=str(obj.get("reason") or ""),
    )


def _fallback_decision(reason: str) -> SkillDecision:
    """Safe default used when LLM fails or no state is available."""
    return SkillDecision(
        action="switch",
        target_skill="direct-instruction",
        reason=reason,
    )


def _max_turns_for(active_skill: str | None, skills: list[SkillBase]) -> int | None:
    if not active_skill:
        return None
    for s in skills:
        if s.config.name == active_skill:
            return s.config.max_turns
    return None


# ---------------------------------------------------------------------------
# Node factory
# ---------------------------------------------------------------------------
@dataclass
class SkillRouterDeps:
    """Dependencies passed into the router at graph-build time."""

    loader: SkillLoader | None
    llm: Any | None  # must expose async ainvoke([BaseMessage]) -> AIMessage


async def _call_llm(llm: Any, prompt: str) -> str:
    """Wrap `llm.ainvoke` so both LangChain BaseChatModel and fakes work."""
    resp = await llm.ainvoke([HumanMessage(content=prompt)])
    if hasattr(resp, "content"):
        content = resp.content
        return content if isinstance(content, str) else str(content)
    return str(resp)


def make_skill_router_node(
    *,
    loader: SkillLoader | None = None,
    llm: Any | None = None,
) -> Callable[[TutorState], Any]:
    """Build the router node closed over its dependencies.

    Passing `loader=None` or `llm=None` yields a minimal router that
    just emits a fallback decision — useful for Phase-1 smoke tests
    where skills aren't wired in yet.
    """

    skills_cache: list[SkillBase] | None = None

    async def _node(state: TutorState) -> dict:
        # --- Pipeline step 1: knode switch reset ---
        prev_knode = state.get("last_routed_knode_id")
        curr_knode = state.get("knode_id")
        knode_switched = (
            prev_knode is not None and curr_knode is not None and prev_knode != curr_knode
        )

        update: dict[str, Any] = {"last_routed_knode_id": curr_knode}
        active_skill = state.get("active_skill")
        turn_count = state.get("skill_turn_count", 0) or 0

        if knode_switched:
            log.info(
                "skill_router: knode switched %s -> %s; resetting active_skill",
                prev_knode,
                curr_knode,
            )
            update["active_skill"] = None
            update["skill_turn_count"] = 0
            active_skill = None
            turn_count = 0

        if loader is None or llm is None:
            decision = _fallback_decision("router not wired (loader/llm missing)")
            update["skill_decision"] = decision
            return update

        nonlocal skills_cache
        if skills_cache is None:
            skills_cache = loader.list_all()
        skills = skills_cache

        # --- Pipeline step 2: max_turns override ---
        max_turns = _max_turns_for(active_skill, skills)
        if active_skill and max_turns is not None and turn_count >= max_turns:
            log.info(
                "skill_router: active_skill=%s hit max_turns=%d; forcing switch",
                active_skill,
                max_turns,
            )
            # LLM still gets asked, but we overwrite 'continue' with 'switch'.
            decision = await _ask_llm(llm, state, skills, active_skill, turn_count, max_turns)
            if decision.get("action") == "continue":
                # continue is not allowed past max_turns. Pick a different
                # skill; if LLM suggested the same skill it was on, fall
                # back to direct-instruction as the safe default.
                suggested = decision.get("target_skill")
                target = (
                    suggested
                    if suggested and suggested != active_skill
                    else "direct-instruction"
                )
                decision = SkillDecision(
                    action="switch",
                    target_skill=target,
                    reason=f"{active_skill} reached max_turns={max_turns}; forced switch",
                )
            update["skill_decision"] = decision
            return update

        # --- Pipeline step 3: LLM decision ---
        decision = await _ask_llm(
            llm, state, skills, active_skill, turn_count, max_turns or 0,
        )
        update["skill_decision"] = decision
        return update

    return _node


async def _ask_llm(
    llm: Any,
    state: TutorState,
    skills: list[SkillBase],
    active_skill: str | None,
    turn_count: int,
    max_turns: int,
) -> SkillDecision:
    """Render the prompt, call the LLM, parse or fall back."""
    memory = state.get("memory") or {}
    prompt = ROUTER_PROMPT.format(
        skill_catalog=_format_catalog(skills),
        active_skill=active_skill or "(none)",
        turn_count=turn_count,
        max_turns=max_turns or 0,
        recent_messages=_recent_messages(state.get("messages") or []),
        knode_state=memory.get("l3_knode_state") or "(empty)",
        knode_content=memory.get("l3_knode_content") or "(empty)",
    )
    try:
        raw = await _call_llm(llm, prompt)
    except Exception as e:  # noqa: BLE001
        log.warning("skill_router LLM call failed: %s", e)
        return _fallback_decision(f"llm error: {e}")

    decision = _parse_decision(raw)
    if decision is None:
        log.warning("skill_router: malformed LLM response: %r", raw)
        return _fallback_decision("malformed LLM response")

    # Validate target_skill exists when switching
    if decision["action"] == "switch":
        target = decision.get("target_skill")
        known = {s.config.name for s in skills}
        if not target or target not in known:
            log.warning(
                "skill_router: switch target %r not in loaded skills; falling back",
                target,
            )
            return _fallback_decision(f"unknown switch target {target!r}")
    return decision


# ---------------------------------------------------------------------------
# Phase-1 compatibility shim
# ---------------------------------------------------------------------------
async def skill_router_node(state: TutorState) -> dict:
    """No-op router kept so Phase-1 smoke tests still pass.

    Real graphs should call `make_skill_router_node(loader=..., llm=...)`.
    """
    return await make_skill_router_node(loader=None, llm=None)(state)


__all__ = ["skill_router_node", "make_skill_router_node", "ROUTER_PROMPT"]
