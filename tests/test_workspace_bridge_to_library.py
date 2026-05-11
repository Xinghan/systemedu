"""端到端: save_knode_to_workspace → systemedu-content publish → library API.

验证 SKILL.md workspace 模式产出的数据能完整流到 library 服务。
"""

from __future__ import annotations

import json
import os
import socket
import subprocess
import time
from pathlib import Path

import httpx
import pytest

from content_pipeline import workspace as ws_mod
from content_pipeline import package as pkg_mod
from content_pipeline import publish as publish_mod
from course_factory import (
    generate_knowledge_tree_from_blueprint,
    save_knode_to_workspace,
)
from systemedu.core.library_client import LibraryClient


SAMPLE = """---
title: 测试项目 E2E
slug: e2e-bridge-proj
duration_weeks: 2
---

## Syllabus

**Phase 1 — A**
- W1:成果 — 干活.
- W2:成果 — 验收.
"""


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture(scope="module")
def library(tmp_path_factory):
    home = tmp_path_factory.mktemp("lib-bridge")
    port = _free_port()
    env = os.environ.copy()
    env.update({
        "LIBRARY_HOME": str(home),
        "LIBRARY_PORT": str(port),
        "LIBRARY_JWT_SECRET": "bridge-jwt",
        "LIBRARY_LICENSE_TOKEN": "bridge-license",
        "LIBRARY_BOOTSTRAP_ADMIN": "admin:adminpw",
    })
    proc = subprocess.Popen(
        ["python", "-m", "uvicorn", "library.main:app",
         "--host", "127.0.0.1", "--port", str(port)],
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    base = f"http://127.0.0.1:{port}"
    deadline = time.time() + 15
    with httpx.Client(timeout=2.0, trust_env=False) as c:
        while time.time() < deadline:
            try:
                if c.get(f"{base}/health").status_code == 200:
                    break
            except Exception:
                pass
            time.sleep(0.3)
        else:
            proc.kill()
            raise RuntimeError("library failed to start")

        # login admin
        r = c.post(
            f"{base}/admin/auth/login",
            json={"username": "admin", "password": "adminpw"},
        )
        r.raise_for_status()
        token = r.json()["token"]

    yield {"base": base, "license": "bridge-license", "admin_token": token}

    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()


def test_workspace_to_library_full_flow(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, library
):
    # 1. 隔离 workspace, 塞蓝图
    monkeypatch.setenv("SYSTEMEDU_CONTENT_WORKSPACE", str(tmp_path / "ws"))
    ws_mod.ensure_workspace()
    bp = ws_mod.project_blueprint_dir("e2e-bridge-proj")
    bp.mkdir(parents=True)
    (bp / "README.zh.md").write_text(SAMPLE, encoding="utf-8")

    # 2. 蓝图 → 知识树 (workspace_bridge)
    tree = generate_knowledge_tree_from_blueprint("e2e-bridge-proj")
    assert len(tree["modules"]) == 2

    # 3. 给 M01 写完整 course_content
    save_knode_to_workspace(
        "e2e-bridge-proj",
        "M01",
        course_content={
            "plan_markdown": "# W1: 准备\n\n本周做准备.\n",
            "ideas": [
                {
                    "idea_id": "anim-1",
                    "mode": "animation",
                    "topic": "实验流程动画",
                    "animation_html": "<!DOCTYPE html><html><body>anim</body></html>",
                }
            ],
            "theories": [
                {"id": "T1", "title": "什么是实验", "body_markdown": "...", "tags": []}
            ],
            "story_paragraphs": [],
            "external_resources": {},
        },
        assignment="# 作业\n\n写笔记.",
        audio_scripts={"scripts": [{"section_id": "intro", "text": "hi", "lang": "zh-CN"}]},
    )

    # 4. 给 M02 写最简 course_content
    save_knode_to_workspace(
        "e2e-bridge-proj",
        "M02",
        course_content={"plan_markdown": "# W2: 验收\n", "ideas": [], "theories": []},
    )

    # 5. 打包 (regenerate_manifest 自动跑)
    pkg = pkg_mod.package_project("e2e-bridge-proj", version="0.1.0")
    assert pkg.tarball_path.is_file()
    assert pkg.size_bytes > 0

    # 6. publish 到 library
    result = publish_mod.publish_tarball(
        pkg.tarball_path,
        target=library["base"],
        admin_token=library["admin_token"],
    )
    assert result.imported is True
    assert result.slug == "e2e-bridge-proj"

    # 7. admin publish 后, 用 SDK 读 (库公开 API)
    with httpx.Client(timeout=10.0, trust_env=False) as c:
        c.post(
            f"{library['base']}/admin/projects/e2e-bridge-proj/publish",
            headers={"Authorization": f"Bearer {library['admin_token']}"},
        ).raise_for_status()

    with LibraryClient(library["base"], library["license"]) as cli:
        projects = cli.list_projects()
        assert any(p.slug == "e2e-bridge-proj" for p in projects)

        # M01 的 plan_markdown / theories / audio_scripts / assignment
        m01 = cli.get_knode("e2e-bridge-proj", "M01")
        assert m01.knode_id == "M01"
        assert m01.plan_markdown.startswith("# W1: 准备")
        assert m01.assignment_md.startswith("# 作业")
        assert isinstance(m01.theories, list) and len(m01.theories) == 1
        assert m01.theories[0]["title"] == "什么是实验"
        assert m01.audio_scripts["scripts"][0]["text"] == "hi"
        # sections.json 里的 idea 应该有 animation_path 指向 media/
        sections = m01.rendered_sections
        assert isinstance(sections, dict)
        ideas = sections["ideas"]
        assert len(ideas) == 1
        anim_path = ideas[0]["animation_path"]
        assert anim_path.startswith("media/animation-")

        # 取那个 animation html 文件
        data = cli.fetch_file("e2e-bridge-proj", f"{m01.knode_dir}/{anim_path}")
        assert b"anim" in data
