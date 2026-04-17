"""Confirmation handler node (spec 014 T4.5, design §8.2).

Processes the user's response to a `pending_confirm` tool call:

- If `confirm_required` is set in state AND the last HumanMessage
  carries confirm metadata (`confirm_id` + `approved`):
  - `approved=True`: clear `confirm_required` so the graph proceeds
    normally and the skill subgraph can replay the tool with
    `ctx.approved=True`.
  - `approved=False`: inject a SystemMessage telling the tutor the
    student rejected, and clear `confirm_required`.
- If no confirm is pending, pass through unchanged.

The node does NOT replay the tool itself — it just sets the flag. The
decorator in `tutor_tool` checks `ctx.approved` and only runs the body
when True; the skill subgraph is the one that actually calls the tool
again on the next turn.
"""

from __future__ import annotations

from typing import Any

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage

from systemedu.tutor.state import TutorState


def _extract_confirm_metadata(messages: list[BaseMessage]) -> dict[str, Any] | None:
    """Check the last HumanMessage for confirm response metadata.

    The gateway encodes confirm responses as HumanMessage with
    `additional_kwargs` containing:
    ```
    {"confirm_response": {"confirm_id": "c-xxx", "approved": true}}
    ```
    """
    for m in reversed(messages):
        if not isinstance(m, HumanMessage):
            continue
        cr = (getattr(m, "additional_kwargs", None) or {}).get("confirm_response")
        if isinstance(cr, dict) and "confirm_id" in cr:
            return cr
        break
    return None


async def confirm_handler_node(state: TutorState) -> dict[str, Any]:
    pending = state.get("confirm_required")
    if not pending:
        return {}

    messages = state.get("messages") or []
    meta = _extract_confirm_metadata(messages)
    if meta is None:
        return {}

    pending_id = pending.get("confirm_id")
    response_id = meta.get("confirm_id")
    if pending_id and response_id and pending_id != response_id:
        return {}

    approved = meta.get("approved", False)
    if approved:
        return {"confirm_required": None}

    tool_name = pending.get("tool", "unknown")
    return {
        "confirm_required": None,
        "messages": [
            SystemMessage(content=f"学生已拒绝执行 {tool_name} 操作。请继续对话，不要再次尝试该操作。")
        ],
    }


__all__ = ["confirm_handler_node"]
