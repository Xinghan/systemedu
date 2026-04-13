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
import re
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
- **等比缩放（禁止非等比拉伸）**：动画必须在固定的 W×H 逻辑坐标系
  （如 600×420）中作画，`resize()` 采用 letterbox 策略：
  `scale = Math.min(rectW/W, rectH/H)`，然后 `ctx.setTransform(
  DPR*scale, 0, 0, DPR*scale, DPR*offsetX, DPR*offsetY)`（offset 居中）。
  **严禁**使用 `ctx.scale(rectW/W, rectH/H)` 这种**非等比**缩放，会导致
  字体和图形在宽高比变化时被拉宽/压扁。
- **Resize 健壮性**：动画 HTML 会被 iframe 嵌入并在前端动态调整大小。
  `resize()` 函数必须（1）重分配 canvas backing store 后**立即调用一次**
  `drawCurrent()`/等价重绘函数；（2）同时挂接 `window.resize` 事件和
  `ResizeObserver(canvas.parentElement)`，因为 iframe 内的 window 对
  父页面 resize 不敏感。course_factory 会在写入数据库前调用
  `inject_animation_resize_patch()` 自动补丁，但 LLM 生成的原始 HTML
  也应该尽量在源头就写对，避免依赖补丁。

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


_IFRAME_LAYOUT_PATCH = """<style>
/* iframe 嵌入补丁: 防止 fixed 元素和 header 重叠 */
.lang-btn{top:auto!important;bottom:100px!important;left:8px!important;}
.guide-panel{top:40px!important;right:8px!important;max-width:200px!important;max-height:30vh!important;font-size:11px!important;}
</style>"""


def _inline_runtime(html: str) -> str:
    """将 animation_runtime.js 的 <script src> 引用替换为内联代码。

    iframe srcdoc 嵌入时无法加载相对路径的外部脚本，
    所以必须把 runtime 代码直接内联到 HTML 中。
    同时注入布局补丁防止 fixed 元素在 iframe 中重叠。
    """
    if '<script src="animation_runtime.js">' not in html:
        return html
    runtime_path = ROOT / "scripts" / "animation_runtime.js"
    if not runtime_path.exists():
        return html
    runtime_code = runtime_path.read_text(encoding="utf-8")
    result = html.replace(
        '<script src="animation_runtime.js"></script>',
        f"<script>\n{runtime_code}\n</script>",
    )
    # 注入 iframe 布局补丁 (在 </head> 前)
    if "</head>" in result:
        result = result.replace("</head>", f"{_IFRAME_LAYOUT_PATCH}\n</head>")
    return result


# ---------------------------------------------------------------------------
# Assignment generation (Step 6.5)
# ---------------------------------------------------------------------------

_ASSIGNMENT_PROMPT_NORMAL = """你是一位经验丰富的教育内容设计师。请根据以下知识节点信息，生成一份循序渐进的作业练习。

知识节点：{node_title}
内容摘要：{node_summary}
难度等级：{difficulty}/5
所属模块：{milestone_title}

请按照以下结构生成作业（全部用中文）：

## 一、选择题（3题）

每题给出4个选项，标注正确答案。格式：
**1. 题目内容**
A. 选项A
B. 选项B
C. 选项C
D. 选项D
**答案：X**

## 二、问答题（2题）

开放性问题，引导学生深入思考。每题后附参考答案要点。

## 三、动手项目

设计一个可以在家完成的动手操作项目（实验/制作/观察均可），要求：
- 使用身边容易获得的材料
- 步骤清晰，适合独立完成
- 与本节知识点紧密相关

在动手项目标题前加上 [HANDS_ON] 标记。

请直接输出作业内容，不要有额外的前言说明。"""

_ASSIGNMENT_PROMPT_CAPSTONE = """你是一位经验丰富的教育内容设计师。请根据以下大作业节点信息，生成一份严谨的大作业提交考核指南。

大作业名称：{node_title}
所属模块：{milestone_title}

交付物清单：
{artifacts_text}

验收标准：
{standards_text}

请按照以下结构生成考核指南（全部用中文）：

## 一、考核要点说明

逐条对照验收标准，详细解释每条标准的评判要点、常见扣分原因和满分示例。每条标准用以下格式：

**标准 N：[标准内容]**
- 评判要点：具体说明达标需要满足哪些条件
- 常见扣分原因：列举 2-3 个学生容易犯的错误
- 满分示例：描述一个理想的达标表现

## 二、交付物自检清单

为每个交付物列出 3-5 个自检项，帮助学生在提交前确认作品质量：

**交付物：[名称]（格式：[format]）**
- [ ] 自检项 1
- [ ] 自检项 2
- ...

## 三、自评说明写作指引

指导学生如何撰写高质量的自评说明，包括：
- 自评说明应包含哪些要素（具体做了什么、用了什么方法、遇到什么困难、如何解决）
- 避免笼统空泛的描述
- 给出一个好的自评说明示例和一个差的自评说明示例

请直接输出考核指南内容，不要有额外的前言说明。"""


def generate_assignment(knode: dict, milestone: dict, plan_markdown: str = "") -> str:
    """
    生成作业练习内容。普通节点生成选择题+问答题+动手项目，
    大作业节点生成考核指南+自检清单+自评写作指引。

    返回 Markdown 文本，用于写入 LessonContent.project_assignment。
    需要 LLM 调用，使用配置中的默认 provider。
    """
    from systemedu.core.config import get_config
    from langchain_openai import ChatOpenAI

    cfg = get_config()
    provider = cfg.llm.providers[cfg.llm.default]
    llm = ChatOpenAI(
        base_url=provider.base_url,
        api_key=provider.api_key,
        model=provider.model,
        temperature=0.7,
    )

    module_role = knode.get("module_role", "")
    node_title = knode.get("name") or knode.get("title", "")
    milestone_title = milestone.get("title", "")

    if module_role == "capstone":
        # 大作业节点：生成考核指南
        artifacts = knode.get("acceptance_artifacts", [])
        standards = knode.get("acceptance_standard", [])
        artifacts_text = "\n".join(
            f"- {a.get('title', '')}: {a.get('description', '')} (格式: {a.get('format', '')})"
            for a in artifacts
        ) or "(无)"
        standards_text = "\n".join(
            f"- {i+1}. {s}" for i, s in enumerate(standards)
        ) or "(无)"
        prompt = _ASSIGNMENT_PROMPT_CAPSTONE.format(
            node_title=node_title,
            milestone_title=milestone_title,
            artifacts_text=artifacts_text,
            standards_text=standards_text,
        )
    else:
        # 普通节点：生成选择题+问答题+动手项目
        difficulty = knode.get("difficulty", 3)
        node_summary = plan_markdown[:500] if plan_markdown else ""
        prompt = _ASSIGNMENT_PROMPT_NORMAL.format(
            node_title=node_title,
            node_summary=node_summary,
            difficulty=difficulty,
            milestone_title=milestone_title,
        )

    messages = [
        {"role": "system", "content": "你是专业的教育内容设计师，擅长为中小学生设计循序渐进的练习题和考核方案。"},
        {"role": "user", "content": prompt},
    ]
    response = llm.invoke(messages)
    text = response.content if hasattr(response, "content") else str(response)
    return text.strip()


def upsert_assignment(project_name: str, knode_id: int, assignment: str) -> None:
    """仅更新 LessonContent.project_assignment 字段。"""
    from systemedu.storage.db import LessonContent, get_session
    db = get_session()
    try:
        lesson = db.query(LessonContent).filter_by(
            project_name=project_name, knode_id=knode_id,
        ).first()
        if lesson:
            lesson.project_assignment = assignment
            db.commit()
        else:
            print(f"[WARN] knode {knode_id} 没有 LessonContent 记录，跳过")
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Audio script generation (Step 6a equivalent for Course Factory)
# ---------------------------------------------------------------------------

_TEACHER_SCRIPT_PROMPT = """你是一位经验丰富的教育内容讲解师，正在为面向 {age_range} 岁学生的课程录制讲解音频。

课程主题：{node_title}
段落标题：{heading}
段落正文：
{body}

请生成一段口语化的讲解稿。要求：
- 长度：150-300 字
- 风格：像一位亲切的老师在课堂上对学生讲解，不是照着课文念
- 内容：提炼段落核心要点，用通俗易懂的语言重新讲述
- 技巧：适当补充背景知识、举生活中的例子、用设问引导思考
- 语气词：可以用"同学们"、"大家想想看"、"你们有没有注意到"等课堂用语
- 语言：中文
- 不要加标题、前言或"以下是讲解稿"之类的元描述
- 直接输出可朗读的讲解内容"""


def generate_audio_scripts(project_name: str, knode_id: int,
                           knode: dict, milestone: dict) -> list[dict]:
    """
    为一个 knode 的 plan_markdown 生成分段讲课稿。

    流程：
    1. 从 DB 读取 course_content.plan_markdown
    2. 按 ##/### 标题分段（纯 Python，保留占位符）
    3. 对每段调用 LLM 生成 audio_script
    4. 将 sections 写回 course_content 并保存 DB

    返回生成的 sections 列表。
    """
    import re
    import uuid
    from systemedu.storage.db import LessonContent, get_session
    from systemedu.core.config import get_config
    from langchain_openai import ChatOpenAI

    db = get_session()
    try:
        lesson = db.query(LessonContent).filter_by(
            project_name=project_name, knode_id=knode_id
        ).first()
        if not lesson or not lesson.course_content:
            print(f"[WARN] knode {knode_id} 没有 course_content，跳过")
            return []

        cc = json.loads(lesson.course_content)
        plan_md = cc.get("plan_markdown", "")
        if not plan_md:
            print(f"[WARN] knode {knode_id} 没有 plan_markdown，跳过")
            return []

        # 如果已有 sections 且 audio_script 非空，跳过
        existing = cc.get("sections", [])
        if existing and all(s.get("audio_script") for s in existing):
            print(f"[SKIP] knode {knode_id} 已有 {len(existing)} 段讲课稿")
            return existing

        # Step 1: 分段
        from systemedu.agents.builtin.course_segment_agent import _split_by_headings
        sections = _split_by_headings(plan_md)

        # Step 2: LLM 生成 audio_script
        cfg = get_config()
        provider = cfg.llm.providers[cfg.llm.default]
        llm = ChatOpenAI(
            base_url=provider.base_url,
            api_key=provider.api_key,
            model=provider.model,
            temperature=0.7,
        )

        node_title = knode.get("name") or knode.get("title", "")
        age_range = "6-18"

        for sec in sections:
            # 去掉占位符和标题，检查是否有实质正文
            body_text = re.sub(r'\[\[IDEA:[^\]]+\]\]', '', sec["body_markdown"]).strip()
            body_text = re.sub(r'^#{2,3}\s+.*$', '', body_text, flags=re.MULTILINE).strip()
            body_text = re.sub(r'\[\[THEORY:[^\]]+\]\]', '', body_text).strip()
            if len(body_text) < 30:
                continue

            prompt = _TEACHER_SCRIPT_PROMPT.format(
                node_title=node_title,
                heading=sec["heading"] or node_title,
                body=body_text[:1000],
                age_range=age_range,
            )
            try:
                response = llm.invoke([{"role": "user", "content": prompt}])
                text = response.content if hasattr(response, "content") else str(response)
                sec["audio_script"] = text.strip()
            except Exception as e:
                print(f"  [ERR] section '{sec['heading']}': {e}")

        # Step 3: 写回 DB
        cc["sections"] = sections
        lesson.course_content = json.dumps(cc, ensure_ascii=False)
        db.commit()

        return sections
    finally:
        db.close()


def _upsert_lesson(project_name: str, knode_id: int, content_type: str,
                   course_content: dict, *,
                   project_assignment: str = "") -> None:
    """写入 LessonContent 表（upsert）。自动内联 animation_runtime.js。"""
    # 内联 runtime 到所有 rendered_sections 的 html 中
    rendered = course_content.get("rendered_sections", {})
    for section_id, section in rendered.items():
        html = section.get("html")
        if html and "animation_runtime.js" in html:
            section["html"] = _inline_runtime(html)

    # 内联 runtime 到 theories 的 animation_html 中
    for theory in course_content.get("theories", []):
        anim = theory.get("animation_html")
        if anim and "animation_runtime.js" in anim:
            theory["animation_html"] = _inline_runtime(anim)

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
            if project_assignment:
                lesson.project_assignment = project_assignment
        else:
            db.add(LessonContent(
                project_name=project_name,
                knode_id=knode_id,
                status="ready",
                course_content=content_json,
                content_type=content_type,
                generated_at=datetime.now(),
                project_assignment=project_assignment,
            ))
        db.commit()
    finally:
        db.close()

    # 自动同步 external_resources 到 node_resources 表（右侧"外部资源"面板）
    ext = course_content.get("external_resources")
    if ext:
        _sync_external_resources_to_db(project_name, knode_id, ext)


def _sync_external_resources_to_db(project_name: str, knode_id: int, ext: dict) -> None:
    """
    将 course_content.external_resources 中的所有资源写入 node_resources 表。
    包含三类来源：Tavily web_results、Tavily youtube_results、LabXchange pathways。
    已存在的 URL 不会重复插入。
    """
    from systemedu.storage.db import get_session
    from systemedu.education.search_service import NodeResource

    items: list[dict] = []

    # Tavily web results
    for r in ext.get("web_results", []):
        if r.get("url"):
            items.append({
                "source_type": "web",
                "title": r.get("title", "") or r["url"],
                "url": r["url"],
                "snippet": r.get("snippet", ""),
                "score": float(r.get("score", 0)),
            })

    # Tavily YouTube results
    for r in ext.get("youtube_results", []):
        if r.get("url"):
            items.append({
                "source_type": "youtube",
                "title": r.get("title", "") or r["url"],
                "url": r["url"],
                "snippet": r.get("snippet", ""),
                "score": float(r.get("score", 0)),
            })

    # LabXchange pathway results
    for r in ext.get("labxchange_results", []):
        if r.get("url"):
            items.append({
                "source_type": "labxchange",
                "title": r.get("title", "") or r["url"],
                "url": r["url"],
                "snippet": r.get("description", ""),
                "score": float(r.get("score", 0)),
            })

    if not items:
        return

    db = get_session()
    try:
        # 获取该节点已有的 URL 集合，避免重复
        existing_urls = {
            row.url
            for row in db.query(NodeResource).filter_by(
                project_name=project_name, knode_id=knode_id
            ).all()
        }

        added = 0
        for item in items:
            if item["url"] in existing_urls:
                continue
            db.add(NodeResource(
                project_name=project_name,
                knode_id=knode_id,
                source_type=item["source_type"],
                title=item["title"],
                url=item["url"],
                snippet=item["snippet"],
                score=item["score"],
                saved=0,
                searched_at=datetime.now(),
            ))
            existing_urls.add(item["url"])
            added += 1

        if added > 0:
            db.commit()
            console.print(f"[dim]  -> {added} 条外部资源已写入 node_resources 表[/dim]")
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
/* 采用等比缩放 + 居中偏移（letterbox），保证字体和图形不被非等比拉伸。
   所有 js_body 代码以 W×H 逻辑坐标系作画，实际显示时 canvas 按
   min(rectW/W, rectH/H) 等比缩放，多余空间留黑。*/
var canvas = document.getElementById("c");
var ctx = canvas.getContext("2d");
var W = 600, H = 420;
var DPR = Math.min(window.devicePixelRatio||1, 2);
function resize(){{
  var rect = canvas.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return;
  canvas.width = rect.width * DPR;
  canvas.height = rect.height * DPR;
  var scale = Math.min(rect.width / W, rect.height / H);
  var drawW = W * scale;
  var drawH = H * scale;
  var offsetX = (rect.width - drawW) / 2;
  var offsetY = (rect.height - drawH) / 2;
  ctx.setTransform(DPR*scale, 0, 0, DPR*scale, DPR*offsetX, DPR*offsetY);
}}
resize();
window.addEventListener("resize", function(){{ resize(); if(typeof drawCurrent==="function") drawCurrent(); }});
/* iframe 容器 resize 不会触发 window.resize；用 ResizeObserver 兜底。
   具体防反馈循环由 inject_animation_resize_patch() 注入的补丁负责。*/
if (typeof ResizeObserver !== "undefined" && canvas.parentElement) {{
  try {{
    new ResizeObserver(function(){{
      resize();
      if (typeof drawCurrent === "function") drawCurrent();
    }}).observe(canvas.parentElement);
  }} catch (e) {{}}
}}

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


# ── make_spec_html: 严格遵循 COURSE_FACTORY.md 规范的 HTML 生成 ───
# ares_mission palette + Space Grotesk + 0px radius + i18n + guide-panel
# + glassmorphism + ambient glow + flex column 布局

def make_spec_html(
    title: str,
    js_body: str,
    mode: str = "animation",  # "animation" | "game"
    style_key: str = "ares_mission",
    i18n: dict | None = None,
    guide_html: str = "",
    params_js: str = "",
) -> str:
    """
    生成严格遵循 COURSE_FACTORY.md 规范的 Canvas HTML。

    与 make_canvas_html() 的区别：
    - ares_mission 调色板 (bg:#131313, primary:#ffb59c, tertiary:#00daf3)
    - 0px border-radius 全局
    - Space Grotesk + Inter + Noto Sans SC (Google Fonts CDN)
    - i18n 双语 (I18N object + t(key) + CN/EN 切换按钮)
    - guide-panel 为 HTML DOM div + 玻璃态 CSS
    - flex column 布局 (wrapper + canvas flex:1)
    - ambient glow (ctx.shadowColor/shadowBlur)
    - 渐变填充
    - animation: 共享元素过渡 (getFrameElements + transitionTo + lerp)
    """
    # 从 STYLE_KITS 加载调色板（如果可用），否则使用 ares_mission 默认值
    palette = {
        "bg": "#131313",
        "surface": "rgba(28,27,27,0.92)",
        "surface_high": "#353534",
        "primary": "#ffb59c",
        "primary_container": "#ff7f50",
        "secondary": "#c6c6c6",
        "tertiary": "#00daf3",
        "signal": "#ff5f1f",
        "success": "#10b981",
        "text": "#e5e2e1",
        "muted": "#8a8886",
        "outline_variant": "rgba(138,136,134,0.15)",
    }
    try:
        from systemedu.agents.builtin.media_art_direction import STYLE_KITS
        if style_key in STYLE_KITS:
            palette = STYLE_KITS[style_key]["palette"]
    except Exception:
        pass

    # rgba(...) 值转 hex，使 JS 中 P.xxx + "AA" 拼接可用
    import re
    _rgba_re = re.compile(r"rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\)")
    for _pk, _pv in list(palette.items()):
        m = _rgba_re.match(str(_pv))
        if m:
            palette[_pk] = "#{:02x}{:02x}{:02x}".format(
                int(m.group(1)), int(m.group(2)), int(m.group(3))
            )

    pal_js = json.dumps(palette, ensure_ascii=False)
    i18n_js = json.dumps(i18n or {}, ensure_ascii=False)

    # guide-panel 折叠内容
    guide_section = ""
    if guide_html:
        guide_section = f"""<div class="guide-panel" id="guidePanel">
    <h3 id="guideHeader"><span id="guideTitle"></span> <span class="toggle" id="guideToggle">[-]</span></h3>
    <div class="guide-content" id="guideContent">{guide_html}</div>
  </div>"""

    # animation mode 额外的控制栏 + HUD
    controls_html = ""
    hud_html = ""
    if mode == "animation":
        controls_html = """<div class="controls" id="controls">
      <button id="btnPrev"></button>
      <button id="btnPlay"></button>
      <button id="btnNext"></button>
      <span class="frame-indicator" id="frameIndicator"></span>
    </div>"""
        hud_html = '<div class="hud" id="hud"></div>'

    # game mode 额外的反馈面板
    feedback_html = ""
    if mode == "game":
        feedback_html = '<div class="feedback-panel" id="feedback"></div>'

    # animation mode 额外的 JS (lerp/easeInOut/merge/transitionTo/drawElement/drawFrame)
    anim_transition_js = ""
    if mode == "animation":
        anim_transition_js = """
/* ── shared element transition engine ── */
function lerp(a,b,p){return a+(b-a)*p;}
function easeInOut(x){return x<0.5?2*x*x:1-Math.pow(-2*x+2,2)/2;}
function merge(base,ov){var r={};for(var k in base)r[k]=base[k];for(var k2 in ov)r[k2]=ov[k2];return r;}

function drawElement(el){
  if(!el||el.alpha<=0.01)return;
  ctx.save();
  ctx.globalAlpha=el.alpha;
  switch(el.type){
    case 'photo':drawPhotoBoxPrimitive(el);break;
    case 'label':drawLabelPrimitive(el);break;
    case 'text':drawTextPrimitive(el);break;
    case 'arrow':drawArrowPrimitive(el);break;
    case 'box':drawBoxPrimitive(el);break;
    case 'custom':if(el.draw)el.draw(el.alpha);break;
  }
  ctx.restore();
}
function drawPhotoBoxPrimitive(el){
  ctx.fillStyle=P.surface_high;
  ctx.fillRect(el.x,el.y,el.w,el.h);
  ctx.strokeStyle=P.outline_variant;ctx.lineWidth=1;
  ctx.strokeRect(el.x,el.y,el.w,el.h);
}
function drawLabelPrimitive(el){
  ctx.font=(el.bold?'bold ':'')+(el.size||14)+"px 'Space Grotesk','Inter',sans-serif";
  ctx.textAlign=el.align||'left';ctx.textBaseline=el.baseline||'top';
  if(el.glow){ctx.shadowColor=el.glowColor||P.primary;ctx.shadowBlur=el.glow;}
  ctx.fillStyle=el.color||P.text;
  ctx.fillText(typeof el.text==='function'?el.text():el.text,el.x,el.y);
  ctx.shadowBlur=0;
}
function drawTextPrimitive(el){
  ctx.font=(el.size||13)+"px 'Noto Sans SC','Inter',sans-serif";
  ctx.textAlign=el.align||'left';ctx.textBaseline=el.baseline||'top';
  ctx.fillStyle=el.color||P.text;
  var lines=(typeof el.text==='function'?el.text():el.text).split('\\n');
  var lh=el.lineHeight||(el.size||13)*1.5;
  lines.forEach(function(ln,i){ctx.fillText(ln,el.x,el.y+i*lh);});
}
function drawArrowPrimitive(el){
  ctx.strokeStyle=el.color||P.tertiary;ctx.lineWidth=el.lineWidth||2;
  if(el.glow){ctx.shadowColor=el.color||P.tertiary;ctx.shadowBlur=el.glow;}
  ctx.beginPath();ctx.moveTo(el.x1,el.y1);ctx.lineTo(el.x2,el.y2);ctx.stroke();
  var ang=Math.atan2(el.y2-el.y1,el.x2-el.x1);var hl=8;
  ctx.beginPath();
  ctx.moveTo(el.x2,el.y2);
  ctx.lineTo(el.x2-hl*Math.cos(ang-0.4),el.y2-hl*Math.sin(ang-0.4));
  ctx.moveTo(el.x2,el.y2);
  ctx.lineTo(el.x2-hl*Math.cos(ang+0.4),el.y2-hl*Math.sin(ang+0.4));
  ctx.stroke();ctx.shadowBlur=0;
}
function drawBoxPrimitive(el){
  if(el.fill){
    ctx.fillStyle=el.fill;
    if(el.glow){ctx.shadowColor=el.glowColor||el.fill;ctx.shadowBlur=el.glow;}
    ctx.fillRect(el.x,el.y,el.w,el.h);ctx.shadowBlur=0;
  }
  if(el.borderColor){
    ctx.strokeStyle=el.borderColor;ctx.lineWidth=el.borderWidth||1;
    ctx.strokeRect(el.x,el.y,el.w,el.h);
  }
}

var transitioning=false;
function transitionTo(newFrame){
  if(newFrame<0)newFrame=0;
  if(typeof totalFrames!=='undefined'&&newFrame>=totalFrames)newFrame=totalFrames-1;
  if(newFrame===currentFrame&&!transitioning){drawFrame(currentFrame);updateHUD(currentFrame);return;}
  if(transitioning)return;
  var oldElems=getFrameElements(currentFrame);
  var newElems=getFrameElements(newFrame);
  var oldMap={};oldElems.forEach(function(e){oldMap[e.id]=e;});
  var newMap={};newElems.forEach(function(e){newMap[e.id]=e;});
  currentFrame=newFrame;
  updateHUD(newFrame);
  transitioning=true;
  var startTime=null,duration=500;
  function step(ts){
    if(!startTime)startTime=ts;
    var raw=Math.min((ts-startTime)/duration,1);
    var p=easeInOut(raw);
    drawBg();
    oldElems.forEach(function(oe){
      if(!newMap[oe.id])drawElement(merge(oe,{alpha:1-p}));
    });
    newElems.forEach(function(ne){
      var oe=oldMap[ne.id];
      if(oe){
        var merged=merge(ne,{
          x:lerp(oe.x||0,ne.x||0,p),y:lerp(oe.y||0,ne.y||0,p),
          w:lerp(oe.w||0,ne.w||0,p),h:lerp(oe.h||0,ne.h||0,p),alpha:1
        });
        if(ne.type==='arrow'&&oe.type==='arrow'){
          merged.x1=lerp(oe.x1,ne.x1,p);merged.y1=lerp(oe.y1,ne.y1,p);
          merged.x2=lerp(oe.x2,ne.x2,p);merged.y2=lerp(oe.y2,ne.y2,p);
        }
        if((ne.type==='label'||ne.type==='text')&&oe.text!==ne.text){
          drawElement(merge(oe,{alpha:1-p}));drawElement(merge(ne,{alpha:p}));
        }else{drawElement(merged);}
      }else{drawElement(merge(ne,{alpha:p}));}
    });
    if(raw<1){requestAnimationFrame(step);}else{transitioning=false;}
  }
  requestAnimationFrame(step);
}
function drawFrame(f){
  drawBg();
  var elems=getFrameElements(f);
  elems.forEach(function(el){drawElement(el);});
}

/* ── animation controls binding ── */
var currentFrame=0;
var playing=false;var playTimer=null;
function updateControlsText(){
  var bp=document.getElementById('btnPlay');
  var bi=document.getElementById('frameIndicator');
  if(bp)bp.textContent=playing?t('btnPause'):t('btnPlay');
  if(bi&&typeof totalFrames!=='undefined')bi.textContent=(currentFrame+1)+' / '+totalFrames;
}
function updateHUD(f){updateControlsText();}
document.getElementById('btnPrev').addEventListener('click',function(){
  if(playing){playing=false;clearInterval(playTimer);}
  transitionTo(currentFrame-1);
});
document.getElementById('btnNext').addEventListener('click',function(){
  if(playing){playing=false;clearInterval(playTimer);}
  transitionTo(currentFrame+1);
});
document.getElementById('btnPlay').addEventListener('click',function(){
  playing=!playing;
  if(playing){
    playTimer=setInterval(function(){
      if(typeof totalFrames!=='undefined'&&currentFrame>=totalFrames-1){
        playing=false;clearInterval(playTimer);updateControlsText();return;
      }
      transitionTo(currentFrame+1);
    },3000);
  }else{clearInterval(playTimer);}
  updateControlsText();
});
"""

    return f"""<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700&family=Inter:wght@400;500&family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet">
<style>
*{{box-sizing:border-box;margin:0;padding:0;border-radius:0}}
html,body{{width:100%;height:100vh;overflow:hidden;
  background:{palette['bg']};
  font-family:'Space Grotesk','Inter','Noto Sans SC',sans-serif;
  color:{palette['text']};
}}
.lang-btn{{
  position:fixed;top:8px;left:8px;z-index:100;
  font-family:'Space Grotesk',sans-serif;font-size:11px;font-weight:700;
  padding:4px 10px;cursor:pointer;
  border:1px solid rgba(255,255,255,0.08);
  background:rgba(20,20,35,0.85);backdrop-filter:blur(12px);
  color:{palette['primary']};letter-spacing:1px;
}}
.guide-panel{{
  position:fixed;top:8px;right:8px;width:260px;max-height:40vh;
  overflow-y:auto;z-index:100;
  background:rgba(20,20,35,0.85);backdrop-filter:blur(12px);
  border:1px solid rgba(255,255,255,0.08);padding:12px;
  font-family:'Noto Sans SC',sans-serif;font-size:13px;
  color:rgba(255,255,255,0.85);
}}
.guide-panel h3{{
  font-family:'Space Grotesk',sans-serif;font-size:14px;
  margin-bottom:8px;display:flex;align-items:center;
  justify-content:space-between;cursor:pointer;
  color:{palette['primary']};
}}
.guide-panel .toggle{{font-size:12px;opacity:0.6;}}
.guide-panel ul{{padding-left:16px;line-height:1.6;}}
.guide-panel .guide-content.collapsed{{display:none;}}
.wrapper{{display:flex;flex-direction:column;height:100vh;}}
.canvas-wrap{{flex:1;min-height:0;position:relative;}}
.canvas-wrap canvas{{display:block;width:100%;height:100%;position:absolute;top:0;left:0;}}
.controls{{
  display:flex;align-items:center;gap:8px;
  padding:6px 12px;
  background:{palette['surface']};
  border-top:1px solid {palette['outline_variant']};
}}
.controls button{{
  font-family:'Space Grotesk',sans-serif;font-size:12px;font-weight:700;
  padding:4px 14px;cursor:pointer;letter-spacing:1px;
  border:1px solid {palette['outline_variant']};
  background:transparent;color:{palette['primary']};
}}
.controls button:hover{{background:{palette['surface_high']};}}
.controls .frame-indicator{{
  font-family:'Space Grotesk',sans-serif;font-size:12px;
  color:{palette['muted']};margin-left:auto;
}}
.hud{{
  display:flex;align-items:center;justify-content:space-around;
  height:52px;
  background:rgba(0,0,0,0.55);
  border-top:1px solid rgba(255,255,255,0.06);
}}
.hud .hud-col{{text-align:center;}}
.hud .hud-label{{
  font-family:'Space Grotesk',sans-serif;font-size:10px;
  color:{palette['muted']};letter-spacing:1px;text-transform:uppercase;
}}
.hud .hud-val{{
  font-family:'Space Grotesk',sans-serif;font-size:14px;font-weight:700;
  color:{palette['text']};
}}
.feedback-panel{{
  padding:8px 12px;
  background:{palette['surface']};
  border-top:1px solid {palette['outline_variant']};
  font-family:'Noto Sans SC',sans-serif;font-size:13px;
  min-height:36px;
}}
</style>
</head>
<body>
<button class="lang-btn" id="langBtn">CN</button>
{guide_section}
<div class="wrapper">
  <div class="canvas-wrap">
    <canvas id="c"></canvas>
  </div>
  {controls_html}
  {hud_html}
  {feedback_html}
</div>
<script>
(function(){{
"use strict";

/* ── palette ── */
var P = {pal_js};

/* ── i18n ── */
var LANG = 'cn';
var I18N = {i18n_js};
function t(key){{return(I18N[key]&&I18N[key][LANG])||(I18N[key]&&I18N[key]['en'])||key;}}
function refreshI18N(){{
  document.getElementById('langBtn').textContent=LANG.toUpperCase();
  /* guide panel title */
  var gt=document.getElementById('guideTitle');
  if(gt)gt.textContent=t('guideTitle');
  /* animation controls */
  var bp=document.getElementById('btnPrev');
  var bpl=document.getElementById('btnPlay');
  var bn=document.getElementById('btnNext');
  if(bp)bp.textContent=t('btnPrev');
  if(bpl)bpl.textContent=playing?t('btnPause'):t('btnPlay');
  if(bn)bn.textContent=t('btnNext');
  /* redraw canvas */
  if(typeof drawCurrent==='function')drawCurrent();
  if(typeof onLangChange==='function')onLangChange();
}}
document.getElementById('langBtn').addEventListener('click',function(){{
  LANG=LANG==='en'?'cn':'en';
  refreshI18N();
}});

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
  if (rect.width < 1 || rect.height < 1) return;
  canvas.width = rect.width * DPR;
  canvas.height = rect.height * DPR;
  var scale = Math.min(rect.width / W, rect.height / H);
  var drawW = W * scale;
  var drawH = H * scale;
  var offsetX = (rect.width - drawW) / 2;
  var offsetY = (rect.height - drawH) / 2;
  ctx.setTransform(DPR*scale, 0, 0, DPR*scale, DPR*offsetX, DPR*offsetY);
}}
resize();
window.addEventListener("resize", function(){{ resize(); if(typeof drawCurrent==="function") drawCurrent(); }});
if (typeof ResizeObserver !== "undefined" && canvas.parentElement) {{
  try {{
    new ResizeObserver(function(){{
      resize();
      if (typeof drawCurrent === "function") drawCurrent();
    }}).observe(canvas.parentElement);
  }} catch (e) {{}}
}}

/* ── color helpers ── */
function hex2rgb(h){{
  h=h.replace("#","");
  if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];
}}
var COLOR = P.primary;
var RGB = hex2rgb(COLOR);
var C = "rgb("+RGB[0]+","+RGB[1]+","+RGB[2]+")";
var CA = function(a){{return"rgba("+RGB[0]+","+RGB[1]+","+RGB[2]+","+a+")"}};

/* ── drawing utils ── */
function drawBg(){{
  /* Martian Crust radial gradient */
  var g=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,Math.max(W,H)*0.7);
  g.addColorStop(0,"#1c1b1b");g.addColorStop(1,P.bg);
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  /* wireframe grid */
  ctx.strokeStyle="rgba(0,218,243,0.06)";ctx.lineWidth=1;
  for(var x=0;x<=W;x+=20){{ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}}
  for(var y=0;y<=H;y+=20){{ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}}
}}
function drawTitle(){{
  ctx.font="bold 16px 'Space Grotesk','Inter',sans-serif";
  ctx.textAlign="center";ctx.fillStyle=P.text;
  ctx.shadowColor=P.primary;ctx.shadowBlur=8;
  ctx.fillText(t('title')||TITLE,W/2,28);
  ctx.shadowBlur=0;
}}
function drawHUD(cols){{
  var hud=document.getElementById('hud');
  if(!hud)return;
  hud.innerHTML='';
  cols.forEach(function(c){{
    var d=document.createElement('div');d.className='hud-col';
    d.innerHTML='<div class="hud-label">'+c.label+'</div><div class="hud-val">'+c.val+'</div>';
    hud.appendChild(d);
  }});
}}
/* ambient glow helper */
function withGlow(color,blur,fn){{
  ctx.save();ctx.shadowColor=color;ctx.shadowBlur=blur||12;
  fn();ctx.shadowBlur=0;ctx.restore();
}}

{anim_transition_js}

/* ── guide panel toggle ── */
(function(){{
  var tog=document.getElementById('guideToggle');
  var gc=document.getElementById('guideContent');
  if(tog&&gc){{
    document.getElementById('guideHeader').addEventListener('click',function(){{
      var collapsed=gc.classList.toggle('collapsed');
      tog.textContent=collapsed?'[+]':'[-]';
    }});
  }}
}})();

/* ── main (js_body) ── */
{js_body}

/* ── init ── */
refreshI18N();
setTimeout(function(){{resize();if(typeof drawCurrent==='function')drawCurrent();}},200);
setTimeout(function(){{resize();if(typeof drawCurrent==='function')drawCurrent();}},600);
if(document.fonts&&document.fonts.ready){{
  document.fonts.ready.then(function(){{resize();if(typeof drawCurrent==='function')drawCurrent();}});
}}

}})();
</script>
</body>
</html>"""


# ── v4.1 知识树上下文加载与对齐校验 ──────────────────────────────

def load_knode_context(project_name: str, knode_global_idx: int) -> dict:
    """
    从 projects/{name}/knowledge_tree.json 读取指定 global index 的 knode，
    并返回完整上下文（knode + milestone/stage + sub_project + v5 module）。

    支持 v5 格式（stages/modules）和旧 milestones 格式（自动检测）。

    参数：
        project_name: 项目英文 slug，例如 "mars-risk-map"
        knode_global_idx: 跨 milestone 的全局知识节点序号（与后端 api_project_detail 中的 id 一致）

    返回：
        {
            "knode": dict,           # 完整 knode dict（兼容旧字段）
            "milestone": dict,       # 所属 milestone/stage 的 title/description
            "sub_project": dict|None, # 所属 sub_project/stage
            "module": dict|None,     # 完整 v5 module dict（仅 v5 格式有值）
            "stage": dict|None,      # 完整 v5 stage dict（仅 v5 格式有值）
        }

    异常：
        FileNotFoundError: 项目目录不存在
        ValueError: knode_global_idx 超出范围
    """
    import sys
    sys.path.insert(0, str(ROOT))

    tree_path = ROOT / "projects" / project_name / "knowledge_tree.json"
    if not tree_path.exists():
        raise FileNotFoundError(f"knowledge_tree.json not found: {tree_path}")

    tree = json.loads(tree_path.read_text(encoding="utf-8"))

    # v5 format: stages + modules
    if "stages" in tree and "modules" in tree:
        from systemedu.education.tree_adapter import (
            build_module_index_map,
            sorted_modules as _sorted_modules,
            v5_to_milestones_view,
        )
        from systemedu.education.models import V5KnowledgeTree

        v5_tree = V5KnowledgeTree.model_validate(tree)
        index_map = build_module_index_map(v5_tree)
        modules = _sorted_modules(v5_tree)

        if knode_global_idx < 0 or knode_global_idx >= len(modules):
            raise ValueError(
                f"knode global index {knode_global_idx} out of range "
                f"(project has {len(modules)} modules)"
            )

        mod = modules[knode_global_idx]
        stage = next((s for s in v5_tree.stages if s.stage_id == mod.stage_id), None)

        # Build backward-compat knode dict from v5 module
        ms_view = v5_to_milestones_view(v5_tree)
        knode_dict = None
        idx = 0
        for ms in ms_view.milestones:
            for kn in ms.knodes:
                if idx == knode_global_idx:
                    knode_dict = kn.model_dump()
                    break
                idx += 1
            if knode_dict is not None:
                break

        return {
            "knode": knode_dict or {},
            "milestone": {
                "title": stage.title if stage else "",
                "description": stage.stage_description if stage else "",
            },
            "sub_project": stage.model_dump() if stage else None,
            "module": mod.model_dump(),
            "stage": stage.model_dump() if stage else None,
        }

    # Legacy milestones format
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
                    "module": None,
                    "stage": None,
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


# ── 项目级外部资源 URL 注册表 ──────────────────────────────
# plan_markdown 中使用 {{KEY}} shortcode 引用，make_course_content() 入口自动替换
# 为完整的 Markdown 链接 [显示文字](url)。
# KEY 不区分大小写，匹配时统一转小写。
EXTERNAL_RESOURCE_URLS: dict[str, dict[str, str]] = {
    "ai4mars": {
        "title": "AI4Mars",
        "url": "https://data.nasa.gov/dataset/ai4mars-a-dataset-for-terrain-aware-autonomous-driving-on-mars",
    },
    "ai4mars_paper": {
        "title": "AI4Mars 论文 (CVPR 2021)",
        "url": "https://openaccess.thecvf.com/content/CVPR2021W/AI4Space/papers/Swan_AI4MARS_A_Dataset_for_Terrain-Aware_Autonomous_Driving_on_Mars_CVPRW_2021_paper.pdf",
    },
    "curiosity_raw": {
        "title": "Curiosity 原始图像库",
        "url": "https://mars.nasa.gov/msl/multimedia/raw-images/",
    },
    "perseverance_raw": {
        "title": "Perseverance 原始图像库",
        "url": "https://mars.nasa.gov/mars2020/multimedia/raw-images/",
    },
    "curiosity_navcam": {
        "title": "Curiosity Navcam",
        "url": "https://mars.nasa.gov/msl/multimedia/raw-images/",
    },
    "mastcamz": {
        "title": "Perseverance Mastcam-Z",
        "url": "https://mastcamz.asu.edu/",
    },
    "hirise": {
        "title": "HiRISE",
        "url": "https://hirise.lpl.arizona.edu/",
    },
    "pds_imaging": {
        "title": "NASA PDS Imaging Node",
        "url": "https://pds-imaging.jpl.nasa.gov/",
    },
}

_SHORTCODE_RE = re.compile(r"\{\{(\w+)\}\}")

# ── LabXchange Pathway 本地索引 ─────────────────────────────────
_LABXCHANGE_INDEX_PATH = ROOT / "knowledge_base_doc" / "labxchange_pathways.json"
_labxchange_cache: list[dict] | None = None


def _load_labxchange_index() -> list[dict]:
    """懒加载 LabXchange pathway 索引（首次调用时读入内存）。"""
    global _labxchange_cache
    if _labxchange_cache is not None:
        return _labxchange_cache
    if not _LABXCHANGE_INDEX_PATH.exists():
        console.print("[yellow]LabXchange 索引文件不存在，跳过。"
                       "运行 python scripts/crawl_labxchange_pathways.py 爬取。[/yellow]")
        _labxchange_cache = []
        return _labxchange_cache
    data = json.loads(_LABXCHANGE_INDEX_PATH.read_text("utf-8"))
    _labxchange_cache = data.get("pathways", [])
    console.print(f"[dim]LabXchange 索引已加载: {len(_labxchange_cache)} pathways[/dim]")
    return _labxchange_cache


def search_labxchange(keywords: list[str], subject_filter: str | None = None,
                      top_k: int = 5) -> list[dict]:
    """
    在本地 LabXchange pathway 索引中搜索与 keywords 最相关的 pathway。

    匹配逻辑：对每个 pathway 的 title + description + learning_objectives 拼接为文本，
    计算 keywords 命中数（不区分大小写），按命中数降序排列。

    Args:
        keywords: 搜索关键词列表，如 ["friction", "force", "motion"]
        subject_filter: 可选学科过滤，如 "Physics"、"Biological Sciences"
        top_k: 返回前 N 条结果

    Returns:
        命中的 pathway 列表，每条含 title, description, url, subject_tags, score
    """
    index = _load_labxchange_index()
    if not index:
        return []

    kw_lower = [k.lower() for k in keywords]
    scored: list[tuple[int, dict]] = []

    for pw in index:
        # 学科过滤
        if subject_filter:
            tags_flat = " ".join(pw.get("subject_tags", [])).lower()
            if subject_filter.lower() not in tags_flat:
                continue

        # 拼接可搜索文本
        text_parts = [
            pw.get("title", ""),
            pw.get("description", ""),
        ]
        for obj in pw.get("learning_objectives", []):
            if isinstance(obj, str):
                text_parts.append(obj)
        searchable = " ".join(text_parts).lower()

        # 计算关键词命中数
        score = sum(1 for kw in kw_lower if kw in searchable)
        if score > 0:
            scored.append((score, pw))

    scored.sort(key=lambda x: -x[0])
    results = []
    for score, pw in scored[:top_k]:
        results.append({
            "title": pw["title"],
            "description": pw["description"],
            "url": pw["url"],
            "subject_tags": pw["subject_tags"],
            "learning_objectives": pw.get("learning_objectives", []),
            "score": score,
        })
    return results


def expand_resource_shortcodes(text: str) -> str:
    """
    将 plan_markdown 中的 {{KEY}} shortcode 替换为 [title](url) Markdown 链接。
    KEY 不区分大小写。未匹配的 shortcode 保持原样不变。
    """
    def _replace(m: re.Match) -> str:
        key = m.group(1).lower()
        entry = EXTERNAL_RESOURCE_URLS.get(key)
        if entry:
            return f"[{entry['title']}]({entry['url']})"
        return m.group(0)  # 未注册的 key，原样保留
    return _SHORTCODE_RE.sub(_replace, text)


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

    当前策略：始终返回 True。每个节点都应该通过外部搜索补充资料，
    搜索结果和 LabXchange pathway 匹配结果会自动写入右侧"外部资源"面板。

    参数：
        knode: v4.1 knode dict
        milestone: 所属 milestone dict（可选，用于补充上下文）

    返回：
        始终返回 True。
    """
    return True


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


def merge_resources_into_plan(
    plan_markdown: str,
    research: dict | None,
    labxchange_results: list[dict] | None = None,
) -> str:
    """
    把 research_knode() 的返回结果以及 LabXchange 匹配结果融入 plan_markdown。

    融入策略（保持纯 markdown，前端 ReactMarkdown 默认可渲染）：
    - YouTube 视频：追加到「## 推荐视频」段落，使用缩略图嵌入格式（前端渲染为播放器）
    - 网页资料：追加到「## 延伸阅读」段落，列表形式
    - LabXchange pathways：单独的「## 推荐互动资源」段落，带 Harvard 学习库标识

    如果 research 和 labxchange_results 都为空，原样返回 plan_markdown。
    """
    web = (research or {}).get("web_results") or []
    youtube = (research or {}).get("youtube_results") or []
    labxchange = labxchange_results or []
    if not web and not youtube and not labxchange:
        return plan_markdown

    text = plan_markdown.rstrip() + "\n"

    # 1. 视频部分（缩略图嵌入格式，前端 ReactMarkdown 渲染为播放器）
    if youtube:
        video_lines: list[str] = ["## 推荐视频", ""]
        for v in youtube:
            title = v.get("title", "").replace("[", "(").replace("]", ")")
            url = v.get("url", "")
            if not url:
                continue
            # 提取 YouTube video ID 生成缩略图
            vid = ""
            if "youtu.be/" in url:
                vid = url.split("youtu.be/")[-1].split("?")[0]
            elif "v=" in url:
                vid = url.split("v=")[-1].split("&")[0]
            if vid:
                thumb = f"https://img.youtube.com/vi/{vid}/hqdefault.jpg"
                video_lines.append(f"[![{title}]({thumb})]({url})")
            else:
                video_lines.append(f"- [**{title}**]({url})")
        video_lines.append("")

        video_block = "\n".join(video_lines)

        # 尝试插入到"## 深入理解"或"## 核心概念"之后
        anchors = ["## 深入理解", "## 核心概念"]
        inserted = False
        for anchor in anchors:
            idx = text.find(anchor)
            if idx < 0:
                continue
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

    # 3. LabXchange pathways（追加到末尾，单独标识）
    if labxchange:
        lx_lines: list[str] = ["", "## 推荐互动资源", ""]
        lx_lines.append("> 来自 Harvard LabXchange 的开放学习路径，可免费注册学习：")
        lx_lines.append("")
        for r in labxchange:
            title = (r.get("title") or "").replace("[", "(").replace("]", ")")
            url = r.get("url", "")
            desc = (r.get("description") or r.get("snippet") or "").strip()
            if not title or not url:
                continue
            if desc:
                lx_lines.append(f"- [**{title}**]({url}) — {desc[:200]}")
            else:
                lx_lines.append(f"- [**{title}**]({url})")
        lx_lines.append("")
        text = text.rstrip() + "\n" + "\n".join(lx_lines)

    return text


# ── 静态图片资源支持 ─────────────────────────────────────
#
# 除了 animation 和 game 之外，knode 内容还可以包含静态图片：
#  - image:   互联网照片（NASA, Wikimedia CC0/CC-BY 等），下载到本地
#  - diagram: Claude 自己写的 HTML/SVG 示意图，本地文件
#
# 图片存储策略：`scripts/course_images/<knode_hash>/<filename>`，
# 由 gateway 的 `/api/course-images` 静态挂载对外服务。

COURSE_IMAGES_DIR = ROOT / "scripts" / "course_images"


def download_course_image(
    src_url: str,
    knode_key: str,
    *,
    filename: str | None = None,
    timeout: float = 30.0,
) -> dict:
    """
    从互联网下载图片到 `scripts/course_images/<knode_key>/<filename>`。

    参数：
        src_url: 图片 URL（必须是 http/https）
        knode_key: 用于命名子目录的标识，例如 `mars-risk-map_5`
        filename: 目标文件名；为空时从 URL 推断，不含扩展名时追加 `.jpg`
        timeout: HTTP 请求超时秒数

    返回：
        {
            "local_path": "scripts/course_images/<key>/<file>",
            "web_path":   "/api/course-images/<key>/<file>",
            "size_bytes": int,
            "content_type": str,
        }

    失败时抛出 RuntimeError。
    """
    import httpx
    import hashlib
    import mimetypes
    from urllib.parse import urlparse, unquote

    if not src_url.startswith(("http://", "https://")):
        raise ValueError(f"src_url must be http(s): {src_url}")

    # 推断文件名
    if not filename:
        parsed = urlparse(src_url)
        name = Path(unquote(parsed.path)).name or "image"
        # 去掉 query string 残留
        filename = name.split("?")[0] or "image"

    # 如果没有扩展名，先按内容推断
    suffix = Path(filename).suffix.lower()
    if not suffix:
        filename = f"{filename}.jpg"
        suffix = ".jpg"

    target_dir = COURSE_IMAGES_DIR / knode_key
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / filename

    # 若已存在且非空，直接复用
    if target_path.exists() and target_path.stat().st_size > 0:
        return {
            "local_path": str(target_path.relative_to(ROOT)),
            "web_path": f"/api/course-images/{knode_key}/{filename}",
            "size_bytes": target_path.stat().st_size,
            "content_type": mimetypes.guess_type(str(target_path))[0] or "",
        }

    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            resp = client.get(src_url, headers={"User-Agent": "SystemEdu CourseFactory/1.0"})
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "").split(";")[0].strip()
            data = resp.content
    except Exception as e:
        raise RuntimeError(f"download_course_image failed for {src_url}: {e}") from e

    if not data:
        raise RuntimeError(f"download_course_image got empty body for {src_url}")

    # 根据 content-type 重新判断扩展名（如果原 filename 不合理）
    if content_type and suffix not in (".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"):
        ext_from_ct = mimetypes.guess_extension(content_type) or ".jpg"
        filename = Path(filename).stem + ext_from_ct
        target_path = target_dir / filename

    target_path.write_bytes(data)

    return {
        "local_path": str(target_path.relative_to(ROOT)),
        "web_path": f"/api/course-images/{knode_key}/{filename}",
        "size_bytes": len(data),
        "content_type": content_type,
    }


def inject_idea_markers(
    plan_markdown: str,
    anim_id: str | None = None,
    ex_id: str | None = None,
    story_id: str | None = None,
    game_id: str | None = None,
    image_markers: list[tuple[str, str]] | None = None,
    diagram_markers: list[tuple[str, str]] | None = None,
    kit_markers: list[tuple[str, str]] | None = None,
) -> str:
    """
    在 plan_markdown 中插入 [[IDEA:<id>]] 标记，让前端能在正确位置渲染
    动画 / 游戏 / 练习题 / 故事段落 / 静态图片 / 示意图 / 实物套件。

    插入策略（按二级标题锚点）：
    - story_id  → 插入到 "## 引入" 标题后（情境导入）
    - anim_id   → 插入到 "## 深入理解" 标题后；找不到则插到 "## 核心概念" 后
    - game_id   → 插入到 "## 动手探索" 或 "## 应用与拓展" 之前；找不到则插到
                  anim_id 之后的位置，或 "## 深入理解" 最末
    - ex_id     → 插入到 "## 应用与拓展" 标题后；找不到则追加到末尾
    - image_markers / diagram_markers / kit_markers: 每项是 (id, anchor) 元组，
      anchor 是二级或三级标题关键字（如 "## 核心概念"、"### 动手实践"）；
      支持关键字匹配变体（如 "核心概念" 会匹配 "## 核心概念：xxx"）。
      anchor 留空字符串时插入到研究资料章节之前。

    已存在的相同标记不会重复插入（通过子串检查）。
    """
    if not plan_markdown:
        return plan_markdown

    text = plan_markdown

    def _insert_after_heading(doc: str, heading_candidates: list[str], marker: str) -> tuple[str, bool]:
        """
        在首个匹配的标题所在行之后插入 marker（独占一段）。
        匹配支持二级（##）和三级（###）标题：候选 "## 动手实践" 会同时匹配
        `## 动手实践` 和 `### 动手实践` 以及 `## 动手实践：xxx` 等变体。
        返回 (新文档, 是否成功插入)。
        """
        import re as _re
        if marker in doc:
            return doc, True  # 已存在，视为成功
        for anchor in heading_candidates:
            # 去掉 anchor 前的 `## ` 前缀，保留关键字
            key = anchor.lstrip("#").strip()
            # 匹配 ##/### 标题行，关键字可后接任意文字（中文冒号、破折号等）
            pattern = _re.compile(rf"^#{{2,4}}\s+{_re.escape(key)}[^\n]*$", _re.MULTILINE)
            m = pattern.search(doc)
            if not m:
                continue
            line_end = doc.find("\n", m.end())
            if line_end < 0:
                line_end = len(doc)
            new_doc = (
                doc[: line_end + 1]
                + "\n"
                + marker
                + "\n"
                + doc[line_end + 1 :]
            )
            return new_doc, True
        return doc, False

    def _insert_before_tail_sections(doc: str, marker: str) -> str:
        """
        把 marker 插入到正文结尾、研究资料章节之前的位置。
        研究资料章节包括 "## 推荐视频"、"## 推荐互动资源"、"## 延伸阅读"。
        找不到时追加到末尾。
        """
        tail_anchors = ["## 推荐视频", "## 推荐互动资源", "## 延伸阅读"]
        earliest = len(doc)
        for a in tail_anchors:
            idx = doc.find(a)
            if idx >= 0 and idx < earliest:
                earliest = idx
        if earliest < len(doc):
            # 在 tail 之前插入
            return doc[:earliest].rstrip() + "\n\n" + marker + "\n\n" + doc[earliest:]
        return doc.rstrip() + "\n\n" + marker + "\n"

    # 1. story_id → 引入段
    if story_id:
        marker = f"[[IDEA:{story_id}]]"
        text, _ = _insert_after_heading(text, ["## 引入", "## 情境导入", "## 开场"], marker)

    # 2. anim_id → 深入理解 / 核心概念 / 动手实践
    if anim_id:
        marker = f"[[IDEA:{anim_id}]]"
        text, ok = _insert_after_heading(
            text,
            ["## 深入理解", "## 核心概念", "## 动手实践", "## 动手探索", "## 动手", "## 原理"],
            marker,
        )
        if not ok:
            # 正文找不到锚点：放到研究资料前，而不是追加到最末尾
            text = _insert_before_tail_sections(text, marker)

    # 3. game_id → 动手探索 / 互动实验 / 应用与拓展 前
    if game_id:
        marker = f"[[IDEA:{game_id}]]"
        if marker not in text:
            text2, ok = _insert_after_heading(
                text,
                ["## 动手探索", "## 互动实验", "## 动手练习", "## 动手实践", "## 游戏挑战"],
                marker,
            )
            if ok:
                text = text2
            else:
                text = _insert_before_tail_sections(text, marker)

    # 4. ex_id → 应用与拓展 / 练习 / 末尾
    if ex_id:
        marker = f"[[IDEA:{ex_id}]]"
        text, ok = _insert_after_heading(
            text,
            ["## 应用与拓展", "## 课堂任务", "## 练习", "## 动手实践", "## 小测验", "## 巩固"],
            marker,
        )
        if not ok:
            text = _insert_before_tail_sections(text, marker)

    # 5. image_markers / diagram_markers / kit_markers → 按调用方指定的 anchor 插入
    for ids_list, kind in (
        (image_markers or [], "image"),
        (diagram_markers or [], "diagram"),
        (kit_markers or [], "hands_on_kit"),
    ):
        for item_id, anchor in ids_list:
            if not item_id:
                continue
            marker = f"[[IDEA:{item_id}]]"
            if marker in text:
                continue
            if anchor:
                text, ok = _insert_after_heading(text, [anchor], marker)
                if not ok:
                    text = _insert_before_tail_sections(text, marker)
            else:
                text = _insert_before_tail_sections(text, marker)

    return text


# ── 动画 HTML resize 补丁 ─────────────────────────────────────
#
# 修复 iframe 嵌入时 canvas 动画的两个顽疾：
#  1. 父容器 resize 后 canvas 留空白：典型的 Canvas2D 动画 `resize()`
#     函数只重分配 backing store（等价于清空 canvas），但没有重绘。
#  2. iframe 内的 `window.addEventListener('resize', ...)` 不会被父
#     页面对 iframe 尺寸变化触发，必须使用 ResizeObserver。
#
# 防反馈循环：
#  - canvas 常见 CSS `width:100%;height:100%` 在原 resize() 里会被
#    覆盖成固定像素（`canvas.style.width = W+"px"`），由于 flex item
#    默认 `min-height:auto`，canvas 会撑大父容器，ResizeObserver 再
#    次回调，形成正反馈。
#  - 补丁注入 CSS 让 canvas `position:absolute` 脱离文档流，父容器
#    强制 `min-height:0; overflow:hidden`。
#  - ResizeObserver 使用 `entry.contentRect`（不受子元素反馈污染）。
#
# 这段 JS 在真实环境（playwright + iframe 动态 resize 900x560 → 600x400）
# 中验证过：resize 前后 canvas 稳定渲染，非背景像素 42.5% → 47%。
ANIMATION_RESIZE_PATCH_JS = r"""
(function () {
  if (window.__systemedu_resize_patched) return;
  window.__systemedu_resize_patched = true;

  const canvas =
    document.querySelector('canvas#c') ||
    document.querySelector('canvas');
  if (!canvas || !canvas.parentElement) return;
  let container = canvas.parentElement;

  // 如果 canvas 的父容器还包含 controls/hud 等兄弟元素，
  // 就给 canvas 包一层 div 作为 host，避免 position:absolute 覆盖按钮
  try {
    const siblings = container.querySelectorAll('.controls, .hud, button');
    if (siblings.length > 0 && container.children.length > 1) {
      const host = document.createElement('div');
      host.style.cssText = 'flex:1;min-height:0;min-width:0;';
      container.insertBefore(host, canvas);
      host.appendChild(canvas);
      container = host;
    }
  } catch (e) {}

  // 注入防撑大 CSS：canvas 脱离流，父容器约束高度
  // 同时把浮动的操作指南面板（.guide-panel 等）改成可折叠，避免
  // 在小视口（iframe 缩小）下覆盖标题栏和控件。
  try {
    const style = document.createElement('style');
    style.setAttribute('data-systemedu-resize-patch', '1');
    style.textContent =
      // canvas 防撑大
      '.systemedu-canvas-host{position:relative!important;min-width:0!important;min-height:0!important;overflow:hidden!important;}' +
      '.systemedu-canvas-host > canvas{position:absolute!important;top:0!important;left:0!important;width:100%!important;height:100%!important;}' +
      // 浮动指南面板折叠态（默认折叠为一个小按钮，避免遮挡）
      '.guide-panel.systemedu-guide-collapsed{max-width:28px!important;max-height:28px!important;min-width:28px!important;min-height:28px!important;' +
      'padding:0!important;overflow:hidden!important;cursor:pointer!important;display:flex!important;align-items:center!important;justify-content:center!important;' +
      'border-radius:50%!important;}' +
      '.guide-panel.systemedu-guide-collapsed > *{display:none!important;}' +
      '.guide-panel.systemedu-guide-collapsed::before{content:"?";color:#38bdf8;font-weight:700;font-size:14px;}' +
      // 小视口时强制 guide-panel 宽度收紧
      '.guide-panel{max-width:min(220px,35vw)!important;z-index:50!important;}';
    document.head.appendChild(style);
    container.classList.add('systemedu-canvas-host');
  } catch (e) {}

  // 让 .guide-panel 默认折叠为问号按钮，点击展开/收起
  try {
    const guides = document.querySelectorAll('.guide-panel');
    guides.forEach(function (g) {
      g.classList.add('systemedu-guide-collapsed');
      g.setAttribute('title', '点击查看操作指南');
      g.addEventListener('click', function (e) {
        // 折叠时点击任意处展开；展开时只有点击面板本身（不是内部链接）才收回
        if (g.classList.contains('systemedu-guide-collapsed')) {
          g.classList.remove('systemedu-guide-collapsed');
          e.stopPropagation();
        } else {
          // 展开状态下点击面板空白区域也能再次折叠
          if (e.target === g) {
            g.classList.add('systemedu-guide-collapsed');
          }
        }
      });
    });
  } catch (e) {}

  const redraw = function () {
    try { if (typeof window.drawCurrent === 'function') { window.drawCurrent(); return; } } catch (e) {}
    try {
      if (typeof window.gotoFrame === 'function' &&
          typeof window.currentFrame !== 'undefined') {
        window.gotoFrame(window.currentFrame); return;
      }
    } catch (e) {}
    try { if (typeof window.draw === 'function') { window.draw(); return; } } catch (e) {}
    try { if (typeof window.render === 'function') { window.render(); return; } } catch (e) {}
  };

  let rafId = 0;
  let prevW = 0, prevH = 0;

  // 校正 canvas backing store 与 CSS 显示尺寸，保证宽高比一致。
  // 防止 canvas 被浏览器按不同比例拉伸（典型症状：文字被水平拉宽或压扁）。
  // 必要时重新调用原 resize() 让动画内部坐标系也更新。
  const enforceSizeConsistency = function () {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return false;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const targetW = Math.round(rect.width * dpr);
    const targetH = Math.round(rect.height * dpr);
    // 允许 1 像素误差
    if (Math.abs(canvas.width - targetW) > 1 || Math.abs(canvas.height - targetH) > 1) {
      return true; // 需要修复
    }
    return false;
  };

  // 调用动画内部的 resize 钩子。优先级：
  //   1) window.resize（老式全局挂载）
  //   2) window 上的 'resize' 事件（addEventListener 注册的 local resize）
  // 多数 knode 动画通过 addEventListener('resize', resize) 挂事件监听，
  // 此时 window.resize 是 undefined，唯一能驱动它的方式是 dispatchEvent。
  const callInternalResize = function () {
    try {
      if (typeof window.resize === 'function') {
        window.resize();
        return true;
      }
    } catch (e) {}
    try {
      window.dispatchEvent(new Event('resize'));
      return true;
    } catch (e) {}
    return false;
  };

  const doResize = function () {
    // 让动画的 local resize 读最新 rect 并重写 canvas backing store
    callInternalResize();

    // 校正 backing store：若 canvas.width/height 与 CSS 显示尺寸不一致
    // （典型症状：文字被水平或垂直拉伸），反复触发 local resize 让它
    // 重新计算。浏览器 layout 已稳定时通常一次就能修复。
    try {
      let guard = 0;
      while (enforceSizeConsistency() && guard < 3) {
        guard++;
        // 触发 reflow 让 getBoundingClientRect 读到最新值
        void canvas.offsetHeight;
        callInternalResize();
      }
      // 最终保障：某些动画的 resize 可能读到错值（例如 parentElement 被
      // 缓存，或 CSS !important 锁死尺寸）。此时直接硬写 canvas.width/height
      // 保证宽高比正确；drawCurrent 会把内容重新画到正确的 backing store。
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const tw = Math.round(rect.width * dpr);
      const th = Math.round(rect.height * dpr);
      if (rect.width >= 1 && rect.height >= 1 &&
          (Math.abs(canvas.width - tw) > 1 || Math.abs(canvas.height - th) > 1)) {
        canvas.width = tw;
        canvas.height = th;
        // 同步动画内部坐标系变量（若挂在 window 上）
        try {
          if (typeof window.W !== 'undefined') window.W = rect.width;
          if (typeof window.H !== 'undefined') window.H = rect.height;
        } catch (e) {}
        // 再跑一次 local resize，让它重新 setTransform 并更新自身 W/H
        callInternalResize();
      }
    } catch (e) {}

    redraw();
  };

  const ro = new ResizeObserver(function (entries) {
    const entry = entries[0];
    if (!entry) return;
    const cr = entry.contentRect;
    const w = cr.width, h = cr.height;
    if (w < 1 || h < 1) return;
    if (Math.abs(w - prevW) < 1 && Math.abs(h - prevH) < 1) return;
    prevW = w; prevH = h;

    // 第一次回调也要处理：iframe 内的动画可能把错值写到 canvas backing
    // store（例如 load 时 parent rect 还不稳定），第一次 RO 回调正是
    // layout 已稳定的时机，必须借此纠正。
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(function () {
      rafId = 0;
      doResize();
    });
  });

  try { ro.observe(container); } catch (e) {}

  // iframe 初始化阶段 parent rect 可能不稳定，导致动画原始 resize()
  // 写入错误的 canvas.width/height（尤其在 iframe 外层 div 宽高变化时）。
  // load 后始终跑一次 doResize 做最终校正，不依赖 canvas.width<4 的判断。
  window.addEventListener('load', function () {
    setTimeout(function () { doResize(); }, 50);
  });
})();
"""

ANIMATION_RESIZE_PATCH_MARKER = "__systemedu_resize_patched"


def fix_nonuniform_scale_in_html(html: str) -> str:
    """
    修复动画 HTML 里的非等比缩放问题。

    背景：早期 make_canvas_html 模板和部分 LLM 生成的动画使用
        ctx.scale(canvas.width / W, canvas.height / H)
    或
        ctx.scale(DPR * rect.width / W, DPR * rect.height / H)
    这种**非等比缩放**。当宽高比和 W/H（通常 600/420 ≈ 1.43）不一致
    时，字体和图形都会被 x/y 方向以不同比例拉伸，导致大屏下字体
    "被拉宽"。

    正确做法是 letterbox 等比缩放：
        scale = Math.min(rect.width/W, rect.height/H)
        offsetX = (rect.width - W*scale) / 2
        offsetY = (rect.height - H*scale) / 2
        ctx.setTransform(DPR*scale, 0, 0, DPR*scale, DPR*offsetX, DPR*offsetY)

    本函数用正则把所有符合特征的非等比 scale 行替换为等比版本。
    匹配两种常见变体：
      - `ctx.scale(canvas.width / W, canvas.height / H)`
      - `ctx.scale(DPR * rect.width / W, DPR * rect.height / H)`
    同时移除同一函数体内的 `ctx.setTransform(1,0,0,1,0,0)`（否则会
    清除我们重新设置的 transform）。

    幂等：已经是等比缩放（出现 `Math.min(` + `setTransform(DPR*scale`）
    的 HTML 不会被二次修改。
    """
    if not html:
        return html

    import re

    # 幂等检查
    if "systemedu-uniform-scale" in html:
        return html

    # 模式 1: ctx.scale(canvas.width / W, canvas.height / H)
    pattern1 = re.compile(
        r'ctx\.setTransform\s*\(\s*1\s*,\s*0\s*,\s*0\s*,\s*1\s*,\s*0\s*,\s*0\s*\)\s*;\s*'
        r'ctx\.scale\s*\(\s*canvas\.width\s*/\s*W\s*,\s*canvas\.height\s*/\s*H\s*\)\s*;?'
    )
    # 模式 2: ctx.scale(DPR * rect.width / W, DPR * rect.height / H)
    pattern2 = re.compile(
        r'ctx\.setTransform\s*\(\s*1\s*,\s*0\s*,\s*0\s*,\s*1\s*,\s*0\s*,\s*0\s*\)\s*;\s*'
        r'ctx\.scale\s*\(\s*DPR\s*\*\s*rect\.width\s*/\s*W\s*,\s*DPR\s*\*\s*rect\.height\s*/\s*H\s*\)\s*;?'
    )

    replacement = (
        "/* systemedu-uniform-scale: letterbox 等比缩放 */"
        "var __seRect = canvas.getBoundingClientRect();"
        "var __seScale = Math.min(__seRect.width / W, __seRect.height / H);"
        "var __seOX = (__seRect.width - W * __seScale) / 2;"
        "var __seOY = (__seRect.height - H * __seScale) / 2;"
        "var __seDPR = (typeof DPR === 'number' ? DPR : 1);"
        "ctx.setTransform(__seDPR*__seScale, 0, 0, __seDPR*__seScale, __seDPR*__seOX, __seDPR*__seOY);"
    )

    new_html = pattern1.sub(replacement, html)
    new_html = pattern2.sub(replacement, new_html)
    return new_html


_ANIMATION_RESIZE_PATCH_BLOCK_RE = re.compile(
    r"<script>\s*\n?\(function\s*\(\)\s*\{[^<]*?"
    + re.escape(ANIMATION_RESIZE_PATCH_MARKER)
    + r"[\s\S]*?</script>\s*",
    re.IGNORECASE,
)


def inject_animation_resize_patch(html: str) -> str:
    """
    往动画 HTML 尾部注入 resize 补丁 <script>。

    - 幂等升级：如果已有旧 patch（通过 `__systemedu_resize_patched` 标记识别），
      先剥离旧 patch script 再注入当前版本，保证升级能生效。
    - 若 HTML 显式声明 `window.__systemedu_resize_patch_optout = true`，
      则跳过注入（用于有自己完整 RAF resize 循环的游戏，patch 反而会
      破坏其布局）。
    - 对空字符串或 None 直接返回原值。
    - 不会修改原有 <script> / <style> / DOM；只追加一段独立 script 到 </body> 前。
      如果找不到 </body>，则追加到字符串末尾。
    """
    if not html:
        return html

    # Opt-out: game/animation 作者显式声明不需要 patch。
    if "__systemedu_resize_patch_optout" in html:
        return html

    # 若旧 patch 存在，先剥离它，再用最新版本重新注入。
    if ANIMATION_RESIZE_PATCH_MARKER in html:
        html = _ANIMATION_RESIZE_PATCH_BLOCK_RE.sub("", html)
        # 防御：如果正则没匹配到（说明存储格式变了），仍然早退避免重复注入。
        if ANIMATION_RESIZE_PATCH_MARKER in html:
            return html

    snippet = "<script>\n" + ANIMATION_RESIZE_PATCH_JS + "\n</script>\n"
    if "</body>" in html:
        return html.replace("</body>", snippet + "</body>", 1)
    return html + snippet


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
    animation_html: str | None,
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
    # 游戏互动（可选）—— 当 game_html 非空时生成 game idea + rendered_section
    game_html: str | None = None,
    game_topic: str = "",
    game_hands_on_ref: str = "",
    game_acceptance_ref: str = "",
    game_mode_reason: str = "互动操作直接检验动手动作",
    preflight: bool = True,
    # 外部资料（Tavily research_knode() 的返回值）
    research: dict | None = None,
    # LabXchange 匹配结果（search_labxchange() 的返回值）
    labxchange_results: list[dict] | None = None,
    # 基础理论标注（Step 1.5 生成的 theories 列表）
    theories: list[dict] | None = None,
    # 静态图片资源（互联网照片）
    # 每项 dict 接受以下字段：
    #   src (必填): 图片 URL（http/https）；调用方已经下载过则可直接传 web_path
    #   web_path (可选): 若已下载，直接使用本地服务路径 /api/course-images/...
    #   alt (必填): 替代文本
    #   caption (可选): 图片说明文字
    #   source_url (可选): 图片来源页面 URL
    #   license (可选): 版权信息，如 "CC-BY 4.0 / NASA"
    #   topic (可选): idea.topic，默认用 caption 或 alt
    #   anchor (可选): 插入位置的标题关键字（如 "### 动手实践"），默认放研究资料前
    #   knode_key (可选): 用于图片下载目录；默认从 knode 推断
    #   hands_on_ref / acceptance_ref (可选): 对齐 v4.1 hands_on_components / acceptance
    images: list[dict] | None = None,
    # 静态 HTML 示意图（Claude 自己写的 SVG/HTML 图）
    # 每项 dict 接受以下字段：
    #   html_path (必填): 本地 HTML 文件路径（相对 ROOT 或绝对路径）
    #   topic (必填): 示意图标题，会变成 idea.topic
    #   caption (可选): 示意图下的说明
    #   anchor (可选): 插入位置的标题关键字，默认 "## 核心概念"
    #   hands_on_ref / acceptance_ref (可选): v4.1 对齐
    diagrams: list[dict] | None = None,
    # 实物动手套件（购买元器件 + 动手操作环节）
    # 每项 dict 接受以下字段：
    #   topic (必填): 套件名称，如 "传感器入门套件"
    #   total_cost_cny (必填): 总价估算（人民币元）
    #   age_min (可选): 建议最低年龄，默认 8
    #   safety_level (可选): "low" / "medium" / "high"，默认 "low"
    #   components (必填): 元器件列表，每项含 name/name_en/spec/qty/price_cny/search_keyword
    #   tools (可选): 工具列表，每项含 name/name_en/price_cny/included
    #   steps (必填): 操作步骤列表，每项含 step/title/description/safety_warning/expected_result
    #   anchor (可选): 插入位置的标题关键字，默认 "## 动手实践"
    #   hands_on_ref / acceptance_ref (可选): v4.1 对齐
    hands_on_kits: list[dict] | None = None,
) -> dict:
    """
    构造标准 CourseContent dict，供写入数据库。

    基础参数：
        animation_html: 完整 Canvas HTML 字符串；d=1 foundation 等无需动画的
                        knode 可传 None 跳过 animation idea。
        exercises: make_exercises() 的返回值
        story_paragraphs: [{"text": str, "image_url": ""}] 或 None
        game_html: 完整游戏 HTML（自包含 iframe 可用）；非空时生成 game idea。

    v4.1 参数（都是可选，但 knode 含 v4.1 字段时应该全部提供）：
        knode: 完整的 v4.1 knode dict（来自 load_knode_context() 或直接读 JSON）。
               传入后会自动调用 preflight_v41() 校验生成的 course_content。
        animation_hands_on_ref: animation idea 对应的 hands_on_components 原文
        animation_acceptance_ref: animation idea 对应的 acceptance_standard/artifact title 原文
        game_hands_on_ref / game_acceptance_ref: 同上，给 game idea 使用
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

    # 0a. 展开 {{KEY}} shortcode 为完整 Markdown 链接
    plan_markdown = expand_resource_shortcodes(plan_markdown)

    # 0b. 把外部资料融入 plan_markdown（如果传入了 research / labxchange）
    if research or labxchange_results:
        plan_markdown = merge_resources_into_plan(
            plan_markdown, research, labxchange_results=labxchange_results
        )

    # 0.5 动画 HTML 双重修复：
    #   (a) 把非等比 ctx.scale(w/W, h/H) 替换为 letterbox 等比缩放
    #       （避免大屏下字体被拉宽）
    #   (b) 注入 ResizeObserver + drawCurrent 补丁
    #       （修复 iframe 容器 resize 后 canvas 空白的 bug）
    if animation_html:
        animation_html = fix_nonuniform_scale_in_html(animation_html)
        animation_html = inject_animation_resize_patch(animation_html)
    if game_html:
        game_html = fix_nonuniform_scale_in_html(game_html)
        game_html = inject_animation_resize_patch(game_html)
        # 0.6 检查 game HTML 中的尺寸硬编码上限
        #     常见错误：Math.min(..., 480) / Math.min(..., 200) 等会导致
        #     canvas 在大屏 iframe 中只占很小一块。
        _size_cap_pat = re.compile(
            r'Math\.min\s*\([^)]*,\s*(\d+)\s*\)',
        )
        for m in _size_cap_pat.finditer(game_html):
            cap_val = int(m.group(1))
            context = game_html[max(0, m.start()-60):m.end()+20]
            # 排除非尺寸相关的 Math.min（如 dt, percentage, score 等）
            # 排除 DPR 相关 (devicePixelRatio, dpr) 和极小值 (<10)
            ctx_lower = context.lower()
            is_dpr = any(kw in ctx_lower for kw in ['pixelratio', 'dpr'])
            is_size_related = not is_dpr and cap_val >= 10 and any(
                kw in ctx_lower
                for kw in ['sz', 'size', 'canvas', 'width', 'height',
                           'availw', 'availh', 'block', 'card']
            )
            if is_size_related and cap_val < 600:
                console.print(
                    f"[yellow]WARNING: game HTML 中检测到尺寸硬编码上限 "
                    f"Math.min(..., {cap_val})。大屏 iframe 中 canvas 会很小。"
                    f"建议去掉硬编码上限，改用容器百分比计算。[/yellow]"
                )

    ex_id = _id("ex")

    ideas: list[dict] = []
    rendered_sections: dict = {}

    anim_id: str | None = None
    if animation_html:
        anim_id = _id("anim")
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
        ideas.append(anim_idea)
        rendered_sections[anim_id] = {
            "mode": "animation",
            "status": "ready",
            "html": animation_html,
            "story_paragraphs": None,
            "exercises": None,
            "generation_backend": "canvas_direct",
        }

    game_id: str | None = None
    if game_html:
        game_id = _id("game")
        game_idea: dict = {
            "idea_id": game_id,
            "mode": "game",
            "topic": game_topic or animation_topic,
            "context_summary": game_topic or animation_topic,
            "generation_backend": "canvas_direct",
            "style_key": "chromatic_depth",
            "mode_reason": game_mode_reason,
        }
        if game_hands_on_ref:
            game_idea["hands_on_ref"] = game_hands_on_ref
        if game_acceptance_ref:
            game_idea["acceptance_ref"] = game_acceptance_ref
        ideas.append(game_idea)
        rendered_sections[game_id] = {
            "mode": "game",
            "status": "ready",
            "html": game_html,
            "story_paragraphs": None,
            "exercises": None,
            "generation_backend": "canvas_direct",
        }

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
    ideas.append(ex_idea)
    rendered_sections[ex_id] = {
        "mode": "exercise",
        "status": "ready",
        "html": None,
        "story_paragraphs": None,
        "exercises": exercises,
        "generation_backend": "",
    }

    story_id: str | None = None
    if story_paragraphs:
        story_id = _id("story")
        # story 放在 animation 之后、game 之前；这里直接插入到 ideas 第 0 位之后
        insert_pos = 1 if anim_id else 0
        ideas.insert(insert_pos, {
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

    # 5. 静态图片（image）
    image_markers: list[tuple[str, str]] = []
    if images:
        # 推断 knode_key（用于图片本地子目录）：优先 knode.project_name + knode_index，
        # 否则 fallback 到 knode.id 或 "shared"
        default_key = "shared"
        if knode is not None:
            key_parts = []
            proj = knode.get("project_name") or ""
            if proj:
                key_parts.append(str(proj))
            idx = knode.get("knode_index") if "knode_index" in knode else knode.get("id")
            if idx is not None:
                key_parts.append(str(idx))
            if key_parts:
                default_key = "_".join(key_parts)

        for img in images:
            img_id = _id("img")
            anchor = img.get("anchor", "")
            alt = img.get("alt", "")
            caption = img.get("caption", "")
            source_url = img.get("source_url", "")
            license_txt = img.get("license", "")
            topic = img.get("topic") or caption or alt or "静态图片"
            knode_key = img.get("knode_key") or default_key

            # web_path 优先级：
            #   1. 显式传入 web_path（已下载的本地图片）
            #   2. src 是 /api/... 开头 → 视为已经是 web 路径
            #   3. src 是 http(s):// → 下载到本地
            web_path = img.get("web_path", "")
            src = img.get("src", "")
            if not web_path:
                if src.startswith("/api/course-images/") or src.startswith("/static/"):
                    web_path = src
                elif src.startswith(("http://", "https://")):
                    info = download_course_image(src, knode_key, filename=img.get("filename"))
                    web_path = info["web_path"]
                else:
                    raise ValueError(f"image entry must provide web_path or http(s) src: {img}")

            img_idea: dict = {
                "idea_id": img_id,
                "mode": "image",
                "topic": topic,
                "context_summary": caption or alt or topic,
                "generation_backend": "",
                "style_key": "",
                "mode_reason": "概念用静态图片比动画更高效",
            }
            if "hands_on_ref" in img:
                img_idea["hands_on_ref"] = img["hands_on_ref"]
            if "acceptance_ref" in img:
                img_idea["acceptance_ref"] = img["acceptance_ref"]
            ideas.append(img_idea)
            rendered_sections[img_id] = {
                "mode": "image",
                "status": "ready",
                "html": None,
                "story_paragraphs": None,
                "exercises": None,
                "generation_backend": "",
                "src": web_path,
                "alt": alt,
                "caption": caption,
                "source_url": source_url,
                "license": license_txt,
            }
            image_markers.append((img_id, anchor))

    # 6. 静态 HTML 示意图（diagram）
    diagram_markers: list[tuple[str, str]] = []
    if diagrams:
        for d in diagrams:
            dia_id = _id("diagram")
            html_path = d.get("html_path")
            if not html_path:
                raise ValueError("diagram entry must provide html_path")
            p = Path(html_path)
            if not p.is_absolute():
                p = ROOT / p
            if not p.exists():
                raise FileNotFoundError(f"diagram html not found: {p}")
            html_text = p.read_text(encoding="utf-8")
            # 示意图 iframe 尺寸较小，也可能需要 resize patch
            html_text = fix_nonuniform_scale_in_html(html_text)
            html_text = inject_animation_resize_patch(html_text)

            topic = d.get("topic") or "示意图"
            anchor = d.get("anchor", "## 核心概念")
            caption = d.get("caption", "")
            dia_idea: dict = {
                "idea_id": dia_id,
                "mode": "diagram",
                "topic": topic,
                "context_summary": caption or topic,
                "generation_backend": "html_static",
                "style_key": "",
                "mode_reason": "概念用静态示意图比动画更直观",
            }
            if "hands_on_ref" in d:
                dia_idea["hands_on_ref"] = d["hands_on_ref"]
            if "acceptance_ref" in d:
                dia_idea["acceptance_ref"] = d["acceptance_ref"]
            ideas.append(dia_idea)
            rendered_sections[dia_id] = {
                "mode": "diagram",
                "status": "ready",
                "html": html_text,
                "story_paragraphs": None,
                "exercises": None,
                "generation_backend": "html_static",
                "caption": caption,
            }
            diagram_markers.append((dia_id, anchor))

    # 7. 实物动手套件（hands_on_kit）
    kit_markers: list[tuple[str, str]] = []
    if hands_on_kits:
        for kit in hands_on_kits:
            kit_id = _id("kit")
            topic = kit.get("topic") or "实物动手套件"
            anchor = kit.get("anchor", "## 动手实践")

            if not kit.get("components"):
                raise ValueError("hands_on_kit entry must provide components list")
            if not kit.get("steps"):
                raise ValueError("hands_on_kit entry must provide steps list")

            kit_idea: dict = {
                "idea_id": kit_id,
                "mode": "hands_on_kit",
                "topic": topic,
                "context_summary": topic,
                "generation_backend": "",
                "style_key": "",
                "mode_reason": "需要实物元器件动手操作来加深理解",
            }
            if "hands_on_ref" in kit:
                kit_idea["hands_on_ref"] = kit["hands_on_ref"]
            if "acceptance_ref" in kit:
                kit_idea["acceptance_ref"] = kit["acceptance_ref"]
            ideas.append(kit_idea)

            rendered_sections[kit_id] = {
                "mode": "hands_on_kit",
                "status": "ready",
                "html": None,
                "story_paragraphs": None,
                "exercises": None,
                "generation_backend": "",
                "kit_topic": topic,
                "total_cost_cny": kit.get("total_cost_cny", 0),
                "age_min": kit.get("age_min", 8),
                "safety_level": kit.get("safety_level", "low"),
                "components": kit.get("components", []),
                "tools": kit.get("tools", []),
                "steps": kit.get("steps", []),
            }
            kit_markers.append((kit_id, anchor))

    # 在 plan_markdown 中插入 [[IDEA:...]] 标记，让前端能在正确位置渲染
    # animation / game / exercise / story / image / diagram / hands_on_kit。
    plan_markdown = inject_idea_markers(
        plan_markdown,
        anim_id=anim_id,
        ex_id=ex_id,
        story_id=story_id,
        game_id=game_id,
        image_markers=image_markers,
        diagram_markers=diagram_markers,
        kit_markers=kit_markers,
    )

    course_content = {
        "plan_markdown": plan_markdown,
        "ideas": ideas,
        "rendered_sections": rendered_sections,
    }

    # 基础理论标注（Step 1.5）
    if theories:
        course_content["theories"] = theories

    # 外部资料结构化字段：合并 Tavily 搜索 + LabXchange 匹配
    ext: dict = {}
    if research:
        ext["web_query"] = research.get("web_query", "")
        ext["youtube_query"] = research.get("youtube_query", "")
        ext["web_results"] = research.get("web_results", [])
        ext["youtube_results"] = research.get("youtube_results", [])
        ext["researched_at"] = research.get("researched_at", "")
    if labxchange_results:
        ext["labxchange_results"] = labxchange_results
    if ext:
        course_content["external_resources"] = ext

    # v4.1 自动校验
    if preflight and knode is not None:
        errors = preflight_v41(knode, course_content)
        if errors:
            msg = "v4.1 preflight failed:\n" + "\n".join(f"  - {e}" for e in errors)
            raise ValueError(msg)

    return course_content


if __name__ == "__main__":
    main()
