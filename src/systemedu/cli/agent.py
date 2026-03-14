"""Agent daemon management CLI commands."""

import typer
from rich.console import Console
from rich.table import Table

agent_app = typer.Typer(no_args_is_help=True)
console = Console()


@agent_app.command("start")
def start(
    port: int = typer.Option(None, "--port", "-p", help="Gateway port (default: 18820)"),
    foreground: bool = typer.Option(False, "--foreground", "-f", help="Run in foreground"),
):
    """Start the agent daemon (Gateway server)."""
    from systemedu.core.config import init_config_dir
    from systemedu.core.daemon import DaemonManager

    init_config_dir()

    try:
        pid = DaemonManager.start(port=port, foreground=foreground)
        if not foreground:
            info = DaemonManager.status()
            console.print(f"[green]Daemon started[/green] (PID {pid})")
            console.print(f"  Gateway: {info['url']}")
            console.print(f"  Logs:    {DaemonManager.LOG_FILE}")
    except RuntimeError as e:
        console.print(f"[red]Error:[/red] {e}")
        raise typer.Exit(1)


@agent_app.command("stop")
def stop():
    """Stop the agent daemon."""
    from systemedu.core.daemon import DaemonManager

    if DaemonManager.stop():
        console.print("[green]Daemon stopped.[/green]")
    else:
        console.print("[dim]Daemon is not running.[/dim]")


@agent_app.command("status")
def status():
    """Show agent daemon status."""
    from systemedu.core.daemon import DaemonManager

    info = DaemonManager.status()

    table = Table(show_header=False, box=None, padding=(0, 2))
    table.add_column("Key", style="bold")
    table.add_column("Value")

    if info["running"]:
        table.add_row("Status", "[green]● Running[/green]")
        table.add_row("PID", str(info["pid"]))
        table.add_row("Gateway", info["url"])
        if "version" in info:
            table.add_row("Version", info["version"])
        if "uptime" in info:
            table.add_row("Uptime", info["uptime"])
        if "sessions" in info:
            table.add_row("Sessions", str(info["sessions"]))
    else:
        table.add_row("Status", "[dim]● Stopped[/dim]")
        table.add_row("", "Run [bold]systemedu agent start[/bold] to start the daemon")

    console.print(table)
