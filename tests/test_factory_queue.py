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
# infer_object_key tests
# ---------------------------------------------------------------------------


def test_infer_needed_object_keys_rocket():
    from systemedu.education.object_scan import infer_needed_object_keys

    results = infer_needed_object_keys("火箭发动机原理", "探索火箭如何升空")
    # Should return standard rocket part keys not already in registry
    assert len(results) > 0
    assert all(k.startswith("rocket.") for k in results)
    # rocket.basic is already in registry, should NOT appear
    assert "rocket.basic" not in results
    # standard parts should appear
    assert "rocket.engine" in results


def test_infer_needed_object_keys_cell():
    from systemedu.education.object_scan import infer_needed_object_keys

    results = infer_needed_object_keys("细胞结构", "了解细胞的基本组成部分")
    assert len(results) > 0
    assert all(k.startswith("cell.") for k in results)
    # cell.animal is already in registry
    assert "cell.animal" not in results
    assert "cell.plant" in results


def test_infer_needed_object_keys_no_match():
    from systemedu.education.object_scan import infer_needed_object_keys

    results = infer_needed_object_keys("数学公式推导", "解方程的方法")
    assert results == []


def test_infer_needed_object_keys_excludes_registered():
    """All returned keys should not be in ObjectRegistry."""
    from systemedu.agents.builtin.gameagent.objects import ObjectRegistry
    from systemedu.education.object_scan import infer_needed_object_keys

    existing = set(ObjectRegistry.supported_keys())
    results = infer_needed_object_keys("火箭推进系统", "了解火箭各零部件的作用")
    for key in results:
        assert key not in existing, f"{key} should not be in registry already"


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


def test_scan_enqueues_first_layer_only(tmp_path, monkeypatch):
    """Only nodes without prerequisite_indices should be enqueued."""
    import json
    from systemedu.education.object_scan import scan_and_enqueue_project_nodes
    from systemedu.agents.builtin.gameagent.object_factory import FactoryQueue

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
        {
            "id": 1,
            "title": "高级推进",
            "summary": "火箭高级推进技术",
            "difficulty_level": 3,
            "content_type": "text",
            "acceptance_type": "quiz",
            "estimated_minutes": 60,
            "xp_reward": 100,
            "prerequisite_indices": [0],  # NOT first layer
        },
    ]

    proj_dir = _make_fake_project(tmp_path, "rocket-proj", nodes)

    # Monkeypatch load_project_context to look in tmp_path
    import systemedu.education.project_loader as pl_mod
    orig_find = pl_mod.find_project_dir

    def mock_find(name, *args, **kwargs):
        d = tmp_path / name
        if d.exists():
            return d
        return orig_find(name, *args, **kwargs)

    monkeypatch.setattr(pl_mod, "find_project_dir", mock_find)

    queue_path = tmp_path / "fq.jsonl"

    # Patch the module-level default path used by FactoryQueue
    import systemedu.agents.builtin.gameagent.object_factory.factory_queue as fq_mod
    monkeypatch.setattr(fq_mod, "_DEFAULT_PATH", queue_path)

    enqueued = scan_and_enqueue_project_nodes("rocket-proj")

    # Should enqueue rocket standard parts (no node title slugs)
    assert len(enqueued) > 0
    assert all(k.startswith("rocket.") for k in enqueued)
    # rocket.basic is already in registry, should not appear
    assert "rocket.basic" not in enqueued
    # standard parts should appear
    assert "rocket.engine" in enqueued

    q = FactoryQueue(queue_path=queue_path)
    items = q.pending_items()
    assert len(items) > 0
    assert all(i.source == "auto_project" for i in items)
    assert all(i.project_name == "rocket-proj" for i in items)


def test_scan_skips_unknown_topics(tmp_path, monkeypatch):
    """Nodes with no matching keyword should not be enqueued."""
    from systemedu.education.object_scan import scan_and_enqueue_project_nodes

    nodes = [
        {
            "id": 0,
            "title": "数学基础",
            "summary": "学习加减乘除",
            "difficulty_level": 1,
            "content_type": "text",
            "acceptance_type": "quiz",
            "estimated_minutes": 20,
            "xp_reward": 30,
            "prerequisite_indices": [],
        },
    ]

    _make_fake_project(tmp_path, "math-proj", nodes)

    import systemedu.education.project_loader as pl_mod
    orig_find = pl_mod.find_project_dir

    def mock_find(name, *args, **kwargs):
        d = tmp_path / name
        if d.exists():
            return d
        return orig_find(name, *args, **kwargs)

    monkeypatch.setattr(pl_mod, "find_project_dir", mock_find)

    enqueued = scan_and_enqueue_project_nodes("math-proj")
    assert enqueued == []


def test_scan_invalid_project_returns_empty(tmp_path):
    from systemedu.education.object_scan import scan_and_enqueue_project_nodes

    enqueued = scan_and_enqueue_project_nodes("nonexistent-project-xyz")
    assert enqueued == []


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


def test_scan_unlocked_nodes_enqueues_topic_nodes(tmp_path, monkeypatch):
    """Unlocked nodes with matching topics should be enqueued."""
    from systemedu.education.object_scan import scan_and_enqueue_unlocked_nodes
    from systemedu.agents.builtin.gameagent.object_factory import FactoryQueue

    _make_fake_project_with_chain(tmp_path, "chain-proj")

    import systemedu.education.project_loader as pl_mod
    orig_find = pl_mod.find_project_dir

    def mock_find(name, *args, **kwargs):
        d = tmp_path / name
        if d.exists():
            return d
        return orig_find(name, *args, **kwargs)

    monkeypatch.setattr(pl_mod, "find_project_dir", mock_find)

    queue_path = tmp_path / "fq.jsonl"
    import systemedu.agents.builtin.gameagent.object_factory.factory_queue as fq_mod
    monkeypatch.setattr(fq_mod, "_DEFAULT_PATH", queue_path)

    # Node 1 (细胞结构) just got unlocked
    enqueued = scan_and_enqueue_unlocked_nodes("chain-proj", [1])
    assert len(enqueued) > 0
    assert all(k.startswith("cell.") for k in enqueued)
    # cell.animal is already in registry
    assert "cell.animal" not in enqueued

    q = FactoryQueue(queue_path=queue_path)
    items = q.pending_items()
    assert len(items) > 0
    assert all(i.project_name == "chain-proj" for i in items)
    assert all(i.source == "auto_project" for i in items)


def test_scan_unlocked_nodes_skips_no_topic_match(tmp_path, monkeypatch):
    """Unlocked nodes with no topic keyword should not be enqueued."""
    from systemedu.education.object_scan import scan_and_enqueue_unlocked_nodes

    _make_fake_project_with_chain(tmp_path, "chain-proj2")

    import systemedu.education.project_loader as pl_mod
    orig_find = pl_mod.find_project_dir

    def mock_find(name, *args, **kwargs):
        d = tmp_path / name
        if d.exists():
            return d
        return orig_find(name, *args, **kwargs)

    monkeypatch.setattr(pl_mod, "find_project_dir", mock_find)

    # Node 2 (数学公式) — no keyword match
    enqueued = scan_and_enqueue_unlocked_nodes("chain-proj2", [2])
    assert enqueued == []


def test_scan_unlocked_nodes_empty_list(tmp_path):
    from systemedu.education.object_scan import scan_and_enqueue_unlocked_nodes

    enqueued = scan_and_enqueue_unlocked_nodes("any-proj", [])
    assert enqueued == []


def test_scan_unlocked_dedup(tmp_path, monkeypatch):
    """Same node unlocked twice should only enqueue once."""
    from systemedu.education.object_scan import scan_and_enqueue_unlocked_nodes
    from systemedu.agents.builtin.gameagent.object_factory import FactoryQueue

    _make_fake_project_with_chain(tmp_path, "chain-proj3")

    import systemedu.education.project_loader as pl_mod
    orig_find = pl_mod.find_project_dir

    def mock_find(name, *args, **kwargs):
        d = tmp_path / name
        if d.exists():
            return d
        return orig_find(name, *args, **kwargs)

    monkeypatch.setattr(pl_mod, "find_project_dir", mock_find)

    queue_path = tmp_path / "fq2.jsonl"
    import systemedu.agents.builtin.gameagent.object_factory.factory_queue as fq_mod
    monkeypatch.setattr(fq_mod, "_DEFAULT_PATH", queue_path)

    first = scan_and_enqueue_unlocked_nodes("chain-proj3", [1])
    first_count = len(first)
    assert first_count > 0
    # Second call — all should be deduped (already pending)
    second = scan_and_enqueue_unlocked_nodes("chain-proj3", [1])
    assert second == []

    q = FactoryQueue(queue_path=queue_path)
    assert len(q.all_items()) == first_count
