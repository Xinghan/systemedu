"""Pluggable agent execution backends.

Provides an abstract base class and a DeepAgentBackend implementation
that uses the deepagents framework for all agent execution.

Usage:
    backend = create_backend()
    response = await backend.process(messages, system_prompt, tools, tool_executor)
"""

import logging
from abc import ABC, abstractmethod
from collections.abc import AsyncGenerator

from deepagents import create_deep_agent
from langchain_core.messages import AIMessage, SystemMessage, ToolMessage

from .config import get_config
from .llm_client import get_llm

logger = logging.getLogger(__name__)


class AgentBackend(ABC):
    """Abstract base class for agent execution backends."""

    @abstractmethod
    async def process(
        self,
        messages: list,
        system_prompt: str,
        tools: list[dict],
        tool_executor,
        user_id: str = "default",
        memory_context: str = "",
    ) -> str:
        """Process messages and return the final text response."""
        ...

    @abstractmethod
    async def stream(
        self,
        messages: list,
        system_prompt: str,
        tools: list[dict] | None = None,
        tool_executor=None,
        user_id: str = "default",
        memory_context: str = "",
    ) -> AsyncGenerator[dict, None]:
        """Stream structured events with optional tool support.

        Yields dicts with a "type" key:
          {"type": "chunk", "content": "..."}       — text content
          {"type": "tool_call", "name": "...", "args": {...}}  — tool invocation
          {"type": "tool_result", "name": "...", "result": "..."}  — tool result
        """
        ...
        # Make this a proper async generator
        yield {"type": "chunk", "content": ""}  # pragma: no cover


class DeepAgentBackend(AgentBackend):
    """Backend using deepagents framework for agent capabilities."""

    def __init__(self, provider: str | None = None):
        self.provider = provider

    async def process(
        self,
        messages: list,
        system_prompt: str,
        tools: list[dict],
        tool_executor,
        user_id: str = "default",
        memory_context: str = "",
    ) -> str:
        llm = get_llm(provider=self.provider, streaming=False)

        # Convert ToolExecutor custom tools to @tool functions for deepagents
        custom_tools = _convert_tools(tools, tool_executor)

        # Build full system prompt with memory context
        full_prompt = system_prompt
        if memory_context:
            full_prompt += f"\n\n## 相关记忆\n{memory_context}"

        agent = create_deep_agent(
            model=llm,
            tools=custom_tools,
            system_prompt=full_prompt,
        )

        result = await agent.ainvoke({"messages": messages})

        # Extract final text response
        for msg in reversed(result["messages"]):
            if isinstance(msg, AIMessage) and msg.content and not getattr(msg, "tool_calls", None):
                return msg.content

        return "抱歉，我执行了太多步骤。请尝试简化你的请求。"

    async def stream(
        self,
        messages: list,
        system_prompt: str,
        tools: list[dict] | None = None,
        tool_executor=None,
        user_id: str = "default",
        memory_context: str = "",
    ) -> AsyncGenerator[dict, None]:
        llm = get_llm(provider=self.provider, streaming=True)

        full_prompt = system_prompt
        if memory_context:
            full_prompt += f"\n\n## 相关记忆\n{memory_context}"

        # Convert tools if provided
        custom_tools = []
        if tools and tool_executor:
            custom_tools = _convert_tools(tools, tool_executor)

        agent = create_deep_agent(
            model=llm,
            tools=custom_tools or None,
            system_prompt=full_prompt,
        )

        pending_tool_calls: dict[str, str] = {}
        async for event in agent.astream_events({"messages": messages}, version="v2"):
            if event["event"] == "on_chat_model_end":
                output = event["data"].get("output")
                if isinstance(output, AIMessage) and getattr(output, "tool_calls", None):
                    for tc in output.tool_calls:
                        pending_tool_calls[tc["id"]] = tc["name"]
                        yield {
                            "type": "tool_call",
                            "name": tc["name"],
                            "args": tc["args"],
                        }
            elif event["event"] == "on_tool_end":
                output = event["data"].get("output")
                tool_name = event.get("name", "")
                result_content = str(output) if output else ""
                if isinstance(output, ToolMessage):
                    result_content = output.content
                    tc_id = output.tool_call_id
                    if tc_id in pending_tool_calls:
                        tool_name = pending_tool_calls.pop(tc_id)
                yield {
                    "type": "tool_result",
                    "name": tool_name,
                    "result": result_content[:500],
                }
            elif event["event"] == "on_chat_model_stream":
                chunk = event["data"]["chunk"]
                if chunk.content and not getattr(chunk, "tool_calls", None):
                    yield {"type": "chunk", "content": chunk.content}


# --- Tool conversion helpers ---

# Built-in tool names that deepagents already provides equivalents for
_BUILTIN_TOOL_NAMES = {"run_bash", "read_file", "write_file"}


def _convert_tools(tool_schemas: list[dict], tool_executor) -> list:
    """Convert ToolExecutor schemas to LangChain @tool functions for deepagents.

    Skips built-in tools (run_bash, read_file, write_file) since deepagents
    has its own filesystem/execute capabilities.
    """
    from langchain_core.tools import StructuredTool

    converted = []
    for schema in tool_schemas:
        func_info = schema.get("function", {})
        name = func_info.get("name", "")

        # Skip built-in tools — deepagents has equivalents
        if name in _BUILTIN_TOOL_NAMES:
            continue

        description = func_info.get("description", name)

        # Create a wrapper that calls tool_executor.execute
        def _make_handler(tool_name):
            async def handler(**kwargs):
                return await tool_executor.execute(tool_name, kwargs)
            handler.__name__ = tool_name
            handler.__doc__ = description
            return handler

        handler = _make_handler(name)

        tool = StructuredTool.from_function(
            coroutine=handler,
            name=name,
            description=description,
        )
        converted.append(tool)

    return converted


# --- Factory ---


def create_backend(
    backend_type: str | None = None,
    provider: str | None = None,
) -> AgentBackend:
    """Factory: create a DeepAgentBackend instance.

    Args:
        backend_type: Ignored (kept for backward compatibility).
        provider: LLM provider name.
    """
    return DeepAgentBackend(provider=provider)
