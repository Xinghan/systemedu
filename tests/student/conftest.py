"""spec 027 P1.7 — student-app pytest fixtures.

`services` fixture 起 library-app + student-app 两个进程 + 注入测试项目, 跨用例复用。
"""

from __future__ import annotations

import hashlib
import json
import os
import socket
import subprocess
import sys
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


def _make_tarball(tmp: Path, slug: str = "p027-test") -> tuple[Path, str]:
    root = tmp / slug
    (root / "tree").mkdir(parents=True)
    (root / "blueprint").mkdir()
    knode_dir = root / "knodes" / "M01-w1-intro"
    knode_dir.mkdir(parents=True)
    knode_dir2 = root / "knodes" / "M02-w1-deep"
    knode_dir2.mkdir(parents=True)

    (knode_dir / "lesson.md").write_text(
        "# M01 Intro\n\nfor 027 test.\n", encoding="utf-8"
    )
    (knode_dir / "sections.json").write_text('{"sections":[]}', encoding="utf-8")
    (knode_dir / "audio_scripts.json").write_text('{"scripts":[]}', encoding="utf-8")
    (knode_dir2 / "lesson.md").write_text("# M02 Deep\n", encoding="utf-8")
    (knode_dir2 / "sections.json").write_text('{"sections":[]}', encoding="utf-8")
    (knode_dir2 / "audio_scripts.json").write_text('{"scripts":[]}', encoding="utf-8")
    (root / "blueprint" / "README.zh.md").write_text(
        "# 027 测试项目\n", encoding="utf-8"
    )
    (root / "tree" / "knowledge_tree.json").write_text(
        json.dumps({
            "schema_version": "5.0",
            "title": "027 test",
            "stages": [{"stage_id": "S1", "title": "Phase 1"}],
            "modules": [
                {"module_id": "M01", "stage_id": "S1", "title": "Intro"},
                {"module_id": "M02", "stage_id": "S1", "title": "Deep"},
            ],
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
        "title": "027 test project",
        "title_zh": "027 测试项目",
        "description": "spec 027 e2e",
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
    }
    (root / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False), encoding="utf-8"
    )
    tarball = tmp / f"{slug}.tar.gz"
    with tarfile.open(tarball, "w:gz") as tar:
        tar.add(root, arcname=slug)
    return tarball, slug


def _wait_http(base: str, deadline_seconds: float = 25.0) -> None:
    deadline = time.time() + deadline_seconds
    with httpx.Client(timeout=2.0, trust_env=False) as c:
        while time.time() < deadline:
            for path in ("/api/health", "/health", "/api/status"):
                try:
                    r = c.get(f"{base}{path}")
                    if r.status_code == 200:
                        return
                except Exception:
                    pass
            time.sleep(0.3)
    raise RuntimeError(f"service at {base} not ready in {deadline_seconds}s")


@pytest.fixture(scope="module")
def services(tmp_path_factory):
    """library-app:port_lib + student-app:port_stu, 注入 1 个 published 项目."""
    home_lib = tmp_path_factory.mktemp("lib-027")
    student_home = tmp_path_factory.mktemp("student-027")
    student_db = student_home / "student.db"
    port_lib = _free_port()
    port_stu = _free_port()
    base_lib = f"http://127.0.0.1:{port_lib}"
    base_stu = f"http://127.0.0.1:{port_stu}"
    license_tok = "p027-license"
    jwt_secret = "p027-jwt-secret"

    env_lib = os.environ.copy()
    env_lib.update({
        "LIBRARY_HOME": str(home_lib),
        "LIBRARY_PORT": str(port_lib),
        "LIBRARY_JWT_SECRET": jwt_secret + "-lib",
        "LIBRARY_LICENSE_TOKEN": license_tok,
        "LIBRARY_BOOTSTRAP_ADMIN": "admin:adminpw",
    })
    proc_lib = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "library.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(port_lib),
        ],
        env=env_lib,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        _wait_http(base_lib)

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

        env_stu = os.environ.copy()
        env_stu.update({
            "STUDENT_DB_PATH": str(student_db),
            "STUDENT_JWT_SECRET": jwt_secret,
            "STUDENT_PORT": str(port_stu),
            "STUDENT_BIND_HOST": "127.0.0.1",
            "LIBRARY_BASE_URL": base_lib,
            "LIBRARY_LICENSE_TOKEN": license_tok,
        })
        proc_stu = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "systemedu.student.server:create_app",
                "--factory",
                "--host",
                "127.0.0.1",
                "--port",
                str(port_stu),
            ],
            env=env_stu,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        try:
            _wait_http(base_stu, deadline_seconds=30.0)
            yield {
                "student": base_stu,
                "library": base_lib,
                "slug": slug,
                "license_token": license_tok,
                "db_path": str(student_db),
            }
        finally:
            proc_stu.terminate()
            try:
                proc_stu.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc_stu.kill()
    finally:
        proc_lib.terminate()
        try:
            proc_lib.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc_lib.kill()


@pytest.fixture
def client(services):
    """Pre-made httpx Client for student-app, trust_env=False to bypass http proxy."""
    return httpx.Client(base_url=services["student"], timeout=15.0, trust_env=False)
