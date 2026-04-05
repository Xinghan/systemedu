#!/usr/bin/env python3
"""
SystemEdu Course Factory — Claude Code 离线课程生成流水线

用法：
    python scripts/course_factory.py "你的项目idea"
    python scripts/course_factory.py "牛顿三定律" --name newton-laws --age 12-15
    python scripts/course_factory.py "光合作用" --name photosynthesis --category biology

流程：
    1. Claude 根据 idea 设计完整知识树（科学严谨）
    2. Claude 为每个节点生成课程内容（plan_markdown + 动画HTML + 练习题）
    3. 直接写入 SQLite 数据库
    4. 无需启动服务，systemedu 系统打开即可看到全部内容

设计原则：
    - 知识树：按教育学循序渐进原则，难度梯度合理，有前置依赖
    - 动画：Canvas 2D，深色主题，物理/数学公式驱动，高视觉质量
    - 练习：选择题为主，有详细解析
    - plan_markdown：结构化学习计划，可直接呈现给学生
"""

from __future__ import annotations

import argparse
import json
import sys
import textwrap
from datetime import datetime
from pathlib import Path

# ── 路径设置 ───────────────────────────────────────────────────
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "src"))

from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn
from rich.table import Table
from rich.markdown import Markdown

console = Console()

# ── 视觉设计语言（所有动画的统一美学基准）────────────────────────
VISUAL_DESIGN_LANGUAGE = """
## SystemEdu 视觉设计语言

### 核心美学：Chromatic Depth（色深系统）
一种将科学精确性与感性视觉张力融合的设计语言。源自示波器荧光屏的冷光、
物理教科书的严密结构感，以及数字宇宙的无限景深。

### Canvas 动画技术规范
- **底色**：深夜蓝黑渐变 `#0f0a1e → #1a1035`，带微弱网格（3% 透明白）
- **主发光色**：根据学科选择：
  - 物理/力学：`#818cf8`（幽蓝紫），辅色 `#6366f1`
  - 数学/几何：`#34d399`（翡翠绿），辅色 `#10b981`
  - 化学/生物：`#f472b6`（荧光粉），辅色 `#ec4899`
  - 地球/天文：`#fb923c`（橙焰），辅色 `#f97316`
  - 通用/综合：`#38bdf8`（天蓝），辅色 `#0ea5e9`
- **渐变质感**：主体元素必须用 `createLinearGradient` 或 `createRadialGradient`，
  3层色：高光（亮）→ 中调 → 暗边，禁止纯色平涂
- **发光效果**：`ctx.shadowColor = color; ctx.shadowBlur = 12-20`
- **HUD 底栏**：`rgba(0,0,0,0.55)` 半透明条，高52px，显示4列数据
- **标题**：顶部居中，`bold 16px`，`rgba(255,255,255,0.9)`
- **网格线**：`rgba(255,255,255,0.03)`，40px间距
- **DPR 感知**：必须实现 `Math.min(window.devicePixelRatio||1, 2)` 缩放

### 动画物理性原则
- 所有运动量必须来自数学/物理公式，禁止关键帧插值
- 运动必须有物理意义（弹力用胡克定律，波用正弦函数等）
- HUD 实时显示核心物理量（数值保留1位小数）
"""

# ── 数据库写入 ──────────────────────────────────────────────────

def _ensure_db_tables() -> None:
    """确保所有表存在。"""
    from systemedu.storage.db import Base, get_engine
    Base.metadata.create_all(get_engine())


def _upsert_project(name: str, title: str, description: str, category: str,
                    age_range: list[int], estimated_hours: float, tags: list[str]) -> None:
    """注册或更新项目到 LocalProject 表。"""
    from systemedu.storage.db import LocalProject, get_session
    db = get_session()
    try:
        existing = db.query(LocalProject).filter_by(name=name).first()
        project_path = str(ROOT / "projects" / name)
        if existing:
            existing.title = title
            existing.description = description
            existing.category = category
            existing.path = project_path
        else:
            db.add(LocalProject(
                name=name, title=title, description=description,
                category=category, path=project_path,
            ))
        db.commit()
    finally:
        db.close()


def _upsert_lesson(project_name: str, knode_id: int, content_type: str,
                   course_content: dict) -> None:
    """写入 LessonContent 表（upsert）。"""
    from systemedu.storage.db import LessonContent, get_session
    db = get_session()
    try:
        lesson = db.query(LessonContent).filter_by(
            project_name=project_name, knode_id=knode_id
        ).first()
        content_json = json.dumps(course_content, ensure_ascii=False)
        if lesson:
            lesson.status = "ready"
            lesson.course_content = content_json
            lesson.content_type = content_type
            lesson.generated_at = datetime.now()
        else:
            db.add(LessonContent(
                project_name=project_name,
                knode_id=knode_id,
                status="ready",
                course_content=content_json,
                content_type=content_type,
                generated_at=datetime.now(),
            ))
        db.commit()
    finally:
        db.close()


def _init_progress(project_name: str, node_count: int) -> None:
    """初始化用户学习进度（第一个节点 available，其余 locked）。"""
    from systemedu.storage.db import ProgressRecord, get_session
    from systemedu.education.models import NodeStatus
    db = get_session()
    try:
        for i in range(node_count):
            existing = db.query(ProgressRecord).filter_by(
                user_id="default", project_name=project_name, knode_id=i
            ).first()
            if existing:
                continue  # 不覆盖已有进度
            status = NodeStatus.AVAILABLE.value if i == 0 else NodeStatus.LOCKED.value
            db.add(ProgressRecord(
                user_id="default", project_name=project_name,
                knode_id=i, status=status,
            ))
        db.commit()
    finally:
        db.close()


# ── 项目文件写入 ────────────────────────────────────────────────

def _write_project_files(name: str, title: str, description: str, category: str,
                          age_range: list[int], estimated_hours: float, tags: list[str],
                          tree_data: dict) -> Path:
    """写入 project.yaml 和 knowledge_tree.json。"""
    import yaml
    project_dir = ROOT / "projects" / name
    project_dir.mkdir(parents=True, exist_ok=True)

    project_data = {
        "name": name,
        "title": title,
        "description": description,
        "category": category,
        "age_range": age_range,
        "estimated_hours": estimated_hours,
        "tags": tags,
        "version": "1.0.0",
        "author": "claude-code",
        "knowledge_tree": "./knowledge_tree.json",
    }
    (project_dir / "project.yaml").write_text(
        yaml.dump(project_data, allow_unicode=True, default_flow_style=False),
        encoding="utf-8",
    )
    (project_dir / "knowledge_tree.json").write_text(
        json.dumps(tree_data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return project_dir


# ── 核心生成函数（由 Claude Code 直接调用自身能力）──────────────

def design_knowledge_tree(idea: str, name: str, age_range: list[int],
                           category: str) -> dict:
    """
    根据 idea 设计知识树。

    返回格式与 knowledge_tree.json 完全一致：
    {
      "milestones": [
        {
          "title": str, "description": str, "order": int, "xp_reward": int,
          "knodes": [
            {
              "title": str, "summary": str, "difficulty_level": int (1-5),
              "content_type": "interactive"|"experiment"|"text",
              "acceptance_type": "quiz",
              "estimated_minutes": int, "xp_reward": int,
              "order": int (global), "prerequisite_indices": [int, ...]
            }
          ]
        }
      ]
    }

    此函数在 Claude Code 上下文中运行，直接由 Claude 填充内容。
    外部调用者从此函数的返回值读取结果。
    """
    raise NotImplementedError(
        "此函数由 Claude Code 直接实现，不通过 LLM API 调用。"
        "请使用 --generate 模式运行脚本，Claude Code 会直接填充内容。"
    )


def generate_node_course(
    project_name: str,
    node_title: str,
    node_summary: str,
    milestone_title: str,
    difficulty: int,
    knode_id: int,
    category: str,
    design_language: str,
) -> dict:
    """
    为单个知识节点生成完整课程内容（CourseContent 格式）。

    返回格式：
    {
      "plan_markdown": str,       # 完整学习计划，Markdown
      "ideas": [CourseIdeaSummary],
      "rendered_sections": {
        idea_id: {
          "mode": "animation"|"exercise"|"story",
          "status": "ready",
          "html": str|null,       # 动画为 Canvas HTML，其余 null
          "story_paragraphs": list|null,
          "exercises": list|null,
          "generation_backend": str,
        }
      }
    }

    此函数在 Claude Code 上下文中运行，直接由 Claude 填充内容。
    """
    raise NotImplementedError(
        "此函数由 Claude Code 直接实现，不通过 LLM API 调用。"
    )


# ── CLI 入口 ──────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="SystemEdu Course Factory — 从 idea 到完整课程",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent(__doc__ or ""),
    )
    parser.add_argument("idea", help="项目主题 idea（一句话描述）")
    parser.add_argument("--name", default=None,
                        help="项目英文名（slug，如 newton-laws）。不填则自动生成")
    parser.add_argument("--age", default="12-15",
                        help="目标年龄段，格式 min-max，如 10-14（默认 12-15）")
    parser.add_argument("--category", default="science",
                        choices=["science", "math", "biology", "chemistry", "physics",
                                 "history", "language", "other"],
                        help="学科分类（默认 science）")
    parser.add_argument("--hours", type=float, default=None,
                        help="预计学习时长（小时）。不填则根据节点数自动计算")
    parser.add_argument("--dry-run", action="store_true",
                        help="只打印知识树设计，不写入数据库")
    args = parser.parse_args()

    # 解析年龄段
    try:
        age_parts = args.age.split("-")
        age_range = [int(age_parts[0]), int(age_parts[1])]
    except Exception:
        console.print(f"[red]年龄格式错误：{args.age}，应为如 12-15[/red]")
        sys.exit(1)

    console.print(Panel.fit(
        f"[bold cyan]SystemEdu Course Factory[/bold cyan]\n\n"
        f"Idea: [yellow]{args.idea}[/yellow]\n"
        f"年龄段: {age_range[0]}-{age_range[1]} 岁\n"
        f"分类: {args.category}",
        title="启动",
    ))

    console.print("\n[bold]此脚本是 Claude Code 的工作框架。[/bold]")
    console.print("Claude Code 负责：")
    console.print("  1. 调用 [cyan]design_knowledge_tree()[/cyan] → 设计知识树")
    console.print("  2. 调用 [cyan]generate_node_course()[/cyan] → 为每节点生成课程内容")
    console.print("  3. 调用 [cyan]write_to_db()[/cyan] → 写入数据库")
    console.print()
    console.print("[dim]请直接运行：[/dim]")
    console.print(f'  [green]python scripts/course_factory.py "{args.idea}"[/green]')
    console.print()
    console.print("[yellow]注：此脚本的实际执行由 Claude Code 在对话中完成，不通过 LLM API 调用。[/yellow]")


def write_to_db(
    name: str,
    title: str,
    description: str,
    category: str,
    age_range: list[int],
    estimated_hours: float,
    tags: list[str],
    tree_data: dict,
    course_contents: list[dict],  # 按 knode_id 顺序
    dry_run: bool = False,
) -> None:
    """
    将完整项目数据写入数据库和文件系统。

    course_contents: 列表，索引对应 knode_id，每项是 CourseContent dict。
    """
    console.rule("[bold cyan]写入数据库[/bold cyan]")

    # 计算节点总数
    node_count = sum(len(ms["knodes"]) for ms in tree_data["milestones"])
    assert len(course_contents) == node_count, (
        f"course_contents 数量 {len(course_contents)} 与节点数 {node_count} 不符"
    )

    if dry_run:
        console.print("[yellow]--dry-run 模式，跳过数据库写入[/yellow]")
        _show_dry_run_summary(name, title, tree_data, course_contents)
        return

    _ensure_db_tables()

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("{task.completed}/{task.total}"),
        console=console,
    ) as progress:
        task = progress.add_task("写入课程内容", total=node_count + 3)

        # 1. 写文件
        progress.update(task, description="写入项目文件 (project.yaml + knowledge_tree.json)")
        _write_project_files(name, title, description, category, age_range, estimated_hours, tags, tree_data)
        progress.advance(task)

        # 2. 注册项目
        progress.update(task, description="注册项目到数据库")
        _upsert_project(name, title, description, category, age_range, estimated_hours, tags)
        progress.advance(task)

        # 3. 初始化进度
        progress.update(task, description="初始化学习进度")
        _init_progress(name, node_count)
        progress.advance(task)

        # 4. 写入每个节点的课程内容
        for knode_id, course_content in enumerate(course_contents):
            # 找到节点的 content_type
            global_idx = 0
            content_type = "interactive"
            for ms in tree_data["milestones"]:
                for knode in ms["knodes"]:
                    if global_idx == knode_id:
                        content_type = knode.get("content_type", "interactive")
                        node_title = knode["title"]
                    global_idx += 1

            progress.update(task, description=f"节点 {knode_id}: {node_title[:20]}")
            _upsert_lesson(name, knode_id, content_type, course_content)
            progress.advance(task)

    console.print(f"\n[bold green]完成！[/bold green] 项目 '{name}' 已写入数据库")
    console.print(f"共 {node_count} 个知识节点，所有内容 status=ready")
    console.print(f"\n启动 systemedu 查看：[dim]./scripts/restart.sh[/dim]")
    console.print(f"或直接访问：[dim]http://localhost:3000/projects/{name}[/dim]")


def _show_dry_run_summary(name: str, title: str, tree_data: dict,
                           course_contents: list[dict]) -> None:
    """打印 dry-run 时的摘要。"""
    table = Table(title=f"知识树预览：{title} ({name})")
    table.add_column("ID", style="dim", width=4)
    table.add_column("里程碑", style="cyan", max_width=20)
    table.add_column("节点标题", style="white", max_width=28)
    table.add_column("难度", width=4)
    table.add_column("分钟", width=6)
    table.add_column("前置", max_width=12)

    global_idx = 0
    for ms in tree_data["milestones"]:
        for knode in ms["knodes"]:
            prereqs = ",".join(str(p) for p in knode.get("prerequisite_indices", []))
            table.add_row(
                str(global_idx),
                ms["title"],
                knode["title"],
                str(knode.get("difficulty_level", 1)),
                str(knode.get("estimated_minutes", 20)),
                prereqs or "-",
            )
            global_idx += 1

    console.print(table)

    if course_contents:
        console.print(f"\n课程内容预览（节点 0）：")
        c = course_contents[0]
        plan = c.get("plan_markdown", "")
        console.print(Markdown(plan[:800] + ("..." if len(plan) > 800 else "")))
        ideas = c.get("ideas", [])
        console.print(f"\n富媒体单元：{len(ideas)} 个")
        for idea in ideas:
            console.print(f"  - [{idea['mode']}] {idea['topic']}")


# ── Canvas 动画 HTML 生成辅助函数（供 Claude Code 调用）──────────

def make_canvas_html(
    title: str,
    js_body: str,
    params_js: str = "",
    color_main: str = "#818cf8",
) -> str:
    """
    生成标准 Canvas 2D 动画 HTML。

    js_body: 完整的 JS 逻辑（不含 params 声明和 canvas setup）
    params_js: 参数声明部分（var TITLE=...; var X=...;）
    返回完整自包含 HTML。
    """
    return f"""<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8"/>
<style>
*{{box-sizing:border-box;margin:0;padding:0}}
html,body{{width:100%;height:100%;overflow:hidden;background:#0f0a1e;
  font-family:"Noto Sans SC","PingFang SC","Microsoft YaHei",system-ui,sans-serif}}
canvas{{display:block;width:100%;height:100%;position:absolute;top:0;left:0}}
</style>
</head>
<body>
<canvas id="c"></canvas>
<script>
(function(){{
"use strict";

/* ── params ── */
var TITLE = {json.dumps(title, ensure_ascii=False)};
{params_js}

/* ── canvas setup ── */
var canvas = document.getElementById("c");
var ctx = canvas.getContext("2d");
var W = 600, H = 420;
var DPR = Math.min(window.devicePixelRatio||1, 2);
function resize(){{
  var rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * DPR;
  canvas.height = rect.height * DPR;
  ctx.setTransform(1,0,0,1,0,0);
  ctx.scale(DPR * rect.width / W, DPR * rect.height / H);
}}
resize();
window.addEventListener("resize", resize);

/* ── color ── */
var COLOR = {json.dumps(color_main)};
function hex2rgb(h){{
  h=h.replace("#","");
  if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];
}}
var RGB = hex2rgb(COLOR);
var C = "rgb("+RGB[0]+","+RGB[1]+","+RGB[2]+")";
var CA = function(a){{return"rgba("+RGB[0]+","+RGB[1]+","+RGB[2]+","+a+")"}};

/* ── utils ── */
function roundRect(x,y,w,h,r){{
  ctx.beginPath();
  ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}}
function drawBg(){{
  var g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,"#0f0a1e");g.addColorStop(1,"#1a1035");
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  ctx.strokeStyle="rgba(255,255,255,0.03)";ctx.lineWidth=1;
  for(var x=0;x<=W;x+=40){{ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}}
  for(var y=0;y<=H;y+=40){{ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}}
}}
function drawTitle(){{
  ctx.font="bold 16px 'Noto Sans SC',system-ui";
  ctx.textAlign="center";ctx.fillStyle="rgba(255,255,255,0.9)";
  ctx.fillText(TITLE,W/2,28);
}}
function drawHUD(cols){{
  var by=H-52;
  ctx.fillStyle="rgba(0,0,0,0.55)";
  roundRect(0,by,W,52,0);ctx.fill();
  ctx.strokeStyle="rgba(255,255,255,0.06)";ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(0,by);ctx.lineTo(W,by);ctx.stroke();
  var cw=W/cols.length;
  cols.forEach(function(c,i){{
    var cx=cw*i+cw/2;
    ctx.font="10px 'Noto Sans SC',system-ui";ctx.textAlign="center";
    ctx.fillStyle=CA(0.5);ctx.fillText(c.label,cx,by+17);
    ctx.font="bold 14px 'Noto Sans SC',system-ui";
    ctx.fillStyle="rgba(255,255,255,0.88)";ctx.fillText(c.val,cx,by+38);
  }});
}}

/* ── main ── */
{js_body}

}})();
</script>
</body>
</html>"""


# ── v4.1 知识树上下文加载与对齐校验 ──────────────────────────────

def load_knode_context(project_name: str, knode_global_idx: int) -> dict:
    """
    从 projects/{name}/knowledge_tree.json 读取指定 global index 的 knode，
    并返回完整上下文（knode + milestone + sub_project）。

    参数：
        project_name: 项目英文 slug，例如 "mars-risk-map"
        knode_global_idx: 跨 milestone 的全局知识节点序号（与后端 api_project_detail 中的 id 一致）

    返回：
        {
            "knode": dict,           # 完整 knode dict，包含 v4.1 字段
            "milestone": dict,       # 所属 milestone 的 title/description
            "sub_project": dict|None, # 所属 sub_project（按 milestone_indices 匹配，可能为 None）
        }

    异常：
        FileNotFoundError: 项目目录不存在
        ValueError: knode_global_idx 超出范围
    """
    tree_path = ROOT / "projects" / project_name / "knowledge_tree.json"
    if not tree_path.exists():
        raise FileNotFoundError(f"knowledge_tree.json not found: {tree_path}")

    tree = json.loads(tree_path.read_text(encoding="utf-8"))
    milestones = tree.get("milestones", [])
    sub_projects = tree.get("sub_projects", [])

    idx = 0
    for ms_i, ms in enumerate(milestones):
        for kn in ms.get("knodes", []):
            if idx == knode_global_idx:
                sub = next(
                    (sp for sp in sub_projects if ms_i in sp.get("milestone_indices", [])),
                    None,
                )
                return {
                    "knode": kn,
                    "milestone": {
                        "title": ms.get("title", ""),
                        "description": ms.get("description", ""),
                    },
                    "sub_project": sub,
                }
            idx += 1

    raise ValueError(
        f"knode global index {knode_global_idx} out of range (project has {idx} knodes)"
    )


def preflight_v41(knode: dict, course_content: dict) -> list[str]:
    """
    校验 course_content 是否满足 v4.1 知识树对齐约束。

    返回违规列表；空列表表示通过。

    三条硬约束：
    1. 每个 game/animation/exercise 类型的 idea 都必须带 hands_on_ref 和 acceptance_ref，
       且值必须能在 knode.hands_on_components / acceptance_standard / acceptance_artifacts 中找到。
    2. 如果 knode.hands_on_components 非空，ideas 中必须至少有一条覆盖其中的某一项动作。
    3. 如果 knode.core_question 非空，plan_markdown 中必须出现该问题（或其等价改写）。

    对于旧版（v4.0 或更早）knode，如果 hands_on_components / acceptance_* / core_question 都为空，
    则跳过所有校验，返回空列表（向后兼容）。
    """
    errors: list[str] = []

    hands_on = set(knode.get("hands_on_components", []) or [])
    standards = set(knode.get("acceptance_standard", []) or [])
    artifacts_titles = {
        a.get("title", "")
        for a in (knode.get("acceptance_artifacts", []) or [])
        if a.get("title")
    }
    core_question = (knode.get("core_question", "") or "").strip()

    # 旧版兼容：无任何 v4.1 字段则跳过校验
    has_v41 = bool(hands_on or standards or artifacts_titles or core_question)
    if not has_v41:
        return errors

    ideas = course_content.get("ideas", []) or []
    plan_markdown = course_content.get("plan_markdown", "") or ""

    # 约束 1: 每个 rich-media idea 都必须有 refs 且值合法
    ref_modes = {"game", "animation", "exercise"}
    for idea in ideas:
        if idea.get("mode") not in ref_modes:
            continue
        idea_id = idea.get("idea_id", "<no-id>")
        href = (idea.get("hands_on_ref", "") or "").strip()
        aref = (idea.get("acceptance_ref", "") or "").strip()

        if hands_on and not href:
            errors.append(f"idea {idea_id} 缺少 hands_on_ref")
        elif href and hands_on and href not in hands_on:
            errors.append(
                f"idea {idea_id} hands_on_ref '{href[:40]}...' 不在 knode.hands_on_components 中"
            )

        if (standards or artifacts_titles) and not aref:
            errors.append(f"idea {idea_id} 缺少 acceptance_ref")
        elif aref and (standards or artifacts_titles):
            if aref not in standards and aref not in artifacts_titles:
                errors.append(
                    f"idea {idea_id} acceptance_ref '{aref[:40]}...' "
                    f"不在 knode.acceptance_standard / acceptance_artifacts 中"
                )

    # 约束 2: hands_on_components 至少被一条 idea 覆盖
    if hands_on:
        covered = {
            (idea.get("hands_on_ref", "") or "").strip()
            for idea in ideas
            if idea.get("mode") in ref_modes
        }
        if not (hands_on & covered):
            errors.append(
                f"hands_on_components 未被任何 idea 覆盖（共 {len(hands_on)} 条动作）"
            )

    # 约束 3: plan_markdown 必须出现 core_question
    if core_question and core_question not in plan_markdown:
        errors.append(
            f"plan_markdown 未出现 core_question: '{core_question[:40]}...'"
        )

    return errors


# ── 外部资料研究（Tavily Search 集成）───────────────────────────

# 需要外部资料的知识节点的典型关键词（工程/科学/数据/算法/仪器/标准）
_RESEARCH_KEYWORDS_EN = {
    "algorithm", "model", "dataset", "sensor", "camera", "spectrum", "frequency",
    "wavelength", "protocol", "standard", "pipeline", "benchmark", "metric",
    "neural", "cnn", "transformer", "bayesian", "gradient", "optimization",
    "simulation", "finite element", "fourier", "laplace", "eigen", "tensor",
    "api", "library", "framework", "sdk",
    "mars", "hirise", "terrain", "satellite", "telescope", "lidar", "radar",
    "dna", "rna", "protein", "enzyme", "genome", "mitochondria", "neuron",
    "quantum", "photon", "electron", "isotope", "crystalline",
    "geological", "seismic", "hydrology", "meteorology",
}
_RESEARCH_KEYWORDS_ZH = {
    "算法", "模型", "数据集", "传感器", "相机", "光谱", "频率",
    "波长", "协议", "标准", "流水线", "基准", "指标",
    "神经网络", "梯度", "优化", "仿真", "有限元", "傅立叶",
    "火星", "地形", "卫星", "望远镜", "激光雷达", "雷达",
    "蛋白", "基因", "酶", "神经元", "量子", "光子", "电子",
    "地质", "地震", "水文", "气象", "绘制地图", "地图", "地形数据",
    "工程", "测量", "观测", "实验", "仪器",
}

# 不需要外部资料的知识节点（方法论、元认知、项目前置说明）
_SKIP_RESEARCH_KEYWORDS_ZH = {
    "介绍", "导入", "概述", "预备", "前置", "开篇", "总结", "回顾", "反思",
    "学习方法", "如何学习", "项目说明", "流程说明", "规则说明", "评分标准",
    "展示与分享", "答辩", "汇报", "路演",
}


def should_research_knode(knode: dict, milestone: dict | None = None) -> bool:
    """
    判断一个知识节点是否应该通过 Tavily 搜索补充外部资料。

    启发式规则（按优先级）：
    1. 显式跳过：title/summary 命中"介绍/导入/展示"等方法论关键词 → False
    2. 显式研究：title/summary/hands_on_components 命中科学/工程关键词 → True
    3. 难度托底：difficulty_level >= 5（中等以上）且 knode 有 hands_on_components 或 module_role in {engineering, application, investigation} → True
    4. 默认：False（前置说明类节点不需要联网）

    参数：
        knode: v4.1 knode dict
        milestone: 所属 milestone dict（可选，用于补充上下文）

    返回：
        True 表示建议调用 research_knode()；False 表示跳过。
    """
    title = (knode.get("title", "") or "").lower()
    summary = (knode.get("summary", "") or "").lower()
    hands_on_text = " ".join(knode.get("hands_on_components", []) or []).lower()
    combined = f"{title} {summary} {hands_on_text}"

    # 规则 1: 显式跳过
    for kw in _SKIP_RESEARCH_KEYWORDS_ZH:
        if kw in title or kw in summary:
            return False

    # 规则 2: 关键词命中
    for kw in _RESEARCH_KEYWORDS_EN:
        if kw in combined:
            return True
    for kw in _RESEARCH_KEYWORDS_ZH:
        if kw in combined:
            return True

    # 规则 3: 难度 + 工程角色托底
    difficulty = int(knode.get("difficulty_level", 0) or 0)
    module_role = (knode.get("module_role", "") or "").lower()
    engineering_roles = {"engineering", "application", "investigation", "implementation", "analysis"}
    if difficulty >= 5 and (
        knode.get("hands_on_components") or module_role in engineering_roles
    ):
        return True

    return False


def _extract_youtube_id(url: str) -> str | None:
    """
    从 YouTube URL 提取 video id。
    支持：
      - https://www.youtube.com/watch?v=ID
      - https://m.youtube.com/watch?v=ID
      - https://youtu.be/ID
      - https://www.youtube.com/embed/ID
      - https://www.youtube.com/v/ID
      - https://www.youtube.com/shorts/ID
    """
    try:
        from urllib.parse import urlparse, parse_qs

        u = urlparse(url)
        host = u.netloc.lower()
        if "youtube.com" in host:
            qs = parse_qs(u.query)
            if "v" in qs and qs["v"]:
                return qs["v"][0]
            # /embed/{id} / /v/{id} / /shorts/{id}
            parts = [p for p in u.path.split("/") if p]
            if len(parts) >= 2 and parts[0] in ("embed", "v", "shorts"):
                return parts[1]
        if host == "youtu.be":
            return u.path.lstrip("/").split("/")[0] or None
    except Exception:
        pass
    return None


def research_knode(
    knode: dict,
    milestone: dict | None = None,
    sub_project: dict | None = None,
    *,
    web_query: str | None = None,
    youtube_query: str | None = None,
    max_web: int = 4,
    max_youtube: int = 2,
    api_key: str | None = None,
) -> dict:
    """
    为一个知识节点调用 Tavily Search 抓取外部资料。

    调用方应先用 should_research_knode() 判断是否值得搜索。
    本函数不做启发式判断，调用即搜索。

    参数：
        knode: 完整的 v4.1 knode dict
        milestone: 所属 milestone（用于丰富查询词）
        sub_project: 所属 sub_project（用于丰富查询词）
        web_query: 网页查询词。为 None 时自动从 knode/milestone/sub_project 组合。
                   建议 Claude Code 显式传入针对该 knode 的高质量英文或中文查询词，
                   例如 "Mars HiRISE DEM stereo reconstruction"。
        youtube_query: YouTube 查询词。为 None 时自动使用 "{title} tutorial explained"。
                       建议传入**英文**查询词以获得更广的视频覆盖。
        max_web: 网页结果最大条数（默认 4）
        max_youtube: YouTube 结果最大条数（默认 2）
        api_key: Tavily API key；为 None 时从 ~/.systemedu/config.yaml 读取

    返回：
        {
            "web_query": str,
            "youtube_query": str,
            "web_results": [
                {"title": str, "url": str, "snippet": str, "score": float},
                ...
            ],
            "youtube_results": [
                {"title": str, "url": str, "video_id": str, "snippet": str, "score": float},
                ...
            ],
            "researched_at": ISO-8601 timestamp,
        }

    异常：
        RuntimeError: Tavily API key 不可用或 Tavily 调用失败
    """
    # 1. API key 解析
    if api_key is None:
        try:
            from systemedu.core.config import get_config

            api_key = get_config().search.tavily_api_key
        except Exception:
            api_key = ""
    if not api_key:
        raise RuntimeError(
            "Tavily API key 不可用：请在 ~/.systemedu/config.yaml 的 search.tavily_api_key 中配置"
        )

    # 2. 构造查询词（调用方未显式传入时回退到自动合并）
    title = (knode.get("title", "") or "").strip()
    ms_title = (milestone or {}).get("title", "") if milestone else ""
    sp_topic = ""
    if sub_project:
        sp_topic = (sub_project.get("title", "") or sub_project.get("id", "") or "").strip()

    if not web_query:
        web_query_parts = [p for p in [sp_topic, ms_title, title] if p]
        web_query = " ".join(web_query_parts[:3]) or title
    if not youtube_query:
        youtube_query = f"{title} tutorial explained"

    # 3. 调用 Tavily
    from datetime import datetime

    try:
        from tavily import TavilyClient  # type: ignore

        client = TavilyClient(api_key=api_key)

        web_raw = client.search(
            web_query,
            max_results=max_web,
            include_answer=False,
            include_raw_content=False,
        )

        yt_raw = client.search(
            youtube_query,
            max_results=max_youtube,
            include_domains=["youtube.com"],
            include_answer=False,
            include_raw_content=False,
        )
    except Exception as e:
        raise RuntimeError(f"Tavily 搜索失败: {e}") from e

    # 4. 整理网页结果
    web_results: list[dict] = []
    for item in (web_raw.get("results") or [])[:max_web]:
        url = item.get("url", "")
        if not url or "youtube.com" in url or "youtu.be" in url:
            continue  # 网页通道排除 YouTube
        web_results.append({
            "title": (item.get("title") or "").strip(),
            "url": url,
            "snippet": (item.get("content") or "").strip()[:400],
            "score": float(item.get("score") or 0.0),
        })

    # 5. 整理 YouTube 结果（提取 video_id）
    youtube_results: list[dict] = []
    for item in (yt_raw.get("results") or [])[:max_youtube]:
        url = item.get("url", "")
        vid = _extract_youtube_id(url) if url else None
        if not vid:
            continue
        youtube_results.append({
            "title": (item.get("title") or "").strip(),
            "url": url,
            "video_id": vid,
            "snippet": (item.get("content") or "").strip()[:300],
            "score": float(item.get("score") or 0.0),
        })

    return {
        "web_query": web_query,
        "youtube_query": youtube_query,
        "web_results": web_results,
        "youtube_results": youtube_results,
        "researched_at": datetime.now().isoformat(),
    }


def merge_resources_into_plan(plan_markdown: str, research: dict | None) -> str:
    """
    把 research_knode() 的返回结果融入 plan_markdown。

    融入策略（保持纯 markdown，前端 ReactMarkdown 默认可渲染）：
    - YouTube 视频：插入在"## 深入理解"之后（如果找不到该段，则插在"## 核心概念"后；再没有则附在末尾）。
      格式：
        ## 推荐视频
        [![视频标题](https://img.youtube.com/vi/{id}/hqdefault.jpg)](https://www.youtube.com/watch?v={id})
        > 点击图片观看：**视频标题** — 简短摘要
    - 网页资料：追加一个"## 延伸阅读"段落，列表形式：
        - [**标题**](url) — 一句话摘要

    如果 research 为 None 或没有任何结果，原样返回 plan_markdown。
    """
    if not research:
        return plan_markdown
    web = research.get("web_results") or []
    youtube = research.get("youtube_results") or []
    if not web and not youtube:
        return plan_markdown

    text = plan_markdown.rstrip() + "\n"

    # 1. 视频部分（优先插入到"深入理解"之后）
    if youtube:
        video_lines: list[str] = ["## 推荐视频", ""]
        for v in youtube:
            vid = v.get("video_id", "")
            title = v.get("title", "").replace("[", "(").replace("]", ")")
            url = v.get("url", "")
            snippet = v.get("snippet", "")
            if not vid or not url:
                continue
            thumb = f"https://img.youtube.com/vi/{vid}/hqdefault.jpg"
            video_lines.append(f"[![{title}]({thumb})]({url})")
            video_lines.append("")
            if snippet:
                video_lines.append(f"> **{title}** — {snippet}")
            else:
                video_lines.append(f"> **{title}** — [在 YouTube 上观看]({url})")
            video_lines.append("")

        video_block = "\n".join(video_lines)

        # 尝试插入到"## 深入理解"或"## 核心概念"之后
        anchors = ["## 深入理解", "## 核心概念"]
        inserted = False
        for anchor in anchors:
            idx = text.find(anchor)
            if idx < 0:
                continue
            # 找到该段下一个 "## " 同级标题
            search_start = idx + len(anchor)
            next_h2 = text.find("\n## ", search_start)
            insert_pos = next_h2 + 1 if next_h2 >= 0 else len(text)
            text = text[:insert_pos] + video_block + "\n" + text[insert_pos:]
            inserted = True
            break
        if not inserted:
            text = text.rstrip() + "\n\n" + video_block + "\n"

    # 2. 网页资料（追加到末尾）
    if web:
        lines: list[str] = ["", "## 延伸阅读", ""]
        lines.append("> 以下资料由系统自动检索并筛选，供深入研究参考：")
        lines.append("")
        for r in web:
            title = (r.get("title") or "").replace("[", "(").replace("]", ")")
            url = r.get("url", "")
            snippet = (r.get("snippet") or "").strip()
            if not title or not url:
                continue
            if snippet:
                lines.append(f"- [**{title}**]({url}) — {snippet[:200]}")
            else:
                lines.append(f"- [**{title}**]({url})")
        lines.append("")
        text = text.rstrip() + "\n" + "\n".join(lines)

    return text


# ── 练习题构造辅助函数 ─────────────────────────────────────────

def make_exercises(items: list[dict]) -> list[dict]:
    """
    构造标准练习题列表。

    items 每项：
    {
      "question": str,
      "options": [str, str, str, str],  # 4个选项
      "correct": int,                    # 0-3
      "explanation": str,
      "ref": str,                        # v4.1 可选：对应的 hands_on_components 或 acceptance_standard 原文
    }
    返回符合 InlineExercise 格式的列表。
    """
    result = []
    for item in items:
        exercise = {
            "type": "choice",
            "question": item["question"],
            "options": item["options"],
            "correct": item["correct"],
            "explanation": item["explanation"],
        }
        # v4.1: 保留题目的对齐引用
        if "ref" in item and item["ref"]:
            exercise["ref"] = item["ref"]
        result.append(exercise)
    return result


def make_course_content(
    plan_markdown: str,
    animation_html: str,
    animation_topic: str,
    exercises: list[dict],
    exercise_topic: str,
    story_paragraphs: list[dict] | None = None,
    *,
    # v4.1 对齐字段（可选，但传入 knode 时会自动校验）
    knode: dict | None = None,
    animation_hands_on_ref: str = "",
    animation_acceptance_ref: str = "",
    exercise_hands_on_ref: str = "",
    exercise_acceptance_ref: str = "",
    preflight: bool = True,
    # 外部资料（Tavily research_knode() 的返回值）
    research: dict | None = None,
) -> dict:
    """
    构造标准 CourseContent dict，供写入数据库。

    基础参数：
        animation_html: 完整 Canvas HTML 字符串
        exercises: make_exercises() 的返回值
        story_paragraphs: [{"text": str, "image_url": ""}] 或 None

    v4.1 参数（都是可选，但 knode 含 v4.1 字段时应该全部提供）：
        knode: 完整的 v4.1 knode dict（来自 load_knode_context() 或直接读 JSON）。
               传入后会自动调用 preflight_v41() 校验生成的 course_content。
        animation_hands_on_ref: animation idea 对应的 hands_on_components 原文
        animation_acceptance_ref: animation idea 对应的 acceptance_standard/artifact title 原文
        exercise_hands_on_ref: exercise idea 对应的 hands_on_components 原文
        exercise_acceptance_ref: exercise idea 对应的 acceptance_standard/artifact title 原文
        preflight: 是否在 knode 非空时自动校验（默认 True）。

    外部资料参数：
        research: research_knode() 返回的 dict。传入后会：
                  1) 调用 merge_resources_into_plan() 把视频和网页融入 plan_markdown
                  2) 在 course_content 顶层添加 external_resources 字段（结构化保留）
                  调用方应先用 should_research_knode() 判断节点是否需要联网。

    异常：
        ValueError: 当 knode 非空且 preflight=True 且校验失败时抛出，
                    异常消息包含所有违规项，便于调试。
    """
    import time, random, string

    def _id(prefix: str) -> str:
        ts = int(time.time() * 1000)
        rand = "".join(random.choices(string.ascii_lowercase, k=4))
        return f"{prefix}_{ts}_{rand}"

    # 0. 把外部资料融入 plan_markdown（如果传入了 research）
    if research:
        plan_markdown = merge_resources_into_plan(plan_markdown, research)

    anim_id = _id("anim")
    ex_id = _id("ex")

    anim_idea: dict = {
        "idea_id": anim_id,
        "mode": "animation",
        "topic": animation_topic,
        "context_summary": animation_topic,
        "generation_backend": "canvas_direct",
        "style_key": "chromatic_depth",
        "mode_reason": "核心概念需要动态可视化演示",
    }
    if animation_hands_on_ref:
        anim_idea["hands_on_ref"] = animation_hands_on_ref
    if animation_acceptance_ref:
        anim_idea["acceptance_ref"] = animation_acceptance_ref

    ex_idea: dict = {
        "idea_id": ex_id,
        "mode": "exercise",
        "topic": exercise_topic,
        "context_summary": exercise_topic,
        "generation_backend": "",
        "style_key": "",
        "mode_reason": "需要练习题巩固知识点",
    }
    if exercise_hands_on_ref:
        ex_idea["hands_on_ref"] = exercise_hands_on_ref
    if exercise_acceptance_ref:
        ex_idea["acceptance_ref"] = exercise_acceptance_ref

    ideas = [anim_idea, ex_idea]

    rendered_sections: dict = {
        anim_id: {
            "mode": "animation",
            "status": "ready",
            "html": animation_html,
            "story_paragraphs": None,
            "exercises": None,
            "generation_backend": "canvas_direct",
        },
        ex_id: {
            "mode": "exercise",
            "status": "ready",
            "html": None,
            "story_paragraphs": None,
            "exercises": exercises,
            "generation_backend": "",
        },
    }

    if story_paragraphs:
        story_id = _id("story")
        ideas.insert(1, {
            "idea_id": story_id,
            "mode": "story",
            "topic": "情境导入",
            "context_summary": "通过真实情境引入知识点",
            "generation_backend": "",
            "style_key": "",
            "mode_reason": "用故事情境激发学习兴趣",
        })
        rendered_sections[story_id] = {
            "mode": "story",
            "status": "ready",
            "html": None,
            "story_paragraphs": story_paragraphs,
            "exercises": None,
            "generation_backend": "",
        }

    course_content = {
        "plan_markdown": plan_markdown,
        "ideas": ideas,
        "rendered_sections": rendered_sections,
    }

    # 外部资料结构化字段（前端未来可以直接 iframe 嵌入；当前前端会忽略此字段）
    if research:
        course_content["external_resources"] = {
            "web_query": research.get("web_query", ""),
            "youtube_query": research.get("youtube_query", ""),
            "web_results": research.get("web_results", []),
            "youtube_results": research.get("youtube_results", []),
            "researched_at": research.get("researched_at", ""),
        }

    # v4.1 自动校验
    if preflight and knode is not None:
        errors = preflight_v41(knode, course_content)
        if errors:
            msg = "v4.1 preflight failed:\n" + "\n".join(f"  - {e}" for e in errors)
            raise ValueError(msg)

    return course_content


if __name__ == "__main__":
    main()
