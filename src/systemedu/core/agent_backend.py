"""Pluggable agent execution backends.

Provides an abstract base class and two implementations:
- LangGraphBackend: the original hand-built LangGraph state machine (default)
- DeepAgentBackend: uses deepagents framework for planning/subagent capabilities

Usage:
    backend = create_backend()  # auto-detect
    response = await backend.process(messages, system_prompt, tools, tool_executor)
"""

import logging
from abc import ABC, abstractmethod
from collections.abc import AsyncGenerator

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from typing_extensions import Annotated, TypedDict

from .config import get_config
from .llm_client import get_llm

logger = logging.getLogger(__name__)

# Max tool-call iterations before stopping
MAX_ITERATIONS = 10


class AgentState(TypedDict):
    """State schema for the LangGraph agent."""

    messages: Annotated[list, add_messages]
    user_id: str
    session_id: str
    memory_context: str
    iteration_count: int


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
    ) -> AsyncGenerator[str, None]:
        """Stream response chunks."""
        ...
        # Make this a proper async generator
        yield ""  # pragma: no cover


class LangGraphBackend(AgentBackend):
    """Backend using a hand-built LangGraph state machine.

    Implements: retrieve_memory → agent → (execute_tools → agent)* → store_memory → END.
    Memory retrieve/store is handled externally by AgentRuntime, so this backend
    only deals with the agent ↔ tool loop.
    """

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
        graph = self._build_graph(system_prompt, tools, tool_executor, memory_context)

        initial_state: AgentState = {
            "messages": messages,
            "user_id": user_id,
            "session_id": "",
            "memory_context": memory_context,
            "iteration_count": 0,
        }

        result = await graph.ainvoke(initial_state)

        # Extract final AI response
        for msg in reversed(result["messages"]):
            if isinstance(msg, AIMessage) and msg.content and not msg.tool_calls:
                return msg.content

        return "抱歉，我执行了太多步骤。请尝试简化你的请求。"

    async def stream(
        self,
        messages: list,
        system_prompt: str,
    ) -> AsyncGenerator[str, None]:
        llm = get_llm(provider=self.provider, streaming=True)
        lc_messages = [SystemMessage(content=system_prompt)] + list(messages)

        async for chunk in llm.astream(lc_messages):
            if chunk.content:
                yield chunk.content

    def _build_graph(self, system_prompt, tools, tool_executor, memory_context):
        """Build the LangGraph state machine for agent ↔ tool loop."""
        provider = self.provider

        async def agent_node(state: AgentState) -> dict:
            llm = get_llm(provider=provider, streaming=False)
            if tools:
                llm = llm.bind_tools(tools)

            sys_prompt = system_prompt
            mem_ctx = state.get("memory_context") or memory_context
            if mem_ctx:
                sys_prompt += f"\n\n## 相关记忆\n{mem_ctx}"

            msgs = [SystemMessage(content=sys_prompt)] + list(state["messages"])
            response = await llm.ainvoke(msgs)
            return {
                "messages": [response],
                "iteration_count": state.get("iteration_count", 0) + 1,
            }

        async def execute_tools(state: AgentState) -> dict:
            last_msg = state["messages"][-1]
            tool_messages = []
            for tool_call in last_msg.tool_calls:
                tool_name = tool_call["name"]
                tool_args = tool_call["args"]
                logger.info(f"Calling tool: {tool_name}({tool_args})")
                result = await tool_executor.execute(tool_name, tool_args)
                logger.info(f"Tool result: {result[:200]}...")
                tool_messages.append(
                    ToolMessage(content=result, tool_call_id=tool_call["id"])
                )
            return {"messages": tool_messages}

        def should_continue(state: AgentState) -> str:
            last_msg = state["messages"][-1]
            if (
                isinstance(last_msg, AIMessage)
                and last_msg.tool_calls
                and state.get("iteration_count", 0) < MAX_ITERATIONS
            ):
                return "execute_tools"
            return END

        graph = StateGraph(AgentState)
        graph.add_node("agent", agent_node)
        graph.add_node("execute_tools", execute_tools)

        graph.add_edge(START, "agent")
        graph.add_conditional_edges("agent", should_continue)
        graph.add_edge("execute_tools", "agent")

        return graph.compile()


class DeepAgentBackend(AgentBackend):
    """Backend using deepagents framework for advanced agent capabilities.

    Requires: pip install deepagents>=0.4.11
    """

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
        from deepagents import create_deep_agent

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
    ) -> AsyncGenerator[str, None]:
        from deepagents import create_deep_agent

        llm = get_llm(provider=self.provider, streaming=True)
        agent = create_deep_agent(model=llm, system_prompt=system_prompt)

        async for event in agent.astream_events({"messages": messages}, version="v2"):
            if event["event"] == "on_chat_model_stream":
                chunk = event["data"]["chunk"]
                if chunk.content:
                    yield chunk.content


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

        params = func_info.get("parameters", {})
        description = func_info.get("description", name)

        # Create a wrapper that calls tool_executor.execute
        def _make_handler(tool_name):
            async def handler(**kwargs):
                return await tool_executor.execute(tool_name, kwargs)
            handler.__name__ = tool_name
            handler.__doc__ = description
            return handler

        handler = _make_handler(name)

        # Build args_schema from parameters if possible
        tool = StructuredTool.from_function(
            coroutine=handler,
            name=name,
            description=description,
        )
        converted.append(tool)

    return converted


# --- Factory ---


def get_default_backend() -> str:
    """Auto-detect: return 'deepagents' if installed, else 'langgraph'."""
    try:
        import deepagents  # noqa: F401

        return "deepagents"
    except ImportError:
        return "langgraph"


def create_backend(
    backend_type: str | None = None,
    provider: str | None = None,
) -> AgentBackend:
    """Factory: create the appropriate backend instance.

    Args:
        backend_type: "deepagents", "langgraph", or None (auto-detect).
        provider: LLM provider name.
    """
    bt = backend_type or get_default_backend()
    if bt == "auto":
        bt = get_default_backend()

    if bt == "deepagents":
        return DeepAgentBackend(provider=provider)
    else:
        return LangGraphBackend(provider=provider)
