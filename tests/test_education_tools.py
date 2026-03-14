"""Tests for education tools (complete_node, get_progress) in AgentRuntime."""

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from langchain_core.messages import AIMessage

from systemedu.core.config import (
    LLMConfig,
    LLMProviderConfig,
    SandboxConfig,
    SystemEduConfig,
    reset_config,
)
from systemedu.core.runtime import AgentRuntime
from systemedu.education.models import (
    KnowledgeNode,
    KnowledgeTree,
    Milestone,
    NodeStatus,
    Project,
    UserNodeProgress,
)
from systemedu.education.project_loader import ProjectContext, save_progress
from systemedu.storage.db import reset_db


@pytest.fixture(autouse=True)
def clean_state():
    reset_config()
    reset_db()
    yield
    reset_config()
    reset_db()


@pytest.fixture
def mock_config():
    config = SystemEduConfig(
        llm=LLMConfig(
            default="test",
            providers={
                "test": LLMProviderConfig(
                    base_url="https://test.example.com/v1",
                    api_key="sk-test",
                    model="test-model",
                ),
            },
        ),
        sandbox=SandboxConfig(enabled=True),
    )
    with patch("systemedu.core.runtime.get_config", return_value=config):
        yield config


@pytest.fixture
def sample_project_context():
    """Create a sample project context with 3 nodes: A → B → C."""
    return ProjectContext(
        project=Project(name="test-project", title="测试项目", description="测试"),
        tree=KnowledgeTree(milestones=[
            Milestone(title="M1", knodes=[
                KnowledgeNode(title="节点A", summary="第一个", prerequisite_indices=[]),
                KnowledgeNode(title="节点B", summary="第二个", prerequisite_indices=[0]),
            ]),
            Milestone(title="M2", knodes=[
                KnowledgeNode(title="节点C", summary="第三个", prerequisite_indices=[1]),
            ]),
        ]),
        progress=[
            UserNodeProgress(knode_id=0, status=NodeStatus.AVAILABLE),
            UserNodeProgress(knode_id=1, status=NodeStatus.LOCKED),
            UserNodeProgress(knode_id=2, status=NodeStatus.LOCKED),
        ],
        project_dir=Path("/tmp/test"),
    )


class TestEducationTools:
    @pytest.mark.asyncio
    async def test_tools_registered_with_project(self, mock_config, sample_project_context):
        """Education tools should be registered when project_context is provided."""
        with patch("systemedu.core.runtime.get_llm"):
            runtime = AgentRuntime(
                provider="test", project_context=sample_project_context
            )
            schemas = runtime.tool_executor.get_tool_schemas()
            names = [s["function"]["name"] for s in schemas]
            assert "complete_node" in names
            assert "get_progress" in names

    @pytest.mark.asyncio
    async def test_complete_node_marks_passed(self, mock_config, sample_project_context):
        """complete_node should mark node as PASSED."""
        with (
            patch("systemedu.core.runtime.get_llm"),
            patch("systemedu.education.project_loader.save_progress"),
        ):
            runtime = AgentRuntime(
                provider="test", project_context=sample_project_context
            )
            result = await runtime.tool_executor.execute(
                "complete_node", {"node_id": 0}
            )
            assert "已完成" in result
            assert sample_project_context.progress[0].status == NodeStatus.PASSED

    @pytest.mark.asyncio
    async def test_complete_node_unlocks_next(self, mock_config, sample_project_context):
        """Completing node 0 should unlock node 1."""
        with (
            patch("systemedu.core.runtime.get_llm"),
            patch("systemedu.education.project_loader.save_progress"),
        ):
            runtime = AgentRuntime(
                provider="test", project_context=sample_project_context
            )
            result = await runtime.tool_executor.execute(
                "complete_node", {"node_id": 0}
            )
            assert "解锁" in result
            assert sample_project_context.progress[1].status == NodeStatus.AVAILABLE

    @pytest.mark.asyncio
    async def test_complete_locked_node_error(self, mock_config, sample_project_context):
        """Completing a LOCKED node should return an error."""
        with patch("systemedu.core.runtime.get_llm"):
            runtime = AgentRuntime(
                provider="test", project_context=sample_project_context
            )
            result = await runtime.tool_executor.execute(
                "complete_node", {"node_id": 1}
            )
            assert "未解锁" in result or "错误" in result

    @pytest.mark.asyncio
    async def test_get_progress_output(self, mock_config, sample_project_context):
        """get_progress should return formatted progress."""
        with patch("systemedu.core.runtime.get_llm"):
            runtime = AgentRuntime(
                provider="test", project_context=sample_project_context
            )
            result = await runtime.tool_executor.execute("get_progress", {})
            assert "测试项目" in result
            assert "节点A" in result
            assert "0/3" in result  # 0 passed out of 3

    @pytest.mark.asyncio
    async def test_complete_node_rebuilds_prompt(self, mock_config, sample_project_context):
        """After completing a node, system prompt should be rebuilt."""
        with (
            patch("systemedu.core.runtime.get_llm"),
            patch("systemedu.education.project_loader.save_progress"),
        ):
            runtime = AgentRuntime(
                provider="test", project_context=sample_project_context
            )
            old_prompt = runtime.system_prompt
            await runtime.tool_executor.execute("complete_node", {"node_id": 0})
            # Prompt should have changed (node B is now current)
            assert runtime.system_prompt != old_prompt
            assert "节点B" in runtime.system_prompt


class TestProgressPersistRoundtrip:
    @pytest.mark.asyncio
    async def test_progress_persist_roundtrip(self, mock_config, tmp_path, monkeypatch):
        """Complete a node → save → reload → progress should persist."""
        db_file = tmp_path / "test.db"
        monkeypatch.setattr("systemedu.storage.db.DB_FILE", db_file)
        reset_db()

        ctx = ProjectContext(
            project=Project(name="persist-test", title="Persist", description="test"),
            tree=KnowledgeTree(milestones=[
                Milestone(title="M1", knodes=[
                    KnowledgeNode(title="A", summary="", prerequisite_indices=[]),
                    KnowledgeNode(title="B", summary="", prerequisite_indices=[0]),
                ]),
            ]),
            progress=[
                UserNodeProgress(knode_id=0, status=NodeStatus.AVAILABLE),
                UserNodeProgress(knode_id=1, status=NodeStatus.LOCKED),
            ],
            project_dir=Path("/tmp/test"),
        )

        with patch("systemedu.core.runtime.get_llm"):
            runtime = AgentRuntime(provider="test", project_context=ctx)
            await runtime.tool_executor.execute("complete_node", {"node_id": 0})

        # Verify persistence
        from systemedu.education.project_loader import load_progress

        loaded = load_progress("default", "persist-test", 2)
        assert loaded is not None
        assert loaded[0].status == NodeStatus.PASSED
        assert loaded[1].status == NodeStatus.AVAILABLE
