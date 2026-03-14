"""Channel management CLI commands (Phase 5 placeholder)."""

import typer
from rich.console import Console

channel_app = typer.Typer(no_args_is_help=True)
console = Console()


@channel_app.command("list")
def list_channels():
    """List configured channels."""
    from systemedu.core.config import load_config

    config = load_config()
    console.print("Channels:")
    console.print(f"  [cyan]cli[/cyan]  - {'enabled' if config.channels.cli.enabled else 'disabled'}")
    console.print(f"  [cyan]web[/cyan]  - {'enabled' if config.channels.web.enabled else 'disabled'}")


@channel_app.command("add")
def add(name: str = typer.Argument(help="Channel name (e.g. wechat, telegram)")):
    """Add a communication channel."""
    console.print(f"[yellow]Channel '{name}' not yet supported (Phase 5).[/yellow]")


@channel_app.command("remove")
def remove(name: str = typer.Argument(help="Channel name to remove")):
    """Remove a channel."""
    console.print(f"[yellow]Channel management not yet implemented (Phase 5).[/yellow]")
