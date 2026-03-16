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
from systemedu.core.runtime import AgentRuntime, _build_node_context, _split_by_headings
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
        sm = SessionManager(persist=False)
        session = sm.create_session()
        assert session.id
        assert session.agent_name == "default"

    def test_create_session_with_agent(self):
        sm = SessionManager(persist=False)
        session = sm.create_session(agent_name="tutor", project_name="test-project")
        assert session.agent_name == "tutor"
        assert session.project_name == "test-project"

    def test_get_session(self):
        sm = SessionManager(persist=False)
        session = sm.create_session()
        found = sm.get_session(session.id)
        assert found is session

    def test_close_session(self):
        sm = SessionManager(persist=False)
        session = sm.create_session()
        sm.close_session(session.id)
        assert sm.get_session(session.id) is None


class TestSessionPersistence:
    """Test session persistence to SQLite."""

    @pytest.fixture(autouse=True)
    def setup_db(self, tmp_path, monkeypatch):
        """Use a temp database for persistence tests."""
        db_file = tmp_path / "test.db"
        monkeypatch.setattr("systemedu.storage.db.DB_FILE", db_file)
        from systemedu.storage.db import reset_db
        reset_db()
        yield
        reset_db()

    def test_session_persisted_to_db(self):
        sm = SessionManager(persist=True)
        session = sm.create_session(agent_name="tutor", project_name="test-proj")

        from systemedu.storage.db import ChatSession as DBSession
        from systemedu.storage.db import get_session as get_db_session

        db = get_db_session()
        try:
            db_sess = db.query(DBSession).filter_by(id=session.id).first()
            assert db_sess is not None
            assert db_sess.agent_name == "tutor"
            assert db_sess.project_name == "test-proj"
        finally:
            db.close()

    def test_messages_persisted_to_db(self):
        sm = SessionManager(persist=True)
        session = sm.create_session()
        session.add_message("user", "hello")
        session.add_message("assistant", "hi there")

        from systemedu.storage.db import ChatMessage as DBMessage
        from systemedu.storage.db import get_session as get_db_session

        db = get_db_session()
        try:
            messages = db.query(DBMessage).filter_by(session_id=session.id).all()
            assert len(messages) == 2
            assert messages[0].role == "user"
            assert messages[0].content == "hello"
            assert messages[1].role == "assistant"
            assert messages[1].content == "hi there"
        finally:
            db.close()

    def test_sessions_loaded_on_init(self):
        # Create a session with the first manager
        sm1 = SessionManager(persist=True)
        session = sm1.create_session(agent_name="tutor")
        session.add_message("user", "test msg")
        session.add_message("assistant", "response")

        # Create a new manager — should load from DB
        sm2 = SessionManager(persist=True)
        loaded = sm2.get_session(session.id)
        assert loaded is not None
        assert loaded.agent_name == "tutor"
        assert len(loaded.messages) == 2
        assert loaded.messages[0].content == "test msg"

    def test_tool_messages_not_persisted(self):
        sm = SessionManager(persist=True)
        session = sm.create_session()
        session.add_message("user", "test")
        session.add_message("tool", "tool result", name="run_bash")
        session.add_message("assistant", "done")

        from systemedu.storage.db import ChatMessage as DBMessage
        from systemedu.storage.db import get_session as get_db_session

        db = get_db_session()
        try:
            messages = db.query(DBMessage).filter_by(session_id=session.id).all()
            # Only user and assistant, not tool
            assert len(messages) == 2
            roles = [m.role for m in messages]
            assert "tool" not in roles
        finally:
            db.close()


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

        with patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm):
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

        with patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm):
            runtime = AgentRuntime(provider="test")
            session = runtime.session_manager.create_session()
            response = await runtime.process_message("运行 echo hello", session)

            assert "hello" in response.lower() or "命令" in response


class TestSkillInjection:
    @pytest.mark.asyncio
    async def test_no_skills_uses_default_prompt(self, mock_config):
        """Without skill_names, default system prompt is used."""
        with patch("systemedu.core.agent_backend.get_llm") as mock_get_llm:
            mock_llm = MagicMock()
            mock_llm.ainvoke = AsyncMock(return_value=AIMessage(content="hi"))
            mock_llm.bind_tools.return_value = mock_llm
            mock_get_llm.return_value = mock_llm

            runtime = AgentRuntime(provider="test")
            assert "Skill:" not in runtime.system_prompt

    @pytest.mark.asyncio
    async def test_builtin_skill_injected(self, mock_config):
        """Passing skill_names=['tutor'] should inject tutor skill content."""
        with patch("systemedu.core.agent_backend.get_llm") as mock_get_llm:
            mock_llm = MagicMock()
            mock_llm.ainvoke = AsyncMock(return_value=AIMessage(content="hi"))
            mock_get_llm.return_value = mock_llm

            runtime = AgentRuntime(provider="test", skill_names=["tutor"])
            assert "小龟老师" in runtime.system_prompt
            assert "## Skill: tutor" in runtime.system_prompt

    @pytest.mark.asyncio
    async def test_unknown_skill_ignored(self, mock_config):
        """Unknown skill names should be silently ignored."""
        with patch("systemedu.core.agent_backend.get_llm") as mock_get_llm:
            mock_llm = MagicMock()
            mock_get_llm.return_value = mock_llm

            runtime = AgentRuntime(provider="test", skill_names=["nonexistent_skill_xyz"])
            # Should not crash, and prompt should not have the unknown skill
            assert "nonexistent_skill_xyz" not in runtime.system_prompt

    @pytest.mark.asyncio
    async def test_multiple_skills_injected(self, mock_config):
        """Multiple skills should all be injected."""
        with patch("systemedu.core.agent_backend.get_llm") as mock_get_llm:
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

        with patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm):
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

        with patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm):
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

        with patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm):
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

        with patch("systemedu.core.agent_backend.get_llm") as mock_get_llm:
            mock_llm = MagicMock()
            mock_llm.ainvoke = AsyncMock(return_value=AIMessage(content="ok"))
            mock_llm.bind_tools.return_value = mock_llm
            mock_get_llm.return_value = mock_llm

            runtime = AgentRuntime(provider="test", project_context=ctx)
            assert "测试项目" in runtime.system_prompt
            assert "节点A" in runtime.system_prompt
            assert "当前学习节点" in runtime.system_prompt

    @pytest.mark.asyncio
    async def test_progress_summary_in_prompt(self, mock_config):
        """Full progress summary with all node statuses should appear in system prompt."""
        from systemedu.education.project_loader import ProjectContext
        from systemedu.education.models import (
            KnowledgeNode, KnowledgeTree, Milestone, NodeStatus, Project, UserNodeProgress,
        )

        ctx = ProjectContext(
            project=Project(name="test", title="测试项目", description="测试描述"),
            tree=KnowledgeTree(milestones=[
                Milestone(title="M1", knodes=[
                    KnowledgeNode(title="节点A", summary="第一个节点"),
                    KnowledgeNode(title="节点B", summary="第二个节点"),
                    KnowledgeNode(title="节点C", summary="第三个节点"),
                ]),
            ]),
            progress=[
                UserNodeProgress(knode_id=0, status=NodeStatus.PASSED),
                UserNodeProgress(knode_id=1, status=NodeStatus.AVAILABLE),
                UserNodeProgress(knode_id=2, status=NodeStatus.LOCKED),
            ],
            project_dir=Path("/tmp/test"),
        )

        with patch("systemedu.core.agent_backend.get_llm") as mock_get_llm:
            mock_llm = MagicMock()
            mock_llm.bind_tools.return_value = mock_llm
            mock_get_llm.return_value = mock_llm

            runtime = AgentRuntime(provider="test", project_context=ctx)
            # Should include progress percentage
            assert "1/3" in runtime.system_prompt
            assert "33%" in runtime.system_prompt
            # Should include all nodes with their status
            assert "节点A — passed" in runtime.system_prompt
            assert "节点B — available" in runtime.system_prompt
            assert "节点C — locked" in runtime.system_prompt

    @pytest.mark.asyncio
    async def test_no_project_context_unchanged(self, mock_config):
        """Without project_context, default prompt should be unchanged."""
        with patch("systemedu.core.agent_backend.get_llm") as mock_get_llm:
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
            patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm),
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

            mock_retrieve.assert_called_once_with(user_id="user1", query="hello", project_id=None)

    @pytest.mark.asyncio
    async def test_memory_store_called(self, mock_config):
        """When memory is enabled, store_conversation should be called."""
        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(return_value=AIMessage(content="response"))
        mock_llm.bind_tools.return_value = mock_llm

        with (
            patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm),
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
            patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm),
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

        with patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm):
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

        with patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm):
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

        with patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm):
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

        with patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm):
            runtime = AgentRuntime(provider="test", tools_enabled=False)
            session = runtime.session_manager.create_session()
            response = await runtime.process_message("test", session, user_id="user123")

            assert response == "ok"


class TestStreamMessage:
    @pytest.mark.asyncio
    async def test_stream_basic(self, mock_config):
        """stream_message should yield structured events and save to session."""
        chunk1 = MagicMock()
        chunk1.content = "Hello"
        chunk2 = MagicMock()
        chunk2.content = " World"

        mock_llm = MagicMock()

        async def fake_stream(*args, **kwargs):
            yield chunk1
            yield chunk2

        mock_llm.astream = fake_stream

        with patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm):
            runtime = AgentRuntime(provider="test", tools_enabled=False)
            session = runtime.session_manager.create_session()
            events = []
            async for event in runtime.stream_message("hello", session):
                events.append(event)

            assert len(events) == 2
            assert events[0] == {"type": "chunk", "content": "Hello"}
            assert events[1] == {"type": "chunk", "content": " World"}
            assert len(session.messages) == 2  # user + assistant
            assert session.messages[1].content == "Hello World"

    @pytest.mark.asyncio
    async def test_stream_with_user_id(self, mock_config):
        """stream_message should pass user_id for memory retrieval."""
        chunk = MagicMock()
        chunk.content = "response"

        mock_llm = MagicMock()

        async def fake_stream(*args, **kwargs):
            yield chunk

        mock_llm.astream = fake_stream

        with (
            patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm),
            patch(
                "systemedu.core.runtime.get_config",
                return_value=MagicMock(
                    memory=MagicMock(enabled=True),
                    sandbox=MagicMock(enabled=False),
                ),
            ),
            patch(
                "systemedu.memory.client.retrieve_memories",
                return_value=["past memory"],
            ) as mock_retrieve,
            patch("systemedu.memory.client.store_conversation") as mock_store,
        ):
            runtime = AgentRuntime(provider="test", tools_enabled=False)
            session = runtime.session_manager.create_session()
            events = []
            async for event in runtime.stream_message("test", session, user_id="user1"):
                events.append(event)

            mock_retrieve.assert_called_once_with(user_id="user1", query="test", project_id=None)
            mock_store.assert_called_once()

    @pytest.mark.asyncio
    async def test_stream_with_mcp_tools(self, mock_config):
        """stream_message should set up MCP tools before streaming."""
        mock_llm = MagicMock()
        # When tools are present, stream uses the graph path which calls ainvoke
        mock_llm.ainvoke = AsyncMock(return_value=AIMessage(content="result"))
        mock_llm.bind_tools.return_value = mock_llm

        mock_manager = MagicMock()
        mock_manager.list_tools.return_value = [
            {
                "type": "function",
                "function": {
                    "name": "test_tool",
                    "description": "A test tool",
                    "parameters": {"type": "object"},
                },
            }
        ]

        with patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm):
            runtime = AgentRuntime(provider="test", mcp_manager=mock_manager)
            session = runtime.session_manager.create_session()
            events = []
            async for event in runtime.stream_message("test", session):
                events.append(event)

            # MCP tools should have been set up
            assert runtime._mcp_setup_done
            # Tool should be registered
            schemas = runtime.tool_executor.get_tool_schemas()
            tool_names = [s["function"]["name"] for s in schemas]
            assert "test_tool" in tool_names


class TestBuildNodeContext:
    """Test _build_node_context function."""

    def _make_project_context(self):
        from systemedu.education.models import (
            KnowledgeNode, KnowledgeTree, Milestone, NodeStatus, Project, UserNodeProgress,
        )
        from systemedu.education.project_loader import ProjectContext

        return ProjectContext(
            project=Project(name="test-proj", title="测试项目", description="测试描述"),
            tree=KnowledgeTree(milestones=[
                Milestone(title="M1", knodes=[
                    KnowledgeNode(title="Python基础", summary="学习Python基础语法"),
                    KnowledgeNode(title="变量与类型", summary="了解变量和数据类型"),
                ]),
            ]),
            progress=[
                UserNodeProgress(knode_id=0, status=NodeStatus.AVAILABLE),
                UserNodeProgress(knode_id=1, status=NodeStatus.LOCKED),
            ],
            project_dir=Path("/tmp/test"),
        )

    def test_returns_empty_for_invalid_node_id(self):
        ctx = self._make_project_context()
        result = _build_node_context(ctx, 999)
        assert result == ""

    def test_includes_node_title_and_summary(self):
        ctx = self._make_project_context()
        result = _build_node_context(ctx, 0)
        assert "Python基础" in result
        assert "学习Python基础语法" in result
        assert "学生当前正在学习的知识点" in result

    def test_includes_lesson_content_from_db(self, tmp_path, monkeypatch):
        """When LessonContent exists in DB, concept and key_takeaways are included."""
        db_file = tmp_path / "test.db"
        monkeypatch.setattr("systemedu.storage.db.DB_FILE", db_file)
        from systemedu.storage.db import LessonContent, get_session as get_db_session, reset_db
        reset_db()

        # Insert lesson content
        db = get_db_session()
        try:
            lesson = LessonContent(
                project_name="test-proj",
                knode_id=0,
                status="ready",
                concept="Python是一种解释型编程语言",
                key_takeaways="- 易学易用\n- 动态类型",
            )
            db.add(lesson)
            db.commit()
        finally:
            db.close()

        ctx = self._make_project_context()
        result = _build_node_context(ctx, 0)
        assert "Python是一种解释型编程语言" in result
        assert "易学易用" in result
        assert "核心概念" in result
        assert "要点总结" in result

        reset_db()

    def test_concept_truncated_when_long(self, tmp_path, monkeypatch):
        """Long concept text should be truncated to ~500 chars."""
        db_file = tmp_path / "test.db"
        monkeypatch.setattr("systemedu.storage.db.DB_FILE", db_file)
        from systemedu.storage.db import LessonContent, get_session as get_db_session, reset_db
        reset_db()

        long_concept = "x" * 1000
        db = get_db_session()
        try:
            lesson = LessonContent(
                project_name="test-proj", knode_id=0, status="ready",
                concept=long_concept, key_takeaways="takeaway",
            )
            db.add(lesson)
            db.commit()
        finally:
            db.close()

        ctx = self._make_project_context()
        result = _build_node_context(ctx, 0)
        # Full 1000-char concept should not appear
        assert long_concept not in result
        # But truncated version + "..." should appear
        assert "x" * 500 + "..." in result

        reset_db()

    def test_no_lesson_still_returns_basic_info(self):
        """Without DB data, still returns node title and summary."""
        ctx = self._make_project_context()
        result = _build_node_context(ctx, 1)
        assert "变量与类型" in result
        assert "了解变量和数据类型" in result


class TestStreamMessageWithNodeId:
    """Test stream_message node_id injection."""

    @pytest.mark.asyncio
    async def test_stream_with_node_id_injects_context(self, mock_config, tmp_path, monkeypatch):
        """stream_message with node_id should inject node context into system prompt."""
        from systemedu.education.models import (
            KnowledgeNode, KnowledgeTree, Milestone, NodeStatus, Project, UserNodeProgress,
        )
        from systemedu.education.project_loader import ProjectContext

        db_file = tmp_path / "test.db"
        monkeypatch.setattr("systemedu.storage.db.DB_FILE", db_file)
        from systemedu.storage.db import LessonContent, get_session as get_db_session, reset_db
        reset_db()

        # Insert lesson content
        db = get_db_session()
        try:
            lesson = LessonContent(
                project_name="test-proj", knode_id=0, status="ready",
                concept="函数是代码复用的基础", key_takeaways="- def 关键字",
            )
            db.add(lesson)
            db.commit()
        finally:
            db.close()

        ctx = ProjectContext(
            project=Project(name="test-proj", title="测试项目", description="描述"),
            tree=KnowledgeTree(milestones=[
                Milestone(title="M1", knodes=[
                    KnowledgeNode(title="函数基础", summary="学习函数"),
                ]),
            ]),
            progress=[UserNodeProgress(knode_id=0, status=NodeStatus.AVAILABLE)],
            project_dir=Path("/tmp/test"),
        )

        chunk = MagicMock()
        chunk.content = "ok"

        mock_llm = MagicMock()

        # Capture the system_prompt passed to the backend
        captured_prompts = []

        async def fake_stream(messages, system_prompt, **kwargs):
            captured_prompts.append(system_prompt)
            yield {"type": "chunk", "content": "ok"}

        with patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm):
            runtime = AgentRuntime(provider="test", project_context=ctx, tools_enabled=False)
            runtime._backend.stream = fake_stream
            session = runtime.session_manager.create_session()

            events = []
            async for event in runtime.stream_message("test", session, node_id=0):
                events.append(event)

            assert len(captured_prompts) == 1
            prompt = captured_prompts[0]
            assert "函数基础" in prompt
            assert "函数是代码复用的基础" in prompt
            assert "学生当前正在学习的知识点" in prompt

        reset_db()

    @pytest.mark.asyncio
    async def test_stream_without_node_id_no_injection(self, mock_config):
        """stream_message without node_id should not inject node context."""
        from systemedu.education.models import (
            KnowledgeNode, KnowledgeTree, Milestone, NodeStatus, Project, UserNodeProgress,
        )
        from systemedu.education.project_loader import ProjectContext

        ctx = ProjectContext(
            project=Project(name="test-proj", title="测试项目", description="描述"),
            tree=KnowledgeTree(milestones=[
                Milestone(title="M1", knodes=[
                    KnowledgeNode(title="函数基础", summary="学习函数"),
                ]),
            ]),
            progress=[UserNodeProgress(knode_id=0, status=NodeStatus.AVAILABLE)],
            project_dir=Path("/tmp/test"),
        )

        captured_prompts = []

        async def fake_stream(messages, system_prompt, **kwargs):
            captured_prompts.append(system_prompt)
            yield {"type": "chunk", "content": "ok"}

        mock_llm = MagicMock()

        with patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm):
            runtime = AgentRuntime(provider="test", project_context=ctx, tools_enabled=False)
            runtime._backend.stream = fake_stream
            session = runtime.session_manager.create_session()

            async for _ in runtime.stream_message("test", session):
                pass

            prompt = captured_prompts[0]
            # Should have project context from init, but NOT the per-message node context
            assert "测试项目" in prompt
            assert "学生当前正在学习的知识点" not in prompt


class TestSplitByHeadings:
    """Test _split_by_headings utility function."""

    def test_no_headings_returns_single_page(self):
        result = _split_by_headings("Hello world\nThis is content.")
        assert len(result) == 1
        assert "Hello world" in result[0]

    def test_split_by_h2(self):
        md = "## Page 1\nContent 1\n## Page 2\nContent 2"
        result = _split_by_headings(md)
        assert len(result) == 2
        assert "Page 1" in result[0]
        assert "Page 2" in result[1]

    def test_split_by_h3(self):
        md = "### A\nFoo\n### B\nBar"
        result = _split_by_headings(md)
        assert len(result) == 2
        assert "Foo" in result[0]
        assert "Bar" in result[1]

    def test_mixed_h2_and_h3(self):
        md = "## Intro\nText\n### Detail\nMore text\n## Conclusion\nEnd"
        result = _split_by_headings(md)
        assert len(result) == 3

    def test_content_before_first_heading(self):
        md = "Some preamble\n## Title\nBody"
        result = _split_by_headings(md)
        assert len(result) == 2
        assert "preamble" in result[0]
        assert "Title" in result[1]

    def test_empty_string(self):
        result = _split_by_headings("")
        assert len(result) == 1

    def test_h4_not_split(self):
        """#### headings should NOT cause page splits."""
        md = "## Top\nContent\n#### Sub\nMore"
        result = _split_by_headings(md)
        assert len(result) == 1  # Only one ## heading, no split

    def test_long_content_without_headings_splits_by_paragraphs(self):
        """Long content without headings should auto-split by paragraphs."""
        paragraphs = [f"段落{i}。" + "这是一段较长的描述文字。" * 15 for i in range(5)]
        md = "\n\n".join(paragraphs)
        result = _split_by_headings(md)
        assert len(result) > 1, f"Expected multiple pages for {len(md)} chars, got {len(result)}"

    def test_short_content_without_headings_stays_single(self):
        """Short content without headings stays as one page."""
        md = "这是短内容。\n\n第二段也很短。"
        result = _split_by_headings(md)
        assert len(result) == 1

    def test_h1_heading_also_splits(self):
        """# headings should also trigger page splits."""
        md = "# Title\nContent here\n# Another\nMore content"
        result = _split_by_headings(md)
        assert len(result) == 2

    def test_realistic_content_splits(self):
        """Realistic 600+ char content with paragraphs should split."""
        para1 = "变量是编程中用来存储数据的容器。" + "这是一段较长的描述文字，用来测试段落分页功能是否正常工作。" * 5
        para2 = "变量可以存储各种类型的数据。" + "这是另一段较长的描述文字，用于验证自动分页的阈值设置。" * 5
        para3 = "使用变量让代码更灵活。" + "更多关于变量的详细说明内容，帮助学习者理解变量的用途。" * 5
        md = f"# 什么是变量\n\n{para1}\n\n{para2}\n\n{para3}"
        result = _split_by_headings(md)
        assert len(result) >= 2, f"Expected 2+ pages for {len(md)} chars, got {len(result)}"


class TestBuildNodeContextWithPageInfo:
    """Test _build_node_context with active_tab and page_index."""

    def _make_project_context(self):
        from systemedu.education.models import (
            KnowledgeNode, KnowledgeTree, Milestone, NodeStatus, Project, UserNodeProgress,
        )
        from systemedu.education.project_loader import ProjectContext

        return ProjectContext(
            project=Project(name="test-proj", title="测试项目", description="测试描述"),
            tree=KnowledgeTree(milestones=[
                Milestone(title="M1", knodes=[
                    KnowledgeNode(title="Python基础", summary="学习Python基础语法"),
                ]),
            ]),
            progress=[
                UserNodeProgress(knode_id=0, status=NodeStatus.AVAILABLE),
            ],
            project_dir=Path("/tmp/test"),
        )

    def test_page_context_injected(self, tmp_path, monkeypatch):
        """When active_tab and page_index are given, specific page content is injected."""
        db_file = tmp_path / "test.db"
        monkeypatch.setattr("systemedu.storage.db.DB_FILE", db_file)
        from systemedu.storage.db import LessonContent, get_session as get_db_session, reset_db
        reset_db()

        db = get_db_session()
        try:
            lesson = LessonContent(
                project_name="test-proj",
                knode_id=0,
                status="ready",
                concept="## 第一页\n变量是存储数据的容器。\n## 第二页\n类型决定了数据的行为。",
                key_takeaways="- 变量\n- 类型",
            )
            db.add(lesson)
            db.commit()
        finally:
            db.close()

        ctx = self._make_project_context()
        result = _build_node_context(ctx, 0, active_tab="concept", page_index=1)
        assert "第二页" in result
        assert "类型决定了数据的行为" in result
        assert "学生当前正在阅读的内容" in result
        # Concept summary should NOT appear (page-level takes over)
        assert "核心概念" not in result

        reset_db()

    def test_without_page_info_fallback(self, tmp_path, monkeypatch):
        """Without active_tab, falls back to concept summary."""
        db_file = tmp_path / "test.db"
        monkeypatch.setattr("systemedu.storage.db.DB_FILE", db_file)
        from systemedu.storage.db import LessonContent, get_session as get_db_session, reset_db
        reset_db()

        db = get_db_session()
        try:
            lesson = LessonContent(
                project_name="test-proj",
                knode_id=0,
                status="ready",
                concept="Python是一门很好的编程语言。",
                key_takeaways="- 很好",
            )
            db.add(lesson)
            db.commit()
        finally:
            db.close()

        ctx = self._make_project_context()
        result = _build_node_context(ctx, 0)
        assert "核心概念" in result
        assert "Python是一门很好的编程语言" in result

        reset_db()
