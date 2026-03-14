"""WebSocket channel for Web UI (placeholder for Phase 5)."""

from .base import Channel, MessageCallback


class WebChannel(Channel):
    """WebSocket-based channel for the Web UI.

    This is a placeholder - full implementation comes in Phase 5.
    """

    name = "web"

    def __init__(self, port: int = 8080):
        self._port = port
        self._callback: MessageCallback | None = None

    async def start(self) -> None:
        raise NotImplementedError("Web channel not yet implemented")

    async def stop(self) -> None:
        pass

    async def send_message(self, conversation_id: str, content: str) -> None:
        raise NotImplementedError("Web channel not yet implemented")

    def on_message(self, callback: MessageCallback) -> None:
        self._callback = callback
