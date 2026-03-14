"""CLI channel for interactive terminal chat."""

import asyncio

from prompt_toolkit import PromptSession
from prompt_toolkit.patch_stdout import patch_stdout
from rich.console import Console
from rich.markdown import Markdown

from .base import Channel, IncomingMessage, MessageCallback


class CLIChannel(Channel):
    """Interactive CLI channel using prompt_toolkit and rich."""

    name = "cli"

    def __init__(self):
        self._callback: MessageCallback | None = None
        self._running = False
        self._console = Console()
        self._prompt_session = PromptSession()

    async def start(self) -> None:
        """Start the interactive CLI loop."""
        self._running = True
        self._console.print("[bold green]SystemEdu Agent[/bold green] - 输入消息开始对话，输入 /quit 退出\n")

        while self._running:
            try:
                with patch_stdout():
                    user_input = await asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda: self._prompt_session.prompt("You> "),
                    )

                user_input = user_input.strip()
                if not user_input:
                    continue
                if user_input in ("/quit", "/exit", "/q"):
                    self._console.print("\n[dim]再见！[/dim]")
                    self._running = False
                    break

                if self._callback:
                    msg = IncomingMessage(
                        content=user_input,
                        conversation_id="cli-default",
                        sender_id="cli-user",
                        channel_name="cli",
                    )
                    self._callback(msg)

            except (KeyboardInterrupt, EOFError):
                self._console.print("\n[dim]再见！[/dim]")
                self._running = False
                break

    async def stop(self) -> None:
        self._running = False

    async def send_message(self, conversation_id: str, content: str) -> None:
        """Display the assistant's response in the terminal."""
        self._console.print()
        self._console.print(Markdown(content))
        self._console.print()

    def on_message(self, callback: MessageCallback) -> None:
        self._callback = callback

    async def send_streaming_chunk(self, chunk: str) -> None:
        """Print a streaming chunk without newline."""
        self._console.print(chunk, end="", highlight=False)

    async def send_streaming_end(self) -> None:
        """End streaming output with newlines."""
        self._console.print("\n")
