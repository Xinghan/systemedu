"""library 项目开篇连环画 (story) 链路测试 (spec 040)。

覆盖: manifest 解析 story / importer 写 Project.story /
_public_project_view 透传 / library_client 透传 / 老 DB 补列迁移。
"""
from __future__ import annotations

import importlib
import json
import sys
import tarfile
from pathlib import Path

sys.path.insert(0, "packages/library-app/src")


# ---------------------------------------------------------------------------
# manifest 层
# ---------------------------------------------------------------------------

def test_manifest_parses_story_frames():
    from library.manifest import Manifest

    m = Manifest.model_validate(
        {
            "slug": "p1",
            "title": "t",
            "story": [
                {
                    "image": "story/story-1.jpg",
                    "title_zh": "标题一",
                    "title_en": "Title One",
                    "caption_zh": "说明一",
                    "caption_en": "Caption One",
                },
                {"image": "story/story-2.jpg"},  # 文案缺省 = 空串
            ],
        }
    )
    assert len(m.story) == 2
    assert m.story[0].image == "story/story-1.jpg"
    assert m.story[0].title_zh == "标题一"
    assert m.story[0].caption_en == "Caption One"
    # 缺文案的帧仍可解析, 文案为空串
    assert m.story[1].image == "story/story-2.jpg"
    assert m.story[1].title_zh == ""


def test_manifest_story_defaults_empty():
    """老 manifest (无 story) 向后兼容 = 空 list。"""
    from library.manifest import Manifest

    m = Manifest.model_validate({"slug": "p1", "title": "t"})
    assert m.story == []


# ---------------------------------------------------------------------------
# _public_project_view 透传 (list + detail)
# ---------------------------------------------------------------------------

def test_public_view_returns_story(tmp_path, monkeypatch):
    monkeypatch.setenv("LIBRARY_HOME", str(tmp_path / "libhome_view"))
    from library import settings as _s
    importlib.reload(_s)
    from library import models as _m
    importlib.reload(_m)
    _m.init_db()
    from library.models import Project, ProjectStatus

    story = [{"image": "story/story-1.jpg", "title_zh": "幕一", "caption_zh": "c"}]
    with _m.get_session() as db:
        db.add(
            Project(
                slug="p1",
                title="t",
                status=ProjectStatus.published,
                manifest_json={},
                knowledge_tree_json={},
                version="1.0.0",
                story=story,
            )
        )
        db.commit()

    from library.routes import public as _pub
    importlib.reload(_pub)
    with _m.get_session() as db:
        p = db.query(Project).filter_by(slug="p1").first()
        view = _pub._public_project_view(p)
    assert "story" in view
    assert view["story"] == story


def test_public_view_story_empty_when_none(tmp_path, monkeypatch):
    """Project.story 为 None 时, 视图返回空 list (前端据此不显示 icon)。"""
    monkeypatch.setenv("LIBRARY_HOME", str(tmp_path / "libhome_none"))
    from library import settings as _s
    importlib.reload(_s)
    from library import models as _m
    importlib.reload(_m)
    _m.init_db()
    from library.models import Project, ProjectStatus

    with _m.get_session() as db:
        db.add(
            Project(
                slug="p2",
                title="t",
                status=ProjectStatus.published,
                manifest_json={},
                knowledge_tree_json={},
                version="1.0.0",
                story=None,
            )
        )
        db.commit()

    from library.routes import public as _pub
    importlib.reload(_pub)
    with _m.get_session() as db:
        p = db.query(Project).filter_by(slug="p2").first()
        view = _pub._public_project_view(p)
    assert view["story"] == []


# ---------------------------------------------------------------------------
# importer 端到端: tarball.manifest.story -> Project.story
# ---------------------------------------------------------------------------

def _build_story_tarball(tmp: Path) -> Path:
    """造一个含 story 帧 + 图的最小项目 tarball。"""
    from library.manifest import sha256_file

    proj = tmp / "src" / "story-proj"
    (proj / "story").mkdir(parents=True)
    (proj / "tree").mkdir(parents=True)

    # story 图 (内容随意, 用于 sha256 校验)
    img = proj / "story" / "story-1.jpg"
    img.write_bytes(b"\xff\xd8\xff\xe0fake-jpeg-bytes-for-test")

    # tree
    tree = {"schema_version": "5.0", "title": "t", "stages": [], "modules": [],
            "edges": [], "final_outcomes": []}
    (proj / "tree" / "knowledge_tree.json").write_text(json.dumps(tree), encoding="utf-8")

    manifest = {
        "schema_version": "1.0",
        "slug": "story-proj",
        "title": "Story Project",
        "title_zh": "故事项目",
        "version": "1.0.0",
        "knode_count": 0,
        "stage_count": 0,
        "story": [
            {
                "image": "story/story-1.jpg",
                "title_zh": "第一幕",
                "title_en": "Act One",
                "caption_zh": "这是第一幕",
                "caption_en": "This is act one",
            }
        ],
        "files": [
            {
                "path": "story/story-1.jpg",
                "sha256": sha256_file(img),
                "size": img.stat().st_size,
            }
        ],
    }
    (proj / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")

    tarball = tmp / "story-proj.tar.gz"
    with tarfile.open(tarball, "w:gz") as tar:
        tar.add(proj, arcname="story-proj")
    return tarball


def test_importer_persists_story(tmp_path, monkeypatch):
    monkeypatch.setenv("LIBRARY_HOME", str(tmp_path / "libhome_imp"))
    from library import settings as _s
    importlib.reload(_s)
    from library import models as _m
    importlib.reload(_m)
    _m.init_db()
    from library import importer as _imp
    importlib.reload(_imp)

    tarball = _build_story_tarball(tmp_path)
    manifest = _imp.import_tarball(tarball, allow_overwrite=True)
    assert len(manifest.story) == 1

    from library.models import Project
    with _m.get_session() as db:
        p = db.query(Project).filter_by(slug="story-proj").first()
        assert p is not None
        assert p.story is not None
        assert len(p.story) == 1
        assert p.story[0]["title_zh"] == "第一幕"
        assert p.story[0]["image"] == "story/story-1.jpg"


# ---------------------------------------------------------------------------
# library_client 透传 (student-app 反代靠 ProjectMeta dataclass)
# ---------------------------------------------------------------------------

def test_library_client_project_meta_carries_story():
    from systemedu.core.library_client.client import ProjectMeta

    p = ProjectMeta.from_dict(
        {
            "slug": "p1",
            "title": "t",
            "story": [{"image": "story/story-1.jpg", "title_zh": "幕一"}],
        }
    )
    assert p.story and p.story[0]["image"] == "story/story-1.jpg"
    # __dict__ (反代透传方式) 含 story
    assert "story" in p.__dict__


def test_library_client_project_meta_story_defaults_empty():
    from systemedu.core.library_client.client import ProjectMeta

    p = ProjectMeta.from_dict({"slug": "p1", "title": "t"})
    assert p.story == []


# ---------------------------------------------------------------------------
# 老 DB 补列迁移 (_ensure_columns idempotent)
# ---------------------------------------------------------------------------

def test_ensure_columns_adds_story_to_legacy_db(tmp_path, monkeypatch):
    """模拟老 DB (无 story 列), init_db 应补上且幂等。"""
    monkeypatch.setenv("LIBRARY_HOME", str(tmp_path / "libhome_mig"))
    from library import settings as _s
    importlib.reload(_s)
    from library import models as _m
    importlib.reload(_m)

    from sqlalchemy import text

    # 1) 手工建一个缺 story 列的旧 projects 表
    engine = _m.get_engine()
    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE TABLE projects ("
                "slug VARCHAR PRIMARY KEY, title VARCHAR, "
                "manifest_json JSON, knowledge_tree_json JSON)"
            )
        )
        cols_before = {
            r[1] for r in conn.execute(text("PRAGMA table_info(projects)")).fetchall()
        }
    assert "story" not in cols_before

    # 2) init_db -> _ensure_columns 应补 story 列
    _m.init_db()
    with engine.begin() as conn:
        cols_after = {
            r[1] for r in conn.execute(text("PRAGMA table_info(projects)")).fetchall()
        }
    assert "story" in cols_after

    # 3) 再跑一次幂等 (不报错)
    _m.init_db()
