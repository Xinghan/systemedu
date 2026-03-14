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

    from systemedu.core.config import get_config, init_config_dir
    from systemedu.core.runtime import AgentRuntime

    init_config_dir()
    console = Console()
    config = get_config()

    # Load project context if specified
    project_context = None
    mcp_manager = None
    if project:
        try:
            from systemedu.education.project_loader import load_project_context

            project_context = load_project_context(project)
            console.print(f"[green]已加载项目: {project_context.project.title}[/green]")

            current = project_context.current_node()
            if current:
                idx, node = current
                console.print(f"[dim]当前节点: [{idx}] {node.title}[/dim]")
        except FileNotFoundError as e:
            console.print(f"[red]项目加载失败: {e}[/red]")
            return

    # Setup MCP manager and auto-connect servers
    mcp_servers = dict(config.mcp.servers)  # Global servers
    if project_context and project_context.project.mcp:
        # Add project-level MCP servers
        from systemedu.core.config import MCPServerConfig

        for name, mcp_conf in project_context.project.mcp.items():
            mcp_servers[name] = MCPServerConfig(
                command=mcp_conf.command,
                args=mcp_conf.args,
                env=mcp_conf.env,
            )

    if mcp_servers:
        from systemedu.mcp.manager import MCPManager

        mcp_manager = MCPManager()
        for name, srv_config in mcp_servers.items():
            try:
                await mcp_manager.start_server(name, srv_config)
                console.print(f"[dim]MCP: {name} 已连接[/dim]")
            except Exception as e:
                console.print(f"[yellow]MCP: {name} 连接失败: {e}[/yellow]")

    skill_names = [agent] if agent != "default" else None
    runtime = AgentRuntime(
        provider=provider,
        skill_names=skill_names,
        mcp_manager=mcp_manager,
        project_context=project_context,
    )
    session = runtime.session_manager.create_session(
        agent_name=agent, project_name=project
    )

    prompt_session = PromptSession()

    console.print("[bold green]SystemEdu Agent[/bold green] - 输入消息开始对话，输入 /quit 退出\n")

    try:
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

                if project_context:
                    # Project mode: use process_message (non-streaming, supports tools)
                    response = await runtime.process_message(user_input, session)
                    console.print(f"\n{response}\n")
                else:
                    # Normal mode: streaming
                    console.print()
                    async for chunk in runtime.stream_message(user_input, session):
                        console.print(chunk, end="", highlight=False)
                    console.print("\n")

            except (KeyboardInterrupt, EOFError):
                console.print("\n[dim]再见！[/dim]")
                break
    finally:
        if mcp_manager:
            await mcp_manager.stop_all()


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
