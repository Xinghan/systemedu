"""Configuration management CLI commands."""

import os
import subprocess

import typer
import yaml
from rich.console import Console
from rich.syntax import Syntax

from systemedu.core.config import CONFIG_FILE, init_config_dir, load_config

config_app = typer.Typer(no_args_is_help=True)
console = Console()


@config_app.command("show")
def show():
    """Show current configuration."""
    init_config_dir()

    if not CONFIG_FILE.exists():
        console.print("[red]No config file found. Run 'systemedu init' first.[/red]")
        raise typer.Exit(1)

    content = CONFIG_FILE.read_text(encoding="utf-8")
    syntax = Syntax(content, "yaml", theme="monokai")
    console.print(syntax)


@config_app.command("edit")
def edit():
    """Open config file in default editor."""
    init_config_dir()

    editor = os.environ.get("EDITOR", "vim")
    subprocess.run([editor, str(CONFIG_FILE)])


@config_app.command("set")
def set_value(
    key: str = typer.Argument(help="Config key (dot-separated, e.g. llm.default)"),
    value: str = typer.Argument(help="Value to set"),
):
    """Set a configuration value."""
    init_config_dir()

    raw = yaml.safe_load(CONFIG_FILE.read_text(encoding="utf-8")) or {}

    # Navigate dot-separated key
    parts = key.split(".")
    obj = raw
    for part in parts[:-1]:
        if part not in obj or not isinstance(obj[part], dict):
            obj[part] = {}
        obj = obj[part]

    # Try to parse as number/bool
    if value.lower() == "true":
        obj[parts[-1]] = True
    elif value.lower() == "false":
        obj[parts[-1]] = False
    elif value.isdigit():
        obj[parts[-1]] = int(value)
    else:
        obj[parts[-1]] = value

    CONFIG_FILE.write_text(
        yaml.dump(raw, default_flow_style=False, allow_unicode=True),
        encoding="utf-8",
    )
    console.print(f"[green]Set {key} = {value}[/green]")


@config_app.command("get")
def get_value(
    key: str = typer.Argument(help="Config key (dot-separated)"),
):
    """Get a configuration value."""
    init_config_dir()

    raw = yaml.safe_load(CONFIG_FILE.read_text(encoding="utf-8")) or {}

    parts = key.split(".")
    obj = raw
    for part in parts:
        if isinstance(obj, dict) and part in obj:
            obj = obj[part]
        else:
            console.print(f"[red]Key not found: {key}[/red]")
            raise typer.Exit(1)

    if isinstance(obj, dict):
        console.print(yaml.dump(obj, default_flow_style=False, allow_unicode=True))
    else:
        console.print(str(obj))
