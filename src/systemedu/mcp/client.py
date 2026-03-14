"""MCP client for stdio/SSE transport (Phase 2 placeholder)."""


class MCPClient:
    """Connects to a single MCP server.

    Phase 2 will implement using the official Python MCP SDK.
    """

    def __init__(self, command: str, args: list[str] | None = None):
        self.command = command
        self.args = args or []

    async def connect(self) -> None:
        raise NotImplementedError("MCP client not yet implemented (Phase 2)")

    async def disconnect(self) -> None:
        pass

    async def list_tools(self) -> list[dict]:
        return []

    async def call_tool(self, name: str, arguments: dict) -> str:
        raise NotImplementedError("MCP client not yet implemented (Phase 2)")
