"""systemedu-content CLI (typer).

用法:
    systemedu-content blueprint sync <source_dir> [--diff] [--slug X --slug Y]
    systemedu-content compile <slug>          # 单个
    systemedu-content compile --all           # 全部
    systemedu-content status <slug>
    systemedu-content publish <slug> [--target=local] [--admin-token=...] [--version=1.0.0]
    systemedu-content export <slug> [--version=1.0.0]
    systemedu-content import <tarball> [--target=local] [--admin-token=...]
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import typer
from rich.console import Console
from rich.table import Table

from . import blueprint as blueprint_mod
from . import compile as compile_mod
from . import package as package_mod
from . import publish as publish_mod
from . import workspace as workspace_mod


app = typer.Typer(
    name="systemedu-content",
    help="systemedu 内容生产流水线 CLI.",
    no_args_is_help=True,
)
blueprint_app = typer.Typer(help="蓝图 sync.")
app.add_typer(blueprint_app, name="blueprint")

console = Console()


# ---------------------------------------------------------------------------
# blueprint sync
# ---------------------------------------------------------------------------

@blueprint_app.command("sync")
def blueprint_sync(
    source: Path = typer.Argument(..., help="systemeduidea repo 路径"),
    diff: bool = typer.Option(False, "--diff", help="只显示有变化的项目"),
    slug: list[str] = typer.Option([], "--slug", "-s", help="只 sync 指定 slug (可重复)"),
) -> None:
    """从 ~/Dev/systemeduidea 同步蓝图到 content-workspace/blueprints/."""
    source = source.expanduser().resolve()
    workspace_mod.ensure_workspace()
    only_slugs = list(slug) if slug else None
    results = blueprint_mod.sync_blueprints(
        source, only_changed=False, only_slugs=only_slugs
    )
    console.print(f"syncing blueprints from [cyan]{source}[/cyan]...")
    new = updated = unchanged = 0
    for r in results:
        if r.status == "new":
            new += 1
            console.print(f"  [green]{r.slug:35s}[/green] (new)")
        elif r.status == "updated":
            updated += 1
            console.print(f"  [yellow]{r.slug:35s}[/yellow] (updated)")
        else:
            unchanged += 1
            if not diff:
                console.print(f"  [dim]{r.slug:35s}[/dim] (unchanged)")
    console.print(
        f"[bold]done.[/bold] {new} new, {updated} updated, {unchanged} unchanged "
        f"(total {len(results)}) → [cyan]{workspace_mod.blueprints_dir()}[/cyan]"
    )


# ---------------------------------------------------------------------------
# compile
# ---------------------------------------------------------------------------

@app.command("compile")
def compile_cmd(
    slug: str | None = typer.Argument(None, help="项目 slug (省略时配合 --all)"),
    all_: bool = typer.Option(False, "--all", help="编译 blueprints/ 下所有项目"),
) -> None:
    """README.md → V5 知识树骨架 + 空 knode 目录."""
    workspace_mod.ensure_workspace()
    targets: list[str] = []
    if all_:
        bp_dir = workspace_mod.blueprints_dir()
        targets = sorted(p.name for p in bp_dir.iterdir() if p.is_dir())
    elif slug:
        targets = [slug]
    else:
        raise typer.BadParameter("must pass <slug> or --all")

    for s in targets:
        try:
            r = compile_mod.compile_project(s)
        except FileNotFoundError as e:
            console.print(f"[red]{s}: skip ({e})[/red]")
            continue
        console.print(
            f"[green]✓[/green] [bold]{r.slug}[/bold]: "
            f"{r.stage_count} stages, {r.module_count} modules "
            f"→ [cyan]{r.tree_path.parent.parent.relative_to(workspace_mod.workspace_root())}[/cyan]"
        )


# ---------------------------------------------------------------------------
# status
# ---------------------------------------------------------------------------

def _knode_status(knode_path: Path) -> tuple[str, dict]:
    """返回 (status, details). status ∈ {'pending', 'partial', 'done'}.

    检查规则:
    - 没文件 → pending
    - 有 lesson.md 没 sections.json → partial
    - 有 lesson.md + sections.json → done
    """
    files = [p for p in knode_path.iterdir() if p.is_file()] if knode_path.is_dir() else []
    fnames = {f.name for f in files}
    details = {
        "files": len(files),
        "has_lesson_md": "lesson.md" in fnames,
        "has_sections_json": "sections.json" in fnames,
        "has_audio_scripts": "audio_scripts.json" in fnames,
        "has_assignment": "assignment.md" in fnames,
        "media_subdir": (knode_path / "media").is_dir() if knode_path.is_dir() else False,
    }
    if not files:
        return "pending", details
    if not (details["has_lesson_md"] and details["has_sections_json"]):
        return "partial", details
    return "done", details


@app.command("status")
def status_cmd(slug: str = typer.Argument(...)) -> None:
    """列出某个项目的 compile + knode 状态."""
    workspace_mod.ensure_workspace()
    bp_dir = workspace_mod.project_blueprint_dir(slug)
    gen_dir = workspace_mod.project_generated_dir(slug)
    manifest_path = gen_dir / "manifest.json"
    tree_path = gen_dir / "tree" / "knowledge_tree.json"

    console.print(f"[bold]project:[/bold] [cyan]{slug}[/cyan]")
    console.print(f"  blueprint:    {'[green]✓ synced[/green]' if bp_dir.is_dir() else '[red]✗ not synced[/red]'}")
    if not tree_path.is_file():
        console.print("  tree:         [red]✗ not compiled[/red]")
        console.print("  → run: [bold]systemedu-content compile " + slug + "[/bold]")
        raise typer.Exit()

    tree = json.loads(tree_path.read_text(encoding="utf-8"))
    manifest = (
        json.loads(manifest_path.read_text(encoding="utf-8"))
        if manifest_path.is_file()
        else {}
    )
    console.print(f"  tree:         [green]✓ compiled[/green] ({len(tree['modules'])} modules)")
    console.print("  knodes:")
    table = Table(show_header=True, header_style="bold")
    table.add_column("module")
    table.add_column("dir")
    table.add_column("status")
    table.add_column("files")
    counts = {"done": 0, "partial": 0, "pending": 0}
    for entry in manifest.get("knodes", []):
        knode_dir = gen_dir / entry["knode_dir"]
        st, details = _knode_status(knode_dir)
        counts[st] += 1
        color = {"done": "green", "partial": "yellow", "pending": "dim"}[st]
        icon = {"done": "✓", "partial": "⏳", "pending": "⏸"}[st]
        table.add_row(
            entry["module_id"],
            f"[{color}]{entry['knode_dir']}[/{color}]",
            f"[{color}]{icon} {st}[/{color}]",
            str(details["files"]),
        )
    console.print(table)
    console.print(
        f"  summary:      [green]{counts['done']} done[/green], "
        f"[yellow]{counts['partial']} partial[/yellow], "
        f"[dim]{counts['pending']} pending[/dim]"
    )


# ---------------------------------------------------------------------------
# publish (compile → package → upload)
# ---------------------------------------------------------------------------

@app.command("publish")
def publish_cmd(
    slug: str = typer.Argument(...),
    target: str = typer.Option("local", "--target", "-t", help="'local' 或 https://library.example.com"),
    admin_token: str | None = typer.Option(None, "--admin-token", help="library admin JWT (或 env LIBRARY_ADMIN_TOKEN)"),
    version: str | None = typer.Option(None, "--version", help="覆盖 manifest.version"),
    overwrite: bool = typer.Option(True, "--overwrite/--no-overwrite"),
) -> None:
    """打包 + 上传到远端 library."""
    workspace_mod.ensure_workspace()
    console.print(f"[bold]packaging[/bold] {slug}...")
    pkg = package_mod.package_project(slug, version=version)
    console.print(
        f"  [green]✓[/green] tarball: [cyan]{pkg.tarball_path}[/cyan] "
        f"({pkg.size_bytes / 1024 / 1024:.1f} MB, sha256: {pkg.sha256[:16]}...)"
    )
    console.print(f"[bold]uploading[/bold] to [cyan]{target}[/cyan]...")
    try:
        result = publish_mod.publish_tarball(
            pkg.tarball_path,
            target=target,
            admin_token=admin_token,
            overwrite=overwrite,
        )
    except Exception as e:
        console.print(f"[red]✗ publish failed: {e}[/red]")
        raise typer.Exit(1)
    console.print(
        f"[green]✓ published[/green]: slug={result.slug}, imported={result.imported}\n"
        f"  → {result.target_url}/v1/projects/{result.slug}"
    )


# ---------------------------------------------------------------------------
# export (compile → package, 不上传)
# ---------------------------------------------------------------------------

@app.command("export")
def export_cmd(
    slug: str = typer.Argument(...),
    version: str | None = typer.Option(None, "--version"),
) -> None:
    """只打包到 dist/, 不上传."""
    workspace_mod.ensure_workspace()
    console.print(f"[bold]packaging[/bold] {slug}...")
    pkg = package_mod.package_project(slug, version=version)
    console.print(
        f"[green]✓[/green] [cyan]{pkg.tarball_path}[/cyan]\n"
        f"  size:   {pkg.size_bytes / 1024 / 1024:.2f} MB\n"
        f"  sha256: {pkg.sha256}"
    )


# ---------------------------------------------------------------------------
# import (远端 library import 一个已有 tarball)
# ---------------------------------------------------------------------------

@app.command("import")
def import_cmd(
    tarball: Path = typer.Argument(..., exists=True, dir_okay=False),
    target: str = typer.Option("local", "--target", "-t"),
    admin_token: str | None = typer.Option(None, "--admin-token"),
    overwrite: bool = typer.Option(True, "--overwrite/--no-overwrite"),
) -> None:
    """上传一个已存在的 tarball 到远端 library."""
    console.print(f"[bold]uploading[/bold] {tarball.name} to {target}...")
    try:
        result = publish_mod.publish_tarball(
            tarball, target=target, admin_token=admin_token, overwrite=overwrite
        )
    except Exception as e:
        console.print(f"[red]✗ import failed: {e}[/red]")
        raise typer.Exit(1)
    console.print(
        f"[green]✓ imported[/green]: slug={result.slug}\n"
        f"  → {result.target_url}/v1/projects/{result.slug}"
    )


# ---------------------------------------------------------------------------
# login (utility)
# ---------------------------------------------------------------------------

@app.command("login")
def login_cmd(
    username: str = typer.Argument(...),
    password: str = typer.Option(..., "--password", "-p", prompt=True, hide_input=True),
    target: str = typer.Option("local", "--target", "-t"),
) -> None:
    """便利命令: 登录 library admin, 打印 JWT (后续可 export LIBRARY_ADMIN_TOKEN=...)."""
    try:
        token = publish_mod.login_for_token(target, username, password)
    except Exception as e:
        console.print(f"[red]✗ login failed: {e}[/red]")
        raise typer.Exit(1)
    # 直接 print, 避免 rich 换行/截断
    print(token)


if __name__ == "__main__":
    app()
