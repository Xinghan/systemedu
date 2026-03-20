"""Tests for FactoryQueue and object_scan."""

from __future__ import annotations

import pytest

from systemedu.agents.builtin.gameagent.object_factory import (
    FactoryQueue,
    FactoryQueueItem,
)


# ---------------------------------------------------------------------------
# FactoryQueue tests
# ---------------------------------------------------------------------------


def test_enqueue_new_item(tmp_path):
    q = FactoryQueue(queue_path=tmp_path / "fq.jsonl")
    item = FactoryQueueItem(object_key="rocket.basic", source="manual")
    added = q.enqueue(item)
    assert added is True
    assert len(q.all_items()) == 1


def test_enqueue_dedup_pending(tmp_path):
    q = FactoryQueue(queue_path=tmp_path / "fq.jsonl")
    item = FactoryQueueItem(object_key="rocket.basic", source="manual")
    assert q.enqueue(item) is True
    assert q.enqueue(item) is False  # duplicate while pending
    assert len(q.all_items()) == 1


def test_enqueue_dedup_in_progress(tmp_path):
    q = FactoryQueue(queue_path=tmp_path / "fq.jsonl")
    item = FactoryQueueItem(object_key="rocket.basic", source="manual")
    q.enqueue(item)
    q.mark_in_progress("rocket.basic")
    # Should still be deduped
    assert q.enqueue(FactoryQueueItem(object_key="rocket.basic")) is False


def test_enqueue_allows_after_done(tmp_path):
    q = FactoryQueue(queue_path=tmp_path / "fq.jsonl")
    item = FactoryQueueItem(object_key="rocket.basic", source="manual")
    q.enqueue(item)
    q.mark_in_progress("rocket.basic")
    q.mark_done("rocket.basic")
    # After done, re-enqueue should succeed
    assert q.enqueue(FactoryQueueItem(object_key="rocket.basic", source="manual")) is True
    assert len(q.all_items()) == 2


def test_mark_in_progress(tmp_path):
    q = FactoryQueue(queue_path=tmp_path / "fq.jsonl")
    q.enqueue(FactoryQueueItem(object_key="cell.basic"))
    q.mark_in_progress("cell.basic")
    items = q.all_items()
    assert items[0].status == "in_progress"


def test_mark_done(tmp_path):
    q = FactoryQueue(queue_path=tmp_path / "fq.jsonl")
    q.enqueue(FactoryQueueItem(object_key="cell.basic"))
    q.mark_in_progress("cell.basic")
    q.mark_done("cell.basic")
    items = q.all_items()
    assert items[0].status == "done"


def test_mark_failed(tmp_path):
    q = FactoryQueue(queue_path=tmp_path / "fq.jsonl")
    q.enqueue(FactoryQueueItem(object_key="cell.basic"))
    q.mark_in_progress("cell.basic")
    q.mark_failed("cell.basic", error="LLM timeout")
    items = q.all_items()
    assert items[0].status == "failed"
    assert items[0].error == "LLM timeout"


def test_pending_items(tmp_path):
    q = FactoryQueue(queue_path=tmp_path / "fq.jsonl")
    q.enqueue(FactoryQueueItem(object_key="rocket.basic"))
    q.enqueue(FactoryQueueItem(object_key="cell.basic"))
    q.mark_in_progress("cell.basic")
    q.mark_done("cell.basic")
    pending = q.pending_items()
    assert len(pending) == 1
    assert pending[0].object_key == "rocket.basic"


def test_items_for_project(tmp_path):
    q = FactoryQueue(queue_path=tmp_path / "fq.jsonl")
    q.enqueue(FactoryQueueItem(object_key="rocket.basic", project_name="proj-a"))
    q.enqueue(FactoryQueueItem(object_key="cell.basic", project_name="proj-b"))
    q.enqueue(FactoryQueueItem(object_key="atom.basic", project_name="proj-a"))
    result = q.items_for_project("proj-a")
    assert len(result) == 2
    assert all(i.project_name == "proj-a" for i in result)


def test_stats(tmp_path):
    q = FactoryQueue(queue_path=tmp_path / "fq.jsonl")
    q.enqueue(FactoryQueueItem(object_key="rocket.basic"))
    q.enqueue(FactoryQueueItem(object_key="cell.basic"))
    q.mark_in_progress("cell.basic")
    q.mark_done("cell.basic")
    q.enqueue(FactoryQueueItem(object_key="atom.basic"))
    q.mark_in_progress("atom.basic")
    q.mark_failed("atom.basic", "error")

    stats = q.stats()
    assert stats["pending"] == 1
    assert stats["in_progress"] == 0
    assert stats["done"] == 1
    assert stats["failed"] == 1


def test_empty_queue_persistence(tmp_path):
    q = FactoryQueue(queue_path=tmp_path / "fq.jsonl")
    assert q.all_items() == []
    assert q.stats() == {"pending": 0, "in_progress": 0, "done": 0, "failed": 0}


def test_multiple_items_different_keys(tmp_path):
    q = FactoryQueue(queue_path=tmp_path / "fq.jsonl")
    keys = ["rocket.basic", "cell.basic", "atom.proton", "earth.crust"]
    for key in keys:
        assert q.enqueue(FactoryQueueItem(object_key=key)) is True
    assert len(q.all_items()) == 4
    # Persistence check — reload
    q2 = FactoryQueue(queue_path=tmp_path / "fq.jsonl")
    assert len(q2.all_items()) == 4


# ---------------------------------------------------------------------------
# ObjectNeedAnalyzer tests (mocked LLM)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_object_need_analyzer_valid_response(monkeypatch):
    """Analyzer should return valid keys from LLM response."""
    from systemedu.agents.builtin.gameagent.object_factory import ObjectNeedAnalyzer
    from unittest.mock import AsyncMock, MagicMock

    async def mock_ainvoke(payload):
        from langchain_core.messages import AIMessage
        return {"messages": [AIMessage(content='{"needed": ["rocket.engine", "rocket.nozzle"]}')]}

    mock_agent = MagicMock()
    mock_agent.ainvoke = mock_ainvoke

    monkeypatch.setattr(
        "systemedu.agents.builtin.gameagent.object_factory.object_need_analyzer.create_deep_agent",
        lambda **kwargs: mock_agent,
    )

    analyzer = ObjectNeedAnalyzer()
    result = await analyzer.analyze("火箭发动机原理", "探索燃烧室和推进系统")
    assert "rocket.engine" in result
    assert "rocket.nozzle" in result
    # Must not include already-registered keys
    assert "rocket.basic" not in result


@pytest.mark.asyncio
async def test_object_need_analyzer_filters_registered(monkeypatch):
    """Analyzer should filter out keys already in ObjectRegistry."""
    from systemedu.agents.builtin.gameagent.object_factory import ObjectNeedAnalyzer
    from unittest.mock import MagicMock

    async def mock_ainvoke(payload):
        from langchain_core.messages import AIMessage
        # LLM returns a key that's already in registry
        return {"messages": [AIMessage(content='{"needed": ["rocket.basic", "rocket.engine"]}')]}

    mock_agent = MagicMock()
    mock_agent.ainvoke = mock_ainvoke

    monkeypatch.setattr(
        "systemedu.agents.builtin.gameagent.object_factory.object_need_analyzer.create_deep_agent",
        lambda **kwargs: mock_agent,
    )

    analyzer = ObjectNeedAnalyzer()
    result = await analyzer.analyze("火箭结构", "了解火箭部件")
    # rocket.basic is already registered — should be filtered out
    assert "rocket.basic" not in result
    assert "rocket.engine" in result


@pytest.mark.asyncio
async def test_object_need_analyzer_no_object_needed(monkeypatch):
    """Analyzer returns [] when LLM says no object needed."""
    from systemedu.agents.builtin.gameagent.object_factory import ObjectNeedAnalyzer
    from unittest.mock import MagicMock

    async def mock_ainvoke(payload):
        from langchain_core.messages import AIMessage
        return {"messages": [AIMessage(content='{"needed": []}')]}

    mock_agent = MagicMock()
    mock_agent.ainvoke = mock_ainvoke

    monkeypatch.setattr(
        "systemedu.agents.builtin.gameagent.object_factory.object_need_analyzer.create_deep_agent",
        lambda **kwargs: mock_agent,
    )

    analyzer = ObjectNeedAnalyzer()
    result = await analyzer.analyze("数学公式推导", "解方程的方法")
    assert result == []


@pytest.mark.asyncio
async def test_object_need_analyzer_rejects_title_slug(monkeypatch):
    """Analyzer should reject variant names not in candidate list (e.g. title slugs)."""
    from systemedu.agents.builtin.gameagent.object_factory import ObjectNeedAnalyzer
    from unittest.mock import MagicMock

    async def mock_ainvoke(payload):
        from langchain_core.messages import AIMessage
        # LLM returns an invalid variant (title slug)
        return {"messages": [AIMessage(content='{"needed": ["rocket.为什么先讲安全再讲火箭"]}')]}

    mock_agent = MagicMock()
    mock_agent.ainvoke = mock_ainvoke

    monkeypatch.setattr(
        "systemedu.agents.builtin.gameagent.object_factory.object_need_analyzer.create_deep_agent",
        lambda **kwargs: mock_agent,
    )

    analyzer = ObjectNeedAnalyzer()
    result = await analyzer.analyze("为什么先讲安全再讲火箭", "安全教育")
    # Should be filtered out since variant is not in candidate list
    assert result == []


# ---------------------------------------------------------------------------
# scan_and_enqueue_project_nodes tests (uses a mock project)
# ---------------------------------------------------------------------------


def _make_fake_project(tmp_path, project_name: str, nodes_data: list[dict]) -> None:
    """Create a minimal project directory with project.yaml + knowledge_tree.json."""
    import json
    import yaml

    proj_dir = tmp_path / project_name
    proj_dir.mkdir()

    # Write project.yaml
    (proj_dir / "project.yaml").write_text(
        yaml.dump(
            {
                "name": project_name,
                "title": "Test Project",
                "description": "A test project",
                "category": "other",
                "age_range": [6, 18],
                "estimated_hours": 10,
                "tags": [],
                "knowledge_tree_path": "knowledge_tree.json",
            },
            allow_unicode=True,
        ),
        encoding="utf-8",
    )

    # Build knowledge tree
    tree = {
        "milestones": [
            {
                "title": "Milestone 1",
                "description": "First milestone",
                "order": 0,
                "xp_reward": 100,
                "knodes": nodes_data,
            }
        ]
    }
    (proj_dir / "knowledge_tree.json").write_text(
        json.dumps(tree, ensure_ascii=False), encoding="utf-8"
    )
    return proj_dir


def test_scan_project_nodes_schedules_task(tmp_path, monkeypatch):
    """scan_and_enqueue_project_nodes schedules an async task and returns [] immediately."""
    from systemedu.education.object_scan import scan_and_enqueue_project_nodes

    nodes = [
        {
            "id": 0,
            "title": "火箭基础",
            "summary": "了解火箭发动机和推进原理",
            "difficulty_level": 1,
            "content_type": "text",
            "acceptance_type": "quiz",
            "estimated_minutes": 30,
            "xp_reward": 50,
            "prerequisite_indices": [],
        },
    ]
    _make_fake_project(tmp_path, "rocket-proj", nodes)

    import systemedu.education.project_loader as pl_mod
    orig_find = pl_mod.find_project_dir

    def mock_find(name, *args, **kwargs):
        d = tmp_path / name
        if d.exists():
            return d
        return orig_find(name, *args, **kwargs)

    monkeypatch.setattr(pl_mod, "find_project_dir", mock_find)

    # Returns [] immediately (analysis is async)
    result = scan_and_enqueue_project_nodes("rocket-proj")
    assert result == []


def test_scan_invalid_project_returns_empty(tmp_path):
    from systemedu.education.object_scan import scan_and_enqueue_project_nodes

    enqueued = scan_and_enqueue_project_nodes("nonexistent-project-xyz")
    assert enqueued == []


@pytest.mark.asyncio
async def test_analyze_and_enqueue_nodes_uses_analyzer(tmp_path, monkeypatch):
    """_analyze_and_enqueue_nodes calls ObjectNeedAnalyzer and enqueues returned keys."""
    from systemedu.education.object_scan import _analyze_and_enqueue_nodes
    from systemedu.agents.builtin.gameagent.object_factory import FactoryQueue
    from unittest.mock import MagicMock

    # Mock ObjectNeedAnalyzer.analyze to return controlled keys
    async def mock_analyze(self, title, summary):
        if "火箭" in title or "火箭" in summary:
            return ["rocket.engine", "rocket.nozzle"]
        return []

    import systemedu.agents.builtin.gameagent.object_factory.object_need_analyzer as ana_mod
    monkeypatch.setattr(ana_mod.ObjectNeedAnalyzer, "analyze", mock_analyze)

    # Patch get_llm to return None (analyzer mock ignores it)
    import systemedu.core.llm_client as llm_mod
    monkeypatch.setattr(llm_mod, "get_llm", lambda: None)

    queue_path = tmp_path / "fq.jsonl"
    import systemedu.agents.builtin.gameagent.object_factory.factory_queue as fq_mod
    monkeypatch.setattr(fq_mod, "_DEFAULT_PATH", queue_path)

    # Patch trigger_factory_for_keys to no-op
    import systemedu.education.object_scan as scan_mod
    monkeypatch.setattr(scan_mod, "trigger_factory_for_keys", lambda items: None)

    # Create fake node objects
    class FakeNode:
        def __init__(self, title, summary):
            self.title = title
            self.summary = summary

    nodes = [FakeNode("火箭发动机", "燃烧室和推进系统原理")]

    enqueued = await _analyze_and_enqueue_nodes(nodes, "rocket-proj")

    # Both keys are in the "rocket" family — dedup-by-family keeps only the first
    assert len(enqueued) == 1
    assert enqueued[0] == "rocket.engine"

    q = FactoryQueue(queue_path=queue_path)
    items = q.pending_items()
    assert len(items) == 1
    assert items[0].source == "auto_project"
    assert items[0].project_name == "rocket-proj"


@pytest.mark.asyncio
async def test_analyze_and_enqueue_dedup_by_family(tmp_path, monkeypatch):
    """Same family handled only once per batch (dedup by family)."""
    from systemedu.education.object_scan import _analyze_and_enqueue_nodes
    from systemedu.agents.builtin.gameagent.object_factory import FactoryQueue
    from unittest.mock import MagicMock

    call_count = 0

    async def mock_analyze(self, title, summary):
        nonlocal call_count
        call_count += 1
        return ["rocket.engine"]  # always returns rocket.engine

    import systemedu.agents.builtin.gameagent.object_factory.object_need_analyzer as ana_mod
    monkeypatch.setattr(ana_mod.ObjectNeedAnalyzer, "analyze", mock_analyze)

    import systemedu.core.llm_client as llm_mod
    monkeypatch.setattr(llm_mod, "get_llm", lambda: None)

    queue_path = tmp_path / "fq_dedup.jsonl"
    import systemedu.agents.builtin.gameagent.object_factory.factory_queue as fq_mod
    monkeypatch.setattr(fq_mod, "_DEFAULT_PATH", queue_path)

    import systemedu.education.object_scan as scan_mod
    monkeypatch.setattr(scan_mod, "trigger_factory_for_keys", lambda items: None)

    class FakeNode:
        def __init__(self, title, summary):
            self.title = title
            self.summary = summary

    # Two nodes both return rocket.engine — second should be deduped by family
    nodes = [FakeNode("火箭推进", "推进系统"), FakeNode("火箭结构", "箭体结构")]

    enqueued = await _analyze_and_enqueue_nodes(nodes, "rocket-proj")

    # Only one enqueue because family "rocket" is handled after first node
    assert enqueued == ["rocket.engine"]

    q = FactoryQueue(queue_path=queue_path)
    assert len(q.all_items()) == 1


# ---------------------------------------------------------------------------
# scan_and_enqueue_unlocked_nodes tests
# ---------------------------------------------------------------------------


def _make_fake_project_with_chain(tmp_path, project_name: str) -> None:
    """Project with 3 nodes: node0 (first-layer), node1 (prereq=0), node2 (prereq=1)."""
    import json
    import yaml

    proj_dir = tmp_path / project_name
    proj_dir.mkdir()
    (proj_dir / "project.yaml").write_text(
        yaml.dump({
            "name": project_name, "title": "Chain", "description": "",
            "category": "other", "age_range": [6, 18], "estimated_hours": 5, "tags": [],
            "knowledge_tree_path": "knowledge_tree.json",
        }, allow_unicode=True),
        encoding="utf-8",
    )
    tree = {
        "milestones": [{
            "title": "M1", "description": "", "order": 0, "xp_reward": 100,
            "knodes": [
                {"id": 0, "title": "火箭基础", "summary": "了解火箭推进", "difficulty_level": 1,
                 "content_type": "text", "acceptance_type": "quiz",
                 "estimated_minutes": 20, "xp_reward": 30, "prerequisite_indices": []},
                {"id": 1, "title": "细胞结构", "summary": "细菌和微生物", "difficulty_level": 2,
                 "content_type": "text", "acceptance_type": "quiz",
                 "estimated_minutes": 30, "xp_reward": 50, "prerequisite_indices": [0]},
                {"id": 2, "title": "数学公式", "summary": "加减乘除", "difficulty_level": 1,
                 "content_type": "text", "acceptance_type": "quiz",
                 "estimated_minutes": 20, "xp_reward": 30, "prerequisite_indices": [1]},
            ],
        }]
    }
    (proj_dir / "knowledge_tree.json").write_text(
        json.dumps(tree, ensure_ascii=False), encoding="utf-8"
    )


def test_scan_unlocked_nodes_schedules_task(tmp_path, monkeypatch):
    """scan_and_enqueue_unlocked_nodes schedules an async task and returns [] immediately."""
    from systemedu.education.object_scan import scan_and_enqueue_unlocked_nodes

    _make_fake_project_with_chain(tmp_path, "chain-proj")

    import systemedu.education.project_loader as pl_mod
    orig_find = pl_mod.find_project_dir

    def mock_find(name, *args, **kwargs):
        d = tmp_path / name
        if d.exists():
            return d
        return orig_find(name, *args, **kwargs)

    monkeypatch.setattr(pl_mod, "find_project_dir", mock_find)

    # Returns [] immediately (analysis is async)
    result = scan_and_enqueue_unlocked_nodes("chain-proj", [1])
    assert result == []


def test_scan_unlocked_nodes_empty_list(tmp_path):
    from systemedu.education.object_scan import scan_and_enqueue_unlocked_nodes

    result = scan_and_enqueue_unlocked_nodes("any-proj", [])
    assert result == []


def test_scan_unlocked_nodes_invalid_project(tmp_path):
    from systemedu.education.object_scan import scan_and_enqueue_unlocked_nodes

    result = scan_and_enqueue_unlocked_nodes("nonexistent-project-xyz", [1])
    assert result == []


@pytest.mark.asyncio
async def test_analyze_and_enqueue_unlocked_nodes(tmp_path, monkeypatch):
    """_analyze_and_enqueue_nodes works for unlocked nodes (same logic as project scan)."""
    from systemedu.education.object_scan import _analyze_and_enqueue_nodes
    from systemedu.agents.builtin.gameagent.object_factory import FactoryQueue

    async def mock_analyze(self, title, summary):
        if "细胞" in title or "细胞" in summary:
            return ["cell.nucleus", "cell.membrane"]
        return []

    import systemedu.agents.builtin.gameagent.object_factory.object_need_analyzer as ana_mod
    monkeypatch.setattr(ana_mod.ObjectNeedAnalyzer, "analyze", mock_analyze)

    import systemedu.core.llm_client as llm_mod
    monkeypatch.setattr(llm_mod, "get_llm", lambda: None)

    queue_path = tmp_path / "fq_unlocked.jsonl"
    import systemedu.agents.builtin.gameagent.object_factory.factory_queue as fq_mod
    monkeypatch.setattr(fq_mod, "_DEFAULT_PATH", queue_path)

    import systemedu.education.object_scan as scan_mod
    monkeypatch.setattr(scan_mod, "trigger_factory_for_keys", lambda items: None)

    class FakeNode:
        def __init__(self, title, summary):
            self.title = title
            self.summary = summary

    nodes = [FakeNode("细胞结构", "细菌和微生物的细胞组织")]

    enqueued = await _analyze_and_enqueue_nodes(nodes, "chain-proj")

    # Both keys are in the "cell" family — dedup-by-family keeps only the first
    assert len(enqueued) == 1
    assert enqueued[0] == "cell.nucleus"

    q = FactoryQueue(queue_path=queue_path)
    items = q.pending_items()
    assert len(items) == 1
    assert items[0].project_name == "chain-proj"
    assert items[0].source == "auto_project"
