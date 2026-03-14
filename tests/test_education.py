"""Tests for education layer (knowledge tree validation, progress tracking, tree generation)."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from systemedu.education.models import KnowledgeTree, NodeStatus
from systemedu.education.progress import initialize_progress, unlock_next_nodes
from systemedu.education.services import (
    KnowledgeTreeValidationError,
    parse_knowledge_tree,
    validate_knowledge_tree,
)
from systemedu.education.tree_generator import _extract_json, generate_knowledge_tree


@pytest.fixture
def valid_tree_data():
    return {
        "milestones": [
            {
                "title": "Milestone 1",
                "description": "First milestone",
                "order": 0,
                "knodes": [
                    {
                        "title": "Node A",
                        "summary": "First node",
                        "difficulty_level": 1,
                        "content_type": "text",
                        "acceptance_type": "quiz",
                        "estimated_minutes": 15,
                        "xp_reward": 20,
                        "order": 0,
                        "prerequisite_indices": [],
                    },
                    {
                        "title": "Node B",
                        "summary": "Second node",
                        "difficulty_level": 2,
                        "content_type": "code",
                        "acceptance_type": "code_submit",
                        "estimated_minutes": 30,
                        "xp_reward": 30,
                        "order": 1,
                        "prerequisite_indices": [0],
                    },
                ],
            },
            {
                "title": "Milestone 2",
                "description": "Second milestone",
                "order": 1,
                "knodes": [
                    {
                        "title": "Node C",
                        "summary": "Third node",
                        "difficulty_level": 3,
                        "content_type": "interactive",
                        "acceptance_type": "demo",
                        "estimated_minutes": 45,
                        "xp_reward": 40,
                        "order": 0,
                        "prerequisite_indices": [1],
                    },
                ],
            },
        ]
    }


class TestValidateKnowledgeTree:
    def test_valid_tree(self, valid_tree_data):
        errors = validate_knowledge_tree(valid_tree_data)
        assert errors == []

    def test_not_a_dict(self):
        errors = validate_knowledge_tree("not a dict")
        assert len(errors) == 1

    def test_empty_milestones(self):
        errors = validate_knowledge_tree({"milestones": []})
        assert len(errors) == 1

    def test_missing_milestone_title(self):
        data = {
            "milestones": [
                {
                    "knodes": [{"title": "Node", "order": 0}],
                }
            ]
        }
        errors = validate_knowledge_tree(data)
        assert any("title" in e for e in errors)

    def test_invalid_content_type(self, valid_tree_data):
        valid_tree_data["milestones"][0]["knodes"][0]["content_type"] = "invalid"
        errors = validate_knowledge_tree(valid_tree_data)
        assert any("content_type" in e for e in errors)

    def test_difficulty_out_of_range(self, valid_tree_data):
        valid_tree_data["milestones"][0]["knodes"][0]["difficulty_level"] = 11
        errors = validate_knowledge_tree(valid_tree_data)
        assert any("difficulty_level" in e for e in errors)

    def test_self_referencing_prerequisite(self):
        data = {
            "milestones": [
                {
                    "title": "MS",
                    "knodes": [
                        {"title": "Node", "prerequisite_indices": [0]},
                    ],
                }
            ]
        }
        errors = validate_knowledge_tree(data)
        assert any("self-reference" in e for e in errors)

    def test_out_of_bounds_prerequisite(self):
        data = {
            "milestones": [
                {
                    "title": "MS",
                    "knodes": [
                        {"title": "Node", "prerequisite_indices": [99]},
                    ],
                }
            ]
        }
        errors = validate_knowledge_tree(data)
        assert any("out of bounds" in e for e in errors)

    def test_cycle_detection(self):
        data = {
            "milestones": [
                {
                    "title": "MS",
                    "knodes": [
                        {"title": "A", "prerequisite_indices": [1]},
                        {"title": "B", "prerequisite_indices": [0]},
                    ],
                }
            ]
        }
        errors = validate_knowledge_tree(data)
        assert any("cycle" in e for e in errors)


class TestParseKnowledgeTree:
    def test_parse_valid_tree(self, valid_tree_data):
        tree = parse_knowledge_tree(valid_tree_data)
        assert isinstance(tree, KnowledgeTree)
        assert len(tree.milestones) == 2
        assert tree.milestones[0].title == "Milestone 1"
        assert len(tree.milestones[0].knodes) == 2

    def test_parse_invalid_tree_raises(self):
        with pytest.raises(KnowledgeTreeValidationError):
            parse_knowledge_tree({"milestones": []})


class TestProgress:
    def test_initialize_progress(self, valid_tree_data):
        tree = parse_knowledge_tree(valid_tree_data)
        progresses = initialize_progress(tree)

        assert len(progresses) == 3  # 3 total nodes
        # First node (no prereqs) should be available
        assert progresses[0].status == NodeStatus.AVAILABLE
        # Other nodes should be locked
        assert progresses[1].status == NodeStatus.LOCKED
        assert progresses[2].status == NodeStatus.LOCKED

    def test_unlock_next_nodes(self, valid_tree_data):
        tree = parse_knowledge_tree(valid_tree_data)
        progresses = initialize_progress(tree)

        # Complete node 0, should unlock node 1
        unlocked = unlock_next_nodes(tree, progresses, completed_node_id=0)
        assert 1 in unlocked
        assert progresses[1].status == NodeStatus.AVAILABLE

    def test_unlock_chain(self, valid_tree_data):
        tree = parse_knowledge_tree(valid_tree_data)
        progresses = initialize_progress(tree)

        # Complete node 0 -> unlocks node 1
        unlock_next_nodes(tree, progresses, completed_node_id=0)
        # Complete node 1 -> unlocks node 2
        unlocked = unlock_next_nodes(tree, progresses, completed_node_id=1)
        assert 2 in unlocked
        assert progresses[2].status == NodeStatus.AVAILABLE


class TestExtractJson:
    def test_extract_json_from_code_block(self):
        content = 'Here is the tree:\n```json\n{"milestones": []}\n```\nDone.'
        result = _extract_json(content)
        assert result == {"milestones": []}

    def test_extract_json_from_generic_block(self):
        content = 'Result:\n```\n{"key": "value"}\n```'
        result = _extract_json(content)
        assert result == {"key": "value"}

    def test_extract_json_from_raw(self):
        content = 'Some text before {"name": "test"} and after'
        result = _extract_json(content)
        assert result == {"name": "test"}

    def test_extract_json_no_json_raises(self):
        content = "No JSON here at all"
        with pytest.raises(ValueError, match="No valid JSON"):
            _extract_json(content)

    def test_extract_json_nested_braces(self):
        content = '{"outer": {"inner": 1}}'
        result = _extract_json(content)
        assert result == {"outer": {"inner": 1}}


class TestGenerateKnowledgeTree:
    @pytest.fixture
    def valid_tree_json(self, valid_tree_data):
        return json.dumps(valid_tree_data)

    @pytest.mark.asyncio
    async def test_generate_retries_on_failure(self, valid_tree_json):
        """Should retry and succeed on second attempt."""
        mock_planner = AsyncMock()
        mock_planner.process = AsyncMock(
            side_effect=[
                "not valid json at all",
                f"```json\n{valid_tree_json}\n```",
            ]
        )

        with (
            patch("systemedu.agents.builtin.planner.PlannerAgent", return_value=mock_planner),
            patch("systemedu.agents.base.AgentConfig"),
        ):
            tree = await generate_knowledge_tree("Test", "Test project", max_retries=3)
            assert isinstance(tree, KnowledgeTree)
            assert mock_planner.process.call_count == 2

    @pytest.mark.asyncio
    async def test_generate_max_retries_exceeded(self):
        """Should raise RuntimeError after max retries."""
        mock_planner = AsyncMock()
        mock_planner.process = AsyncMock(return_value="garbage response")

        with (
            patch("systemedu.agents.builtin.planner.PlannerAgent", return_value=mock_planner),
            patch("systemedu.agents.base.AgentConfig"),
        ):
            with pytest.raises(RuntimeError, match="Failed to generate"):
                await generate_knowledge_tree("Test", "Test", max_retries=2)
