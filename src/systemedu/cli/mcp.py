"""MCP server management CLI commands (Phase 2 placeholder)."""

import typer
from rich.console import Console

mcp_app = typer.Typer(no_args_is_help=True)
console = Console()


@mcp_app.command("add")
def add(
    name: str = typer.Argument(help="MCP server name"),
    command: str = typer.Option(..., "--command", "-c", help="Command to run"),
    args: str = typer.Option("", "--args", "-a", help="Command arguments (space-separated)"),
):
    """Add an MCP server to config."""
    import yaml

    from systemedu.core.config import CONFIG_FILE, init_config_dir

    init_config_dir()

    raw = yaml.safe_load(CONFIG_FILE.read_text(encoding="utf-8")) or {}
    raw.setdefault("mcp", {}).setdefault("servers", {})[name] = {
        "command": command,
        "args": args.split() if args else [],
    }

    CONFIG_FILE.write_text(
        yaml.dump(raw, default_flow_style=False, allow_unicode=True),
        encoding="utf-8",
    )
    console.print(f"[green]Added MCP server '{name}'[/green]")


@mcp_app.command("list")
def list_servers():
    """List configured MCP servers."""
    from systemedu.core.config import load_config

    config = load_config()
    if not config.mcp.servers:
        console.print("[dim]No MCP servers configured.[/dim]")
        return

    for name, server in config.mcp.servers.items():
        console.print(f"  [cyan]{name}[/cyan]: {server.command} {' '.join(server.args)}")


@mcp_app.command("remove")
def remove(name: str = typer.Argument(help="MCP server name to remove")):
    """Remove an MCP server from config."""
    import yaml

    from systemedu.core.config import CONFIG_FILE

    raw = yaml.safe_load(CONFIG_FILE.read_text(encoding="utf-8")) or {}
    servers = raw.get("mcp", {}).get("servers", {})

    if name not in servers:
        console.print(f"[red]MCP server '{name}' not found.[/red]")
        raise typer.Exit(1)

    del servers[name]
    CONFIG_FILE.write_text(
        yaml.dump(raw, default_flow_style=False, allow_unicode=True),
        encoding="utf-8",
    )
    console.print(f"[green]Removed MCP server '{name}'[/green]")
