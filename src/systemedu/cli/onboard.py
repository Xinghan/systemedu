"""Interactive onboarding for SystemEdu."""

import typer
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Confirm, IntPrompt, Prompt
from rich.text import Text

console = Console()

TURTLE_ART = r"""
    ___-------___
   /|             |
  / |  O       O  |
 |  |      <      |
  \ |   \______/  |
   \|_____________/
     ___|   |___
    /   |   |   \
   /    |   |    \
  /_____|___|_____\
"""

# Provider presets
PROVIDERS = {
    "1": {
        "name": "qwen",
        "label": "Qwen (阿里通义千问)",
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "model": "qwen-plus",
        "env_key": "DASHSCOPE_API_KEY",
        "needs_key": True,
    },
    "2": {
        "name": "claude",
        "label": "Claude (Anthropic)",
        "base_url": "https://api.anthropic.com/v1",
        "model": "claude-sonnet-4-20250514",
        "env_key": "ANTHROPIC_API_KEY",
        "needs_key": True,
    },
    "3": {
        "name": "openai",
        "label": "OpenAI",
        "base_url": "https://api.openai.com/v1",
        "model": "gpt-4o",
        "env_key": "OPENAI_API_KEY",
        "needs_key": True,
    },
    "4": {
        "name": "ollama",
        "label": "Ollama (本地)",
        "base_url": "http://localhost:11434/v1",
        "model": "llama3",
        "env_key": "",
        "needs_key": False,
    },
    "5": {
        "name": "custom",
        "label": "自定义 (Custom)",
        "base_url": "",
        "model": "",
        "env_key": "",
        "needs_key": True,
    },
}


def onboard(
    install_daemon: bool = typer.Option(
        False, "--install-daemon", help="Start daemon after onboarding"
    ),
):
    """Interactive onboarding - configure SystemEdu for first use."""
    from systemedu.core.config import (
        CONFIG_FILE,
        init_config_dir,
        load_config,
        save_config,
    )

    # Welcome
    console.print()
    console.print(
        Panel(
            Text(TURTLE_ART, style="green")
            + Text("\n欢迎使用 SystemEdu!", style="bold white")
            + Text("\nAI Agent 驱动的项目制学习平台", style="dim"),
            title="[bold green]SystemEdu[/bold green]",
            border_style="green",
        )
    )
    console.print()

    # Step 1: Init config dir
    path = init_config_dir()
    console.print(f"[dim]Config directory: {path}[/dim]\n")

    # Step 2: Choose LLM provider
    console.print("[bold]选择 LLM Provider:[/bold]\n")
    for key, prov in PROVIDERS.items():
        marker = "  (无需 API key)" if not prov["needs_key"] else ""
        console.print(f"  [{key}] {prov['label']}{marker}")
    console.print()

    choice = Prompt.ask(
        "请选择",
        choices=list(PROVIDERS.keys()),
        default="1",
    )
    provider = PROVIDERS[choice]
    console.print()

    # Step 3: Custom provider config
    if choice == "5":
        provider["base_url"] = Prompt.ask("API Base URL")
        provider["model"] = Prompt.ask("Model name")
        provider["name"] = Prompt.ask("Provider name", default="custom")

    # Step 4: API key
    api_key = ""
    if provider["needs_key"]:
        import os

        env_val = os.environ.get(provider["env_key"], "") if provider["env_key"] else ""
        if env_val:
            console.print(
                f"[dim]检测到环境变量 {provider['env_key']} 已设置[/dim]"
            )
            use_env = Confirm.ask("使用环境变量中的 API key?", default=True)
            if use_env:
                api_key = f"${{{provider['env_key']}}}"
            else:
                api_key = Prompt.ask("API Key", password=True)
        else:
            api_key = Prompt.ask(
                f"API Key{' (' + provider['env_key'] + ')' if provider['env_key'] else ''}",
                password=True,
            )

    # Step 5: Write config
    config_dict = {
        "llm": {
            "default": provider["name"],
            "providers": {
                provider["name"]: {
                    "base_url": provider["base_url"],
                    "api_key": api_key,
                    "model": provider["model"],
                },
            },
        },
        "sandbox": {
            "enabled": True,
            "allowed_dirs": ["~/projects"],
            "blocked_commands": ["rm -rf /", "format"],
            "network": True,
            "max_execution_time": 300,
        },
        "mcp": {"servers": {}},
        "channels": {"cli": {"enabled": True}, "web": {"enabled": False}},
        "gateway": {"port": 18820, "host": "127.0.0.1"},
        "hub": {"url": "https://hub.systemedu.com"},
        "memory": {"enabled": True, "backend": "mem0"},
    }

    save_config(config_dict)
    console.print(f"[green]Config saved to {CONFIG_FILE}[/green]\n")

    # Step 6: Test LLM connection
    console.print("[bold]Testing LLM connection...[/bold]")
    _test_connection(provider["name"], api_key, provider["base_url"], provider["model"])

    # Step 7: Optionally start daemon
    if install_daemon:
        console.print("\n[bold]Starting daemon...[/bold]")
        try:
            from systemedu.core.daemon import DaemonManager

            pid = DaemonManager.start()
            console.print(f"[green]Daemon started (PID {pid})[/green]")
        except Exception as e:
            console.print(f"[yellow]Could not start daemon: {e}[/yellow]")

    # Step 8: Done!
    console.print()
    console.print(
        Panel(
            "[green]Setup complete![/green]\n\n"
            "[bold]下一步:[/bold]\n"
            "  systemedu chat           对话聊天\n"
            "  systemedu agent start    启动后台服务\n"
            "  systemedu dashboard      打开 Dashboard\n"
            "  systemedu doctor         诊断检查\n"
            "  systemedu status         查看状态",
            title="[bold green]Ready[/bold green]",
            border_style="green",
        )
    )


def _test_connection(
    provider_name: str, api_key: str, base_url: str, model: str
) -> None:
    """Test LLM connection by sending a simple message."""
    import os
    import re

    # Resolve env var references in api_key
    resolved_key = api_key
    env_match = re.match(r"^\$\{(\w+)\}$", api_key)
    if env_match:
        resolved_key = os.environ.get(env_match.group(1), "")

    if not resolved_key and provider_name != "ollama":
        console.print("[yellow]Skipped: API key is empty.[/yellow]")
        return

    try:
        from openai import OpenAI

        client = OpenAI(api_key=resolved_key or "ollama", base_url=base_url)
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "Say 'hello' in one word."}],
            max_tokens=10,
        )
        reply = response.choices[0].message.content.strip()
        console.print(f"[green]Connection successful![/green] LLM replied: {reply}")
    except Exception as e:
        console.print(f"[yellow]Connection test failed: {e}[/yellow]")
        console.print("[dim]You can fix the config later with: systemedu config edit[/dim]")
