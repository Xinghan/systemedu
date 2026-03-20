"""Tests for ObjectResolver and MissQueue."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from systemedu.agents.builtin.gameagent.object_spec import MissingObjectRequest, ObjectSpec
from systemedu.agents.builtin.gameagent.object_resolver import ObjectResolver, ResolveResult
from systemedu.agents.builtin.gameagent.miss_queue import MissQueue


# ---------------------------------------------------------------------------
# ObjectResolver tests
# ---------------------------------------------------------------------------

class TestObjectResolverExactHit:
    def test_exact_hit_returns_exact_type(self):
        resolver = ObjectResolver()
        result = resolver.resolve(ObjectSpec(object_key="rocket.basic"))
        assert result.resolution_type == "exact"

    def test_exact_hit_resolved_key_matches(self):
        resolver = ObjectResolver()
        result = resolver.resolve(ObjectSpec(object_key="rocket.basic"))
        assert result.resolved_key == "rocket.basic"

    def test_exact_hit_has_no_miss_request(self):
        resolver = ObjectResolver()
        result = resolver.resolve(ObjectSpec(object_key="rocket.basic"))
        assert result.miss_request is None

    def test_exact_hit_render_spec_not_none(self):
        resolver = ObjectResolver()
        result = resolver.resolve(ObjectSpec(object_key="rocket.basic"))
        assert result.render_spec is not None

    def test_exact_hit_render_spec_key(self):
        resolver = ObjectResolver()
        result = resolver.resolve(ObjectSpec(object_key="rocket.basic"))
        assert result.render_spec.object_key == "rocket.basic"

    @pytest.mark.parametrize("key", [
        "human_body.external",
        "cell.animal",
        "atom.bohr",
        "plant.basic",
        "earth.basic",
    ])
    def test_all_registry_keys_exact(self, key: str):
        resolver = ObjectResolver()
        result = resolver.resolve(ObjectSpec(object_key=key))
        assert result.resolution_type == "exact"
        assert result.resolved_key == key


class TestObjectResolverFamilyFallback:
    def test_unknown_variant_triggers_fallback(self):
        resolver = ObjectResolver()
        result = resolver.resolve(ObjectSpec(object_key="rocket.cutaway"))
        assert result.resolution_type == "fallback"

    def test_fallback_resolved_key_is_rocket_basic(self):
        resolver = ObjectResolver()
        result = resolver.resolve(ObjectSpec(object_key="rocket.cutaway"))
        assert result.resolved_key == "rocket.basic"

    def test_fallback_render_spec_not_none(self):
        resolver = ObjectResolver()
        result = resolver.resolve(ObjectSpec(object_key="rocket.cutaway"))
        assert result.render_spec is not None

    def test_fallback_emits_miss_request(self):
        resolver = ObjectResolver()
        result = resolver.resolve(ObjectSpec(object_key="rocket.cutaway"))
        assert result.miss_request is not None

    def test_fallback_miss_request_key(self):
        resolver = ObjectResolver()
        result = resolver.resolve(ObjectSpec(object_key="rocket.cutaway"))
        assert result.miss_request.object_key == "rocket.cutaway"

    def test_fallback_miss_request_family(self):
        resolver = ObjectResolver()
        result = resolver.resolve(ObjectSpec(object_key="rocket.cutaway"))
        assert result.miss_request.family == "rocket"

    def test_fallback_miss_request_fallback_used(self):
        resolver = ObjectResolver()
        result = resolver.resolve(ObjectSpec(object_key="rocket.cutaway"))
        assert result.miss_request.fallback_used == "rocket.basic"

    def test_fallback_miss_request_carries_topic(self):
        resolver = ObjectResolver()
        result = resolver.resolve(
            ObjectSpec(object_key="rocket.cutaway"),
            game_spec_context={"topic": "rocket science", "mechanic": "label_map"},
        )
        assert result.miss_request.topic == "rocket science"
        assert result.miss_request.preferred_mechanic == "label_map"

    def test_fallback_miss_request_carries_required_parts(self):
        resolver = ObjectResolver()
        spec = ObjectSpec(
            object_key="rocket.cutaway",
            label_part_ids=["nose_cone", "engine"],
        )
        result = resolver.resolve(spec)
        assert result.miss_request.required_parts == ["nose_cone", "engine"]

    @pytest.mark.parametrize("key,expected_fallback", [
        ("human_body.organs", "human_body.external"),
        ("cell.plant", "cell.animal"),
        ("atom.quantum", "atom.bohr"),
        ("plant.flower", "plant.basic"),
        ("earth.crust_detail", "earth.basic"),
    ])
    def test_family_fallback_table(self, key: str, expected_fallback: str):
        resolver = ObjectResolver()
        result = resolver.resolve(ObjectSpec(object_key=key))
        assert result.resolution_type == "fallback"
        assert result.resolved_key == expected_fallback


class TestObjectResolverNoFallback:
    def test_unknown_family_returns_none_type(self):
        resolver = ObjectResolver()
        result = resolver.resolve(ObjectSpec(object_key="alien.spaceship"))
        assert result.resolution_type == "none"

    def test_unknown_family_render_spec_is_none(self):
        resolver = ObjectResolver()
        result = resolver.resolve(ObjectSpec(object_key="alien.spaceship"))
        assert result.render_spec is None

    def test_unknown_family_resolved_key_is_none(self):
        resolver = ObjectResolver()
        result = resolver.resolve(ObjectSpec(object_key="alien.spaceship"))
        assert result.resolved_key is None

    def test_unknown_family_emits_miss_request(self):
        resolver = ObjectResolver()
        result = resolver.resolve(ObjectSpec(object_key="alien.spaceship"))
        assert result.miss_request is not None

    def test_unknown_family_miss_request_no_fallback_used(self):
        resolver = ObjectResolver()
        result = resolver.resolve(ObjectSpec(object_key="alien.spaceship"))
        assert result.miss_request.fallback_used is None


# ---------------------------------------------------------------------------
# MissQueue tests
# ---------------------------------------------------------------------------

class TestMissQueue:
    def test_enqueue_creates_file(self, tmp_path: Path):
        q = MissQueue(tmp_path / "test_queue.jsonl")
        req = MissingObjectRequest(object_key="rocket.cutaway", family="rocket")
        q.enqueue(req)
        assert (tmp_path / "test_queue.jsonl").exists()

    def test_peek_returns_entry(self, tmp_path: Path):
        q = MissQueue(tmp_path / "q.jsonl")
        req = MissingObjectRequest(object_key="rocket.cutaway", family="rocket")
        q.enqueue(req)
        entries = q.peek()
        assert len(entries) == 1
        assert entries[0].object_key == "rocket.cutaway"

    def test_peek_does_not_clear(self, tmp_path: Path):
        q = MissQueue(tmp_path / "q.jsonl")
        req = MissingObjectRequest(object_key="rocket.cutaway", family="rocket")
        q.enqueue(req)
        q.peek()
        assert len(q.peek()) == 1

    def test_dequeue_all_returns_and_clears(self, tmp_path: Path):
        q = MissQueue(tmp_path / "q.jsonl")
        q.enqueue(MissingObjectRequest(object_key="rocket.cutaway", family="rocket"))
        q.enqueue(MissingObjectRequest(object_key="alien.ship", family="alien"))
        entries = q.dequeue_all()
        assert len(entries) == 2
        assert len(q.peek()) == 0

    def test_enqueue_same_key_increments_count(self, tmp_path: Path):
        q = MissQueue(tmp_path / "q.jsonl")
        req = MissingObjectRequest(object_key="rocket.cutaway", family="rocket")
        q.enqueue(req)
        q.enqueue(req)
        entries = q.peek()
        assert len(entries) == 1
        assert entries[0].request_count == 2

    def test_enqueue_same_key_three_times(self, tmp_path: Path):
        q = MissQueue(tmp_path / "q.jsonl")
        req = MissingObjectRequest(object_key="rocket.cutaway", family="rocket")
        q.enqueue(req)
        q.enqueue(req)
        q.enqueue(req)
        entries = q.peek()
        assert entries[0].request_count == 3

    def test_peek_sorted_by_count_desc(self, tmp_path: Path):
        q = MissQueue(tmp_path / "q.jsonl")
        q.enqueue(MissingObjectRequest(object_key="alien.ship", family="alien"))
        rocket = MissingObjectRequest(object_key="rocket.cutaway", family="rocket")
        q.enqueue(rocket)
        q.enqueue(rocket)
        entries = q.peek()
        assert entries[0].object_key == "rocket.cutaway"
        assert entries[1].object_key == "alien.ship"

    def test_empty_queue_peek(self, tmp_path: Path):
        q = MissQueue(tmp_path / "q.jsonl")
        assert q.peek() == []

    def test_empty_queue_dequeue(self, tmp_path: Path):
        q = MissQueue(tmp_path / "q.jsonl")
        assert q.dequeue_all() == []

    def test_jsonl_format(self, tmp_path: Path):
        q = MissQueue(tmp_path / "q.jsonl")
        req = MissingObjectRequest(
            object_key="rocket.cutaway",
            family="rocket",
            topic="space travel",
            fallback_used="rocket.basic",
        )
        q.enqueue(req)
        content = (tmp_path / "q.jsonl").read_text()
        data = json.loads(content.strip())
        assert data["object_key"] == "rocket.cutaway"
        assert data["fallback_used"] == "rocket.basic"

    def test_dequeue_all_sorted_by_count_desc(self, tmp_path: Path):
        q = MissQueue(tmp_path / "q.jsonl")
        a = MissingObjectRequest(object_key="a.x", family="a")
        b = MissingObjectRequest(object_key="b.x", family="b")
        q.enqueue(a)
        q.enqueue(b)
        q.enqueue(b)
        entries = q.dequeue_all()
        assert entries[0].object_key == "b.x"
        assert entries[0].request_count == 2
