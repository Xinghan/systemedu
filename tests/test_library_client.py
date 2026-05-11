"""LibraryClient (sync + async) e2e + 单元测试.

策略:
- 起一个真实 library-app uvicorn (port 18822, 隔离的 tmp data dir)
- 用 content-pipeline 的 export + publish 路径塞一个项目进去并 publish
- 然后用 LibraryClient 调 /v1/* 全套 API, 验证返回结构正确
- 单元层加 _build_path / _is_local / from_dict / 错误码映射
"""

from __future__ import annotations

import json
import os
import socket
import subprocess
import tarfile
import tempfile
import time
from pathlib import Path

import httpx
import pytest

from systemedu.core.library_client import (
    AsyncLibraryClient,
    KnodeContent,
    LibraryClient,
    LibraryError,
    LibraryNotFound,
    LibraryUnauthorized,
    ProjectMeta,
)
from systemedu.core.library_client.client import _build_path, _is_local


# ---------------------------------------------------------------------------
# 单元测试 (不需要起服务)
# ---------------------------------------------------------------------------

class TestUnit:
    def test_build_path_quotes_segments(self):
        url = _build_path("http://x", "v1", "projects", "a/b", "files", "knodes/M01/a.png")
        # slug 中的 / 被保留为路径分隔符 (safe='/')
        assert url.endswith("/v1/projects/a/b/files/knodes/M01/a.png")

    def test_is_local(self):
        assert _is_local("http://127.0.0.1:18821") is True
        assert _is_local("http://localhost:3000") is True
        assert _is_local("https://library.example.com") is False

    def test_project_meta_from_dict(self):
        m = ProjectMeta.from_dict({
            "slug": "t",
            "title": "Test",
            "knode_count": 5,
            "tags": ["a", "b"],
        })
        assert m.slug == "t"
        assert m.knode_count == 5
        assert m.tags == ["a", "b"]
        assert m.duration_weeks is None
        assert m.languages == []

    def test_knode_content_from_dict(self):
        k = KnodeContent.from_dict({
            "project_slug": "p",
            "knode_id": "M01",
            "plan_markdown": "# hi",
            "files": [{"path": "lesson.md", "sha256": "x", "size": 4}],
        })
        assert k.project_slug == "p"
        assert k.knode_id == "M01"
        assert len(k.files) == 1

    def test_constructor_validates(self):
        with pytest.raises(ValueError):
            LibraryClient("", "token")
        with pytest.raises(ValueError):
            LibraryClient("http://x", "")

    def test_get_file_url(self):
        c = LibraryClient("http://lib.example.com/", "tok")
        try:
            url = c.get_file_url("ai-ant", "knodes/M01/media/a.png")
            assert url == "http://lib.example.com/v1/projects/ai-ant/files/knodes/M01/media/a.png"
        finally:
            c.close()


# ---------------------------------------------------------------------------
# e2e: 起 library + 注入项目 + 用 SDK 调
# ---------------------------------------------------------------------------

def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _make_tarball(tmp: Path) -> tuple[Path, str]:
    """构造一个最小 1-knode 的 tarball, 返回 (path, slug)."""
    slug = "sdk-test-proj"
    root = tmp / slug
    (root / "tree").mkdir(parents=True)
    (root / "blueprint").mkdir()
    knode_dir = root / "knodes" / "M01-w1-intro"
    knode_dir.mkdir(parents=True)

    lesson = "# M01 Intro\n\nSDK test lesson.\n"
    sections = {"sections": [{"id": "s1", "kind": "text", "body": "hello"}]}
    audio = {"scripts": [{"section_id": "s1", "text": "hi", "lang": "zh-CN"}]}
    assignment = "# Assignment\n\nDo something."
    theories = []
    blueprint_zh = "# blueprint zh\n"
    blueprint_en = "# blueprint en\n"
    tree = {
        "schema_version": "5.0",
        "title": "SDK Test",
        "stages": [{"stage_id": "S1", "title": "Phase 1"}],
        "modules": [{"module_id": "M01", "stage_id": "S1", "title": "Intro"}],
        "edges": [],
    }

    (knode_dir / "lesson.md").write_text(lesson, encoding="utf-8")
    (knode_dir / "sections.json").write_text(json.dumps(sections), encoding="utf-8")
    (knode_dir / "audio_scripts.json").write_text(json.dumps(audio), encoding="utf-8")
    (knode_dir / "assignment.md").write_text(assignment, encoding="utf-8")
    (knode_dir / "theories.json").write_text(json.dumps(theories), encoding="utf-8")
    (root / "blueprint" / "README.zh.md").write_text(blueprint_zh, encoding="utf-8")
    (root / "blueprint" / "README.md").write_text(blueprint_en, encoding="utf-8")
    (root / "tree" / "knowledge_tree.json").write_text(json.dumps(tree), encoding="utf-8")

    # manifest with sha256
    import hashlib

    def sha256(p: Path) -> str:
        return hashlib.sha256(p.read_bytes()).hexdigest()

    files = []
    for p in sorted(root.rglob("*")):
        if not p.is_file():
            continue
        if p.name == "manifest.json":
            continue
        files.append({
            "path": p.relative_to(root).as_posix(),
            "sha256": sha256(p),
            "size": p.stat().st_size,
        })
    manifest = {
        "schema_version": "1.0",
        "slug": slug,
        "title": "SDK Test Project",
        "title_zh": "SDK 测试项目",
        "description": "for sdk e2e",
        "version": "1.0.0",
        "frontmatter": {
            "age_band": "10-12",
            "domain": "Test",
            "duration_weeks": 1,
        },
        "knode_count": 1,
        "stage_count": 1,
        "languages": ["zh-CN", "en"],
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
    return tarball, slug


@pytest.fixture(scope="module")
def library_service(tmp_path_factory):
    """起一个隔离的 library uvicorn, 给所有 e2e 共享."""
    home = tmp_path_factory.mktemp("library-home")
    port = _free_port()
    base = f"http://127.0.0.1:{port}"
    license_token = "sdk-test-license"

    env = os.environ.copy()
    env.update({
        "LIBRARY_HOME": str(home),
        "LIBRARY_PORT": str(port),
        "LIBRARY_HOST": "127.0.0.1",
        "LIBRARY_JWT_SECRET": "sdk-test-jwt",
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
    # wait for ready
    deadline = time.time() + 15
    ready = False
    with httpx.Client(timeout=2.0, trust_env=False) as cli:
        while time.time() < deadline:
            try:
                r = cli.get(f"{base}/health")
                if r.status_code == 200:
                    ready = True
                    break
            except Exception:
                pass
            time.sleep(0.3)
    if not ready:
        proc.kill()
        raise RuntimeError("library service failed to start in 15s")

    # admin login → tarball publish
    with httpx.Client(timeout=10.0, trust_env=False) as cli:
        r = cli.post(f"{base}/admin/auth/login",
                     json={"username": "admin", "password": "adminpw"})
        r.raise_for_status()
        token = r.json()["token"]

        with tempfile.TemporaryDirectory() as tmp:
            tarball, slug = _make_tarball(Path(tmp))
            with tarball.open("rb") as f:
                r = cli.post(
                    f"{base}/admin/projects/import",
                    headers={"Authorization": f"Bearer {token}"},
                    files={"file": (tarball.name, f, "application/gzip")},
                )
            r.raise_for_status()

            # publish
            r = cli.post(
                f"{base}/admin/projects/{slug}/publish",
                headers={"Authorization": f"Bearer {token}"},
            )
            r.raise_for_status()

    yield {"base": base, "license": license_token, "slug": slug}

    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()


# ---------------------------------------------------------------------------
# 同步 SDK e2e
# ---------------------------------------------------------------------------

class TestSyncE2E:
    def test_list_projects(self, library_service):
        with LibraryClient(library_service["base"], library_service["license"]) as c:
            projects = c.list_projects()
        assert len(projects) >= 1
        slugs = {p.slug for p in projects}
        assert library_service["slug"] in slugs
        p = next(p for p in projects if p.slug == library_service["slug"])
        assert p.knode_count == 1
        assert p.stage_count == 1
        assert "test" in p.tags

    def test_get_project(self, library_service):
        with LibraryClient(library_service["base"], library_service["license"]) as c:
            p = c.get_project(library_service["slug"])
        assert p.title_zh == "SDK 测试项目"
        assert p.knowledge_tree is not None
        assert len(p.knowledge_tree["modules"]) == 1

    def test_get_manifest(self, library_service):
        with LibraryClient(library_service["base"], library_service["license"]) as c:
            m = c.get_manifest(library_service["slug"])
        assert m["slug"] == library_service["slug"]
        assert m["knode_count"] == 1
        assert any(f["path"].endswith("lesson.md") for f in m["files"])

    def test_get_tree(self, library_service):
        with LibraryClient(library_service["base"], library_service["license"]) as c:
            t = c.get_tree(library_service["slug"])
        assert t["schema_version"] == "5.0"
        assert len(t["stages"]) == 1

    def test_get_blueprint(self, library_service):
        with LibraryClient(library_service["base"], library_service["license"]) as c:
            bp = c.get_blueprint(library_service["slug"], lang="zh-CN")
        assert "content" in bp
        assert bp["lang_returned"].lower().startswith("zh")
        assert "blueprint zh" in bp["content"]

    def test_get_knode(self, library_service):
        with LibraryClient(library_service["base"], library_service["license"]) as c:
            k = c.get_knode(library_service["slug"], "M01")
        assert k.knode_id == "M01"
        assert k.plan_markdown.startswith("# M01 Intro")
        assert k.title == "Intro"
        assert isinstance(k.rendered_sections, dict)

    def test_fetch_file(self, library_service):
        with LibraryClient(library_service["base"], library_service["license"]) as c:
            data = c.fetch_file(library_service["slug"], "knodes/M01-w1-intro/lesson.md")
        assert data.decode("utf-8").startswith("# M01 Intro")

    def test_get_file_url(self, library_service):
        with LibraryClient(library_service["base"], library_service["license"]) as c:
            url = c.get_file_url(library_service["slug"], "blueprint/README.md")
        assert url.endswith(f"/v1/projects/{library_service['slug']}/files/blueprint/README.md")

    def test_not_found(self, library_service):
        with LibraryClient(library_service["base"], library_service["license"]) as c:
            with pytest.raises(LibraryNotFound):
                c.get_project("does-not-exist")

    def test_unauthorized(self, library_service):
        with LibraryClient(library_service["base"], "wrong-token") as c:
            with pytest.raises(LibraryUnauthorized):
                c.list_projects()


# ---------------------------------------------------------------------------
# 异步 SDK e2e (smoke; 同步全过了, async 只验关键 API)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestAsyncE2E:
    async def test_list_and_get_knode(self, library_service):
        async with AsyncLibraryClient(
            library_service["base"], library_service["license"]
        ) as c:
            ps = await c.list_projects()
            assert len(ps) >= 1
            k = await c.get_knode(library_service["slug"], "M01")
            assert k.knode_id == "M01"
            assert k.plan_markdown.startswith("# M01 Intro")

    async def test_fetch_file_async(self, library_service):
        async with AsyncLibraryClient(
            library_service["base"], library_service["license"]
        ) as c:
            data = await c.fetch_file(
                library_service["slug"], "knodes/M01-w1-intro/sections.json"
            )
        parsed = json.loads(data)
        assert parsed["sections"][0]["id"] == "s1"

    async def test_async_not_found(self, library_service):
        async with AsyncLibraryClient(
            library_service["base"], library_service["license"]
        ) as c:
            with pytest.raises(LibraryNotFound):
                await c.get_knode(library_service["slug"], "M99-nope")
