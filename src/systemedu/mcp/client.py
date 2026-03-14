"""MCP client for stdio transport using the official Python MCP SDK."""

import logging
from contextlib import AsyncExitStack

logger = logging.getLogger(__name__)


class MCPClient:
    """Connects to a single MCP server via stdio transport.

    Uses the official `mcp` Python SDK for communication.
    """

    def __init__(
        self,
        command: str,
        args: list[str] | None = None,
        env: dict[str, str] | None = None,
    ):
        self.command = command
        self.args = args or []
        self.env = env
        self._session = None
        self._exit_stack: AsyncExitStack | None = None

    @property
    def is_connected(self) -> bool:
        return self._session is not None

    async def connect(self) -> None:
        """Connect to the MCP server via stdio."""
        try:
            from mcp import ClientSession, StdioServerParameters
            from mcp.client.stdio import stdio_client
        except ImportError:
            raise ImportError(
                "MCP SDK not installed. Install with: pip install systemedu[mcp]"
            )

        params = StdioServerParameters(
            command=self.command,
            args=self.args,
            env=self.env,
        )

        self._exit_stack = AsyncExitStack()
        stdio_transport = await self._exit_stack.enter_async_context(
            stdio_client(params)
        )
        read_stream, write_stream = stdio_transport
        self._session = await self._exit_stack.enter_async_context(
            ClientSession(read_stream, write_stream)
        )
        await self._session.initialize()
        logger.info(f"Connected to MCP server: {self.command}")

    async def list_tools(self) -> list[dict]:
        """List available tools from the server.

        Returns a list of dicts with keys: name, description, inputSchema.
        """
        if not self._session:
            return []

        result = await self._session.list_tools()
        return [
            {
                "name": tool.name,
                "description": tool.description or "",
                "inputSchema": tool.inputSchema if hasattr(tool, "inputSchema") else {},
            }
            for tool in result.tools
        ]

    async def call_tool(self, name: str, arguments: dict) -> str:
        """Call a tool on the server and return the result as a string."""
        if not self._session:
            raise RuntimeError("Not connected to MCP server")

        result = await self._session.call_tool(name, arguments)
        # Concatenate text content from result
        parts = []
        for content in result.content:
            if hasattr(content, "text"):
                parts.append(content.text)
            else:
                parts.append(str(content))
        return "\n".join(parts) if parts else ""

    async def disconnect(self) -> None:
        """Disconnect from the MCP server."""
        if self._exit_stack:
            await self._exit_stack.aclose()
            self._exit_stack = None
        self._session = None
        logger.info(f"Disconnected from MCP server: {self.command}")
