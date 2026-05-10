"""Tests for MCP client and manager."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from systemedu.core.config import MCPServerConfig
from systemedu.core.mcp.client import MCPClient
from systemedu.core.mcp.manager import MCPManager


class TestMCPClient:
    def test_not_connected_by_default(self):
        client = MCPClient(command="echo", args=[])
        assert not client.is_connected

    @pytest.mark.asyncio
    async def test_list_tools_when_not_connected(self):
        client = MCPClient(command="echo")
        tools = await client.list_tools()
        assert tools == []

    @pytest.mark.asyncio
    async def test_call_tool_when_not_connected(self):
        client = MCPClient(command="echo")
        with pytest.raises(RuntimeError, match="Not connected"):
            await client.call_tool("test", {})

    @pytest.mark.asyncio
    async def test_connect_without_mcp_sdk(self):
        """Should raise ImportError if mcp package is not installed."""
        client = MCPClient(command="echo")
        with patch.dict("sys.modules", {"mcp": None, "mcp.client.stdio": None}):
            with pytest.raises(ImportError, match="MCP SDK not installed"):
                await client.connect()

    @pytest.mark.asyncio
    async def test_connect_and_list_tools(self):
        """Mock MCP SDK to test connect + list_tools flow."""
        client = MCPClient(command="test-server", args=["--flag"])

        # Mock tool result
        mock_tool = MagicMock()
        mock_tool.name = "read_file"
        mock_tool.description = "Read a file"
        mock_tool.inputSchema = {"type": "object", "properties": {"path": {"type": "string"}}}

        mock_session = AsyncMock()
        mock_session.initialize = AsyncMock()
        mock_session.list_tools = AsyncMock(
            return_value=MagicMock(tools=[mock_tool])
        )

        # Patch the mcp imports within connect
        mock_params_class = MagicMock()
        mock_stdio_client = AsyncMock()

        # Create async context manager mocks
        mock_transport_cm = AsyncMock()
        mock_transport_cm.__aenter__ = AsyncMock(return_value=(MagicMock(), MagicMock()))
        mock_transport_cm.__aexit__ = AsyncMock(return_value=False)

        mock_session_cm = AsyncMock()
        mock_session_cm.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session_cm.__aexit__ = AsyncMock(return_value=False)

        with (
            patch("systemedu.core.mcp.client.AsyncExitStack") as mock_stack_class,
        ):
            mock_stack = AsyncMock()
            mock_stack.enter_async_context = AsyncMock(
                side_effect=[
                    (MagicMock(), MagicMock()),  # stdio transport
                    mock_session,  # client session
                ]
            )
            mock_stack_class.return_value = mock_stack

            mock_mcp = MagicMock()
            mock_mcp.ClientSession = MagicMock(return_value=mock_session_cm)
            mock_mcp.StdioServerParameters = mock_params_class

            mock_mcp_stdio = MagicMock()
            mock_mcp_stdio.stdio_client = MagicMock(return_value=mock_transport_cm)

            import sys
            with patch.dict(sys.modules, {
                "mcp": mock_mcp,
                "mcp.client": MagicMock(),
                "mcp.client.stdio": mock_mcp_stdio,
            }):
                await client.connect()

            assert client.is_connected
            tools = await client.list_tools()
            assert len(tools) == 1
            assert tools[0]["name"] == "read_file"

    @pytest.mark.asyncio
    async def test_call_tool_success(self):
        """Mock a connected session and call a tool."""
        client = MCPClient(command="test")

        mock_content = MagicMock()
        mock_content.text = "file contents here"

        mock_result = MagicMock()
        mock_result.content = [mock_content]

        mock_session = AsyncMock()
        mock_session.call_tool = AsyncMock(return_value=mock_result)
        client._session = mock_session

        result = await client.call_tool("read_file", {"path": "/tmp/test.txt"})
        assert result == "file contents here"
        mock_session.call_tool.assert_called_once_with("read_file", {"path": "/tmp/test.txt"})

    @pytest.mark.asyncio
    async def test_disconnect(self):
        """Disconnect should clean up session and exit stack."""
        client = MCPClient(command="test")
        client._session = MagicMock()
        client._exit_stack = AsyncMock()
        client._exit_stack.aclose = AsyncMock()

        await client.disconnect()
        assert client._session is None
        assert client._exit_stack is None


class TestMCPManager:
    @pytest.mark.asyncio
    async def test_empty_manager_list_tools(self):
        manager = MCPManager()
        assert manager.list_tools() == []

    @pytest.mark.asyncio
    async def test_start_server_and_list_tools(self):
        """Start a mock server and verify tools are discovered."""
        manager = MCPManager()

        mock_client = AsyncMock(spec=MCPClient)
        mock_client.is_connected = True
        mock_client.connect = AsyncMock()
        mock_client.list_tools = AsyncMock(return_value=[
            {"name": "read_file", "description": "Read a file", "inputSchema": {}},
            {"name": "write_file", "description": "Write a file", "inputSchema": {}},
        ])

        config = MCPServerConfig(command="test", args=[])

        with patch("systemedu.core.mcp.manager.MCPClient", return_value=mock_client):
            await manager.start_server("filesystem", config)

        tools = manager.list_tools()
        assert len(tools) == 2

        # Verify qualified naming
        names = [t["function"]["name"] for t in tools]
        assert "filesystem__read_file" in names
        assert "filesystem__write_file" in names

        # Verify description prefix
        for tool in tools:
            assert tool["function"]["description"].startswith("[filesystem]")

    @pytest.mark.asyncio
    async def test_call_tool_routed_correctly(self):
        """call_tool should route to the correct server."""
        manager = MCPManager()

        mock_client = AsyncMock(spec=MCPClient)
        mock_client.is_connected = True
        mock_client.connect = AsyncMock()
        mock_client.list_tools = AsyncMock(return_value=[
            {"name": "echo", "description": "Echo", "inputSchema": {}},
        ])
        mock_client.call_tool = AsyncMock(return_value="echoed: hello")

        config = MCPServerConfig(command="echo-server")

        with patch("systemedu.core.mcp.manager.MCPClient", return_value=mock_client):
            await manager.start_server("echo", config)

        result = await manager.call_tool("echo__echo", {"text": "hello"})
        assert result == "echoed: hello"
        mock_client.call_tool.assert_called_once_with("echo", {"text": "hello"})

    @pytest.mark.asyncio
    async def test_call_unknown_tool_raises(self):
        manager = MCPManager()
        with pytest.raises(ValueError, match="Unknown MCP tool"):
            await manager.call_tool("nonexistent__tool", {})

    @pytest.mark.asyncio
    async def test_stop_server(self):
        """Stopping a server should disconnect and remove tools."""
        manager = MCPManager()

        mock_client = AsyncMock(spec=MCPClient)
        mock_client.is_connected = True
        mock_client.connect = AsyncMock()
        mock_client.disconnect = AsyncMock()
        mock_client.list_tools = AsyncMock(return_value=[
            {"name": "tool1", "description": "T1", "inputSchema": {}},
        ])

        config = MCPServerConfig(command="test")

        with patch("systemedu.core.mcp.manager.MCPClient", return_value=mock_client):
            await manager.start_server("srv", config)

        assert len(manager.list_tools()) == 1

        await manager.stop_server("srv")
        mock_client.disconnect.assert_called_once()
        assert len(manager.list_tools()) == 0

    @pytest.mark.asyncio
    async def test_stop_all(self):
        """stop_all should disconnect all servers."""
        manager = MCPManager()

        for name in ["srv1", "srv2"]:
            mock_client = AsyncMock(spec=MCPClient)
            mock_client.is_connected = True
            mock_client.connect = AsyncMock()
            mock_client.disconnect = AsyncMock()
            mock_client.list_tools = AsyncMock(return_value=[])

            config = MCPServerConfig(command=name)
            with patch("systemedu.core.mcp.manager.MCPClient", return_value=mock_client):
                await manager.start_server(name, config)

        await manager.stop_all()
        assert len(manager._clients) == 0

    @pytest.mark.asyncio
    async def test_list_servers(self):
        manager = MCPManager()

        mock_client = AsyncMock(spec=MCPClient)
        mock_client.is_connected = True
        mock_client.connect = AsyncMock()
        mock_client.list_tools = AsyncMock(return_value=[])

        config = MCPServerConfig(command="test")
        with patch("systemedu.core.mcp.manager.MCPClient", return_value=mock_client):
            await manager.start_server("test", config)

        servers = manager.list_servers()
        assert servers == {"test": True}
