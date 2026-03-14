"""MCP server lifecycle management (Phase 2 implementation)."""

import logging

from systemedu.core.config import MCPServerConfig

logger = logging.getLogger(__name__)


class MCPManager:
    """Manages MCP server lifecycle and tool discovery.

    Phase 2 will implement full MCP SDK integration.
    """

    def __init__(self):
        self._servers: dict[str, MCPServerConfig] = {}
        self._running: dict[str, object] = {}  # name -> process

    async def start_server(self, name: str, config: MCPServerConfig) -> None:
        """Start an MCP server process."""
        self._servers[name] = config
        logger.info(f"MCP server '{name}' registered (start not yet implemented)")

    async def stop_server(self, name: str) -> None:
        """Stop an MCP server process."""
        self._servers.pop(name, None)
        self._running.pop(name, None)

    async def list_tools(self) -> list[dict]:
        """List all tools from all connected MCP servers."""
        return []

    async def call_tool(self, server: str, tool: str, args: dict):
        """Call a tool on an MCP server."""
        raise NotImplementedError("MCP tool calling not yet implemented (Phase 2)")

    def list_servers(self) -> dict[str, MCPServerConfig]:
        return dict(self._servers)
