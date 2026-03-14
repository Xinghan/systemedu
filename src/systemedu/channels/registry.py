"""Channel registry for dynamic channel loading."""

from .base import Channel


class ChannelRegistry:
    """Registry of available communication channels."""

    def __init__(self):
        self._channels: dict[str, Channel] = {}

    def register(self, channel: Channel) -> None:
        self._channels[channel.name] = channel

    def get(self, name: str) -> Channel | None:
        return self._channels.get(name)

    def list_channels(self) -> list[str]:
        return list(self._channels.keys())

    async def start_all(self) -> None:
        for channel in self._channels.values():
            await channel.start()

    async def stop_all(self) -> None:
        for channel in self._channels.values():
            await channel.stop()
