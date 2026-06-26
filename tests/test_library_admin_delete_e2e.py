"""T7 — library admin 删除级联 e2e (lessons + media 目录) + 删后学生侧 404.

覆盖工单 5 个 scenario:
  1. DELETE /admin/projects/<slug> -> Project 记录消失 + 返回 deleted:true
  2. 删后该 slug 的所有 Lesson 消失 (无孤儿)
  3. 删后 PROJECTS_MEDIA_DIR/<slug>/ 整目录被 rmtree
  4. DELETE 不存在的 slug -> 404
  5. 删后 GET /v1/projects/<slug>/knodes/M01 -> 404

范式说明 (贴合 admin.py admin_delete_project 真实行为):
  - 删除端点真删 Lesson + Project + rmtree(PROJECTS_MEDIA_DIR/<slug>), 返回
    {"deleted": True, "slug": slug}; 不存在 slug -> 404 "project not found".
  - 用真起的隔离 library-app 子进程 (仿 T4 导入范式 test_library_client.py),
    并额外把 LIBRARY_HOME 暴露给测试进程, 从而可对
    <home>/media/projects/<slug>/ 整目录做文件系统断言 (同机共享 fs)。
  - 删除是破坏性操作, 故每个测试自带一个新 import+publish 的独立 slug,
    互不串扰; 服务进程 module-scope 只起一次。
"""

from __future__ import annotations

import hashlib
import json
import os
import socket
import subprocess
import tarfile
import tempfile
import time
import uuid
from pathlib import Path

import httpx
import pytest


# ---------------------------------------------------------------------------
# 工具
# ---------------------------------------------------------------------------

def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _make_tarball(tmp: Path, slug: str) -> Path:
    """构造一个含 M01 knode + media 文件的最小 tarball, 返回 tarball 路径。

    刻意放一个 knodes/M01-w1-intro/media/diagram.png 媒体文件, 让 rmtree
    断言有真实落盘内容可验。
    """
    root = tmp / slug
    knode_dir = root / "knodes" / "M01-w1-intro"
    media_dir = knode_dir / "media"
    media_dir.mkdir(parents=True)
    (root / "tree").mkdir()
    (root / "blueprint").mkdir()

    (knode_dir / "lesson.md").write_text("# M01 Intro\n\nT7 delete test.\n", encoding="utf-8")
    (knode_dir / "sections.json").write_text('{"sections":[]}', encoding="utf-8")
    (knode_dir / "audio_scripts.json").write_text('{"scripts":[]}', encoding="utf-8")
    (media_dir / "diagram.png").write_bytes(b"\x89PNG\r\n\x1a\nfake-media-bytes")
    (root / "blueprint" / "README.zh.md").write_text("# bp\n", encoding="utf-8")
    (root / "tree" / "knowledge_tree.json").write_text(
        json.dumps({
            "schema_version": "5.0",
            "title": "T7 del",
            "stages": [{"stage_id": "S1", "title": "Phase 1"}],
            "modules": [{"module_id": "M01", "stage_id": "S1", "title": "Intro"}],
            "edges": [],
        }),
        encoding="utf-8",
    )

    def sha256(p: Path) -> str:
        return hashlib.sha256(p.read_bytes()).hexdigest()

    files = [
        {
            "path": p.relative_to(root).as_posix(),
            "sha256": sha256(p),
            "size": p.stat().st_size,
        }
        for p in sorted(root.rglob("*"))
        if p.is_file() and p.name != "manifest.json"
    ]
    manifest = {
        "schema_version": "1.0",
        "slug": slug,
        "title": "T7 Delete Project",
        "title_zh": "T7 删除测试项目",
        "description": "for delete e2e",
        "version": "1.0.0",
        "frontmatter": {"age_band": "10-12", "domain": "Test", "duration_weeks": 1},
        "knode_count": 1,
        "stage_count": 1,
        "languages": ["zh-CN"],
        "total_size_bytes": sum(f["size"] for f in files),
        "files": files,
        "knodes": [{
            "module_id": "M01",
            "title": "Intro",
            "week": 1,
            "stage": "S1",
            "duration_minutes": 60,
            "knode_dir": "knodes/M01-w1-intro",
        }],
        "tags": ["test"],
    }
    (root / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False), encoding="utf-8"
    )

    tarball = tmp / f"{slug}.tar.gz"
    with tarfile.open(tarball, "w:gz") as tar:
        tar.add(root, arcname=slug)
    return tarball


# ---------------------------------------------------------------------------
# fixture: 真起 library-app 子进程 (隔离 LIBRARY_HOME, 暴露 home 供 fs 断言)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def library(tmp_path_factory):
    """起一个隔离的 library-app, 暴露 base / home / admin_token / license。

    home 是 LIBRARY_HOME, 媒体落 home/media/projects/<slug>/。
    """
    home = tmp_path_factory.mktemp("lib-t7-home")
    port = _free_port()
    base = f"http://127.0.0.1:{port}"
    license_token = "t7-license"

    env = os.environ.copy()
    env.update({
        "LIBRARY_HOME": str(home),
        "LIBRARY_PORT": str(port),
        "LIBRARY_HOST": "127.0.0.1",
        "LIBRARY_JWT_SECRET": "t7-jwt",
        "LIBRARY_LICENSE_TOKEN": license_token,
        "LIBRARY_BOOTSTRAP_ADMIN": "admin:adminpw",
    })
    proc = subprocess.Popen(
        ["python", "-m", "uvicorn", "library.main:app",
         "--host", "127.0.0.1", "--port", str(port)],
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    try:
        # 等就绪
        deadline = time.time() + 20
        ready = False
        with httpx.Client(timeout=2.0, trust_env=False) as cli:
            while time.time() < deadline:
                try:
                    if cli.get(f"{base}/health").status_code == 200:
                        ready = True
                        break
                except Exception:
                    pass
                time.sleep(0.3)
        if not ready:
            raise RuntimeError("library-app 20s 内未就绪")

        # admin 登录拿 token
        with httpx.Client(timeout=10.0, trust_env=False) as cli:
            r = cli.post(f"{base}/admin/auth/login",
                         json={"username": "admin", "password": "adminpw"})
            r.raise_for_status()
            admin_token = r.json()["token"]

        yield {
            "base": base,
            "home": home,
            "admin_token": admin_token,
            "license": license_token,
        }
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()


def _import_and_publish(library: dict, slug: str) -> None:
    """import 一个 tarball 并 publish (每个测试拿自己独立的 slug)。"""
    base = library["base"]
    admin_token = library["admin_token"]
    hdr = {"Authorization": f"Bearer {admin_token}"}
    with httpx.Client(timeout=20.0, trust_env=False) as cli:
        with tempfile.TemporaryDirectory() as tmp:
            tarball = _make_tarball(Path(tmp), slug)
            with tarball.open("rb") as f:
                r = cli.post(
                    f"{base}/admin/projects/import",
                    headers=hdr,
                    files={"file": (tarball.name, f, "application/gzip")},
                )
            r.raise_for_status()
        r = cli.post(f"{base}/admin/projects/{slug}/publish", headers=hdr)
        r.raise_for_status()


def _new_slug() -> str:
    return f"t7-del-{uuid.uuid4().hex[:8]}"


@pytest.fixture
def admin_client(library):
    """httpx Client 指向 library-app, 带 admin Bearer, trust_env=False 绕代理。"""
    c = httpx.Client(
        base_url=library["base"],
        headers={"Authorization": f"Bearer {library['admin_token']}"},
        timeout=20.0,
        trust_env=False,
    )
    yield c
    c.close()


@pytest.fixture
def license_client(library):
    """httpx Client 指向 /v1, 带 license Bearer (学生侧反代用的同款 token)。"""
    c = httpx.Client(
        base_url=library["base"],
        headers={"Authorization": f"Bearer {library['license']}"},
        timeout=20.0,
        trust_env=False,
    )
    yield c
    c.close()


# ---------------------------------------------------------------------------
# Scenario 1: DELETE -> Project 记录消失 + 返回 deleted:true
# ---------------------------------------------------------------------------

def test_delete_returns_deleted_true_and_project_gone(library, admin_client):
    slug = _new_slug()
    _import_and_publish(library, slug)

    # 删前 admin 详情 200
    assert admin_client.get(f"/admin/projects/{slug}").status_code == 200

    r = admin_client.request("DELETE", f"/admin/projects/{slug}")
    assert r.status_code == 200
    body = r.json()
    assert body["deleted"] is True
    assert body["slug"] == slug

    # 删后 admin 详情 404 (Project 记录消失)
    r2 = admin_client.get(f"/admin/projects/{slug}")
    assert r2.status_code == 404

    # 列表中也不再出现该 slug
    r3 = admin_client.get("/admin/projects")
    assert r3.status_code == 200
    assert slug not in {p["slug"] for p in r3.json()}


# ---------------------------------------------------------------------------
# Scenario 2: 删后该 slug 的所有 Lesson 消失 (无孤儿)
# ---------------------------------------------------------------------------

def test_delete_cascades_lessons_no_orphans(library, admin_client):
    slug = _new_slug()
    _import_and_publish(library, slug)

    # 删前: M01 lesson 存在 (admin 文件预览能取到 lesson.md)
    pre = admin_client.get(f"/admin/projects/{slug}/files/knodes/M01-w1-intro/lesson.md")
    assert pre.status_code == 200

    # 直接读子进程 library 的 SQLite, 断言 Lesson 行数: 删前 == 1
    db_path = library["home"] / "db.sqlite"
    assert _count_lessons(db_path, slug) == 1

    r = admin_client.request("DELETE", f"/admin/projects/{slug}")
    assert r.status_code == 200

    # 删后: 该 slug 对应 Lesson 全部消失 (无孤儿)
    assert _count_lessons(db_path, slug) == 0


def _count_lessons(db_path: Path, slug: str) -> int:
    """直连子进程 library 的 SQLite, 数某 slug 的 Lesson 行数 (验级联无孤儿)。"""
    import sqlite3

    con = sqlite3.connect(str(db_path))
    try:
        cur = con.execute(
            "SELECT COUNT(*) FROM lessons WHERE project_slug = ?", (slug,)
        )
        return int(cur.fetchone()[0])
    finally:
        con.close()


# ---------------------------------------------------------------------------
# Scenario 3: 删后 PROJECTS_MEDIA_DIR/<slug>/ 整目录被 rmtree
# ---------------------------------------------------------------------------

def test_delete_rmtree_media_dir(library, admin_client):
    slug = _new_slug()
    _import_and_publish(library, slug)

    media_dir = library["home"] / "media" / "projects" / slug
    # 删前目录存在且含落盘媒体
    assert media_dir.is_dir()
    assert (media_dir / "knodes" / "M01-w1-intro" / "media" / "diagram.png").is_file()

    r = admin_client.request("DELETE", f"/admin/projects/{slug}")
    assert r.status_code == 200

    # 删后整目录被 rmtree
    assert not media_dir.exists()


# ---------------------------------------------------------------------------
# Scenario 4: DELETE 不存在的 slug -> 404
# ---------------------------------------------------------------------------

def test_delete_nonexistent_slug_404(admin_client):
    r = admin_client.request("DELETE", "/admin/projects/does-not-exist-xyz")
    assert r.status_code == 404
    assert "not found" in r.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Scenario 5: 删后 GET /v1/projects/<slug>/knodes/M01 -> 404 (学生侧)
# ---------------------------------------------------------------------------

def test_delete_then_student_knode_404(library, admin_client, license_client):
    slug = _new_slug()
    _import_and_publish(library, slug)

    # 删前: 学生侧 (license token) 能正常取 M01 knode
    pre = license_client.get(f"/v1/projects/{slug}/knodes/M01")
    assert pre.status_code == 200
    assert pre.json()["knode_id"] == "M01"

    r = admin_client.request("DELETE", f"/admin/projects/{slug}")
    assert r.status_code == 200

    # 删后: 学生侧取 M01 knode -> 404 (project not found)
    post = license_client.get(f"/v1/projects/{slug}/knodes/M01")
    assert post.status_code == 404
