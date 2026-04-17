"""Safety gate node (spec 014 T4.6, design §8.3).

Regex-prefilters the last user message for sensitive patterns. When a
match is found:
1. `_safety_triggered = True` — the main graph short-circuits straight
   to `output_stream`, skipping memory inject + skill work.
2. A fixed AIMessage is injected (exact text, not LLM-generated) so
   every student sees the same safe response regardless of model.
3. `skill_decision.action = "exit"` so the output_stream node knows
   there's no active skill to render.

The node does NOT write an Escalation row itself — that's the
responsibility of the caller that wires the safety gate into the
full graph (since the DB session / DAO may not be available here).
Instead, it sets `_safety_matched_patterns` in the update so a
post-hook can log it.
"""

from __future__ import annotations

import re
from typing import Any

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage

from systemedu.tutor.state import TutorState

SENSITIVE_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"(自杀|想死|活不下去|没意思|受不了了|不想活)"),
    re.compile(r"(色情|黄色|裸体|性行为)"),
    re.compile(r"(赌博|赌钱|网赌|下注)"),
    re.compile(r"(毒品|吸毒|冰毒|大麻|海洛因)"),
]

SAFETY_RESPONSE = (
    "我注意到你在分享一些重要的事。"
    "这个话题需要你信任的大人来帮你——"
    "你可以告诉家长或老师，他们会真正帮到你。"
    "如果现在很紧急，请拨打 12355 青少年心理热线。"
)


def _last_user_message(messages: list[BaseMessage]) -> str:
    for m in reversed(messages):
        if isinstance(m, HumanMessage):
            return m.content if isinstance(m.content, str) else str(m.content)
    return ""


def _match_patterns(text: str) -> list[str]:
    """Return list of matched pattern strings (empty if none)."""
    hits: list[str] = []
    for pat in SENSITIVE_PATTERNS:
        match = pat.search(text)
        if match:
            hits.append(match.group(0))
    return hits


async def safety_gate_node(state: TutorState) -> dict[str, Any]:
    messages = state.get("messages") or []
    text = _last_user_message(messages)
    if not text:
        return {}

    hits = _match_patterns(text)
    if not hits:
        return {}

    return {
        "messages": [AIMessage(content=SAFETY_RESPONSE)],
        "skill_decision": {"action": "exit", "reason": "safety"},
        "_safety_triggered": True,
        "_safety_matched_patterns": hits,
    }


__all__ = ["safety_gate_node", "SENSITIVE_PATTERNS", "SAFETY_RESPONSE"]
