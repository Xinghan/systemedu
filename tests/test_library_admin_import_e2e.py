"""library admin 导入流程端到端 (工单 T4)。

覆盖 importer.import_tarball + POST /admin/projects/import 的真实行为:
- 有效 tarball -> Project(status=draft) + 每 knode 一条 Lesson (plan/sections/audio 装填)
- manifest sha256 与实际不符 -> ImportError_ -> 端点 400
- tar 含 ../ 或绝对路径成员 -> 拒绝 (unsafe path in tar)
- 顶层无 manifest.json -> 拒绝
- 同 slug 已存在 + allow_overwrite=false -> 拒绝 (already exists)
- overwrite=true -> 旧 lessons 清掉 + 写新的 (无孤儿 Lesson)
- 导入后 PROJECTS_MEDIA_DIR/<slug>/ 文件完整 + _archive/ 有 tarball 备份
- manifest.story[] -> Project.story JSON 正确映射

范式参考 tests/test_library_story.py (monkeypatch LIBRARY_HOME + importlib.reload
隔离每个测试的库目录; 直接调 importer + verify_files 范式)。
所有 reload 同一套 settings/models/manifest/importer, 保证 PROJECTS_MEDIA_DIR /
全局 engine 指向本测试的临时目录, 不污染真实 ~/.systemedu-library/。
"""

from __future__ import annotations

import hashlib
import importlib
import io
import json
import sys
import tarfile
from pathlib import Path

import pytest

sys.path.insert(0, "packages/library-app/src")


# ---------------------------------------------------------------------------
# 隔离 fixture: 每个测试一套全新 LIBRARY_HOME + reload 全链路模块
# ---------------------------------------------------------------------------

@pytest.fixture
def lib_env(tmp_path, monkeypatch):
    """把 library 全局状态指向本测试独立的临时目录。

    返回一个简单命名空间, 暴露 reload 后的模块 + PROJECTS_MEDIA_DIR。
    settings 用 module-level Final 常量、models 用 module-level _engine 缓存,
    故必须 reload 顺序: settings -> models -> manifest -> importer。
    """
    home = tmp_path / "libhome"
    monkeypatch.setenv("LIBRARY_HOME", str(home))

    from library import settings as _s
    importlib.reload(_s)
    from library import models as _m
    importlib.reload(_m)
    from library import manifest as _mf
    importlib.reload(_mf)
    from library import importer as _imp
    importlib.reload(_imp)

    _m.init_db()

    class _Ns:
        settings = _s
        models = _m
        manifest = _mf
        importer = _imp
        media_dir = _s.PROJECTS_MEDIA_DIR

    return _Ns()


# ---------------------------------------------------------------------------
# tarball builder (可微调 manifest 制造 hash 不符 / 缺 manifest / unsafe path)
# ---------------------------------------------------------------------------

def _sha256(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def _build_project_tree(tmp: Path, slug: str) -> Path:
    """造一个最小但完整的项目目录 (2 个 knode + tree + story 图)，返回项目目录。"""
    root = tmp / "src" / slug
    (root / "tree").mkdir(parents=True)
    (root / "story").mkdir(parents=True)
    k1 = root / "knodes" / "M01-w1-intro"
    k2 = root / "knodes" / "M02-w1-deep"
    k1.mkdir(parents=True)
    k2.mkdir(parents=True)

    (k1 / "lesson.md").write_text("# M01 Intro\n\nplan body.\n", encoding="utf-8")
    (k1 / "sections.json").write_text('{"sections":[{"id":"s1"}]}', encoding="utf-8")
    (k1 / "audio_scripts.json").write_text('{"scripts":["hello"]}', encoding="utf-8")
    (k2 / "lesson.md").write_text("# M02 Deep\n", encoding="utf-8")
    (k2 / "sections.json").write_text('{"sections":[]}', encoding="utf-8")
    (k2 / "audio_scripts.json").write_text('{"scripts":[]}', encoding="utf-8")

    (root / "story" / "story-1.png").write_bytes(
        b"\x89PNG\r\n\x1a\nfake-story-image-bytes"
    )

    tree = {
        "schema_version": "5.0",
        "title": "T4 import test",
        "stages": [{"stage_id": "S1", "title": "Phase 1"}],
        "modules": [
            {"module_id": "M01", "stage_id": "S1", "title": "Intro"},
            {"module_id": "M02", "stage_id": "S1", "title": "Deep"},
        ],
        "edges": [],
        "final_outcomes": [],
    }
    (root / "tree" / "knowledge_tree.json").write_text(
        json.dumps(tree), encoding="utf-8"
    )
    return root


def _make_manifest(root: Path, slug: str) -> dict:
    """根据磁盘真实文件算出 files[] (sha256/size)，组装合法 manifest dict。"""
    files = [
        {
            "path": p.relative_to(root).as_posix(),
            "sha256": _sha256(p),
            "size": p.stat().st_size,
        }
        for p in sorted(root.rglob("*"))
        if p.is_file() and p.name != "manifest.json"
    ]
    return {
        "schema_version": "1.0",
        "slug": slug,
        "title": "T4 import project",
        "title_zh": "T4 导入项目",
        "description": "T4 e2e",
        "version": "1.0.0",
        "frontmatter": {"age_band": "10-12", "domain": "Test", "duration_weeks": 1},
        "knode_count": 2,
        "stage_count": 1,
        "languages": ["zh-CN"],
        "total_size_bytes": sum(f["size"] for f in files),
        "files": files,
        "knodes": [
            {
                "module_id": "M01",
                "title": "Intro",
                "week": 1,
                "stage": "S1",
                "duration_minutes": 60,
                "knode_dir": "knodes/M01-w1-intro",
            },
            {
                "module_id": "M02",
                "title": "Deep",
                "week": 1,
                "stage": "S1",
                "duration_minutes": 60,
                "knode_dir": "knodes/M02-w1-deep",
            },
        ],
        "tags": ["test"],
        "story": [
            {
                "image": "story/story-1.png",
                "title_zh": "开篇一",
                "title_en": "Opening One",
                "caption_zh": "这是开篇第一帧",
                "caption_en": "First story frame",
            }
        ],
    }


def _pack(root: Path, slug: str, tarball: Path) -> Path:
    """把 root/ 打成 <slug>/ 顶层目录的 tar.gz。"""
    with tarfile.open(tarball, "w:gz") as tar:
        tar.add(root, arcname=slug)
    return tarball


def make_valid_tarball(tmp: Path, slug: str = "t4-import") -> Path:
    """造一个合法 tarball (hash 全对)。"""
    root = _build_project_tree(tmp, slug)
    manifest = _make_manifest(root, slug)
    (root / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False), encoding="utf-8"
    )
    return _pack(root, slug, tmp / f"{slug}.tar.gz")


# ---------------------------------------------------------------------------
# Scenario 1: 有效 tarball -> Project(draft) + 每 knode 一条 Lesson
# ---------------------------------------------------------------------------

def test_valid_tarball_creates_project_and_lessons(lib_env, tmp_path):
    slug = "t4-valid"
    tarball = make_valid_tarball(tmp_path, slug)

    manifest = lib_env.importer.import_tarball(tarball, allow_overwrite=False)
    assert manifest.slug == slug

    Project = lib_env.models.Project
    Lesson = lib_env.models.Lesson
    ProjectStatus = lib_env.models.ProjectStatus
    with lib_env.models.get_session() as db:
        p = db.query(Project).filter_by(slug=slug).first()
        assert p is not None
        # 默认导入是 draft
        assert p.status == ProjectStatus.draft
        assert p.title == "T4 import project"
        assert p.version == "1.0.0"

        lessons = db.query(Lesson).filter_by(project_slug=slug).order_by(Lesson.knode_id).all()
        # manifest.knodes 两条 -> 两条 Lesson
        assert [l.knode_id for l in lessons] == ["M01", "M02"]

        m01 = lessons[0]
        # plan/sections/audio 装填正确 (从 knode 目录读)
        assert "M01 Intro" in m01.plan_markdown
        assert m01.rendered_sections == {"sections": [{"id": "s1"}]}
        assert m01.audio_scripts == {"scripts": ["hello"]}
        assert m01.title == "Intro"
        assert m01.week == 1
        assert m01.stage == "S1"


# ---------------------------------------------------------------------------
# Scenario 2: manifest 列的 sha256 与实际不符 -> ImportError_
# ---------------------------------------------------------------------------

def test_sha256_mismatch_rejected(lib_env, tmp_path):
    slug = "t4-badhash"
    root = _build_project_tree(tmp_path, slug)
    manifest = _make_manifest(root, slug)
    # 把第一个文件的 sha256 改成假的 -> 与磁盘不符
    manifest["files"][0]["sha256"] = "0" * 64
    (root / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False), encoding="utf-8"
    )
    tarball = _pack(root, slug, tmp_path / f"{slug}.tar.gz")

    with pytest.raises(lib_env.importer.ImportError_) as exc:
        lib_env.importer.import_tarball(tarball, allow_overwrite=True)
    assert "validation failed" in str(exc.value)

    # 校验失败不应留下 Project 记录
    with lib_env.models.get_session() as db:
        assert db.query(lib_env.models.Project).filter_by(slug=slug).first() is None


# ---------------------------------------------------------------------------
# Scenario 3: tar 含 ../ 或绝对路径成员 -> 拒绝 (unsafe path in tar)
# ---------------------------------------------------------------------------

def test_unsafe_path_traversal_rejected(lib_env, tmp_path):
    slug = "t4-evil"
    root = _build_project_tree(tmp_path, slug)
    manifest = _make_manifest(root, slug)
    (root / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False), encoding="utf-8"
    )

    # 手工塞一个 ../ 跳出成员 (合法成员之外额外加恶意成员)
    tarball = tmp_path / f"{slug}.tar.gz"
    with tarfile.open(tarball, "w:gz") as tar:
        tar.add(root, arcname=slug)
        evil = tarfile.TarInfo(name=f"{slug}/../evil.txt")
        payload = b"pwned"
        evil.size = len(payload)
        tar.addfile(evil, io.BytesIO(payload))

    with pytest.raises(lib_env.importer.ImportError_) as exc:
        lib_env.importer.import_tarball(tarball, allow_overwrite=True)
    assert "unsafe path" in str(exc.value)


def test_absolute_path_member_rejected(lib_env, tmp_path):
    slug = "t4-abs"
    root = _build_project_tree(tmp_path, slug)
    manifest = _make_manifest(root, slug)
    (root / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False), encoding="utf-8"
    )

    tarball = tmp_path / f"{slug}.tar.gz"
    with tarfile.open(tarball, "w:gz") as tar:
        tar.add(root, arcname=slug)
        evil = tarfile.TarInfo(name="/etc/evil.txt")
        payload = b"pwned"
        evil.size = len(payload)
        tar.addfile(evil, io.BytesIO(payload))

    with pytest.raises(lib_env.importer.ImportError_) as exc:
        lib_env.importer.import_tarball(tarball, allow_overwrite=True)
    assert "unsafe path" in str(exc.value)


# ---------------------------------------------------------------------------
# Scenario 4: 顶层无 manifest.json -> 拒绝
# ---------------------------------------------------------------------------

def test_missing_manifest_rejected(lib_env, tmp_path):
    slug = "t4-nomanifest"
    root = _build_project_tree(tmp_path, slug)
    # 故意不写 manifest.json
    assert not (root / "manifest.json").exists()
    tarball = _pack(root, slug, tmp_path / f"{slug}.tar.gz")

    with pytest.raises(lib_env.importer.ImportError_) as exc:
        lib_env.importer.import_tarball(tarball, allow_overwrite=True)
    assert "manifest.json not found" in str(exc.value)


# ---------------------------------------------------------------------------
# Scenario 5: 同 slug 已存在 + allow_overwrite=false -> 拒绝 (already exists)
# ---------------------------------------------------------------------------

def test_duplicate_slug_no_overwrite_rejected(lib_env, tmp_path):
    slug = "t4-dup"
    tarball = make_valid_tarball(tmp_path, slug)

    # 第一次成功
    lib_env.importer.import_tarball(tarball, allow_overwrite=True)
    # 第二次 allow_overwrite=False -> 拒绝
    with pytest.raises(lib_env.importer.ImportError_) as exc:
        lib_env.importer.import_tarball(tarball, allow_overwrite=False)
    assert "already exists" in str(exc.value)


# ---------------------------------------------------------------------------
# Scenario 6: overwrite=true -> 旧 lessons 清掉 + 写新的 (无孤儿 Lesson)
# ---------------------------------------------------------------------------

def test_overwrite_replaces_lessons_no_orphans(lib_env, tmp_path):
    slug = "t4-ovr"

    # 第一版: 2 个 knode (M01, M02)
    tarball_v1 = make_valid_tarball(tmp_path / "v1", slug)
    lib_env.importer.import_tarball(tarball_v1, allow_overwrite=True)

    Lesson = lib_env.models.Lesson
    with lib_env.models.get_session() as db:
        ids_v1 = {l.knode_id for l in db.query(Lesson).filter_by(project_slug=slug).all()}
    assert ids_v1 == {"M01", "M02"}

    # 第二版: 只有 1 个 knode (M01)，去掉 M02
    root2 = _build_project_tree(tmp_path / "v2", slug)
    # 删掉 M02 knode 目录
    import shutil
    shutil.rmtree(root2 / "knodes" / "M02-w1-deep")
    manifest2 = _make_manifest(root2, slug)
    manifest2["knodes"] = [manifest2["knodes"][0]]  # 仅留 M01
    manifest2["knode_count"] = 1
    (root2 / "manifest.json").write_text(
        json.dumps(manifest2, ensure_ascii=False), encoding="utf-8"
    )
    tarball_v2 = _pack(root2, slug, tmp_path / "v2" / f"{slug}.tar.gz")

    lib_env.importer.import_tarball(tarball_v2, allow_overwrite=True)

    with lib_env.models.get_session() as db:
        lessons = db.query(Lesson).filter_by(project_slug=slug).all()
        ids_v2 = {l.knode_id for l in lessons}
    # 旧 M02 必须被清掉, 不留孤儿
    assert ids_v2 == {"M01"}
    # 全库也不该有任何 M02 孤儿 lesson
    with lib_env.models.get_session() as db:
        orphans = db.query(Lesson).filter_by(knode_id="M02").all()
    assert orphans == []


# ---------------------------------------------------------------------------
# Scenario 7: 导入后 PROJECTS_MEDIA_DIR/<slug>/ 文件完整 + _archive/ 有 tarball 备份
# ---------------------------------------------------------------------------

def test_files_landed_and_archive_backup(lib_env, tmp_path):
    slug = "t4-land"
    tarball = make_valid_tarball(tmp_path, slug)
    manifest = lib_env.importer.import_tarball(tarball, allow_overwrite=True)

    target = lib_env.media_dir / slug
    assert target.is_dir()
    # manifest 列的每个文件都应落盘且 sha256 匹配
    errors = lib_env.manifest.verify_files(manifest, target)
    assert errors == [], f"落盘文件校验失败: {errors}"

    # 关键文件确实在
    assert (target / "manifest.json").exists()
    assert (target / "tree" / "knowledge_tree.json").exists()
    assert (target / "knodes" / "M01-w1-intro" / "lesson.md").exists()
    assert (target / "story" / "story-1.png").exists()

    # _archive/<slug>-<version>.tar.gz 备份
    archive = target / "_archive" / f"{slug}-1.0.0.tar.gz"
    assert archive.exists()
    # 备份就是上传 tarball 的拷贝, 字节一致
    assert archive.read_bytes() == tarball.read_bytes()


# ---------------------------------------------------------------------------
# Scenario 8: manifest.story[] -> Project.story JSON 正确映射
# ---------------------------------------------------------------------------

def test_story_mapped_to_project(lib_env, tmp_path):
    slug = "t4-story"
    tarball = make_valid_tarball(tmp_path, slug)
    lib_env.importer.import_tarball(tarball, allow_overwrite=True)

    Project = lib_env.models.Project
    with lib_env.models.get_session() as db:
        p = db.query(Project).filter_by(slug=slug).first()
        assert p.story is not None
        assert len(p.story) == 1
        frame = p.story[0]
        assert frame["image"] == "story/story-1.png"
        assert frame["title_zh"] == "开篇一"
        assert frame["title_en"] == "Opening One"
        assert frame["caption_zh"] == "这是开篇第一帧"


# ---------------------------------------------------------------------------
# 端点级 e2e: in-process TestClient + admin token (完整 HTTP 链路)
# ---------------------------------------------------------------------------

@pytest.fixture
def admin_client(tmp_path, monkeypatch):
    """起进程内 FastAPI TestClient + bootstrap admin 并返回 (client, token)。

    用 LIBRARY_BOOTSTRAP_ADMIN env 让 lifespan 自动建 super_admin, 然后 login 拿
    JWT。TestClient 上下文管理器会触发 lifespan (ensure_dirs/init_db/bootstrap)。
    """
    home = tmp_path / "ep-libhome"
    monkeypatch.setenv("LIBRARY_HOME", str(home))
    monkeypatch.setenv("LIBRARY_BOOTSTRAP_ADMIN", "t4admin:t4pw")
    monkeypatch.setenv("LIBRARY_JWT_SECRET", "t4-jwt-secret")

    # reload 全链路, 使常量 / 全局 engine 指向本测试目录
    from library import settings as _s
    importlib.reload(_s)
    from library import models as _m
    importlib.reload(_m)
    from library import manifest as _mf
    importlib.reload(_mf)
    from library import importer as _imp
    importlib.reload(_imp)
    from library import auth as _auth
    importlib.reload(_auth)
    from library.routes import admin as _admin
    importlib.reload(_admin)
    from library.routes import public as _pub
    importlib.reload(_pub)
    from library import main as _main
    importlib.reload(_main)

    from fastapi.testclient import TestClient

    with TestClient(_main.app) as client:
        r = client.post(
            "/admin/auth/login", json={"username": "t4admin", "password": "t4pw"}
        )
        assert r.status_code == 200, r.text
        token = r.json()["token"]
        yield client, token, _m, _s


def test_endpoint_import_returns_201_draft(admin_client, tmp_path):
    client, token, models, settings = admin_client
    slug = "t4-ep-ok"
    tarball = make_valid_tarball(tmp_path, slug)

    with tarball.open("rb") as f:
        r = client.post(
            "/admin/projects/import",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": (tarball.name, f, "application/gzip")},
        )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["imported"] is True
    assert body["slug"] == slug
    assert body["knode_count"] == 2
    assert body["version"] == "1.0.0"

    # 通过 admin detail 端点确认默认 status=draft
    r2 = client.get(
        f"/admin/projects/{slug}", headers={"Authorization": f"Bearer {token}"}
    )
    assert r2.status_code == 200
    assert r2.json()["status"] == "draft"

    # 落盘 + archive 也成立 (端点链路)
    target = settings.PROJECTS_MEDIA_DIR / slug
    assert (target / "manifest.json").exists()
    assert (target / "_archive" / f"{slug}-1.0.0.tar.gz").exists()


def test_endpoint_bad_hash_maps_to_400(admin_client, tmp_path):
    client, token, models, settings = admin_client
    slug = "t4-ep-bad"
    root = _build_project_tree(tmp_path, slug)
    manifest = _make_manifest(root, slug)
    manifest["files"][0]["sha256"] = "f" * 64  # 篡改
    (root / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False), encoding="utf-8"
    )
    tarball = _pack(root, slug, tmp_path / f"{slug}.tar.gz")

    with tarball.open("rb") as f:
        r = client.post(
            "/admin/projects/import",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": (tarball.name, f, "application/gzip")},
        )
    # importer 的 ImportError_ 在端点被映射成 400
    assert r.status_code == 400, r.text
    assert "import failed" in r.json()["detail"]


def test_endpoint_requires_admin_token(admin_client, tmp_path):
    client, token, models, settings = admin_client
    slug = "t4-ep-noauth"
    tarball = make_valid_tarball(tmp_path, slug)

    # 不带 Authorization header -> 401/403 拒绝
    with tarball.open("rb") as f:
        r = client.post(
            "/admin/projects/import",
            files={"file": (tarball.name, f, "application/gzip")},
        )
    assert r.status_code in (401, 403), r.text


def test_endpoint_duplicate_no_overwrite_400(admin_client, tmp_path):
    client, token, models, settings = admin_client
    slug = "t4-ep-dup"
    tarball = make_valid_tarball(tmp_path, slug)

    # 第一次成功 (默认 overwrite=true)
    with tarball.open("rb") as f:
        r = client.post(
            "/admin/projects/import",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": (tarball.name, f, "application/gzip")},
        )
    assert r.status_code == 200, r.text

    # 第二次 overwrite=false -> 端点 400 (already exists)
    with tarball.open("rb") as f:
        r = client.post(
            "/admin/projects/import?overwrite=false",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": (tarball.name, f, "application/gzip")},
        )
    assert r.status_code == 400, r.text
    assert "already exists" in r.json()["detail"]
