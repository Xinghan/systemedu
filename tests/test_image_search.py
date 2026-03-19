"""Tests for Wikimedia image search functions in lesson_generator."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from systemedu.education.lesson_generator import (
    _enrich_analysis_with_images,
    _extract_items_for_image_search,
    _fetch_wikimedia_image,
)


# ---------------------------------------------------------------------------
# _fetch_wikimedia_image
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_fetch_wikimedia_image_returns_url():
    """Normal case: Wikipedia returns a thumbnail."""
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {
        "query": {
            "pages": {
                "12345": {
                    "pageid": 12345,
                    "thumbnail": {"source": "https://upload.wikimedia.org/thumb/cat.jpg"},
                }
            }
        }
    }

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await _fetch_wikimedia_image("domestic cat")

    assert result == "https://upload.wikimedia.org/thumb/cat.jpg"


@pytest.mark.asyncio
async def test_fetch_wikimedia_image_page_not_found():
    """Page ID -1 means article doesn't exist — return None."""
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {
        "query": {
            "pages": {
                "-1": {
                    "pageid": -1,
                    "title": "Nonexistent thing xyz123",
                }
            }
        }
    }

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await _fetch_wikimedia_image("Nonexistent thing xyz123")

    assert result is None


@pytest.mark.asyncio
async def test_fetch_wikimedia_image_no_thumbnail():
    """Article exists but has no thumbnail — return None."""
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {
        "query": {
            "pages": {
                "99999": {
                    "pageid": 99999,
                    "title": "Some article without image",
                }
            }
        }
    }

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await _fetch_wikimedia_image("Some article without image")

    assert result is None


@pytest.mark.asyncio
async def test_fetch_wikimedia_image_timeout_returns_none():
    """Timeout exception → return None, do not raise."""
    import httpx

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await _fetch_wikimedia_image("maple leaf")

    assert result is None


@pytest.mark.asyncio
async def test_fetch_wikimedia_image_network_error_returns_none():
    """Any network error → return None."""
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(side_effect=Exception("network error"))
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await _fetch_wikimedia_image("oak leaf")

    assert result is None


# ---------------------------------------------------------------------------
# _extract_items_for_image_search
# ---------------------------------------------------------------------------

def test_extract_drag_classify():
    analysis = {
        "best_interaction": "drag_classify",
        "interactive_objects": [
            {"name": "银杏叶", "category": "扇形", "search_keyword": "Ginkgo biloba leaf"},
            {"name": "枫叶", "category": "掌形"},
        ],
    }
    pairs = _extract_items_for_image_search(analysis)
    assert len(pairs) == 2
    # First item uses search_keyword
    item0, kw0 = pairs[0]
    assert kw0 == "Ginkgo biloba leaf"
    assert item0["name"] == "银杏叶"
    # Second item falls back to name
    item1, kw1 = pairs[1]
    assert kw1 == "枫叶"


def test_extract_drag_sort():
    analysis = {
        "best_interaction": "drag_sort",
        "sortable_items": [
            {"label": "草", "correct_position": 1, "search_keyword": "grass plant"},
            {"label": "蝗虫", "correct_position": 2},
        ],
    }
    pairs = _extract_items_for_image_search(analysis)
    assert len(pairs) == 2
    assert pairs[0][1] == "grass plant"
    assert pairs[1][1] == "蝗虫"


def test_extract_click_select():
    analysis = {
        "best_interaction": "click_select",
        "questions": [
            {
                "prompt": "哪个是哺乳动物？",
                "options": [
                    {"label": "猫", "is_correct": True, "search_keyword": "domestic cat"},
                    {"label": "金鱼", "is_correct": False},
                ],
            }
        ],
    }
    pairs = _extract_items_for_image_search(analysis)
    assert len(pairs) == 2
    assert pairs[0][1] == "domestic cat"
    assert pairs[1][1] == "金鱼"


def test_extract_connect_match():
    analysis = {
        "best_interaction": "connect_match",
        "left_items": [
            {"id": "l1", "label": "企鹅", "search_keyword": "penguin animal"},
        ],
        "right_items": [
            {"id": "r1", "label": "南极", "match_id": "l1"},
        ],
    }
    pairs = _extract_items_for_image_search(analysis)
    assert len(pairs) == 2
    assert pairs[0][1] == "penguin animal"
    assert pairs[1][1] == "南极"


def test_extract_cause_effect_skipped():
    analysis = {
        "best_interaction": "cause_effect",
        "controls": [{"id": "c1", "label": "燃料"}],
    }
    pairs = _extract_items_for_image_search(analysis)
    assert pairs == []


def test_extract_animated_story_skipped():
    analysis = {
        "best_interaction": "animated_story",
        "animation_steps": [{"step": 1, "narration": "test"}],
    }
    pairs = _extract_items_for_image_search(analysis)
    assert pairs == []


# ---------------------------------------------------------------------------
# _enrich_analysis_with_images
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_enrich_writes_image_url_to_items():
    """_enrich_analysis_with_images writes image_url to each item."""
    analysis = {
        "best_interaction": "drag_classify",
        "interactive_objects": [
            {"name": "银杏叶", "category": "扇形", "search_keyword": "Ginkgo biloba leaf"},
            {"name": "枫叶", "category": "掌形", "search_keyword": "maple leaf"},
        ],
    }

    async def fake_fetch(keyword: str) -> str | None:
        return f"https://example.com/{keyword.replace(' ', '_')}.jpg"

    with patch(
        "systemedu.education.lesson_generator._fetch_wikimedia_image",
        side_effect=fake_fetch,
    ):
        result = await _enrich_analysis_with_images(analysis)

    objects = result["interactive_objects"]
    assert objects[0]["image_url"] == "https://example.com/Ginkgo_biloba_leaf.jpg"
    assert objects[1]["image_url"] == "https://example.com/maple_leaf.jpg"


@pytest.mark.asyncio
async def test_enrich_cause_effect_skips_search():
    """cause_effect mode: no searches run, analysis returned unchanged."""
    analysis = {
        "best_interaction": "cause_effect",
        "controls": [{"id": "c1", "label": "燃料"}],
    }

    with patch(
        "systemedu.education.lesson_generator._fetch_wikimedia_image",
        side_effect=AssertionError("should not be called"),
    ):
        result = await _enrich_analysis_with_images(analysis)

    assert result == analysis
    assert "image_url" not in result["controls"][0]


@pytest.mark.asyncio
async def test_enrich_animated_story_skips_search():
    """animated_story mode: no searches run."""
    analysis = {
        "best_interaction": "animated_story",
        "animation_steps": [{"step": 1}],
    }

    with patch(
        "systemedu.education.lesson_generator._fetch_wikimedia_image",
        side_effect=AssertionError("should not be called"),
    ):
        result = await _enrich_analysis_with_images(analysis)

    assert result == analysis


@pytest.mark.asyncio
async def test_enrich_partial_failure_continues():
    """Even if some fetches return None, other items get their URLs."""
    analysis = {
        "best_interaction": "drag_classify",
        "interactive_objects": [
            {"name": "A", "search_keyword": "item A"},
            {"name": "B", "search_keyword": "item B"},
        ],
    }

    async def fake_fetch(keyword: str) -> str | None:
        if keyword == "item A":
            return "https://example.com/A.jpg"
        return None

    with patch(
        "systemedu.education.lesson_generator._fetch_wikimedia_image",
        side_effect=fake_fetch,
    ):
        result = await _enrich_analysis_with_images(analysis)

    objects = result["interactive_objects"]
    assert objects[0]["image_url"] == "https://example.com/A.jpg"
    assert objects[1]["image_url"] is None


@pytest.mark.asyncio
async def test_enrich_exception_does_not_propagate():
    """If _enrich_analysis_with_images raises internally, it still returns analysis."""
    analysis = {
        "best_interaction": "drag_classify",
        "interactive_objects": [{"name": "X", "search_keyword": "X"}],
    }

    with patch(
        "systemedu.education.lesson_generator._extract_items_for_image_search",
        side_effect=RuntimeError("unexpected"),
    ):
        # Should not raise
        result = await _enrich_analysis_with_images(analysis)

    assert result is analysis
