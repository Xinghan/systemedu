"""Agent daemon management CLI commands."""

import typer
from rich.console import Console

agent_app = typer.Typer(no_args_is_help=True)
console = Console()


@agent_app.command("start")
def start():
    """Start the agent daemon."""
    console.print("[yellow]Agent daemon not yet implemented (Phase 2).[/yellow]")
    console.print("Use [bold]systemedu chat[/bold] for interactive mode.")


@agent_app.command("stop")
def stop():
    """Stop the agent daemon."""
    console.print("[yellow]Agent daemon not yet implemented (Phase 2).[/yellow]")


@agent_app.command("status")
def status():
    """Show agent daemon status."""
    console.print("[dim]Agent daemon is not running.[/dim]")
    console.print("Use [bold]systemedu chat[/bold] for interactive mode.")
