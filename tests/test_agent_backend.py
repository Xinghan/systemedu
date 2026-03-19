"""Tests for the DeepAgentBackend and factory."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from langchain_core.messages import AIMessage, HumanMessage

from systemedu.core.agent_backend import (
    AgentBackend,
    DeepAgentBackend,
    _convert_tools,
    create_backend,
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


def _make_mock_agent(response_text: str):
    """Create a mock deep agent that returns a given response text."""
    mock_agent = MagicMock()
    mock_agent.ainvoke = AsyncMock(return_value={
        "messages": [AIMessage(content=response_text)]
    })
    return mock_agent


# --- Factory tests ---


class TestCreateBackend:
    def test_create_backend_returns_deepagent(self):
        """create_backend() always returns DeepAgentBackend."""
        backend = create_backend()
        assert isinstance(backend, DeepAgentBackend)

    def test_create_backend_with_provider(self):
        """Provider is passed through."""
        backend = create_backend(provider="my_provider")
        assert isinstance(backend, DeepAgentBackend)
        assert backend.provider == "my_provider"

    def test_create_backend_ignores_backend_type(self):
        """backend_type parameter is ignored (kept for backward compat)."""
        backend = create_backend(backend_type="langgraph", provider="test")
        assert isinstance(backend, DeepAgentBackend)

    def test_create_backend_none_args(self):
        """None args produce a valid backend."""
        backend = create_backend(None, None)
        assert isinstance(backend, DeepAgentBackend)
        assert backend.provider is None


# --- DeepAgentBackend.process tests ---


class TestDeepAgentBackendProcess:
    @pytest.mark.asyncio
    async def test_process_returns_response(self, mock_config):
        """process() returns the AI message content."""
        mock_agent = _make_mock_agent("Hello from DeepAgent!")
        mock_llm = MagicMock()

        with (
            patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm),
            patch("systemedu.core.agent_backend.create_deep_agent", return_value=mock_agent),
        ):
            backend = DeepAgentBackend(provider="test")
            result = await backend.process(
                messages=[HumanMessage(content="hi")],
                system_prompt="You are a helpful bot.",
                tools=[],
                tool_executor=MagicMock(),
            )
            assert result == "Hello from DeepAgent!"

    @pytest.mark.asyncio
    async def test_process_memory_context_appended(self, mock_config):
        """Memory context should be appended to system_prompt passed to create_deep_agent."""
        mock_agent = _make_mock_agent("ok")
        mock_llm = MagicMock()

        with (
            patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm),
            patch("systemedu.core.agent_backend.create_deep_agent", return_value=mock_agent) as mock_create,
        ):
            backend = DeepAgentBackend(provider="test")
            await backend.process(
                messages=[HumanMessage(content="hi")],
                system_prompt="Base prompt",
                tools=[],
                tool_executor=MagicMock(),
                memory_context="- important memory",
            )
            call_kwargs = mock_create.call_args[1]
            assert "相关记忆" in call_kwargs["system_prompt"]
            assert "important memory" in call_kwargs["system_prompt"]

    @pytest.mark.asyncio
    async def test_process_no_memory_context(self, mock_config):
        """Without memory context, system_prompt is passed as-is."""
        mock_agent = _make_mock_agent("ok")
        mock_llm = MagicMock()

        with (
            patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm),
            patch("systemedu.core.agent_backend.create_deep_agent", return_value=mock_agent) as mock_create,
        ):
            backend = DeepAgentBackend(provider="test")
            await backend.process(
                messages=[HumanMessage(content="hi")],
                system_prompt="Clean prompt",
                tools=[],
                tool_executor=MagicMock(),
            )
            call_kwargs = mock_create.call_args[1]
            assert call_kwargs["system_prompt"] == "Clean prompt"

    @pytest.mark.asyncio
    async def test_process_fallback_on_empty_messages(self, mock_config):
        """Should return fallback text when result has no AIMessage."""
        mock_agent = MagicMock()
        mock_agent.ainvoke = AsyncMock(return_value={"messages": []})
        mock_llm = MagicMock()

        with (
            patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm),
            patch("systemedu.core.agent_backend.create_deep_agent", return_value=mock_agent),
        ):
            backend = DeepAgentBackend(provider="test")
            result = await backend.process(
                messages=[HumanMessage(content="hi")],
                system_prompt="test",
                tools=[],
                tool_executor=MagicMock(),
            )
            assert "抱歉" in result

    @pytest.mark.asyncio
    async def test_process_passes_llm_to_create_deep_agent(self, mock_config):
        """The LLM from get_llm() is passed as model= to create_deep_agent."""
        mock_agent = _make_mock_agent("ok")
        mock_llm = MagicMock()

        with (
            patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm),
            patch("systemedu.core.agent_backend.create_deep_agent", return_value=mock_agent) as mock_create,
        ):
            backend = DeepAgentBackend(provider="test")
            await backend.process(
                messages=[HumanMessage(content="hi")],
                system_prompt="test",
                tools=[],
                tool_executor=MagicMock(),
            )
            call_kwargs = mock_create.call_args[1]
            assert call_kwargs["model"] is mock_llm


# --- DeepAgentBackend.stream tests ---


async def _async_iter(items):
    for item in items:
        yield item


class TestDeepAgentBackendStream:
    @pytest.mark.asyncio
    async def test_stream_yields_text_chunks(self, mock_config):
        """Stream should yield chunk events from on_chat_model_stream."""
        chunk1 = MagicMock()
        chunk1.content = "Hello"
        chunk1.tool_calls = []

        chunk2 = MagicMock()
        chunk2.content = " World"
        chunk2.tool_calls = []

        events = [
            {"event": "on_chat_model_stream", "data": {"chunk": chunk1}},
            {"event": "on_chat_model_stream", "data": {"chunk": chunk2}},
        ]

        mock_agent = MagicMock()
        mock_agent.astream_events = MagicMock(return_value=_async_iter(events))
        mock_llm = MagicMock()

        with (
            patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm),
            patch("systemedu.core.agent_backend.create_deep_agent", return_value=mock_agent),
        ):
            backend = DeepAgentBackend(provider="test")
            results = []
            async for event in backend.stream([HumanMessage(content="hi")], "test prompt"):
                results.append(event)

            assert results == [
                {"type": "chunk", "content": "Hello"},
                {"type": "chunk", "content": " World"},
            ]

    @pytest.mark.asyncio
    async def test_stream_yields_tool_call_event(self, mock_config):
        """Stream should yield tool_call events from on_chat_model_end."""
        ai_msg = AIMessage(
            content="",
            tool_calls=[{"id": "tc1", "name": "my_tool", "args": {"x": 1}}],
        )
        events = [
            {"event": "on_chat_model_end", "data": {"output": ai_msg}},
        ]

        mock_agent = MagicMock()
        mock_agent.astream_events = MagicMock(return_value=_async_iter(events))
        mock_llm = MagicMock()

        with (
            patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm),
            patch("systemedu.core.agent_backend.create_deep_agent", return_value=mock_agent),
        ):
            backend = DeepAgentBackend(provider="test")
            results = []
            async for event in backend.stream([HumanMessage(content="hi")], "test prompt"):
                results.append(event)

            assert len(results) == 1
            assert results[0]["type"] == "tool_call"
            assert results[0]["name"] == "my_tool"

    @pytest.mark.asyncio
    async def test_stream_skips_empty_chunks(self, mock_config):
        """Chunks with no content should not be yielded."""
        empty_chunk = MagicMock()
        empty_chunk.content = ""
        empty_chunk.tool_calls = []

        events = [
            {"event": "on_chat_model_stream", "data": {"chunk": empty_chunk}},
        ]

        mock_agent = MagicMock()
        mock_agent.astream_events = MagicMock(return_value=_async_iter(events))
        mock_llm = MagicMock()

        with (
            patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm),
            patch("systemedu.core.agent_backend.create_deep_agent", return_value=mock_agent),
        ):
            backend = DeepAgentBackend(provider="test")
            results = []
            async for event in backend.stream([HumanMessage(content="hi")], "test"):
                results.append(event)

            assert results == []


# --- Tool conversion tests ---


class TestConvertTools:
    def test_builtin_tools_excluded(self):
        """Built-in tools (run_bash, read_file, write_file) should not be converted."""
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

    def test_empty_schemas(self):
        """Empty schema list returns empty list."""
        executor = ToolExecutor()
        assert _convert_tools([], executor) == []


# --- Runtime integration tests ---


class TestRuntimeWithBackend:
    @pytest.mark.asyncio
    async def test_runtime_uses_deepagent_backend(self, mock_config):
        """Runtime should always use DeepAgentBackend."""
        from systemedu.core.runtime import AgentRuntime

        with patch("systemedu.core.runtime.get_config", return_value=mock_config):
            runtime = AgentRuntime(provider="test")
            assert isinstance(runtime._backend, DeepAgentBackend)

    @pytest.mark.asyncio
    async def test_runtime_process_uses_backend(self, mock_config):
        """process_message should delegate to backend.process."""
        from systemedu.core.runtime import AgentRuntime

        mock_agent = _make_mock_agent("Backend response")
        mock_llm = MagicMock()

        with (
            patch("systemedu.core.runtime.get_config", return_value=mock_config),
            patch("systemedu.core.agent_backend.get_llm", return_value=mock_llm),
            patch("systemedu.core.agent_backend.create_deep_agent", return_value=mock_agent),
        ):
            runtime = AgentRuntime(provider="test", tools_enabled=False)
            session = runtime.session_manager.create_session()
            response = await runtime.process_message("hi", session)

            assert response == "Backend response"

    @pytest.mark.asyncio
    async def test_education_tools_registered(self, mock_config):
        """Education tools (complete_node, get_progress) should be registered."""
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
            )
            schemas = runtime.tool_executor.get_tool_schemas()
            tool_names = [s["function"]["name"] for s in schemas]
            assert "complete_node" in tool_names
            assert "get_progress" in tool_names
