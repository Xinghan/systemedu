"""Skill management CLI commands (Phase 2 placeholder)."""

import typer
from rich.console import Console

skill_app = typer.Typer(no_args_is_help=True)
console = Console()


@skill_app.command("list")
def list_skills():
    """List available skills."""
    console.print("[dim]Built-in skills:[/dim]")
    console.print("  [cyan]tutor[/cyan]    - AI 导师, 个性化教学")
    console.print("  [cyan]assessor[/cyan] - 知识评估")
    console.print("  [cyan]planner[/cyan]  - 学习计划生成")


@skill_app.command("add")
def add(path: str = typer.Argument(help="Path to skill directory")):
    """Add a local skill."""
    console.print(f"[yellow]Skill loading not yet implemented (Phase 2).[/yellow]")


@skill_app.command("remove")
def remove(name: str = typer.Argument(help="Skill name to remove")):
    """Remove a skill."""
    console.print(f"[yellow]Skill management not yet implemented (Phase 2).[/yellow]")
