"""Provider-aware tool binding (spec 043 T1.3).

These tests pin the *decision* — which provider params get attached when
binding tutor tools — without hitting a network. The behavioural claims
they encode (parallel off, thinking off for DashScope) were each first
observed against a real Qwen model; see the real-Qwen validation script.

Why this matters vs. the pre-T1.3 code: the old loop did a bare
`bind(tools)`, so on a two-part question Qwen fired multiple parallel
tool_calls in a single turn — unauditable and messy for HITL. T1.3 forces
one-call-per-turn and defuses the thinking/tool-calling conflict on Qwen3
thinking models. The `records kwargs` fakes below assert that difference.
"""

from __future__ import annotations

from typing import Any

import pytest

from systemedu.core.tutor.tools.binding import (
    bind_tutor_tools,
    is_dashscope_llm,
    tutor_tool_bind_kwargs,
)


# ---------------------------------------------------------------------------
# Fakes: each mimics one class of LLM the binder must handle differently.
# ---------------------------------------------------------------------------
class _RecordingOpenAILike:
    """Mimics ChatOpenAI: bind_tools has a real `parallel_tool_calls` param."""

    def __init__(self, base_url: str):
        self.base_url = base_url
        self.bound_with: dict[str, Any] | None = None

    def bind_tools(self, tools, tool_choice=None, strict=None,
                   parallel_tool_calls=None, response_format=None, **kwargs):
        self.bound_with = {
            "n_tools": len(tools),
            "parallel_tool_calls": parallel_tool_calls,
            **kwargs,
        }
        return self  # stand-in for the bound runnable


class _KwargsOnlyLLM:
    """A thin wrapper whose bind_tools is **kwargs-only (still accepts params)."""

    def __init__(self):
        self.bound_with: dict[str, Any] | None = None

    def bind_tools(self, tools, **kwargs):
        self.bound_with = {"n_tools": len(tools), **kwargs}
        return self


class _NoParamFakeLLM:
    """A test fake whose bind_tools takes only `tools` — must NOT get extras."""

    def __init__(self):
        self.bound_with: dict[str, Any] | None = None

    def bind_tools(self, tools):
        self.bound_with = {"n_tools": len(tools)}
        return self


class _NoBindLLM:
    """No bind_tools at all — binder returns it untouched."""


_TOOLS = [object(), object()]  # opaque stand-ins; binder never introspects them


# ---------------------------------------------------------------------------
# is_dashscope_llm
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "base_url,expected",
    [
        ("https://dashscope.aliyuncs.com/compatible-mode/v1", True),
        ("https://DASHSCOPE.aliyuncs.com/compatible-mode/v1", True),  # case-insensitive
        ("https://api.openai.com/v1", False),
        ("http://localhost:11434/v1", False),
        ("", False),
    ],
)
def test_is_dashscope_detects_by_base_url(base_url, expected):
    llm = _RecordingOpenAILike(base_url)
    assert is_dashscope_llm(llm) is expected


def test_is_dashscope_handles_missing_attr():
    class _Bare:
        pass

    assert is_dashscope_llm(_Bare()) is False


# ---------------------------------------------------------------------------
# tutor_tool_bind_kwargs — the core decision table
# ---------------------------------------------------------------------------
def test_kwargs_dashscope_gets_both_flags():
    llm = _RecordingOpenAILike("https://dashscope.aliyuncs.com/compatible-mode/v1")
    kw = tutor_tool_bind_kwargs(llm)
    assert kw["parallel_tool_calls"] is False
    assert kw["extra_body"] == {"enable_thinking": False}


def test_kwargs_generic_openai_no_thinking_flag():
    """A non-Qwen OpenAI-compatible server must NOT receive enable_thinking
    (it would reject the unknown field) but SHOULD get parallel off."""
    llm = _RecordingOpenAILike("https://api.openai.com/v1")
    kw = tutor_tool_bind_kwargs(llm)
    assert kw == {"parallel_tool_calls": False}
    assert "extra_body" not in kw


def test_kwargs_kwargs_only_llm_still_configured():
    kw = tutor_tool_bind_kwargs(_KwargsOnlyLLM())
    assert kw["parallel_tool_calls"] is False


def test_kwargs_fake_without_params_gets_nothing():
    """The existing test fakes (bind_tools(tools) only) must stay untouched,
    else every prior tool-loop test would break on an unexpected kwarg."""
    assert tutor_tool_bind_kwargs(_NoParamFakeLLM()) == {}


def test_kwargs_no_bind_returns_empty():
    assert tutor_tool_bind_kwargs(_NoBindLLM()) == {}


# ---------------------------------------------------------------------------
# bind_tutor_tools — end-to-end wiring of the kwargs onto bind_tools
# ---------------------------------------------------------------------------
def test_bind_dashscope_forwards_flags_to_bind_tools():
    llm = _RecordingOpenAILike("https://dashscope.aliyuncs.com/compatible-mode/v1")
    bound = bind_tutor_tools(llm, _TOOLS)
    assert bound is llm  # our fake returns self
    assert llm.bound_with["n_tools"] == 2
    assert llm.bound_with["parallel_tool_calls"] is False
    assert llm.bound_with["extra_body"] == {"enable_thinking": False}


def test_bind_generic_openai_only_parallel_flag():
    llm = _RecordingOpenAILike("https://api.openai.com/v1")
    bind_tutor_tools(llm, _TOOLS)
    assert llm.bound_with["parallel_tool_calls"] is False
    assert "extra_body" not in llm.bound_with


def test_bind_plain_fake_gets_bare_bind():
    """Regression guard: the no-param fake used across the tool-loop suite
    must receive exactly bind_tools(tools) — no provider kwargs leak in."""
    llm = _NoParamFakeLLM()
    bind_tutor_tools(llm, _TOOLS)
    assert llm.bound_with == {"n_tools": 2}


def test_bind_no_bind_tools_returns_llm_untouched():
    llm = _NoBindLLM()
    assert bind_tutor_tools(llm, _TOOLS) is llm
