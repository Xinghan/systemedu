"""Tests for agent runtime."""

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


class TestAgentRuntime:
    @pytest.mark.asyncio
    async def test_process_message(self, mock_config):
        mock_llm = MagicMock()
        mock_llm.invoke.return_value = AIMessage(content="Hello! 我是小龟老师。")
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
        mock_llm.invoke.side_effect = [tool_call_response, final_response]
        mock_llm.bind_tools.return_value = mock_llm

        with patch("systemedu.core.runtime.get_llm", return_value=mock_llm):
            runtime = AgentRuntime(provider="test")
            session = runtime.session_manager.create_session()
            response = await runtime.process_message("运行 echo hello", session)

            assert "hello" in response.lower() or "命令" in response
