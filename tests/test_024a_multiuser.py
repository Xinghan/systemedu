"""spec 024-A 端到端: 注册 → 登录 → library 浏览 → 购买 → 学习 knode.

起独立 library + cloud-app 两个进程, 通过 HTTP 调.
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import socket
import subprocess
import tarfile
import tempfile
import time
from pathlib import Path

import httpx
import pytest


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _make_tarball(tmp: Path) -> tuple[Path, str]:
    slug = "p024a-test"
    root = tmp / slug
    (root / "tree").mkdir(parents=True)
    (root / "blueprint").mkdir()
    knode_dir = root / "knodes" / "M01-w1-intro"
    knode_dir.mkdir(parents=True)

    (knode_dir / "lesson.md").write_text("# M01 Intro\n\nfor 024-A test.\n", encoding="utf-8")
    (knode_dir / "sections.json").write_text('{"sections":[]}', encoding="utf-8")
    (knode_dir / "audio_scripts.json").write_text('{"scripts":[]}', encoding="utf-8")
    (root / "blueprint" / "README.zh.md").write_text("# 024-A 测试项目\n", encoding="utf-8")
    (root / "tree" / "knowledge_tree.json").write_text(json.dumps({
        "schema_version": "5.0",
        "title": "024-A test",
        "stages": [{"stage_id": "S1", "title": "Phase 1"}],
        "modules": [{"module_id": "M01", "stage_id": "S1", "title": "Intro"}],
        "edges": [],
    }), encoding="utf-8")

    def sha256(p: Path) -> str:
        return hashlib.sha256(p.read_bytes()).hexdigest()

    files = [
        {"path": p.relative_to(root).as_posix(), "sha256": sha256(p), "size": p.stat().st_size}
        for p in sorted(root.rglob("*"))
        if p.is_file() and p.name != "manifest.json"
    ]
    manifest = {
        "schema_version": "1.0",
        "slug": slug,
        "title": "024-A 测试项目",
        "title_zh": "024-A 测试项目",
        "description": "spec 024-A e2e",
        "version": "1.0.0",
        "frontmatter": {"age_band": "10-12", "domain": "Test", "duration_weeks": 1},
        "knode_count": 1,
        "stage_count": 1,
        "languages": ["zh-CN"],
        "total_size_bytes": sum(f["size"] for f in files),
        "files": files,
        "knodes": [{
            "module_id": "M01", "title": "Intro", "week": 1, "stage": "S1",
            "duration_minutes": 60, "knode_dir": "knodes/M01-w1-intro",
        }],
        "tags": ["test"],
    }
    (root / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")
    tarball = tmp / f"{slug}.tar.gz"
    with tarfile.open(tarball, "w:gz") as tar:
        tar.add(root, arcname=slug)
    return tarball, slug


def _wait_http(base: str, deadline_seconds: float = 20.0) -> None:
    deadline = time.time() + deadline_seconds
    with httpx.Client(timeout=2.0, trust_env=False) as c:
        while time.time() < deadline:
            try:
                r = c.get(f"{base}/health")
                if r.status_code == 200:
                    return
            except Exception:
                pass
            try:
                r = c.get(f"{base}/api/status")
                if r.status_code == 200:
                    return
            except Exception:
                pass
            time.sleep(0.3)
    raise RuntimeError(f"service at {base} not ready in {deadline_seconds}s")


@pytest.fixture(scope="module")
def services(tmp_path_factory):
    """启动 library + cloud-app, 注入 1 个 published 项目."""
    home_lib = tmp_path_factory.mktemp("lib-024a")
    home_cloud = tmp_path_factory.mktemp("cloud-024a")
    port_lib = _free_port()
    port_cloud = _free_port()
    base_lib = f"http://127.0.0.1:{port_lib}"
    base_cloud = f"http://127.0.0.1:{port_cloud}"
    license_tok = "p024a-license"
    jwt_secret = "p024a-jwt-secret"

    env_lib = os.environ.copy()
    env_lib.update({
        "LIBRARY_HOME": str(home_lib),
        "LIBRARY_PORT": str(port_lib),
        "LIBRARY_JWT_SECRET": jwt_secret + "-lib",
        "LIBRARY_LICENSE_TOKEN": license_tok,
        "LIBRARY_BOOTSTRAP_ADMIN": "admin:adminpw",
    })
    proc_lib = subprocess.Popen(
        ["python", "-m", "uvicorn", "library.main:app",
         "--host", "127.0.0.1", "--port", str(port_lib)],
        env=env_lib,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        _wait_http(base_lib)

        # 注入测试项目: admin login + import + publish
        with httpx.Client(timeout=20.0, trust_env=False) as c:
            r = c.post(
                f"{base_lib}/admin/auth/login",
                json={"username": "admin", "password": "adminpw"},
            )
            r.raise_for_status()
            admin_token = r.json()["token"]

            with tempfile.TemporaryDirectory() as tmp:
                tarball, slug = _make_tarball(Path(tmp))
                with tarball.open("rb") as f:
                    r = c.post(
                        f"{base_lib}/admin/projects/import",
                        headers={"Authorization": f"Bearer {admin_token}"},
                        files={"file": (tarball.name, f, "application/gzip")},
                    )
                r.raise_for_status()
            r = c.post(
                f"{base_lib}/admin/projects/{slug}/publish",
                headers={"Authorization": f"Bearer {admin_token}"},
            )
            r.raise_for_status()

        # 启动 cloud-app
        env_cloud = os.environ.copy()
        env_cloud.update({
            "SYSTEMEDU_HOME": str(home_cloud),
            "CLOUD_JWT_SECRET": jwt_secret,
            "LIBRARY_URL": base_lib,
            "LIBRARY_LICENSE_TOKEN": license_tok,
        })
        proc_cloud = subprocess.Popen(
            ["python", "-m", "uvicorn",
             "systemedu.cloud.gateway.server:create_app",
             "--factory",
             "--host", "127.0.0.1", "--port", str(port_cloud)],
            env=env_cloud,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        try:
            _wait_http(base_cloud, deadline_seconds=30.0)
            yield {
                "cloud": base_cloud,
                "library": base_lib,
                "slug": slug,
                "license_token": license_tok,
            }
        finally:
            proc_cloud.terminate()
            try:
                proc_cloud.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc_cloud.kill()
    finally:
        proc_lib.terminate()
        try:
            proc_lib.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc_lib.kill()


def _client(base: str) -> httpx.Client:
    return httpx.Client(base_url=base, timeout=15.0, trust_env=False)


# ---------------------------------------------------------------------------
# 测试
# ---------------------------------------------------------------------------

def test_register_and_login(services):
    base = services["cloud"]
    with _client(base) as c:
        # 注册
        r = c.post("/api/auth/register", json={"username": "alice", "password": "passw0rd"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["username"] == "alice"
        assert "token" in d and len(d["token"]) > 50

        # 重复注册 → 409
        r2 = c.post("/api/auth/register", json={"username": "alice", "password": "passw0rd"})
        assert r2.status_code == 409

        # 密码太短 → 400
        r3 = c.post("/api/auth/register", json={"username": "bob", "password": "12"})
        assert r3.status_code == 400

        # 用户名非法 → 400
        r4 = c.post("/api/auth/register", json={"username": "x y", "password": "passw0rd"})
        assert r4.status_code == 400


def test_login_wrong_password(services):
    base = services["cloud"]
    with _client(base) as c:
        c.post("/api/auth/register", json={"username": "carol", "password": "carolpw"})
        r = c.post("/api/auth/login", json={"username": "carol", "password": "wrong"})
        assert r.status_code == 401


def test_login_and_me(services):
    base = services["cloud"]
    with _client(base) as c:
        c.post("/api/auth/register", json={"username": "dan", "password": "danpw1"})
        r = c.post("/api/auth/login", json={"username": "dan", "password": "danpw1"})
        assert r.status_code == 200
        token = r.json()["token"]

        r2 = c.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r2.status_code == 200
        assert r2.json()["username"] == "dan"

        # 无 token → 401
        r3 = c.get("/api/auth/me")
        assert r3.status_code == 401

        # 假 token → 401
        r4 = c.get("/api/auth/me", headers={"Authorization": "Bearer garbage"})
        assert r4.status_code == 401


def test_library_public_endpoints_no_auth(services):
    """游客可看列表+概述+树+蓝图."""
    base = services["cloud"]
    slug = services["slug"]
    with _client(base) as c:
        r = c.get("/api/library/projects")
        assert r.status_code == 200
        projects = r.json()
        assert any(p["slug"] == slug for p in projects)

        r2 = c.get(f"/api/library/projects/{slug}")
        assert r2.status_code == 200
        assert r2.json()["slug"] == slug

        r3 = c.get(f"/api/library/projects/{slug}/tree")
        assert r3.status_code == 200
        tree = r3.json()
        assert tree["schema_version"] == "5.0"
        assert len(tree["modules"]) == 1

        r4 = c.get(f"/api/library/projects/{slug}/blueprint")
        assert r4.status_code == 200
        assert "024-A 测试项目" in r4.json()["content"]


def test_knode_requires_login(services):
    base = services["cloud"]
    slug = services["slug"]
    with _client(base) as c:
        r = c.get(f"/api/library/projects/{slug}/knodes/M01")
        assert r.status_code == 401


def test_knode_requires_purchase(services):
    base = services["cloud"]
    slug = services["slug"]
    with _client(base) as c:
        # 注册新用户但不购买
        r = c.post("/api/auth/register", json={"username": "eve", "password": "evepw1"})
        token = r.json()["token"]
        r2 = c.get(
            f"/api/library/projects/{slug}/knodes/M01",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r2.status_code == 403
        assert r2.json()["error"] == "purchase_required"


def test_buy_and_access_knode(services):
    base = services["cloud"]
    slug = services["slug"]
    with _client(base) as c:
        # 注册
        r = c.post("/api/auth/register", json={"username": "frank", "password": "frankpw1"})
        token = r.json()["token"]
        H = {"Authorization": f"Bearer {token}"}

        # 购买
        r2 = c.post(f"/api/purchases/{slug}", headers=H)
        assert r2.status_code == 200
        assert r2.json()["purchased"] is True
        assert r2.json()["already_owned"] is False

        # 再买一次 → already_owned
        r2b = c.post(f"/api/purchases/{slug}", headers=H)
        assert r2b.status_code == 200
        assert r2b.json()["already_owned"] is True

        # 列出购买
        r3 = c.get("/api/purchases", headers=H)
        assert r3.status_code == 200
        assert any(p["project_slug"] == slug for p in r3.json())

        # 访问 knode 详情
        r4 = c.get(f"/api/library/projects/{slug}/knodes/M01", headers=H)
        assert r4.status_code == 200, r4.text
        assert r4.json()["plan_markdown"].startswith("# M01 Intro")

        # 访问 knode 文件
        r5 = c.get(
            f"/api/library/projects/{slug}/files/knodes/M01-w1-intro/lesson.md",
            headers=H,
        )
        assert r5.status_code == 200
        assert "M01 Intro" in r5.text


def test_buy_nonexistent_project(services):
    base = services["cloud"]
    with _client(base) as c:
        r = c.post("/api/auth/register", json={"username": "gary", "password": "garypw1"})
        token = r.json()["token"]
        r2 = c.post(
            "/api/purchases/does-not-exist",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r2.status_code == 404
