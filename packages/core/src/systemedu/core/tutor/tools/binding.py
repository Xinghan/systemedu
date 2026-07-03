"""Provider-aware tool binding for the tutor (spec 043 T1.3).

`llm.bind_tools(tools)` alone is not enough for reliable tool-calling on
DashScope Qwen. Two provider parameters matter, both validated against a
real Qwen model before this module was written:

1. **`parallel_tool_calls=False`** — left at the default, Qwen happily
   emits *several* tool_calls in one turn (observed: it fired both
   `get_knode_content` and `get_practice_exercises` at once for a
   two-part question). Forcing one call per turn keeps the loop:
     - auditable  — one tool_call → one trace edge (P4 observability);
     - HITL-clean — a write-tool confirmation card (T1.11-14) never has
       to arbitrate a mixed read+write batch;
     - pedagogically ordered — "look at the content, *then* give me
       exercises" runs in that order instead of being flattened.

2. **`enable_thinking=False`** (DashScope-only, via `extra_body`) —
   Qwen3 *thinking* models (e.g. the open-weight 235b/32b line) refuse
   or misbehave on tool-calling while the reasoning channel is on;
   DashScope's own docs require disabling it for function calling. The
   current `qwen3.7-max` default does not need it (it tool-calls fine
   with thinking absent), but a user who points their config at a
   thinking model would otherwise hit an opaque failure. Sending it is a
   no-op on models that don't reason, so we send it defensively — but
   ONLY to DashScope endpoints, since a non-Qwen OpenAI-compatible
   server would reject the unknown field.

Non-`ChatOpenAI` LLMs (test fakes, local wrappers) fall through to a
plain `bind_tools(tools)` so nothing outside the OpenAI-compatible path
is disturbed.
"""

from __future__ import annotations

from typing import Any

__all__ = ["bind_tutor_tools", "is_dashscope_llm", "tutor_tool_bind_kwargs"]


def is_dashscope_llm(llm: Any) -> bool:
    """True when `llm` talks to a DashScope (Qwen) OpenAI-compatible endpoint.

    We sniff the base_url rather than the model name because users pick
    arbitrary model ids, but the DashScope host is stable. Robust to the
    attribute being a str, an object with `.host`, or absent.
    """
    for attr in ("openai_api_base", "base_url"):
        val = getattr(llm, attr, None)
        if not val:
            continue
        text = str(val).lower()
        if "dashscope" in text or "aliyuncs" in text:
            return True
    return False


def tutor_tool_bind_kwargs(llm: Any) -> dict[str, Any]:
    """Compute the provider-specific kwargs for binding tutor tools.

    Split out from `bind_tutor_tools` so tests can assert the decision
    (which flags for which provider) without needing a bindable LLM.
    """
    # Only OpenAI-style chat models accept `parallel_tool_calls`; a bare
    # fake without that formal parameter would raise on the extra kwarg.
    if not _accepts_openai_tool_params(llm):
        return {}
    kwargs: dict[str, Any] = {"parallel_tool_calls": False}
    if is_dashscope_llm(llm):
        # extra_body is forwarded verbatim to the OpenAI SDK request body;
        # DashScope reads `enable_thinking` from there.
        kwargs["extra_body"] = {"enable_thinking": False}
    return kwargs


def bind_tutor_tools(llm: Any, tools: list[Any]) -> Any:
    """Bind `tools` to `llm` with tutor-appropriate provider parameters.

    Returns the bound runnable. Falls back to a plain `bind_tools(tools)`
    for any LLM that is not an OpenAI-compatible chat model (e.g. test
    fakes), and to `llm` itself if it has no `bind_tools` at all (the
    caller — `build_tool_loop_subgraph` — already guards this, but we
    stay defensive).
    """
    bind = getattr(llm, "bind_tools", None)
    if not callable(bind):
        return llm
    return bind(tools, **tutor_tool_bind_kwargs(llm))


def _accepts_openai_tool_params(llm: Any) -> bool:
    """Best-effort check that `bind_tools` accepts `parallel_tool_calls`.

    ChatOpenAI (and subclasses) do. We inspect the signature so a future
    non-OpenAI LangChain model, or a hand-rolled fake, is handled by the
    plain-bind fallback instead of crashing on an unexpected kwarg.
    """
    bind = getattr(llm, "bind_tools", None)
    if bind is None:
        return False
    try:
        import inspect

        params = inspect.signature(bind).parameters
    except (TypeError, ValueError):
        return False
    if "parallel_tool_calls" in params:
        return True
    # A `**kwargs`-only signature (common in thin wrappers) can still take
    # it; accept when kwargs is present.
    return any(p.kind == p.VAR_KEYWORD for p in params.values())
