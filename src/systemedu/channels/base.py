"""Abstract base class for communication channels."""

from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass


@dataclass
class IncomingMessage:
    """A message received from a channel."""

    content: str
    conversation_id: str
    sender_id: str = ""
    channel_name: str = ""


MessageCallback = Callable[[IncomingMessage], None]


class Channel(ABC):
    """Base class for all communication channels (CLI, Web, IM, etc.)."""

    name: str = "base"

    @abstractmethod
    async def start(self) -> None:
        """Start the channel and begin listening for messages."""

    @abstractmethod
    async def stop(self) -> None:
        """Stop the channel."""

    @abstractmethod
    async def send_message(self, conversation_id: str, content: str) -> None:
        """Send a message to a conversation."""

    @abstractmethod
    def on_message(self, callback: MessageCallback) -> None:
        """Register a callback for incoming messages."""
