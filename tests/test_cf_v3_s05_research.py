"""s05_research 单元 + 集成测试。"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest

from systemedu.course_factory_v3.progress import Emitter
from systemedu.course_factory_v3.steps import s05_research


@pytest.fixture
def base_ctx():
    return {
        "project_name": "rocket-design",
        "category": "rocket-design",
        "knode": {
            "title": "推力的产生与调节",
            "summary": "推力 = 质量流量 × 排气速度",
            "core_question": "如何让火箭产生足够的推力升空?",
        },
        "milestone": {"title": "火箭动力系统"},
        "sub_project": {"core_problem": "设计可控固体火箭"},
    }


@pytest.mark.asyncio
async def test_extract_queries_parses_pure_json(base_ctx, monkeypatch):
    async def fake_ainvoke(llm, messages, **kwargs):
        return '{"web_query":"rocket nozzle thrust expansion","youtube_query":"rocket thrust explained"}'

    monkeypatch.setattr(s05_research, "ainvoke", fake_ainvoke)
    web, yt = await s05_research._extract_queries(base_ctx)
    assert web == "rocket nozzle thrust expansion"
    assert yt == "rocket thrust explained"


@pytest.mark.asyncio
async def test_extract_queries_strips_markdown_code_block(base_ctx, monkeypatch):
    async def fake_ainvoke(llm, messages, **kwargs):
        return '```json\n{"web_query":"foo bar baz","youtube_query":"alpha beta gamma"}\n```'

    monkeypatch.setattr(s05_research, "ainvoke", fake_ainvoke)
    web, yt = await s05_research._extract_queries(base_ctx)
    assert web == "foo bar baz"
    assert yt == "alpha beta gamma"


@pytest.mark.asyncio
async def test_extract_queries_rejects_too_short(base_ctx, monkeypatch):
    async def fake_ainvoke(llm, messages, **kwargs):
        return '{"web_query":"foo","youtube_query":"bar baz qux"}'

    monkeypatch.setattr(s05_research, "ainvoke", fake_ainvoke)
    with pytest.raises(ValueError, match="too short"):
        await s05_research._extract_queries(base_ctx)


@pytest.mark.asyncio
async def test_run_falls_back_when_llm_fails(base_ctx, monkeypatch):
    """LLM 抽词失败时 web_query / youtube_query=None,factory 自动用默认词。"""

    async def boom(llm, messages, **kwargs):
        raise RuntimeError("kimi quota")
    monkeypatch.setattr(s05_research, "ainvoke", boom)

    captured = {}
    def fake_research_knode(knode, **kwargs):
        captured.update(kwargs)
        return {
            "web_query": kwargs.get("web_query") or "(default)",
            "youtube_query": kwargs.get("youtube_query") or "(default)",
            "web_results": [{"title": "x", "url": "https://x.com", "snippet": "", "score": 0.5}],
            "youtube_results": [],
            "researched_at": "2026-04-24T00:00:00",
        }
    import course_factory.factory as cf
    monkeypatch.setattr(cf, "research_knode", fake_research_knode)

    events = []
    em = Emitter(lambda e, d: events.append((e, d)))
    res = await s05_research.run(base_ctx, em=em)

    # web_query 是 None 透传给 factory
    assert captured.get("web_query") is None
    assert captured.get("youtube_query") is None
    # 仍然返回 research dict
    assert res is not None
    assert len(res["web_results"]) == 1


@pytest.mark.asyncio
async def test_run_returns_none_when_tavily_fails(base_ctx, monkeypatch):
    async def fake_ainvoke(llm, messages, **kwargs):
        return '{"web_query":"a b c","youtube_query":"d e f"}'
    monkeypatch.setattr(s05_research, "ainvoke", fake_ainvoke)

    def boom(*a, **kw):
        raise RuntimeError("Tavily 503")
    import course_factory.factory as cf
    monkeypatch.setattr(cf, "research_knode", boom)

    em = Emitter(lambda e, d: None)
    res = await s05_research.run(base_ctx, em=em)
    assert res is None  # F.0.5 失败时 skip
