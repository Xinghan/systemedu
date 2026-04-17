"""Tests for ToolRegistry (T4.2)."""

from __future__ import annotations

import pytest
from langchain_core.tools import StructuredTool

from systemedu.tutor.tools.decorator import ToolContext, push_tool_context, tutor_tool
from systemedu.tutor.tools.registry import ToolRegistry


@tutor_tool()
async def _read_a(arg: str = "") -> str:
    return f"a:{arg}"


@tutor_tool()
async def _read_b() -> str:
    return "b"


@tutor_tool(access="write", confirm=True)
async def _write_c(arg: str) -> str:
    return f"c:{arg}"


class TestRegistration:
    def test_register_and_get(self):
        r = ToolRegistry()
        r.register(_read_a)
        assert r.get("_read_a") is _read_a
        assert r.names() == ["_read_a"]

    def test_register_many(self):
        r = ToolRegistry()
        r.register_many([_read_a, _read_b, _write_c])
        assert set(r.names()) == {"_read_a", "_read_b", "_write_c"}

    def test_register_rejects_plain_tool(self):
        """Only @tutor_tool-decorated tools may enter the registry."""

        async def _handler(x: str = "x") -> str:
            return x

        raw = StructuredTool.from_function(coroutine=_handler, name="raw", description="")
        r = ToolRegistry()
        with pytest.raises(TypeError, match="not a @tutor_tool"):
            r.register(raw)

    def test_re_register_warns_and_overwrites(self, caplog):
        r = ToolRegistry()
        r.register(_read_a)
        with caplog.at_level("WARNING"):
            r.register(_read_a)
        assert any("already registered" in m for m in caplog.messages)
        assert r.get("_read_a") is _read_a


class TestWhitelistFilter:
    def test_subset_returned_in_order(self):
        r = ToolRegistry()
        r.register_many([_read_a, _read_b, _write_c])
        filtered = r.filter_by_whitelist(["_write_c", "_read_a"])
        assert [t.name for t in filtered] == ["_write_c", "_read_a"]

    def test_empty_whitelist_returns_empty(self):
        """No declared tools = no tools. Silent total lockdown."""
        r = ToolRegistry()
        r.register_many([_read_a, _read_b])
        assert r.filter_by_whitelist([]) == []

    def test_none_whitelist_returns_empty(self):
        r = ToolRegistry()
        r.register(_read_a)
        assert r.filter_by_whitelist(None) == []

    def test_unknown_names_dropped(self, caplog):
        r = ToolRegistry()
        r.register(_read_a)
        with caplog.at_level("WARNING"):
            out = r.filter_by_whitelist(["_read_a", "does_not_exist"])
        assert [t.name for t in out] == ["_read_a"]
        assert any("unknown tool" in m for m in caplog.messages)

    def test_filter_doesnt_leak_state(self):
        r = ToolRegistry()
        r.register_many([_read_a, _read_b])
        a = r.filter_by_whitelist(["_read_a"])
        b = r.filter_by_whitelist(["_read_b"])
        assert [t.name for t in a] == ["_read_a"]
        assert [t.name for t in b] == ["_read_b"]


class TestIntegration:
    async def test_filtered_tool_still_runs(self):
        r = ToolRegistry()
        r.register_many([_read_a, _read_b, _write_c])
        tools = r.filter_by_whitelist(["_read_a"])
        assert len(tools) == 1
        ctx = ToolContext(user_id="u1")
        with push_tool_context(ctx):
            out = await tools[0].ainvoke({"arg": "hi"})
        assert out == "a:hi"
