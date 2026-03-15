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
    no_web: bool = typer.Option(False, "--no-web", help="Don't start the web frontend"),
):
    """Start the agent daemon (Gateway + Web frontend)."""
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

            # Auto-start web frontend
            if not no_web:
                web_pid = DaemonManager.start_web()
                if web_pid:
                    console.print(f"[green]Web frontend started[/green] (PID {web_pid})")
                    console.print(f"  Frontend: http://localhost:3000")
                    console.print(f"  Logs:     {DaemonManager.WEB_LOG_FILE}")
                else:
                    console.print("[dim]Web frontend: web/ not found, skipped[/dim]")
    except RuntimeError as e:
        console.print(f"[red]Error:[/red] {e}")
        raise typer.Exit(1)


@agent_app.command("stop")
def stop():
    """Stop the agent daemon (and web frontend)."""
    from systemedu.core.daemon import DaemonManager

    web_stopped = DaemonManager.stop_web()
    if web_stopped:
        console.print("[green]Web frontend stopped.[/green]")

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

    # Web frontend status
    if DaemonManager.WEB_PID_FILE.exists():
        web_pid = int(DaemonManager.WEB_PID_FILE.read_text().strip())
        if DaemonManager._is_pid_alive(web_pid):
            table.add_row("Web", f"[green]● Running[/green] (PID {web_pid})")
            table.add_row("Frontend", "http://localhost:3000")
        else:
            table.add_row("Web", "[dim]● Stopped[/dim]")

    console.print(table)
