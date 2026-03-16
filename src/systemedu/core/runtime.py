"""Agent runtime - the core loop that processes messages through LLM."""

import logging
from pathlib import Path

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from .agent_backend import create_backend
from .config import SYSTEMEDU_HOME, get_config
from .llm_client import get_llm
from .session import Session, SessionManager
from .tool_executor import ToolExecutor

logger = logging.getLogger(__name__)

DEFAULT_SYSTEM_PROMPT = """你是 SystemEdu 的 AI 助手，一个智能教育与通用 Agent 平台。
你可以帮助用户学习知识、执行任务、编写代码、分析问题。
你有以下工具可以使用，在需要时调用它们来帮助用户。
用中文回答用户的问题。"""


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

    # Full progress summary so AI can answer "我的进度如何" without tool calls
    nodes = ctx.all_nodes_flat()
    if ctx.progress:
        status_icons = {
            "locked": "🔒", "available": "📖", "in_progress": "⏳",
            "passed": "✅", "submitted": "📤", "failed": "❌",
        }
        passed = sum(1 for p in ctx.progress if p.status.value == "passed")
        total = len(ctx.progress)
        section += f"\n## 学习进度: {passed}/{total} ({100 * passed // total if total else 0}%)\n"
        for p in ctx.progress:
            node = ctx.get_node_by_id(p.knode_id)
            title = node.title if node else f"#{p.knode_id}"
            icon = status_icons.get(p.status.value, "?")
            section += f"{icon} [{p.knode_id}] {title} — {p.status.value}\n"

    current = ctx.current_node()
    if current:
        idx, node = current
        section += f"\n## 当前学习节点 (ID: {idx})\n"
        section += f"标题: {node.title}\n"
        section += f"简介: {node.summary}\n"
        section += f"难度: {node.difficulty_level}/10\n"
        section += f"内容类型: {node.content_type.value}\n"
        section += f"验收方式: {node.acceptance_type.value}\n"

    section += (
        "\n你可以使用 complete_node 工具标记节点完成，"
        "使用 get_progress 工具查看学习进度。\n"
    )
    return section


_PAGE_TARGET_CHARS = 800


def _split_by_headings(markdown: str) -> list[str]:
    """Split markdown into pages. Mirrors frontend splitByHeadings().

    Strategy:
    1. If content has multiple ## or ### headings, split by headings.
    2. Otherwise, split by paragraph breaks, grouping to ~800 chars/page.
    3. Short content stays as one page.
    """
    if not markdown or not markdown.strip():
        return [markdown or ""]

    # Try heading-based split first
    heading_pages = _split_by_heading_markers(markdown)
    if len(heading_pages) > 1:
        return heading_pages

    # Fallback: paragraph-based split
    return _split_by_paragraphs(markdown)


def _split_by_heading_markers(markdown: str) -> list[str]:
    import re

    lines = markdown.split("\n")
    pages: list[str] = []
    current_page: list[str] = []

    for line in lines:
        if re.match(r"^#{2,3}\s", line):
            if current_page:
                content = "\n".join(current_page).strip()
                if content or pages:
                    pages.append(content)
            current_page = [line]
        else:
            current_page.append(line)

    if current_page:
        pages.append("\n".join(current_page).strip())

    if not pages:
        return [markdown.strip()]

    if pages[0] == "" and len(pages) > 1:
        pages.pop(0)

    return pages if pages else [markdown.strip()]


def _split_by_paragraphs(markdown: str) -> list[str]:
    import re

    trimmed = markdown.strip()
    if len(trimmed) <= _PAGE_TARGET_CHARS:
        return [trimmed]

    blocks = re.split(r"\n{2,}", trimmed)
    pages: list[str] = []
    current_page: list[str] = []
    current_len = 0

    for block in blocks:
        block_len = len(block)
        if current_len > 0 and current_len + block_len > _PAGE_TARGET_CHARS:
            pages.append("\n\n".join(current_page).strip())
            current_page = [block]
            current_len = block_len
        else:
            current_page.append(block)
            current_len += block_len

    if current_page:
        pages.append("\n\n".join(current_page).strip())

    return pages if len(pages) > 1 else [trimmed]


def _build_node_context(project_context, node_id: int, active_tab: str | None = None, page_index: int | None = None) -> str:
    """Build per-message context for the active learning node.

    Queries LessonContent and NodeContextCache from the DB,
    returns a markdown section to append to the system prompt.
    Content is kept concise (~2000 chars) to avoid token waste.
    """
    ctx = project_context
    node = ctx.get_node_by_id(node_id)
    if node is None:
        return ""

    parts = [f"\n\n## 学生当前正在学习的知识点 (ID: {node_id})"]
    parts.append(f"标题: {node.title}")
    parts.append(f"简介: {node.summary}")
    parts.append(f"难度: {node.difficulty_level}/10")

    # Query lesson content from DB
    try:
        from systemedu.storage.db import LessonContent, NodeContextCache, get_session as get_db_session

        db = get_db_session()
        try:
            lesson = db.query(LessonContent).filter_by(
                project_name=ctx.project.name, knode_id=node_id
            ).first()

            if lesson and lesson.status == "ready":
                # If active_tab and page_index are given, inject specific page content
                if active_tab and page_index is not None:
                    tab_content = getattr(lesson, active_tab, "")
                    if tab_content:
                        pages = _split_by_headings(tab_content)
                        if page_index < len(pages):
                            page_text = pages[page_index]
                            if len(page_text) > 1000:
                                page_text = page_text[:1000] + "..."
                            tab_labels = {
                                "concept": "概念",
                                "examples": "示例",
                                "code_samples": "代码",
                                "practice": "练习",
                                "key_takeaways": "总结",
                            }
                            tab_label = tab_labels.get(active_tab, active_tab)
                            parts.append(
                                f"\n### 学生当前正在阅读的内容 (tab: {tab_label}, 第{page_index + 1}页/{len(pages)}页)\n{page_text}"
                            )
                else:
                    # Fallback: inject concept summary if no specific page
                    if lesson.concept:
                        concept = lesson.concept[:500]
                        if len(lesson.concept) > 500:
                            concept += "..."
                        parts.append(f"\n### 核心概念\n{concept}")
                if lesson.key_takeaways:
                    parts.append(f"\n### 要点总结\n{lesson.key_takeaways}")

            # Query context cache
            cache = db.query(NodeContextCache).filter_by(
                project_name=ctx.project.name, knode_id=node_id
            ).first()

            if cache:
                if cache.prerequisites_trace:
                    parts.append(f"\n### 前置知识链\n{cache.prerequisites_trace}")
                if cache.learning_suggestions:
                    parts.append(f"\n### 学习建议\n{cache.learning_suggestions}")
        finally:
            db.close()
    except Exception as e:
        logger.debug(f"Failed to load node context from DB: {e}")

    parts.append("\n请基于以上学习内容来回答学生的问题。不要注入 examples/code_samples/practice 的内容，学生已在页面上看到。")
    return "\n".join(parts)


class AgentRuntime:
    """Core agent runtime that handles message → LLM → tool calls → response loop.

    Delegates actual LLM interaction to a pluggable AgentBackend (LangGraph or DeepAgents).
    Memory retrieve/store, session management, and education tools remain in this layer.
    """

    def __init__(
        self,
        provider: str | None = None,
        system_prompt: str | None = None,
        tools_enabled: bool = True,
        skill_names: list[str] | None = None,
        mcp_manager=None,
        project_context=None,
        backend: str | None = None,
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

        # Create pluggable backend
        self._backend = create_backend(backend, provider)

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

    @property
    def _project_name(self) -> str | None:
        """Return the project name if project context is available."""
        if self._project_context is not None:
            return self._project_context.project.name
        return None

    async def _retrieve_memory(self, user_id: str, user_message: str) -> str:
        """Retrieve relevant memories if mem0 is available.

        When a project context exists, memories are scoped to that project.
        """
        if not get_config().memory.enabled:
            return ""
        try:
            from systemedu.memory.client import retrieve_memories

            memories = retrieve_memories(
                user_id=user_id, query=user_message, project_id=self._project_name
            )
            if memories:
                return "\n".join(f"- {m}" for m in memories)
        except Exception as e:
            logger.debug(f"Memory retrieval skipped: {e}")
        return ""

    async def _store_memory(self, user_id: str, user_message: str, assistant_message: str):
        """Store conversation in memory if mem0 is available.

        When a project context exists, memories are tagged with that project.
        """
        if not get_config().memory.enabled:
            return
        try:
            from systemedu.memory.client import store_conversation

            store_conversation(
                user_id=user_id,
                messages=[
                    {"role": "user", "content": user_message},
                    {"role": "assistant", "content": assistant_message},
                ],
                project_id=self._project_name,
            )
        except Exception as e:
            logger.debug(f"Memory storage skipped: {e}")

    async def process_message(
        self,
        user_message: str,
        session: Session | None = None,
        user_id: str = "default",
    ) -> str:
        """Process a user message through the agent backend."""
        if session is None:
            session = self.session_manager.create_session()

        # Lazy MCP setup
        await self._setup_mcp_tools()

        session.add_message("user", user_message)

        # Retrieve memory
        memory_context = await self._retrieve_memory(user_id, user_message)

        # Convert session history to LangChain messages
        lc_messages = []
        for msg in session.messages:
            if msg.role == "user":
                lc_messages.append(HumanMessage(content=msg.content))
            elif msg.role == "assistant":
                lc_messages.append(AIMessage(content=msg.content))

        # Get tool schemas
        tools = self.tool_executor.get_tool_schemas() if self.tools_enabled else []

        # Delegate to backend
        response = await self._backend.process(
            messages=lc_messages,
            system_prompt=self.system_prompt,
            tools=tools,
            tool_executor=self.tool_executor,
            user_id=user_id,
            memory_context=memory_context,
        )

        # Store memory
        await self._store_memory(user_id, user_message, response)

        session.add_message("assistant", response)
        return response

    async def stream_message(
        self,
        user_message: str,
        session: Session | None = None,
        user_id: str = "default",
        node_id: int | None = None,
        active_tab: str | None = None,
        page_index: int | None = None,
    ):
        """Process a message with streaming output.

        Yields chunks of the response as they arrive.
        Supports tools (MCP + education) just like process_message.
        If node_id is provided and project_context exists, the active node's
        lesson content is injected into the system prompt for this message.
        active_tab and page_index allow injecting specific page content.
        """
        if session is None:
            session = self.session_manager.create_session()

        # Lazy MCP setup
        await self._setup_mcp_tools()

        session.add_message("user", user_message)

        # Retrieve memory
        memory_context = await self._retrieve_memory(user_id, user_message)

        # Build per-message system prompt with optional node context
        system_prompt = self.system_prompt
        if node_id is not None and self._project_context is not None:
            node_context = _build_node_context(self._project_context, node_id, active_tab=active_tab, page_index=page_index)
            if node_context:
                system_prompt = system_prompt + node_context

        # Convert session to LangChain messages
        lc_messages = []
        for msg in session.messages[:-1]:  # Exclude the message we just added
            if msg.role == "user":
                lc_messages.append(HumanMessage(content=msg.content))
            elif msg.role == "assistant":
                lc_messages.append(AIMessage(content=msg.content))
        lc_messages.append(HumanMessage(content=user_message))

        # Get tool schemas
        tools = self.tool_executor.get_tool_schemas() if self.tools_enabled else []

        full_response = ""
        async for event in self._backend.stream(
            lc_messages,
            system_prompt,
            tools=tools,
            tool_executor=self.tool_executor,
            user_id=user_id,
            memory_context=memory_context,
        ):
            if event["type"] == "chunk":
                full_response += event["content"]
            yield event

        # Store memory
        await self._store_memory(user_id, user_message, full_response)

        session.add_message("assistant", full_response)
