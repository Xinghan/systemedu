"""Agent runtime - the core loop that processes messages through LLM."""

import logging
from pathlib import Path

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from typing_extensions import Annotated, TypedDict

from .config import SYSTEMEDU_HOME, get_config
from .llm_client import get_llm
from .session import Session, SessionManager
from .tool_executor import ToolExecutor

logger = logging.getLogger(__name__)

DEFAULT_SYSTEM_PROMPT = """你是 SystemEdu 的 AI 助手，一个智能教育与通用 Agent 平台。
你可以帮助用户学习知识、执行任务、编写代码、分析问题。
你有以下工具可以使用，在需要时调用它们来帮助用户。
用中文回答用户的问题。"""


class AgentState(TypedDict):
    """State schema for the LangGraph agent."""

    messages: Annotated[list, add_messages]
    user_id: str
    session_id: str
    memory_context: str
    iteration_count: int


def _build_system_prompt(
    base_prompt: str,
    skill_names: list[str] | None = None,
    project_context=None,
) -> str:
    """Build system prompt with optional skill and project context injection."""
    parts = [base_prompt]

    if skill_names:
        from systemedu.skills.loader import SkillLoader

        loader = SkillLoader()
        loader.load_builtin()

        # Also try loading user-level skills
        user_skills_dir = SYSTEMEDU_HOME / "skills"
        if user_skills_dir.exists():
            loader.load_directory(user_skills_dir, priority=1)

        for name in skill_names:
            skill = loader.get_skill(name)
            if skill and skill.content:
                parts.append(f"\n\n## Skill: {skill.name}\n\n{skill.content}")

    if project_context is not None:
        parts.append(_build_project_prompt_section(project_context))

    return "".join(parts)


def _build_project_prompt_section(project_context) -> str:
    """Build the project context section for the system prompt."""
    ctx = project_context
    section = f"\n\n## 当前项目: {ctx.project.title}\n"
    section += f"项目描述: {ctx.project.description}\n"

    current = ctx.current_node()
    if current:
        idx, node = current
        section += f"\n## 当前学习节点 (ID: {idx})\n"
        section += f"标题: {node.title}\n"
        section += f"简介: {node.summary}\n"
        section += f"难度: {node.difficulty_level}/10\n"
        section += f"内容类型: {node.content_type.value}\n"
        section += f"验收方式: {node.acceptance_type.value}\n"

    available = ctx.available_nodes()
    if available:
        section += "\n## 可用节点列表\n"
        for i, node in available:
            status_icon = "→" if current and i == current[0] else " "
            section += f"{status_icon} [{i}] {node.title} (难度 {node.difficulty_level})\n"

    section += (
        "\n你可以使用 complete_node 工具标记节点完成，"
        "使用 get_progress 工具查看学习进度。\n"
    )
    return section


class AgentRuntime:
    """Core agent runtime that handles message → LLM → tool calls → response loop."""

    def __init__(
        self,
        provider: str | None = None,
        system_prompt: str | None = None,
        tools_enabled: bool = True,
        skill_names: list[str] | None = None,
        mcp_manager=None,
        project_context=None,
    ):
        self.provider = provider
        self._project_context = project_context
        base_prompt = system_prompt or DEFAULT_SYSTEM_PROMPT
        self.system_prompt = _build_system_prompt(
            base_prompt, skill_names, project_context
        )
        self.session_manager = SessionManager()
        self.tool_executor = ToolExecutor(
            sandbox_config=get_config().sandbox if tools_enabled else None
        )
        self.tools_enabled = tools_enabled
        self._mcp_manager = mcp_manager
        self._mcp_setup_done = False
        self._graph = None

        if project_context is not None:
            self._register_education_tools(project_context)

    def _register_education_tools(self, project_context):
        """Register complete_node and get_progress tools for education mode."""
        runtime = self

        async def complete_node(node_id: int) -> str:
            """Mark a knowledge node as completed and unlock next nodes."""
            from datetime import datetime

            from systemedu.education.models import NodeStatus
            from systemedu.education.progress import unlock_next_nodes
            from systemedu.education.project_loader import save_progress

            ctx = runtime._project_context
            progress = ctx.get_node_progress(node_id)
            if progress is None:
                return f"错误: 节点 {node_id} 不存在"
            if progress.status == NodeStatus.LOCKED:
                return f"错误: 节点 {node_id} 尚未解锁，无法完成"
            if progress.status == NodeStatus.PASSED:
                return f"节点 {node_id} 已经完成过了"

            # Mark as passed
            progress.status = NodeStatus.PASSED
            progress.passed_at = datetime.now()
            progress.attempts += 1

            # Unlock next nodes
            unlocked = unlock_next_nodes(ctx.tree, ctx.progress, node_id)

            # Persist
            save_progress("default", ctx.project.name, ctx.progress)

            # Rebuild system prompt
            runtime.system_prompt = _build_system_prompt(
                DEFAULT_SYSTEM_PROMPT,
                project_context=ctx,
            )
            runtime._graph = None  # Force graph rebuild

            node = ctx.get_node_by_id(node_id)
            title = node.title if node else f"#{node_id}"
            result = f"节点 [{node_id}] '{title}' 已完成！"
            if unlocked:
                names = []
                for uid in unlocked:
                    n = ctx.get_node_by_id(uid)
                    names.append(f"[{uid}] {n.title}" if n else f"[{uid}]")
                result += f"\n新解锁的节点: {', '.join(names)}"
            return result

        async def get_progress() -> str:
            """Get current learning progress."""
            ctx = runtime._project_context
            nodes = ctx.all_nodes_flat()
            lines = [f"项目: {ctx.project.title}", ""]
            passed = 0
            for p in ctx.progress:
                node = ctx.get_node_by_id(p.knode_id)
                title = node.title if node else f"#{p.knode_id}"
                status_icon = {
                    "locked": "🔒",
                    "available": "📖",
                    "in_progress": "⏳",
                    "passed": "✅",
                    "submitted": "📤",
                    "failed": "❌",
                }.get(p.status.value, "?")
                lines.append(f"{status_icon} [{p.knode_id}] {title} — {p.status.value}")
                if p.status.value == "passed":
                    passed += 1
            total = len(ctx.progress)
            lines.append(f"\n进度: {passed}/{total} ({100*passed//total if total else 0}%)")
            return "\n".join(lines)

        # Register complete_node
        complete_schema = {
            "type": "function",
            "function": {
                "name": "complete_node",
                "description": "标记一个学习节点为已完成，并自动解锁后续节点",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "node_id": {
                            "type": "integer",
                            "description": "要完成的节点 ID",
                        },
                    },
                    "required": ["node_id"],
                },
            },
        }
        self.tool_executor.register_tool("complete_node", complete_node, complete_schema)

        # Register get_progress
        progress_schema = {
            "type": "function",
            "function": {
                "name": "get_progress",
                "description": "查看当前项目的学习进度",
                "parameters": {
                    "type": "object",
                    "properties": {},
                },
            },
        }
        self.tool_executor.register_tool("get_progress", get_progress, progress_schema)

    async def _setup_mcp_tools(self):
        """Lazy setup: discover MCP tools and register them in ToolExecutor."""
        if self._mcp_setup_done or not self._mcp_manager:
            return
        self._mcp_setup_done = True

        mcp_tools = self._mcp_manager.list_tools()
        for tool_schema in mcp_tools:
            tool_name = tool_schema["function"]["name"]

            async def _make_handler(name):
                async def handler(**kwargs):
                    return await self._mcp_manager.call_tool(name, kwargs)
                return handler

            handler = await _make_handler(tool_name)
            self.tool_executor.register_tool(tool_name, handler, tool_schema)

    def _build_graph(self):
        """Build the LangGraph state machine."""
        runtime = self  # capture for closures

        async def retrieve_memory(state: AgentState) -> dict:
            """Retrieve relevant memories if mem0 is available."""
            memory_context = ""
            if get_config().memory.enabled:
                try:
                    from systemedu.memory.client import retrieve_memories

                    user_msg = ""
                    for msg in reversed(state["messages"]):
                        if isinstance(msg, HumanMessage):
                            user_msg = msg.content
                            break
                    if user_msg:
                        memories = retrieve_memories(
                            user_id=state["user_id"], query=user_msg
                        )
                        if memories:
                            memory_context = "\n".join(
                                f"- {m}" for m in memories
                            )
                except Exception as e:
                    logger.debug(f"Memory retrieval skipped: {e}")
            return {"memory_context": memory_context}

        async def agent_node(state: AgentState) -> dict:
            """Call the LLM with current messages."""
            llm = get_llm(provider=runtime.provider, streaming=False)
            tools = runtime.tool_executor.get_tool_schemas() if runtime.tools_enabled else []
            if tools:
                llm = llm.bind_tools(tools)

            # Build system prompt with memory context
            sys_prompt = runtime.system_prompt
            if state.get("memory_context"):
                sys_prompt += f"\n\n## 相关记忆\n{state['memory_context']}"

            messages = [SystemMessage(content=sys_prompt)] + list(state["messages"])
            response = await llm.ainvoke(messages)
            return {
                "messages": [response],
                "iteration_count": state.get("iteration_count", 0) + 1,
            }

        async def execute_tools(state: AgentState) -> dict:
            """Execute tool calls from the last AI message."""
            last_msg = state["messages"][-1]
            tool_messages = []
            for tool_call in last_msg.tool_calls:
                tool_name = tool_call["name"]
                tool_args = tool_call["args"]
                logger.info(f"Calling tool: {tool_name}({tool_args})")

                result = await runtime.tool_executor.execute(tool_name, tool_args)
                logger.info(f"Tool result: {result[:200]}...")
                tool_messages.append(
                    ToolMessage(content=result, tool_call_id=tool_call["id"])
                )
            return {"messages": tool_messages}

        async def store_memory(state: AgentState) -> dict:
            """Store conversation in memory if mem0 is available."""
            if get_config().memory.enabled:
                try:
                    from systemedu.memory.client import store_conversation

                    # Extract last user-assistant pair
                    messages = state["messages"]
                    user_msg = assistant_msg = ""
                    for msg in reversed(messages):
                        if isinstance(msg, AIMessage) and not assistant_msg and msg.content:
                            assistant_msg = msg.content
                        elif isinstance(msg, HumanMessage) and not user_msg:
                            user_msg = msg.content
                        if user_msg and assistant_msg:
                            break
                    if user_msg and assistant_msg:
                        store_conversation(
                            user_id=state["user_id"],
                            messages=[
                                {"role": "user", "content": user_msg},
                                {"role": "assistant", "content": assistant_msg},
                            ],
                        )
                except Exception as e:
                    logger.debug(f"Memory storage skipped: {e}")
            return {}

        def should_continue(state: AgentState) -> str:
            """Decide whether to continue tool loop or finish."""
            last_msg = state["messages"][-1]
            if (
                isinstance(last_msg, AIMessage)
                and last_msg.tool_calls
                and state.get("iteration_count", 0) < 10
            ):
                return "execute_tools"
            return "store_memory"

        # Build graph
        graph = StateGraph(AgentState)
        graph.add_node("retrieve_memory", retrieve_memory)
        graph.add_node("agent", agent_node)
        graph.add_node("execute_tools", execute_tools)
        graph.add_node("store_memory", store_memory)

        graph.add_edge(START, "retrieve_memory")
        graph.add_edge("retrieve_memory", "agent")
        graph.add_conditional_edges("agent", should_continue)
        graph.add_edge("execute_tools", "agent")
        graph.add_edge("store_memory", END)

        return graph.compile()

    async def process_message(
        self,
        user_message: str,
        session: Session | None = None,
        user_id: str = "default",
    ) -> str:
        """Process a user message through the LangGraph state machine."""
        if session is None:
            session = self.session_manager.create_session()

        # Lazy MCP setup
        await self._setup_mcp_tools()

        session.add_message("user", user_message)

        # Build LangGraph
        if self._graph is None:
            self._graph = self._build_graph()

        # Convert session history to LangChain messages
        lc_messages = []
        for msg in session.messages:
            if msg.role == "user":
                lc_messages.append(HumanMessage(content=msg.content))
            elif msg.role == "assistant":
                lc_messages.append(AIMessage(content=msg.content))

        initial_state: AgentState = {
            "messages": lc_messages,
            "user_id": user_id,
            "session_id": session.id,
            "memory_context": "",
            "iteration_count": 0,
        }

        result = await self._graph.ainvoke(initial_state)

        # Extract final response
        final_messages = result["messages"]
        for msg in reversed(final_messages):
            if isinstance(msg, AIMessage) and msg.content and not msg.tool_calls:
                session.add_message("assistant", msg.content)
                return msg.content

        # Fallback: max iterations hit
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
        Note: streaming does not use the LangGraph state machine.
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
