"""Tests for the pluggable agent backend system."""

import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from langchain_core.messages import AIMessage, HumanMessage

from systemedu.core.agent_backend import (
    AgentBackend,
    DeepAgentBackend,
    LangGraphBackend,
    create_backend,
    get_default_backend,
    _convert_tools,
)
from systemedu.core.config import (
    LLMConfig,
    LLMProviderConfig,
    SandboxConfig,
    SystemEduConfig,
    reset_config,
)
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
        sandbox=SandboxConfig(enabled=False),
    )
    with patch("systemedu.core.agent_backend.get_config", return_value=config):
        with patch("systemedu.core.runtime.get_config", return_value=config):
            yield config


# --- Factory tests ---


class TestAgentBackendFactory:
    def test_auto_detect_langgraph(self):
        """When deepagents is not installed, should return 'langgraph'."""
        with patch.dict(sys.modules, {"deepagents": None}):
            # Force ImportError by removing from sys.modules
            original = sys.modules.pop("deepagents", None)
            try:
                result = get_default_backend()
                assert result == "langgraph"
            finally:
                if original is not None:
                    sys.modules["deepagents"] = original

    def test_auto_detect_deepagents(self):
        """When deepagents is importable, should return 'deepagents'."""
        mock_module = MagicMock()
        with patch.dict(sys.modules, {"deepagents": mock_module}):
            result = get_default_backend()
            assert result == "deepagents"

    def test_create_langgraph_backend(self):
        """Explicitly creating a langgraph backend."""
        backend = create_backend("langgraph", provider="test")
        assert isinstance(backend, LangGraphBackend)
        assert backend.provider == "test"

    def test_create_deepagent_backend(self):
        """Explicitly creating a deepagents backend."""
        backend = create_backend("deepagents", provider="test")
        assert isinstance(backend, DeepAgentBackend)
        assert backend.provider == "test"

    def test_create_auto_backend_defaults_langgraph(self):
        """'auto' should resolve to langgraph when deepagents is not installed."""
        original = sys.modules.pop("deepagents", None)
        try:
            backend = create_backend("auto", provider="test")
            assert isinstance(backend, LangGraphBackend)
        finally:
            if original is not None:
                sys.modules["deepagents"] = original

    def test_create_none_backend_auto_detects(self):
        """None should auto-detect."""
        original = sys.modules.pop("deepagents", None)
        try:
            backend = create_backend(None, provider="test")
            assert isinstance(backend, LangGraphBackend)
        finally:
            if original is not None:
                sys.modules["deepagents"] = original


# --- LangGraphBackend tests ---


class TestLangGraphBackend:
    @pytest.mark.asyncio
    async def test_process_returns_response(self, mock_config):
        """Simple message should return LLM response."""
        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(return_value=AIMessage(content="Hello!"))
        mock_llm.bind_tools.return_value = mock_llm

        with patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm):
            backend = LangGraphBackend(provider="test")
            result = await backend.process(
                messages=[HumanMessage(content="hi")],
                system_prompt="You are a test bot.",
                tools=[],
                tool_executor=None,
            )
            assert result == "Hello!"

    @pytest.mark.asyncio
    async def test_process_with_tools(self, mock_config):
        """Tool calls should execute and loop back to LLM."""
        tool_call_msg = AIMessage(
            content="",
            tool_calls=[{
                "id": "call_1",
                "name": "run_bash",
                "args": {"command": "echo test"},
            }],
        )
        final_msg = AIMessage(content="Done: test")

        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(side_effect=[tool_call_msg, final_msg])
        mock_llm.bind_tools.return_value = mock_llm

        executor = ToolExecutor()

        with patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm):
            backend = LangGraphBackend(provider="test")
            tools = executor.get_tool_schemas()
            result = await backend.process(
                messages=[HumanMessage(content="run echo")],
                system_prompt="test",
                tools=tools,
                tool_executor=executor,
            )
            assert result == "Done: test"
            assert mock_llm.ainvoke.call_count == 2

    @pytest.mark.asyncio
    async def test_process_max_iterations(self, mock_config):
        """Should stop after MAX_ITERATIONS tool call loops."""
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

        executor = ToolExecutor()

        with patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm):
            backend = LangGraphBackend(provider="test")
            result = await backend.process(
                messages=[HumanMessage(content="loop")],
                system_prompt="test",
                tools=executor.get_tool_schemas(),
                tool_executor=executor,
            )
            assert "抱歉" in result

    @pytest.mark.asyncio
    async def test_stream_yields_chunks(self, mock_config):
        """Stream should yield content chunks."""
        chunk1 = MagicMock()
        chunk1.content = "Hello"
        chunk2 = MagicMock()
        chunk2.content = " World"

        mock_llm = MagicMock()
        mock_llm.astream = AsyncMock()

        async def fake_stream(*args, **kwargs):
            yield chunk1
            yield chunk2

        mock_llm.astream = fake_stream

        with patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm):
            backend = LangGraphBackend(provider="test")
            chunks = []
            async for c in backend.stream([HumanMessage(content="hi")], "test prompt"):
                chunks.append(c)
            assert chunks == ["Hello", " World"]

    @pytest.mark.asyncio
    async def test_memory_context_appended_to_prompt(self, mock_config):
        """Memory context should be appended to system prompt in agent_node."""
        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(return_value=AIMessage(content="with memory"))
        mock_llm.bind_tools.return_value = mock_llm

        with patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm):
            backend = LangGraphBackend(provider="test")
            result = await backend.process(
                messages=[HumanMessage(content="hi")],
                system_prompt="Base prompt",
                tools=[],
                tool_executor=None,
                memory_context="- Previous fact",
            )
            assert result == "with memory"

            # Verify the system prompt included memory context
            call_args = mock_llm.ainvoke.call_args[0][0]
            system_msg = call_args[0]
            assert "相关记忆" in system_msg.content
            assert "Previous fact" in system_msg.content


# --- DeepAgentBackend tests ---


class TestDeepAgentBackend:
    @pytest.fixture(autouse=True)
    def mock_deepagents_module(self):
        """Ensure deepagents module is mockable for all DeepAgent tests."""
        mock_module = MagicMock()
        with patch.dict(sys.modules, {"deepagents": mock_module}):
            yield mock_module

    @pytest.mark.asyncio
    async def test_process_calls_create_deep_agent(self, mock_config, mock_deepagents_module):
        """Should call create_deep_agent with correct params."""
        mock_result = {
            "messages": [AIMessage(content="Deep agent response")]
        }
        mock_agent = MagicMock()
        mock_agent.ainvoke = AsyncMock(return_value=mock_result)
        mock_deepagents_module.create_deep_agent.return_value = mock_agent

        mock_llm = MagicMock()

        with patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm):
            backend = DeepAgentBackend(provider="test")
            result = await backend.process(
                messages=[HumanMessage(content="hello")],
                system_prompt="Test prompt",
                tools=[],
                tool_executor=MagicMock(),
            )

            assert result == "Deep agent response"
            mock_deepagents_module.create_deep_agent.assert_called_once()
            call_kwargs = mock_deepagents_module.create_deep_agent.call_args[1]
            assert call_kwargs["model"] is mock_llm
            assert call_kwargs["system_prompt"] == "Test prompt"

    @pytest.mark.asyncio
    async def test_system_prompt_with_memory_context(self, mock_config, mock_deepagents_module):
        """Memory context should be appended to system prompt."""
        mock_result = {
            "messages": [AIMessage(content="ok")]
        }
        mock_agent = MagicMock()
        mock_agent.ainvoke = AsyncMock(return_value=mock_result)
        mock_deepagents_module.create_deep_agent.return_value = mock_agent

        mock_llm = MagicMock()

        with patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm):
            backend = DeepAgentBackend(provider="test")
            await backend.process(
                messages=[HumanMessage(content="hi")],
                system_prompt="Base",
                tools=[],
                tool_executor=MagicMock(),
                memory_context="- remembered fact",
            )

            call_kwargs = mock_deepagents_module.create_deep_agent.call_args[1]
            assert "相关记忆" in call_kwargs["system_prompt"]
            assert "remembered fact" in call_kwargs["system_prompt"]

    @pytest.mark.asyncio
    async def test_custom_tools_converted(self, mock_config, mock_deepagents_module):
        """Custom tools from ToolExecutor should be converted for deepagents."""
        mock_result = {
            "messages": [AIMessage(content="ok")]
        }
        mock_agent = MagicMock()
        mock_agent.ainvoke = AsyncMock(return_value=mock_result)
        mock_deepagents_module.create_deep_agent.return_value = mock_agent

        mock_llm = MagicMock()

        # Create a ToolExecutor with a custom tool
        executor = ToolExecutor(sandbox_config=SandboxConfig(enabled=False))
        custom_schema = {
            "type": "function",
            "function": {
                "name": "get_progress",
                "description": "Get progress",
                "parameters": {"type": "object", "properties": {}},
            },
        }
        executor.register_tool("get_progress", AsyncMock(return_value="50%"), custom_schema)

        with patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm):
            backend = DeepAgentBackend(provider="test")
            await backend.process(
                messages=[HumanMessage(content="progress")],
                system_prompt="test",
                tools=executor.get_tool_schemas(),
                tool_executor=executor,
            )

            call_kwargs = mock_deepagents_module.create_deep_agent.call_args[1]
            tool_names = [t.name for t in call_kwargs["tools"]]
            # Custom tool should be present
            assert "get_progress" in tool_names
            # Built-in tools should be excluded (deepagents has its own)
            assert "run_bash" not in tool_names
            assert "read_file" not in tool_names
            assert "write_file" not in tool_names

    @pytest.mark.asyncio
    async def test_fallback_on_no_response(self, mock_config, mock_deepagents_module):
        """Should return fallback message when no valid AIMessage found."""
        mock_result = {
            "messages": []  # No messages
        }
        mock_agent = MagicMock()
        mock_agent.ainvoke = AsyncMock(return_value=mock_result)
        mock_deepagents_module.create_deep_agent.return_value = mock_agent

        mock_llm = MagicMock()

        with patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm):
            backend = DeepAgentBackend(provider="test")
            result = await backend.process(
                messages=[HumanMessage(content="hi")],
                system_prompt="test",
                tools=[],
                tool_executor=MagicMock(),
            )
            assert "抱歉" in result


# --- Tool conversion tests ---


class TestConvertTools:
    def test_builtin_tools_excluded(self):
        """Built-in tools should not be converted."""
        from systemedu.core.tool_executor import BUILTIN_TOOLS

        executor = ToolExecutor()
        converted = _convert_tools(BUILTIN_TOOLS, executor)
        assert len(converted) == 0

    def test_custom_tools_converted(self):
        """Custom tools should be converted to StructuredTool."""
        executor = ToolExecutor()
        executor.register_tool("my_tool", AsyncMock(return_value="result"))

        schemas = [
            {
                "type": "function",
                "function": {
                    "name": "my_tool",
                    "description": "A custom tool",
                    "parameters": {"type": "object", "properties": {}},
                },
            }
        ]
        converted = _convert_tools(schemas, executor)
        assert len(converted) == 1
        assert converted[0].name == "my_tool"


# --- Runtime with Backend tests ---


class TestRuntimeWithBackend:
    @pytest.mark.asyncio
    async def test_runtime_default_backend(self, mock_config):
        """Runtime without explicit backend should use auto-detect."""
        from systemedu.core.runtime import AgentRuntime

        with patch("systemedu.core.runtime.get_config", return_value=mock_config):
            runtime = AgentRuntime(provider="test")
            # Without deepagents installed, should be LangGraphBackend
            assert isinstance(runtime._backend, LangGraphBackend)

    @pytest.mark.asyncio
    async def test_runtime_explicit_langgraph(self, mock_config):
        """Explicitly setting backend='langgraph'."""
        from systemedu.core.runtime import AgentRuntime

        with patch("systemedu.core.runtime.get_config", return_value=mock_config):
            runtime = AgentRuntime(provider="test", backend="langgraph")
            assert isinstance(runtime._backend, LangGraphBackend)

    @pytest.mark.asyncio
    async def test_runtime_explicit_deepagents(self, mock_config):
        """Explicitly setting backend='deepagents'."""
        from systemedu.core.runtime import AgentRuntime

        with patch("systemedu.core.runtime.get_config", return_value=mock_config):
            runtime = AgentRuntime(provider="test", backend="deepagents")
            assert isinstance(runtime._backend, DeepAgentBackend)

    @pytest.mark.asyncio
    async def test_runtime_process_uses_backend(self, mock_config):
        """process_message should delegate to backend.process."""
        from systemedu.core.runtime import AgentRuntime

        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(return_value=AIMessage(content="Backend response"))
        mock_llm.bind_tools.return_value = mock_llm

        with (
            patch("systemedu.core.runtime.get_config", return_value=mock_config),
            patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm),
        ):
            runtime = AgentRuntime(provider="test", tools_enabled=False, backend="langgraph")
            session = runtime.session_manager.create_session()
            response = await runtime.process_message("hi", session)

            assert response == "Backend response"

    @pytest.mark.asyncio
    async def test_education_tools_work_with_langgraph(self, mock_config):
        """Education tools (complete_node, get_progress) should work with LangGraph backend."""
        from pathlib import Path

        from systemedu.core.runtime import AgentRuntime
        from systemedu.education.models import (
            KnowledgeNode,
            KnowledgeTree,
            Milestone,
            NodeStatus,
            Project,
            UserNodeProgress,
        )
        from systemedu.education.project_loader import ProjectContext

        ctx = ProjectContext(
            project=Project(name="test", title="Test", description="Test project"),
            tree=KnowledgeTree(milestones=[
                Milestone(title="M1", knodes=[
                    KnowledgeNode(title="Node A", summary="First"),
                ]),
            ]),
            progress=[UserNodeProgress(knode_id=0, status=NodeStatus.AVAILABLE)],
            project_dir=Path("/tmp/test"),
        )

        with patch("systemedu.core.runtime.get_config", return_value=mock_config):
            runtime = AgentRuntime(
                provider="test",
                project_context=ctx,
                backend="langgraph",
            )
            # Education tools should be registered
            schemas = runtime.tool_executor.get_tool_schemas()
            tool_names = [s["function"]["name"] for s in schemas]
            assert "complete_node" in tool_names
            assert "get_progress" in tool_names
