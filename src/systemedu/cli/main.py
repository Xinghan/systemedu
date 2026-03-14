"""SystemEdu CLI entry point."""

import typer

app = typer.Typer(
    name="systemedu",
    help="SystemEdu - AI Agent-driven project-based learning platform",
    no_args_is_help=True,
)


@app.command()
def init():
    """Initialize SystemEdu configuration (~/.systemedu/)."""
    from rich.console import Console

    from systemedu.core.config import init_config_dir

    console = Console()
    path = init_config_dir()
    console.print(f"[green]Initialized SystemEdu at {path}[/green]")
    console.print(f"  Config: {path / 'config.yaml'}")
    console.print(f"  Database: {path / 'systemedu.db'}")
    console.print("\nEdit config.yaml to configure your LLM providers.")


@app.command()
def onboard(
    install_daemon: bool = typer.Option(
        False, "--install-daemon", help="Start daemon after onboarding"
    ),
):
    """Interactive onboarding - configure SystemEdu for first use."""
    from systemedu.cli.onboard import onboard as _onboard

    _onboard(install_daemon=install_daemon)


@app.command()
def chat(
    agent: str = typer.Option("default", "--agent", "-a", help="Agent to chat with"),
    project: str = typer.Option(None, "--project", "-p", help="Project context"),
    provider: str = typer.Option(None, "--provider", help="LLM provider to use"),
):
    """Start an interactive chat session."""
    import asyncio

    asyncio.run(_run_chat(agent, project, provider))


@app.command()
def status():
    """Show system status."""
    from rich.console import Console
    from rich.panel import Panel
    from rich.table import Table

    from systemedu.core.config import get_config
    from systemedu.core.daemon import DaemonManager

    console = Console()
    config = get_config()
    info = DaemonManager.status()

    table = Table(show_header=False, box=None, padding=(0, 2))
    table.add_column("Key", style="bold")
    table.add_column("Value")

    if info["running"]:
        table.add_row("Daemon", "[green]● Running[/green] (PID {})".format(info["pid"]))
        table.add_row("Gateway", info["url"])
    else:
        table.add_row("Daemon", "[dim]● Stopped[/dim]")

    table.add_row("LLM", f"{config.llm.default}")
    if config.llm.default in config.llm.providers:
        prov = config.llm.providers[config.llm.default]
        table.add_row("Model", prov.model)

    if info.get("sessions") is not None:
        table.add_row("Sessions", str(info["sessions"]))
    if info.get("uptime"):
        table.add_row("Uptime", info["uptime"])

    console.print(Panel(table, title="[bold]SystemEdu v0.1.0[/bold]", border_style="blue"))


@app.command()
def dashboard():
    """Open the SystemEdu Dashboard in your browser."""
    import webbrowser

    from rich.console import Console

    from systemedu.core.daemon import DaemonManager

    console = Console()

    if not DaemonManager.is_running():
        console.print("[dim]Daemon not running. Starting...[/dim]")
        try:
            DaemonManager.start()
        except RuntimeError as e:
            console.print(f"[red]Could not start daemon: {e}[/red]")
            raise typer.Exit(1)

    info = DaemonManager.status()
    url = info["url"]
    console.print(f"Opening dashboard at {url}")
    webbrowser.open(url)


@app.command()
def doctor():
    """Run diagnostic checks."""
    from systemedu.cli.doctor import run_doctor

    run_doctor()


async def _run_chat(agent: str, project: str | None, provider: str | None):
    """Run the interactive chat loop."""
    import asyncio

    from prompt_toolkit import PromptSession
    from rich.console import Console

    from systemedu.core.config import init_config_dir
    from systemedu.core.runtime import AgentRuntime

    init_config_dir()
    console = Console()

    runtime = AgentRuntime(provider=provider)
    session = runtime.session_manager.create_session(
        agent_name=agent, project_name=project
    )

    prompt_session = PromptSession()

    console.print("[bold green]SystemEdu Agent[/bold green] - 输入消息开始对话，输入 /quit 退出\n")

    while True:
        try:
            user_input = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: prompt_session.prompt("You> "),
            )
            user_input = user_input.strip()
            if not user_input:
                continue
            if user_input in ("/quit", "/exit", "/q"):
                console.print("\n[dim]再见！[/dim]")
                break

            # Stream response
            console.print()
            full_response = ""
            async for chunk in runtime.stream_message(user_input, session):
                console.print(chunk, end="", highlight=False)
                full_response += chunk
            console.print("\n")

        except (KeyboardInterrupt, EOFError):
            console.print("\n[dim]再见！[/dim]")
            break


# Import subcommands
from systemedu.cli.agent import agent_app
from systemedu.cli.channel import channel_app
from systemedu.cli.config_cmd import config_app
from systemedu.cli.mcp import mcp_app
from systemedu.cli.project import project_app
from systemedu.cli.skill import skill_app

app.add_typer(agent_app, name="agent", help="Manage the agent daemon")
app.add_typer(config_app, name="config", help="Manage configuration")
app.add_typer(project_app, name="project", help="Manage projects")
app.add_typer(mcp_app, name="mcp", help="Manage MCP servers")
app.add_typer(skill_app, name="skill", help="Manage skills")
app.add_typer(channel_app, name="channel", help="Manage channels")


def main():
    app()


if __name__ == "__main__":
    main()
