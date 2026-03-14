"""Agent runtime - the core loop that processes messages through LLM."""

import json
import logging

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from .config import get_config
from .llm_client import get_llm
from .session import Message, Session, SessionManager
from .tool_executor import ToolExecutor

logger = logging.getLogger(__name__)

DEFAULT_SYSTEM_PROMPT = """你是 SystemEdu 的 AI 助手，一个智能教育与通用 Agent 平台。
你可以帮助用户学习知识、执行任务、编写代码、分析问题。
你有以下工具可以使用，在需要时调用它们来帮助用户。
用中文回答用户的问题。"""


class AgentRuntime:
    """Core agent runtime that handles message → LLM → tool calls → response loop."""

    def __init__(
        self,
        provider: str | None = None,
        system_prompt: str | None = None,
        tools_enabled: bool = True,
    ):
        self.provider = provider
        self.system_prompt = system_prompt or DEFAULT_SYSTEM_PROMPT
        self.session_manager = SessionManager()
        self.tool_executor = ToolExecutor(
            sandbox_config=get_config().sandbox if tools_enabled else None
        )
        self.tools_enabled = tools_enabled

    async def process_message(
        self,
        user_message: str,
        session: Session | None = None,
    ) -> str:
        """Process a user message and return the assistant's response.

        Handles the full loop: user msg → LLM → tool calls → LLM → response.
        """
        if session is None:
            session = self.session_manager.create_session()

        session.add_message("user", user_message)

        llm = get_llm(provider=self.provider, streaming=False)

        # Build messages for LLM
        messages = [SystemMessage(content=self.system_prompt)]
        for msg in session.messages:
            if msg.role == "user":
                messages.append(HumanMessage(content=msg.content))
            elif msg.role == "assistant":
                messages.append(AIMessage(content=msg.content))

        # Bind tools if enabled
        tools = self.tool_executor.get_tool_schemas() if self.tools_enabled else []
        if tools:
            llm_with_tools = llm.bind_tools(tools)
        else:
            llm_with_tools = llm

        # Agent loop: call LLM, execute tool calls, repeat
        max_iterations = 10
        for _ in range(max_iterations):
            response = llm_with_tools.invoke(messages)

            if not response.tool_calls:
                # No tool calls - final response
                content = response.content or ""
                session.add_message("assistant", content)
                return content

            # Process tool calls
            messages.append(response)

            for tool_call in response.tool_calls:
                tool_name = tool_call["name"]
                tool_args = tool_call["args"]
                logger.info(f"Calling tool: {tool_name}({tool_args})")

                result = await self.tool_executor.execute(tool_name, tool_args)
                logger.info(f"Tool result: {result[:200]}...")

                # Add tool result to messages
                from langchain_core.messages import ToolMessage

                messages.append(
                    ToolMessage(content=result, tool_call_id=tool_call["id"])
                )

        # If we hit max iterations, return the last response
        final = "抱歉，我执行了太多步骤。请尝试简化你的请求。"
        session.add_message("assistant", final)
        return final

    async def stream_message(
        self,
        user_message: str,
        session: Session | None = None,
    ):
        """Process a message with streaming output.

        Yields chunks of the response as they arrive.
        """
        if session is None:
            session = self.session_manager.create_session()

        session.add_message("user", user_message)

        llm = get_llm(provider=self.provider, streaming=True)

        messages = [SystemMessage(content=self.system_prompt)]
        for msg in session.messages[:-1]:  # Exclude the message we just added
            if msg.role == "user":
                messages.append(HumanMessage(content=msg.content))
            elif msg.role == "assistant":
                messages.append(AIMessage(content=msg.content))
        messages.append(HumanMessage(content=user_message))

        full_response = ""
        async for chunk in llm.astream(messages):
            if chunk.content:
                full_response += chunk.content
                yield chunk.content

        session.add_message("assistant", full_response)
