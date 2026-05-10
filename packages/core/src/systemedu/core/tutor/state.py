"""Tutor main-graph state (spec 014 §5.1).

`TutorState` is a TypedDict so LangGraph can reason about channel
reducers. All non-mandatory keys may be absent on the first turn; the
main graph populates them incrementally.

Semantics:
- messages: conversation axis with LangGraph `add_messages` reducer
  (appends new messages, dedupes by id).
- memory: a snapshot of the 5-layer retrieval written by
  `memory_inject` each turn.
- skill_*: skill_router decides continue/switch/exit; skill subgraphs
  mutate skill_state; skill_turn_count bounds recursion.
- pending_tool_calls / confirm_required / stream_events: outputs
  consumed by the gateway SSE layer.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Literal, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class MemorySnapshot(TypedDict, total=False):
    """5-layer memory injection snapshot (filled by memory_inject)."""

    l1_profile: str           # 学生画像（稳定）
    l2_project_ctx: str       # 项目上下文（进度）
    l3_knode_state: str       # 当前 knode 卡点 / 尝试
    l3_knode_content: str     # 当前 knode 课程内容摘要（plan + exercises）
    l4_semantic_recall: list[str]  # Mem0 top-3 片段
    l5_skill_ctx: str         # active skill 子图 state 摘要
    injected_at: datetime


class SkillDecision(TypedDict, total=False):
    """skill_router output."""

    action: Literal["continue", "switch", "exit"]
    target_skill: str | None
    reason: str


class TutorState(TypedDict, total=False):
    """Main graph state. All keys optional so partial updates reduce cleanly."""

    # === 对话轴 ===
    messages: Annotated[list[BaseMessage], add_messages]

    # === 会话标识（从 config 注入）===
    user_id: str
    session_id: str           # = thread_id
    project_name: str | None
    knode_id: str | None
    active_tab: str | None

    # === 记忆层 ===
    memory: MemorySnapshot

    # === Skill 控制 ===
    active_skill: str | None
    skill_turn_count: int
    skill_state: dict[str, Any]
    skill_decision: SkillDecision
    # 最近一次 skill_router 观察到的 knode_id，用于检测 knode 切换并重置 active_skill
    last_routed_knode_id: str | None

    # === 输出轴 ===
    pending_tool_calls: list[Any]
    confirm_required: dict[str, Any] | None
    stream_events: list[Any]

    # === 内部标志 ===
    # safety_gate 命中敏感模式时置 True,_after_safety 据此短路到 output_stream
    _safety_triggered: bool


__all__ = ["TutorState", "MemorySnapshot", "SkillDecision"]
