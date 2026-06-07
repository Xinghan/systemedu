"""Tarball 导入: 解压 → 验证 manifest hash → 写 DB + 持久化文件.

POST /admin/projects/import 收到 multipart tarball, 调 import_tarball()
"""

from __future__ import annotations

import json
import shutil
import tarfile
import tempfile
from datetime import datetime
from pathlib import Path

from .manifest import Manifest, load_manifest, verify_files
from .models import Lesson, Project, ProjectStatus, get_session
from .settings import PROJECTS_MEDIA_DIR


class ImportError_(Exception):
    """库导入错误 (重命名避免和 builtin ImportError 冲突)."""


def import_tarball(tarball_path: Path, allow_overwrite: bool = True) -> Manifest:
    """导入 tarball → 写 DB + 解压到 PROJECTS_MEDIA_DIR/<slug>/.

    步骤:
    1. 解压到临时目录
    2. 读 manifest.json
    3. 验证所有 file 的 sha256 + size
    4. 解析 V5 knowledge_tree 结构出 stages / modules
    5. 写 Project + Lesson 记录到 DB
    6. mv 解压后的文件到 PROJECTS_MEDIA_DIR/<slug>/

    Args:
        tarball_path: 上传 tarball 的本地路径
        allow_overwrite: 已存在同 slug 项目时是否覆盖 (覆盖 = 删除旧的 + 重新装)

    Returns:
        解析出的 Manifest

    Raises:
        ImportError_: 校验失败 / slug 冲突
    """
    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)

        # 1. 解压
        with tarfile.open(tarball_path, "r:gz") as tar:
            # 安全检查: 拒绝绝对路径 / .. 跳出 tar
            for member in tar.getmembers():
                if member.name.startswith("/") or ".." in member.name.split("/"):
                    raise ImportError_(f"unsafe path in tar: {member.name!r}")
            tar.extractall(tmp_dir)

        # tarball 顶层目录是 <slug>/, 找到唯一一个目录
        top_dirs = [p for p in tmp_dir.iterdir() if p.is_dir()]
        if len(top_dirs) != 1:
            raise ImportError_(
                f"tarball must contain exactly 1 top-level <slug>/ dir, got {len(top_dirs)}"
            )
        project_dir = top_dirs[0]

        # 2. 读 manifest
        manifest_path = project_dir / "manifest.json"
        if not manifest_path.exists():
            raise ImportError_("manifest.json not found at top level of tarball")
        manifest = load_manifest(manifest_path)

        # 3. 验证 hash
        errors = verify_files(manifest, project_dir)
        if errors:
            raise ImportError_(f"manifest validation failed: {errors[:5]}")

        # 4. 读 knowledge_tree
        tree_path = project_dir / "tree" / "knowledge_tree.json"
        if not tree_path.exists():
            raise ImportError_("tree/knowledge_tree.json not found")
        tree_json = json.loads(tree_path.read_text(encoding="utf-8"))

        # 5. 写 DB + 文件
        db = get_session()
        try:
            existing = db.query(Project).filter_by(slug=manifest.slug).first()
            if existing:
                if not allow_overwrite:
                    raise ImportError_(f"project {manifest.slug!r} already exists")
                # 清旧文件 (在写新文件之前)
                old_dir = PROJECTS_MEDIA_DIR / manifest.slug
                if old_dir.exists():
                    shutil.rmtree(old_dir)
                # 删旧 lessons
                db.query(Lesson).filter_by(project_slug=manifest.slug).delete()
                project = existing
                project.updated_at = datetime.utcnow()
            else:
                project = Project(slug=manifest.slug)
                db.add(project)

            # 同步 metadata
            fm = manifest.frontmatter
            project.title = manifest.title
            project.title_zh = manifest.title_zh
            project.description = manifest.description
            project.age_band = fm.age_band
            project.domain = fm.domain
            project.duration_weeks = fm.duration_weeks
            project.weekly_hours = fm.weekly_hours
            project.budget_usd = fm.budget_usd
            project.difficulty = fm.difficulty
            project.tags = manifest.tags
            project.cover_image_path = manifest.cover_image_path
            project.version = manifest.version
            project.knode_count = manifest.knode_count
            project.stage_count = manifest.stage_count
            project.languages = manifest.languages
            project.total_size_bytes = manifest.total_size_bytes
            project.manifest_json = manifest.model_dump()
            project.knowledge_tree_json = tree_json
            # 默认导入是 draft (除非已经是 published 保留状态)
            if existing is None:
                project.status = ProjectStatus.draft

            # lessons: 从 tree 的 modules 读, 或从 manifest.knodes
            for entry in manifest.knodes:
                lesson = Lesson(
                    project_slug=manifest.slug,
                    knode_id=entry.module_id,
                    title=entry.title,
                    week=entry.week,
                    stage=entry.stage,
                    duration_minutes=entry.duration_minutes,
                    knode_dir=entry.knode_dir,
                    version=manifest.version,
                )
                # 读该 knode 目录下的 lesson.md / sections.json / 等
                knode_dir = project_dir / entry.knode_dir
                if knode_dir.exists():
                    lesson.plan_markdown = _read_text_safely(knode_dir / "lesson.md")
                    lesson.assignment_md = _read_text_safely(knode_dir / "assignment.md")
                    lesson.rendered_sections = _read_json_safely(knode_dir / "sections.json", default={})
                    lesson.audio_scripts = _read_json_safely(knode_dir / "audio_scripts.json", default={})
                    lesson.theories = _read_json_safely(knode_dir / "theories.json", default=[])
                    _slides_doc = _read_json_safely(knode_dir / "slides.json", default={})
                    lesson.slides = (
                        _slides_doc.get("slides", [])
                        if isinstance(_slides_doc, dict)
                        else (_slides_doc if isinstance(_slides_doc, list) else [])
                    )
                    # 该 knode 的所有文件
                    lesson.files = [
                        f.model_dump() for f in manifest.files
                        if f.path.startswith(entry.knode_dir + "/")
                    ]
                db.add(lesson)

            # 6. mv 文件到 PROJECTS_MEDIA_DIR/<slug>/
            target_dir = PROJECTS_MEDIA_DIR / manifest.slug
            target_dir.parent.mkdir(parents=True, exist_ok=True)
            if target_dir.exists():
                shutil.rmtree(target_dir)
            shutil.copytree(project_dir, target_dir)

            # spec 033: 把原始 tarball 拷一份到 _archive/<slug>-<version>.tar.gz
            # 用于 /v1/projects/<slug>/download 给 student-app pull 时下载
            archive_dir = target_dir / "_archive"
            archive_dir.mkdir(parents=True, exist_ok=True)
            archive_path = archive_dir / f"{manifest.slug}-{manifest.version}.tar.gz"
            shutil.copy2(tarball_path, archive_path)

            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    return manifest


def _read_text_safely(p: Path, default: str = "") -> str:
    if p.exists():
        return p.read_text(encoding="utf-8")
    return default


def _read_json_safely(p: Path, default):
    if p.exists():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return default
    return default
