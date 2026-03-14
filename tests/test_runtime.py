"""Tests for agent runtime."""

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
from systemedu.core.session import Session, SessionManager
from systemedu.core.tool_executor import ToolExecutor


@pytest.fixture(autouse=True)
def clean_config():
    reset_config()
    yield
    reset_config()


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


class TestSessionManager:
    def test_create_session(self):
        sm = SessionManager()
        session = sm.create_session()
        assert session.id
        assert session.agent_name == "default"

    def test_create_session_with_agent(self):
        sm = SessionManager()
        session = sm.create_session(agent_name="tutor", project_name="test-project")
        assert session.agent_name == "tutor"
        assert session.project_name == "test-project"

    def test_get_session(self):
        sm = SessionManager()
        session = sm.create_session()
        found = sm.get_session(session.id)
        assert found is session

    def test_close_session(self):
        sm = SessionManager()
        session = sm.create_session()
        sm.close_session(session.id)
        assert sm.get_session(session.id) is None


class TestSession:
    def test_add_message(self):
        session = Session()
        msg = session.add_message("user", "hello")
        assert msg.role == "user"
        assert msg.content == "hello"
        assert len(session.messages) == 1

    def test_get_openai_messages(self):
        session = Session()
        session.add_message("user", "hi")
        session.add_message("assistant", "hello")

        msgs = session.get_openai_messages()
        assert len(msgs) == 2
        assert msgs[0]["role"] == "user"
        assert msgs[1]["role"] == "assistant"


class TestToolExecutor:
    def test_run_bash(self):
        executor = ToolExecutor()
        result = executor._run_bash("echo hello")
        assert "hello" in result

    def test_blocked_command(self):
        executor = ToolExecutor(
            sandbox_config=SandboxConfig(blocked_commands=["rm -rf /"])
        )
        result = executor._run_bash("rm -rf /")
        assert "blocked" in result.lower()

    def test_read_file(self, tmp_path):
        test_file = tmp_path / "test.txt"
        test_file.write_text("test content")

        executor = ToolExecutor()
        result = executor._read_file(str(test_file))
        assert result == "test content"

    def test_read_nonexistent_file(self):
        executor = ToolExecutor()
        result = executor._read_file("/nonexistent/file")
        assert "Error" in result

    def test_write_file(self, tmp_path):
        test_file = tmp_path / "output.txt"
        executor = ToolExecutor()
        result = executor._write_file(str(test_file), "written content")
        assert "Successfully" in result
        assert test_file.read_text() == "written content"

    @pytest.mark.asyncio
    async def test_execute_bash(self):
        executor = ToolExecutor()
        result = await executor.execute("run_bash", {"command": "echo test"})
        assert "test" in result

    @pytest.mark.asyncio
    async def test_execute_unknown_tool(self):
        executor = ToolExecutor()
        result = await executor.execute("nonexistent", {})
        assert "Unknown tool" in result

    def test_read_file_blocked_by_sandbox(self, tmp_path):
        """Reading a file outside allowed_dirs should be blocked."""
        test_file = tmp_path / "secret.txt"
        test_file.write_text("secret")

        executor = ToolExecutor(
            sandbox_config=SandboxConfig(allowed_dirs=["/some/other/dir"])
        )
        result = executor._read_file(str(test_file))
        assert "blocked" in result.lower()

    def test_write_file_blocked_by_sandbox(self, tmp_path):
        """Writing a file outside allowed_dirs should be blocked."""
        executor = ToolExecutor(
            sandbox_config=SandboxConfig(allowed_dirs=["/some/other/dir"])
        )
        result = executor._write_file(str(tmp_path / "out.txt"), "data")
        assert "blocked" in result.lower()

    def test_read_file_allowed_by_sandbox(self, tmp_path):
        """Reading a file inside allowed_dirs should succeed."""
        test_file = tmp_path / "ok.txt"
        test_file.write_text("allowed content")

        executor = ToolExecutor(
            sandbox_config=SandboxConfig(allowed_dirs=[str(tmp_path)])
        )
        result = executor._read_file(str(test_file))
        assert result == "allowed content"

    def test_sandbox_disabled_allows_all(self, tmp_path):
        """When sandbox is disabled, all file access is allowed."""
        test_file = tmp_path / "any.txt"
        test_file.write_text("anything")

        executor = ToolExecutor(
            sandbox_config=SandboxConfig(enabled=False)
        )
        result = executor._read_file(str(test_file))
        assert result == "anything"

    def test_extra_schemas_via_register_tool(self):
        """register_tool with schema should add to get_tool_schemas."""
        executor = ToolExecutor()
        schema = {"type": "function", "function": {"name": "custom", "parameters": {}}}
        executor.register_tool("custom", lambda: "ok", schema=schema)
        schemas = executor.get_tool_schemas()
        assert schema in schemas

    def test_register_tool_without_schema(self):
        """register_tool without schema should not add extra schemas."""
        executor = ToolExecutor()
        before = len(executor.get_tool_schemas())
        executor.register_tool("custom", lambda: "ok")
        assert len(executor.get_tool_schemas()) == before


class TestAgentRuntime:
    @pytest.mark.asyncio
    async def test_process_message(self, mock_config):
        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(return_value=AIMessage(content="Hello! 我是小龟老师。"))
        mock_llm.bind_tools.return_value = mock_llm

        with patch("systemedu.core.runtime.get_llm", return_value=mock_llm):
            runtime = AgentRuntime(provider="test", tools_enabled=False)
            session = runtime.session_manager.create_session()
            response = await runtime.process_message("你好", session)

            assert response == "Hello! 我是小龟老师。"
            assert len(session.messages) == 2  # user + assistant

    @pytest.mark.asyncio
    async def test_process_with_tool_calls(self, mock_config):
        # First call returns tool call, second returns final response
        tool_call_response = AIMessage(
            content="",
            tool_calls=[{
                "id": "call_123",
                "name": "run_bash",
                "args": {"command": "echo hello"},
            }],
        )
        final_response = AIMessage(content="命令输出是: hello")

        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(side_effect=[tool_call_response, final_response])
        mock_llm.bind_tools.return_value = mock_llm

        with patch("systemedu.core.runtime.get_llm", return_value=mock_llm):
            runtime = AgentRuntime(provider="test")
            session = runtime.session_manager.create_session()
            response = await runtime.process_message("运行 echo hello", session)

            assert "hello" in response.lower() or "命令" in response


class TestSkillInjection:
    @pytest.mark.asyncio
    async def test_no_skills_uses_default_prompt(self, mock_config):
        """Without skill_names, default system prompt is used."""
        with patch("systemedu.core.runtime.get_llm") as mock_get_llm:
            mock_llm = MagicMock()
            mock_llm.ainvoke = AsyncMock(return_value=AIMessage(content="hi"))
            mock_llm.bind_tools.return_value = mock_llm
            mock_get_llm.return_value = mock_llm

            runtime = AgentRuntime(provider="test")
            assert "Skill:" not in runtime.system_prompt

    @pytest.mark.asyncio
    async def test_builtin_skill_injected(self, mock_config):
        """Passing skill_names=['tutor'] should inject tutor skill content."""
        with patch("systemedu.core.runtime.get_llm") as mock_get_llm:
            mock_llm = MagicMock()
            mock_llm.ainvoke = AsyncMock(return_value=AIMessage(content="hi"))
            mock_get_llm.return_value = mock_llm

            runtime = AgentRuntime(provider="test", skill_names=["tutor"])
            assert "小龟老师" in runtime.system_prompt
            assert "## Skill: tutor" in runtime.system_prompt

    @pytest.mark.asyncio
    async def test_unknown_skill_ignored(self, mock_config):
        """Unknown skill names should be silently ignored."""
        with patch("systemedu.core.runtime.get_llm") as mock_get_llm:
            mock_llm = MagicMock()
            mock_get_llm.return_value = mock_llm

            runtime = AgentRuntime(provider="test", skill_names=["nonexistent_skill_xyz"])
            # Should not crash, and prompt should not have the unknown skill
            assert "nonexistent_skill_xyz" not in runtime.system_prompt

    @pytest.mark.asyncio
    async def test_multiple_skills_injected(self, mock_config):
        """Multiple skills should all be injected."""
        with patch("systemedu.core.runtime.get_llm") as mock_get_llm:
            mock_llm = MagicMock()
            mock_get_llm.return_value = mock_llm

            runtime = AgentRuntime(provider="test", skill_names=["tutor", "planner"])
            assert "## Skill: tutor" in runtime.system_prompt
            assert "## Skill: planner" in runtime.system_prompt


class TestMCPToolsIntegration:
    @pytest.mark.asyncio
    async def test_mcp_tools_added_to_schemas(self, mock_config):
        """MCP tools should appear in tool schemas after setup."""
        mock_manager = MagicMock()
        mock_manager.list_tools.return_value = [
            {
                "type": "function",
                "function": {
                    "name": "fs__read_file",
                    "description": "[fs] Read a file",
                    "parameters": {"type": "object"},
                },
            }
        ]
        mock_manager.call_tool = AsyncMock(return_value="content")

        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(return_value=AIMessage(content="done"))
        mock_llm.bind_tools.return_value = mock_llm

        with patch("systemedu.core.runtime.get_llm", return_value=mock_llm):
            runtime = AgentRuntime(provider="test", mcp_manager=mock_manager)
            session = runtime.session_manager.create_session()
            await runtime.process_message("test", session)

            # After process_message, MCP tools should be registered
            schemas = runtime.tool_executor.get_tool_schemas()
            names = [s["function"]["name"] for s in schemas]
            assert "fs__read_file" in names

    @pytest.mark.asyncio
    async def test_mcp_tool_call_routed(self, mock_config):
        """LLM calling an MCP tool should route to MCPManager."""
        mock_manager = MagicMock()
        mock_manager.list_tools.return_value = [
            {
                "type": "function",
                "function": {
                    "name": "echo__echo",
                    "description": "[echo] Echo text",
                    "parameters": {"type": "object"},
                },
            }
        ]
        mock_manager.call_tool = AsyncMock(return_value="echoed: hello")

        tool_call_response = AIMessage(
            content="",
            tool_calls=[{
                "id": "call_mcp_1",
                "name": "echo__echo",
                "args": {"text": "hello"},
            }],
        )
        final_response = AIMessage(content="Echo result: echoed: hello")

        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(side_effect=[tool_call_response, final_response])
        mock_llm.bind_tools.return_value = mock_llm

        with patch("systemedu.core.runtime.get_llm", return_value=mock_llm):
            runtime = AgentRuntime(provider="test", mcp_manager=mock_manager)
            session = runtime.session_manager.create_session()
            response = await runtime.process_message("echo hello", session)

            assert "echoed" in response.lower() or "echo" in response.lower()
            mock_manager.call_tool.assert_called_once_with("echo__echo", {"text": "hello"})


class TestMCPAutoConnect:
    @pytest.mark.asyncio
    async def test_mcp_auto_connect(self, mock_config):
        """MCP servers from config should be auto-connected."""
        from systemedu.core.config import MCPServerConfig
        from systemedu.mcp.manager import MCPManager

        mock_manager = MagicMock(spec=MCPManager)
        mock_manager.list_tools.return_value = []

        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(return_value=AIMessage(content="ok"))
        mock_llm.bind_tools.return_value = mock_llm

        with patch("systemedu.core.runtime.get_llm", return_value=mock_llm):
            runtime = AgentRuntime(provider="test", mcp_manager=mock_manager)
            session = runtime.session_manager.create_session()
            await runtime.process_message("test", session)

            # list_tools should have been called during MCP setup
            mock_manager.list_tools.assert_called_once()


class TestProjectContextInPrompt:
    @pytest.mark.asyncio
    async def test_project_context_in_prompt(self, mock_config):
        """Project context should appear in system prompt."""
        from systemedu.education.project_loader import ProjectContext
        from systemedu.education.models import (
            KnowledgeNode, KnowledgeTree, Milestone, NodeStatus, Project, UserNodeProgress,
        )

        ctx = ProjectContext(
            project=Project(name="test", title="测试项目", description="测试描述"),
            tree=KnowledgeTree(milestones=[
                Milestone(title="M1", knodes=[
                    KnowledgeNode(title="节点A", summary="第一个节点"),
                ]),
            ]),
            progress=[UserNodeProgress(knode_id=0, status=NodeStatus.AVAILABLE)],
            project_dir=Path("/tmp/test"),
        )

        with patch("systemedu.core.runtime.get_llm") as mock_get_llm:
            mock_llm = MagicMock()
            mock_llm.ainvoke = AsyncMock(return_value=AIMessage(content="ok"))
            mock_llm.bind_tools.return_value = mock_llm
            mock_get_llm.return_value = mock_llm

            runtime = AgentRuntime(provider="test", project_context=ctx)
            assert "测试项目" in runtime.system_prompt
            assert "节点A" in runtime.system_prompt
            assert "当前学习节点" in runtime.system_prompt

    @pytest.mark.asyncio
    async def test_no_project_context_unchanged(self, mock_config):
        """Without project_context, default prompt should be unchanged."""
        with patch("systemedu.core.runtime.get_llm") as mock_get_llm:
            mock_llm = MagicMock()
            mock_get_llm.return_value = mock_llm

            runtime = AgentRuntime(provider="test")
            assert "当前项目" not in runtime.system_prompt
            assert "complete_node" not in runtime.system_prompt


class TestMemoryIntegration:
    @pytest.mark.asyncio
    async def test_memory_retrieve_called(self, mock_config):
        """When memory is enabled, retrieve_memories should be called."""
        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(return_value=AIMessage(content="with memory"))
        mock_llm.bind_tools.return_value = mock_llm

        with (
            patch("systemedu.core.runtime.get_llm", return_value=mock_llm),
            patch(
                "systemedu.core.runtime.get_config",
                return_value=MagicMock(
                    memory=MagicMock(enabled=True),
                    sandbox=MagicMock(enabled=False),
                ),
            ),
            patch(
                "systemedu.memory.client.retrieve_memories",
                return_value=["past context"],
            ) as mock_retrieve,
        ):
            runtime = AgentRuntime(provider="test", tools_enabled=False)
            session = runtime.session_manager.create_session()
            await runtime.process_message("hello", session, user_id="user1")

            mock_retrieve.assert_called_once_with(user_id="user1", query="hello")

    @pytest.mark.asyncio
    async def test_memory_store_called(self, mock_config):
        """When memory is enabled, store_conversation should be called."""
        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(return_value=AIMessage(content="response"))
        mock_llm.bind_tools.return_value = mock_llm

        with (
            patch("systemedu.core.runtime.get_llm", return_value=mock_llm),
            patch(
                "systemedu.core.runtime.get_config",
                return_value=MagicMock(
                    memory=MagicMock(enabled=True),
                    sandbox=MagicMock(enabled=False),
                ),
            ),
            patch("systemedu.memory.client.retrieve_memories", return_value=[]),
            patch(
                "systemedu.memory.client.store_conversation",
                return_value=None,
            ) as mock_store,
        ):
            runtime = AgentRuntime(provider="test", tools_enabled=False)
            session = runtime.session_manager.create_session()
            await runtime.process_message("hi", session, user_id="user2")

            mock_store.assert_called_once()
            call_kwargs = mock_store.call_args[1]
            assert call_kwargs["user_id"] == "user2"
            assert len(call_kwargs["messages"]) == 2

    @pytest.mark.asyncio
    async def test_memory_disabled_skips(self, mock_config):
        """When memory is disabled, neither retrieve nor store should be called."""
        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(return_value=AIMessage(content="no memory"))
        mock_llm.bind_tools.return_value = mock_llm

        with (
            patch("systemedu.core.runtime.get_llm", return_value=mock_llm),
            patch(
                "systemedu.core.runtime.get_config",
                return_value=MagicMock(
                    memory=MagicMock(enabled=False),
                    sandbox=MagicMock(enabled=False),
                ),
            ),
            patch(
                "systemedu.memory.client.retrieve_memories",
            ) as mock_retrieve,
            patch(
                "systemedu.memory.client.store_conversation",
            ) as mock_store,
        ):
            runtime = AgentRuntime(provider="test", tools_enabled=False)
            session = runtime.session_manager.create_session()
            await runtime.process_message("test", session)

            mock_retrieve.assert_not_called()
            mock_store.assert_not_called()


class TestLangGraphRuntime:
    @pytest.mark.asyncio
    async def test_simple_response_flows_through_graph(self, mock_config):
        """Simple message should flow through: retrieve_memory → agent → store_memory → END."""
        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(return_value=AIMessage(content="Graph response"))
        mock_llm.bind_tools.return_value = mock_llm

        with patch("systemedu.core.runtime.get_llm", return_value=mock_llm):
            runtime = AgentRuntime(provider="test", tools_enabled=False)
            session = runtime.session_manager.create_session()
            response = await runtime.process_message("hi", session)

            assert response == "Graph response"

    @pytest.mark.asyncio
    async def test_tool_calls_loop_in_graph(self, mock_config):
        """Tool call should loop: agent → execute_tools → agent → store_memory."""
        tool_call_msg = AIMessage(
            content="",
            tool_calls=[{
                "id": "call_1",
                "name": "run_bash",
                "args": {"command": "echo loop"},
            }],
        )
        final_msg = AIMessage(content="Loop done")

        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(side_effect=[tool_call_msg, final_msg])
        mock_llm.bind_tools.return_value = mock_llm

        with patch("systemedu.core.runtime.get_llm", return_value=mock_llm):
            runtime = AgentRuntime(provider="test")
            session = runtime.session_manager.create_session()
            response = await runtime.process_message("do something", session)

            assert response == "Loop done"
            assert mock_llm.ainvoke.call_count == 2

    @pytest.mark.asyncio
    async def test_max_iterations_stops_graph(self, mock_config):
        """Graph should stop after max iterations (10)."""
        # Always return tool calls to trigger the loop
        tool_call_msg = AIMessage(
            content="",
            tool_calls=[{
                "id": "call_loop",
                "name": "run_bash",
                "args": {"command": "echo loop"},
            }],
        )

        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(return_value=tool_call_msg)
        mock_llm.bind_tools.return_value = mock_llm

        with patch("systemedu.core.runtime.get_llm", return_value=mock_llm):
            runtime = AgentRuntime(provider="test")
            session = runtime.session_manager.create_session()
            response = await runtime.process_message("infinite loop", session)

            # Should hit the fallback message
            assert "抱歉" in response or "太多步骤" in response

    @pytest.mark.asyncio
    async def test_user_id_passed_to_graph(self, mock_config):
        """user_id parameter should be passed to the graph state."""
        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(return_value=AIMessage(content="ok"))
        mock_llm.bind_tools.return_value = mock_llm

        with patch("systemedu.core.runtime.get_llm", return_value=mock_llm):
            runtime = AgentRuntime(provider="test", tools_enabled=False)
            session = runtime.session_manager.create_session()
            response = await runtime.process_message("test", session, user_id="user123")

            assert response == "ok"
