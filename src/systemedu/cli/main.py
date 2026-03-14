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
def chat(
    agent: str = typer.Option("default", "--agent", "-a", help="Agent to chat with"),
    project: str = typer.Option(None, "--project", "-p", help="Project context"),
    provider: str = typer.Option(None, "--provider", help="LLM provider to use"),
):
    """Start an interactive chat session."""
    import asyncio

    asyncio.run(_run_chat(agent, project, provider))


async def _run_chat(agent: str, project: str | None, provider: str | None):
    """Run the interactive chat loop."""
    from systemedu.channels.cli_channel import CLIChannel
    from systemedu.core.config import get_config, init_config_dir
    from systemedu.core.runtime import AgentRuntime

    init_config_dir()

    runtime = AgentRuntime(provider=provider)
    session = runtime.session_manager.create_session(
        agent_name=agent, project_name=project
    )

    cli = CLIChannel()

    def on_message(msg):
        asyncio.get_event_loop().create_task(_handle_message(runtime, session, cli, msg))

    cli.on_message(on_message)

    # Use a simpler loop that processes messages synchronously
    from prompt_toolkit import PromptSession
    from rich.console import Console
    from rich.markdown import Markdown

    console = Console()
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


async def _handle_message(runtime, session, cli, msg):
    """Handle an incoming message from a channel."""
    response = await runtime.process_message(msg.content, session)
    await cli.send_message(msg.conversation_id, response)


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
