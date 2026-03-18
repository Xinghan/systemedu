"""Tests for resource search service and SearchAgent."""

import pytest
from unittest.mock import MagicMock, patch
from pathlib import Path


@pytest.fixture(autouse=True)
def isolated_db(tmp_path, monkeypatch):
    """Use a fresh in-memory DB for each test."""
    import systemedu.storage.db as db_module
    import systemedu.core.config as config_module

    db_file = tmp_path / "test.db"
    monkeypatch.setattr(db_module, "_engine", None)
    monkeypatch.setattr(db_module, "_session_factory", None)
    monkeypatch.setattr(config_module, "DB_FILE", db_file)
    monkeypatch.setattr(config_module, "_config", None)

    yield

    db_module._engine = None
    db_module._session_factory = None


def _make_agent_result(web_n: int = 10, yt_n: int = 10) -> dict:
    """Build a mock SearchAgent.search() return value."""
    return {
        "web_query": "test web query",
        "youtube_query": "test youtube tutorial",
        "web_results": [
            {"source_type": "web", "title": f"Web {i}", "url": f"https://example.com/{i}",
             "snippet": f"Snippet {i}", "score": 0.9 - i * 0.05}
            for i in range(web_n)
        ],
        "youtube_results": [
            {"source_type": "youtube", "title": f"YouTube {i}", "url": f"https://youtube.com/watch?v={i}",
             "snippet": f"Video snippet {i}", "score": 0.85 - i * 0.05}
            for i in range(yt_n)
        ],
    }


def _patch_agent(result):
    """Patch SearchAgent and create_llm so no real LLM/Tavily is called."""
    mock_agent = MagicMock()
    mock_agent.search.return_value = result
    mock_agent_cls = MagicMock(return_value=mock_agent)
    return (
        patch("systemedu.education.search_service.SearchAgent", mock_agent_cls),
        patch("systemedu.education.search_service.get_llm", return_value=MagicMock()),
    )


def test_search_resources_creates_rows():
    """search_resources should insert web + youtube rows and set status=done."""
    from systemedu.education.search_service import search_resources, get_resources

    p1, p2 = _patch_agent(_make_agent_result(web_n=10, yt_n=8))
    with p1, p2:
        search_resources("test-project", 1, "Rocket Science", "How rockets work", 5)

    result = get_resources("test-project", 1)
    assert result["status"] == "done"
    assert len(result["resources"]) == 18  # 10 web + 8 yt
    web = [r for r in result["resources"] if r["source_type"] == "web"]
    yt = [r for r in result["resources"] if r["source_type"] == "youtube"]
    assert len(web) == 10
    assert len(yt) == 8
    for r in result["resources"]:
        assert r["saved"] is False


def test_search_resources_handles_agent_failure():
    """When SearchAgent returns None, status should be failed."""
    from systemedu.education.search_service import search_resources, get_resources

    p1, p2 = _patch_agent(None)  # agent returns None
    with p1, p2:
        search_resources("test-project", 2, "Bad Query", "", 5)

    result = get_resources("test-project", 2)
    assert result["status"] == "failed"
    assert len(result["error"]) > 0


def test_saved_resources_preserved_on_re_search():
    """Pre-saved resources should survive a re-search."""
    from systemedu.education.search_service import (
        search_resources,
        get_resources,
        toggle_resource_saved,
    )

    p1, p2 = _patch_agent(_make_agent_result(web_n=5, yt_n=5))
    with p1, p2:
        search_resources("test-project", 3, "Node Title", "Summary", 5)

    # Save first resource
    result = get_resources("test-project", 3)
    first_id = result["resources"][0]["id"]
    toggle_resource_saved(first_id, True)

    # Verify saved
    result = get_resources("test-project", 3)
    saved = [r for r in result["resources"] if r["saved"]]
    assert len(saved) == 1
    assert saved[0]["id"] == first_id

    # Re-search
    p3, p4 = _patch_agent(_make_agent_result(web_n=5, yt_n=5))
    with p3, p4:
        search_resources("test-project", 3, "Node Title", "Summary", 5)

    # Saved resource should still be there
    result = get_resources("test-project", 3)
    still_saved = [r for r in result["resources"] if r["saved"]]
    assert len(still_saved) == 1
    assert still_saved[0]["id"] == first_id


def test_search_agent_query_generation():
    """SearchAgent should call LLM for query generation and Tavily for search."""
    from systemedu.agents.builtin.search_agent import SearchAgent

    mock_llm = MagicMock()
    mock_llm.invoke.return_value = MagicMock(
        content='{"web_query": "python list comprehension", "youtube_query": "python list comprehension tutorial"}'
    )

    mock_client = MagicMock()
    mock_client.search.side_effect = [
        {"results": [{"title": "Web Result", "url": "https://example.com", "content": "...", "score": 0.9}]},
        {"results": [{"title": "YT Result", "url": "https://youtube.com/watch?v=1", "content": "...", "score": 0.8}]},
    ]

    agent = SearchAgent(llm=mock_llm, tavily_api_key="test-key", max_results=5)

    import tavily
    with patch.object(tavily, "TavilyClient", return_value=mock_client):
        result = agent.search("Python List Comprehension", "How to use list comprehension", 4)

    assert result is not None
    assert result["web_query"] == "python list comprehension"
    assert result["youtube_query"] == "python list comprehension tutorial"
    assert len(result["web_results"]) == 1
    assert len(result["youtube_results"]) == 1
    assert result["web_results"][0]["source_type"] == "web"
    assert result["youtube_results"][0]["source_type"] == "youtube"
    # LLM was called once for query generation
    mock_llm.invoke.assert_called_once()
    # Tavily was called twice: web + youtube
    assert mock_client.search.call_count == 2


def test_search_agent_llm_fallback():
    """SearchAgent should fall back to node_title if LLM fails."""
    from systemedu.agents.builtin.search_agent import SearchAgent

    mock_llm = MagicMock()
    mock_llm.invoke.side_effect = RuntimeError("LLM down")

    mock_client = MagicMock()
    mock_client.search.return_value = {"results": []}

    agent = SearchAgent(llm=mock_llm, tavily_api_key="test-key", max_results=5)

    import tavily
    with patch.object(tavily, "TavilyClient", return_value=mock_client):
        result = agent.search("Rocket Propulsion", "How rocket engines work", 7)

    assert result is not None
    # Fallback: uses node_title as web_query
    assert result["web_query"] == "Rocket Propulsion"
    assert "tutorial" in result["youtube_query"]
