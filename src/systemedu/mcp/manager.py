"""MCP server lifecycle management with real MCP SDK integration."""

import logging

from systemedu.core.config import MCPServerConfig

from .client import MCPClient

logger = logging.getLogger(__name__)


class MCPManager:
    """Manages MCP server lifecycle, tool discovery, and tool routing.

    Tools are namespaced as `{server_name}__{tool_name}` to avoid conflicts.
    """

    def __init__(self):
        self._clients: dict[str, MCPClient] = {}
        self._tools: dict[str, dict] = {}  # qualified_name -> {server, tool_name, schema}

    async def start_server(self, name: str, config: MCPServerConfig) -> None:
        """Start and connect to an MCP server."""
        if name in self._clients:
            await self.stop_server(name)

        client = MCPClient(
            command=config.command,
            args=config.args,
            env=config.env or None,
        )
        await client.connect()
        self._clients[name] = client

        # Discover tools
        tools = await client.list_tools()
        for tool in tools:
            qualified_name = f"{name}__{tool['name']}"
            self._tools[qualified_name] = {
                "server": name,
                "tool_name": tool["name"],
                "description": tool["description"],
                "inputSchema": tool.get("inputSchema", {}),
            }
        logger.info(f"MCP server '{name}' started with {len(tools)} tools")

    async def stop_server(self, name: str) -> None:
        """Stop and disconnect from an MCP server."""
        client = self._clients.pop(name, None)
        if client:
            await client.disconnect()

        # Remove tools belonging to this server
        to_remove = [k for k, v in self._tools.items() if v["server"] == name]
        for key in to_remove:
            del self._tools[key]

        logger.info(f"MCP server '{name}' stopped")

    async def stop_all(self) -> None:
        """Stop all MCP servers."""
        for name in list(self._clients):
            await self.stop_server(name)

    def list_tools(self) -> list[dict]:
        """List all tools from all servers in OpenAI function-calling format.

        Tool names are qualified as `{server}__{tool}`.
        Descriptions are prefixed with `[{server}]`.
        """
        schemas = []
        for qualified_name, info in self._tools.items():
            schema = {
                "type": "function",
                "function": {
                    "name": qualified_name,
                    "description": f"[{info['server']}] {info['description']}",
                    "parameters": info.get("inputSchema", {}),
                },
            }
            schemas.append(schema)
        return schemas

    async def call_tool(self, qualified_name: str, arguments: dict) -> str:
        """Call a tool by its qualified name ({server}__{tool})."""
        info = self._tools.get(qualified_name)
        if not info:
            raise ValueError(f"Unknown MCP tool: {qualified_name}")

        server_name = info["server"]
        tool_name = info["tool_name"]

        client = self._clients.get(server_name)
        if not client or not client.is_connected:
            raise RuntimeError(f"MCP server '{server_name}' is not connected")

        return await client.call_tool(tool_name, arguments)

    def list_servers(self) -> dict[str, bool]:
        """List servers and their connection status."""
        return {
            name: client.is_connected for name, client in self._clients.items()
        }
