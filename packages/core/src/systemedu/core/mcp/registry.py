"""Registry of configured MCP servers."""

from systemedu.core.config import MCPServerConfig


class MCPRegistry:
    """Tracks registered MCP servers and their configurations."""

    def __init__(self):
        self._servers: dict[str, MCPServerConfig] = {}

    def register(self, name: str, config: MCPServerConfig) -> None:
        self._servers[name] = config

    def unregister(self, name: str) -> None:
        self._servers.pop(name, None)

    def get(self, name: str) -> MCPServerConfig | None:
        return self._servers.get(name)

    def list_all(self) -> dict[str, MCPServerConfig]:
        return dict(self._servers)
