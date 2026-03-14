"""Project management CLI commands."""

from pathlib import Path

import typer
from rich.console import Console
from rich.table import Table

from systemedu.storage.files import init_project_skeleton, load_project_yaml

project_app = typer.Typer(no_args_is_help=True)
console = Console()


@project_app.command("init")
def init(
    name: str = typer.Argument(help="Project name"),
    path: str = typer.Option(
        None, "--path", "-p", help="Directory to create project in"
    ),
):
    """Create a new project skeleton."""
    project_dir = Path(path) / name if path else Path.cwd() / name
    if project_dir.exists():
        console.print(f"[red]Directory already exists: {project_dir}[/red]")
        raise typer.Exit(1)

    init_project_skeleton(project_dir, name)
    console.print(f"[green]Created project '{name}' at {project_dir}[/green]")
    console.print("\nProject structure:")
    console.print(f"  {project_dir}/")
    console.print(f"  ├── project.yaml")
    console.print(f"  ├── knowledge_tree.json")
    console.print(f"  ├── skills/")
    console.print(f"  ├── agents/")
    console.print(f"  ├── mcp/")
    console.print(f"  └── artifacts/")


@project_app.command("list")
def list_projects(
    path: str = typer.Option(
        None, "--path", "-p", help="Directory to scan for projects"
    ),
):
    """List local projects."""
    scan_dir = Path(path) if path else Path.cwd()

    table = Table(title="Local Projects")
    table.add_column("Name", style="cyan")
    table.add_column("Title", style="white")
    table.add_column("Category", style="green")
    table.add_column("Path", style="dim")

    found = False
    for child in sorted(scan_dir.iterdir()):
        if child.is_dir() and (child / "project.yaml").exists():
            try:
                data = load_project_yaml(child)
                table.add_row(
                    data.get("name", child.name),
                    data.get("title", ""),
                    data.get("category", ""),
                    str(child),
                )
                found = True
            except Exception:
                pass

    if found:
        console.print(table)
    else:
        console.print("[dim]No projects found.[/dim]")


@project_app.command("info")
def info(
    path: str = typer.Argument(default=".", help="Project directory path"),
):
    """Show project information."""
    project_dir = Path(path).resolve()
    try:
        data = load_project_yaml(project_dir)
    except FileNotFoundError:
        console.print(f"[red]No project.yaml found in {project_dir}[/red]")
        raise typer.Exit(1)

    console.print(f"[bold]{data.get('title', data.get('name', 'Unknown'))}[/bold]")
    console.print(f"  Name: {data.get('name', 'N/A')}")
    console.print(f"  Version: {data.get('version', 'N/A')}")
    console.print(f"  Description: {data.get('description', 'N/A')}")
    console.print(f"  Category: {data.get('category', 'N/A')}")
    console.print(f"  Age Range: {data.get('age_range', 'N/A')}")
    console.print(f"  Tags: {', '.join(data.get('tags', []))}")
