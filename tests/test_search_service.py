"""Tests for resource search service."""

import pytest
from unittest.mock import MagicMock, patch
from pathlib import Path


def _make_result(n: int, domain: str = "example.com") -> dict:
    return {
        "results": [
            {
                "title": f"Result {i}",
                "url": f"https://{domain}/page{i}",
                "content": f"Snippet {i}",
                "score": 0.9 - i * 0.05,
            }
            for i in range(n)
        ]
    }


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

    # Cleanup
    db_module._engine = None
    db_module._session_factory = None


def _mock_tavily(web_n=10, yt_n=10):
    """Return a mock TavilyClient class."""
    client = MagicMock()
    client.search.side_effect = [
        _make_result(web_n),
        _make_result(yt_n, domain="youtube.com"),
    ]
    cls = MagicMock(return_value=client)
    return cls


def test_search_resources_creates_rows():
    """search_resources should insert web + youtube rows and set status=done."""
    from systemedu.education.search_service import search_resources, get_resources

    mock_cls = _mock_tavily(web_n=10, yt_n=8)
    import tavily
    with patch.object(tavily, "TavilyClient", mock_cls):
        search_resources("test-project", 1, "rocket science")

    result = get_resources("test-project", 1)
    assert result["status"] == "done"
    assert len(result["resources"]) == 18  # 10 web + 8 yt
    web = [r for r in result["resources"] if r["source_type"] == "web"]
    yt = [r for r in result["resources"] if r["source_type"] == "youtube"]
    assert len(web) == 10
    assert len(yt) == 8
    for r in result["resources"]:
        assert r["saved"] is False


def test_search_resources_handles_error():
    """When TavilyClient raises, status should be failed."""
    from systemedu.education.search_service import search_resources, get_resources

    failing_cls = MagicMock(side_effect=RuntimeError("API unavailable"))
    with patch.dict("sys.modules", {"tavily": MagicMock(TavilyClient=failing_cls)}):
        search_resources("test-project", 2, "query")

    result = get_resources("test-project", 2)
    assert result["status"] == "failed"
    assert "API unavailable" in result["error"]


def test_saved_resources_preserved_on_re_search():
    """Pre-saved resources should survive a re-search."""
    from systemedu.education.search_service import (
        search_resources,
        get_resources,
        toggle_resource_saved,
    )

    mock_cls = _mock_tavily(web_n=5, yt_n=5)
    with patch.dict("sys.modules", {"tavily": MagicMock(TavilyClient=mock_cls)}):
        search_resources("test-project", 3, "query")

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
    mock_cls2 = _mock_tavily(web_n=5, yt_n=5)
    with patch.dict("sys.modules", {"tavily": MagicMock(TavilyClient=mock_cls2)}):
        search_resources("test-project", 3, "query again")

    # Saved resource should still be there
    result = get_resources("test-project", 3)
    still_saved = [r for r in result["resources"] if r["saved"]]
    assert len(still_saved) == 1
    assert still_saved[0]["id"] == first_id
