"""library 公开 API (/v1/*) 许可证令牌鉴权 e2e 测试 (工单 T2, D-auth-boundary).

复用 tests/test_library_knowledge_tree_api.py 的鉴权范式:
in-process TestClient + monkeypatch (LICENSE_TOKEN + auth_mod.LICENSE_TOKEN),
种 1 个 published 项目。

require_license 真实行为 (library/auth.py):
  - 无 Authorization 头        -> 401 "Missing Bearer token"
  - Bearer 但 token 不匹配     -> 403 "Invalid license token"
  - Bearer 且 token 正确       -> 放行 (200 / 业务状态码)

整个 public.router 都挂了 dependencies=[Depends(require_license)] (library/main.py
prefix="/v1"), 所以 /v1/projects、/v1/projects/{slug}/cover、/v1/platform/knowledge-tree
全部需要 license token。
"""

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

# 测试用 license token (fixture 里 patch 进去, 与生产真值无关)
LICENSE = "test-license"


@pytest.fixture
def client(monkeypatch, tmp_path):
    """library FastAPI app + 独立 sqlite file 每个测试。

    library.models 的 _engine 是全局单例 — 必须 patch + reset。
    auth.py 模块级缓存了 LICENSE_TOKEN, 也必须 patch (否则用生产默认值)。
    """
    db_file = tmp_path / "test_library.db"
    media_dir = tmp_path / "media"
    media_dir.mkdir()

    import library.settings as s
    monkeypatch.setattr(s, "DB_PATH", db_file, raising=False)
    monkeypatch.setattr(s, "LIBRARY_HOME", tmp_path, raising=False)
    monkeypatch.setattr(s, "LICENSE_TOKEN", LICENSE, raising=False)
    monkeypatch.setattr(s, "PROJECTS_MEDIA_DIR", media_dir, raising=False)

    import library.models as m
    monkeypatch.setattr(m, "_engine", None, raising=False)
    monkeypatch.setattr(m, "_SessionLocal", None, raising=False)

    # auth.py 模块也缓存了 LICENSE_TOKEN; reset 它
    import library.auth as auth_mod
    monkeypatch.setattr(auth_mod, "LICENSE_TOKEN", LICENSE, raising=False)

    # public.py routes 用 PROJECTS_MEDIA_DIR 拼封面/文件路径; patch 它指向 tmp media
    import library.routes.public as pub
    monkeypatch.setattr(pub, "PROJECTS_MEDIA_DIR", media_dir, raising=False)

    m.init_db()
    import library.main as main
    return TestClient(main.app)


def _auth(token: str = LICENSE) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _seed_project(slug: str, *, cover_image_path: str | None = None):
    """直接插一个 published 项目到 DB。"""
    from library.models import Project, ProjectStatus, get_session

    db = get_session()
    try:
        p = Project(
            slug=slug,
            title=f"Test {slug}",
            title_zh=f"测试 {slug}",
            description="",
            version="0.1.0",
            knode_count=2,
            stage_count=1,
            duration_weeks=4,
            domain="test",
            age_band="10-12",
            difficulty=3,
            tags=[],
            languages=["zh-CN"],
            status=ProjectStatus.published,
            published_at=datetime.now(timezone.utc),
            cover_image_path=cover_image_path,
            manifest_json={
                "slug": slug,
                "title": f"Test {slug}",
                "version": "0.1.0",
            },
            knowledge_tree_json={"schema_version": "5.0", "stages": [], "modules": []},
        )
        db.add(p)
        db.commit()
    finally:
        db.close()


def _write_cover(media_dir, slug: str, rel: str = "cover.png") -> str:
    """在 PROJECTS_MEDIA_DIR/<slug>/<rel> 写一张占位封面, 返回相对路径。"""
    target = media_dir / slug / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    # 1x1 PNG 的最小字节 (内容随意, 端点只 FileResponse 不校验图像)
    target.write_bytes(b"\x89PNG\r\n\x1a\n" + b"fake-cover-bytes")
    return rel


# ---------------------------------------------------------------------------
# Scenario 1: GET /v1/projects 无 Authorization -> 401
# ---------------------------------------------------------------------------

def test_list_projects_without_auth_returns_401(client):
    _seed_project("proj-a")
    r = client.get("/v1/projects")
    assert r.status_code == 401, r.text
    assert "Missing Bearer token" in r.json()["detail"]


# ---------------------------------------------------------------------------
# Scenario 2: GET /v1/projects Bearer wrong-token -> 403
# ---------------------------------------------------------------------------

def test_list_projects_with_wrong_token_returns_403(client):
    _seed_project("proj-a")
    r = client.get("/v1/projects", headers=_auth("totally-wrong-token"))
    assert r.status_code == 403, r.text
    assert "Invalid license token" in r.json()["detail"]


# ---------------------------------------------------------------------------
# Scenario 3: GET /v1/projects Bearer 正确 license token -> 200
# ---------------------------------------------------------------------------

def test_list_projects_with_valid_token_returns_200(client):
    _seed_project("proj-a")
    r = client.get("/v1/projects", headers=_auth())
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    slugs = {p["slug"] for p in data}
    assert "proj-a" in slugs


# ---------------------------------------------------------------------------
# Scenario 4: GET /v1/projects/{slug}/cover 也需 license token (无 -> 401)
# ---------------------------------------------------------------------------

def test_cover_without_auth_returns_401(client, tmp_path):
    media_dir = tmp_path / "media"
    rel = _write_cover(media_dir, "proj-a")
    _seed_project("proj-a", cover_image_path=rel)

    # 无 Authorization: router 级 require_license 先拦截 -> 401, 到不了封面逻辑
    r = client.get("/v1/projects/proj-a/cover")
    assert r.status_code == 401, r.text
    assert "Missing Bearer token" in r.json()["detail"]


def test_cover_with_wrong_token_returns_403(client, tmp_path):
    media_dir = tmp_path / "media"
    rel = _write_cover(media_dir, "proj-a")
    _seed_project("proj-a", cover_image_path=rel)

    r = client.get("/v1/projects/proj-a/cover", headers=_auth("bad"))
    assert r.status_code == 403, r.text
    assert "Invalid license token" in r.json()["detail"]


def test_cover_with_valid_token_returns_200(client, tmp_path):
    media_dir = tmp_path / "media"
    rel = _write_cover(media_dir, "proj-a")
    _seed_project("proj-a", cover_image_path=rel)

    r = client.get("/v1/projects/proj-a/cover", headers=_auth())
    assert r.status_code == 200, r.text
    assert r.content == b"\x89PNG\r\n\x1a\n" + b"fake-cover-bytes"


# ---------------------------------------------------------------------------
# Scenario 5: GET /v1/platform/knowledge-tree 需 token
# ---------------------------------------------------------------------------

def test_platform_tree_without_auth_returns_401(client):
    r = client.get("/v1/platform/knowledge-tree")
    assert r.status_code == 401, r.text
    assert "Missing Bearer token" in r.json()["detail"]


def test_platform_tree_with_wrong_token_returns_403(client):
    r = client.get("/v1/platform/knowledge-tree", headers=_auth("nope"))
    assert r.status_code == 403, r.text
    assert "Invalid license token" in r.json()["detail"]


def test_platform_tree_with_valid_token_returns_200(client):
    r = client.get("/v1/platform/knowledge-tree", headers=_auth())
    # 有正确 token 后通过鉴权; platform_tree.json 仓库内存在 -> 200 (11 学科)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "subjects" in data
    assert len(data["subjects"]) == 11
