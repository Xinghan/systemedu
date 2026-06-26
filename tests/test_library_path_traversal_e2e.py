"""T3 — library 文件/封面路径遍历防护 + 404 传播 (D-auth-boundary)。

覆盖 public.py get_file / get_cover / get_knode / get_tree 的边界与防护:
- 路径遍历 (resolve().relative_to 拦截 + 客户端 URL 规范化兜底)
- 越界但目标存在 -> 403 path traversal blocked
- 越界但目标不存在 / 媒体目录内不存在 -> 404 file not found
- 正常文件 -> 200 + 内容
- 不存在的 knode / project -> 404 (不是 200 空 body)

范式参照 tests/test_library_knowledge_tree_api.py: in-process FastAPI TestClient +
独立 sqlite + monkeypatch settings/auth/public/importer 的 PROJECTS_MEDIA_DIR, 走真实
importer.import_tarball 把媒体文件落到 PROJECTS_MEDIA_DIR/<slug>/ (复用
conftest._make_tarball 的目录/文件布局思路)。

注意 (实测, 非臆测):
- get_file 端点是 {file_path:path}; importer copytree 把 knodes/M01-w1-intro/lesson.md
  等真实文件落盘。
- 原始 "../" 形态 URL 会被 httpx/TestClient 客户端侧规范化折叠 (RFC 3986), 折叠后
  不匹配路由 -> 404 "Not Found"; 这是工单接受的 "403 或 404" 之一。
- 用 %2e%2e 编码可绕过客户端规范化, 让 file_path:path 真收到 "../":
    * 越界目标确实存在 (在媒体目录外) -> relative_to 抛 ValueError -> 403
    * 越界目标不存在 (如 /etc/passwd 在 tmp 深度下解析不到) -> exists() 先拦 -> 404
"""

from __future__ import annotations

import hashlib
import json
import tarfile
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

LICENSE = "t3-license"
AUTH = {"Authorization": f"Bearer {LICENSE}"}
SLUG = "t3-traversal-proj"


# ---------------------------------------------------------------------------
# tarball 工厂 (复用 conftest._make_tarball 的布局: knodes/M01-w1-intro/lesson.md +
# tree/knowledge_tree.json + manifest.json + sha256 校验)
# ---------------------------------------------------------------------------

def _sha256(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def _make_tarball(tmp: Path, slug: str = SLUG) -> Path:
    root = tmp / slug
    knode_dir = root / "knodes" / "M01-w1-intro"
    knode_dir.mkdir(parents=True)
    (knode_dir / "lesson.md").write_text(
        "# M01 Intro\n\nfor T3 traversal test.\n", encoding="utf-8"
    )
    (knode_dir / "sections.json").write_text('{"sections":[]}', encoding="utf-8")
    (knode_dir / "audio_scripts.json").write_text('{"scripts":[]}', encoding="utf-8")
    (root / "tree").mkdir()
    (root / "tree" / "knowledge_tree.json").write_text(
        json.dumps(
            {
                "schema_version": "5.0",
                "title": "T3 test",
                "stages": [{"stage_id": "S1", "title": "Phase 1"}],
                "modules": [{"module_id": "M01", "stage_id": "S1", "title": "Intro"}],
                "edges": [],
                "final_outcomes": [],
            }
        ),
        encoding="utf-8",
    )

    files = [
        {
            "path": p.relative_to(root).as_posix(),
            "sha256": _sha256(p),
            "size": p.stat().st_size,
        }
        for p in sorted(root.rglob("*"))
        if p.is_file() and p.name != "manifest.json"
    ]
    manifest = {
        "schema_version": "1.0",
        "slug": slug,
        "title": "T3 traversal project",
        "title_zh": "T3 路径遍历测试项目",
        "description": "T3 e2e",
        "version": "1.0.0",
        "frontmatter": {"age_band": "10-12", "domain": "Test", "duration_weeks": 1},
        "knode_count": 1,
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
            }
        ],
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
# fixture: in-process library app + 真实 import 1 个 published 项目
# ---------------------------------------------------------------------------

@pytest.fixture
def lib(monkeypatch, tmp_path):
    """library FastAPI app + 独立 sqlite + 媒体目录落真实文件 + published 项目.

    返回 (TestClient, media_dir)。media_dir = PROJECTS_MEDIA_DIR。
    """
    db_file = tmp_path / "t3_library.db"
    media_dir = tmp_path / "media" / "projects"
    media_dir.mkdir(parents=True)

    import library.settings as s
    monkeypatch.setattr(s, "DB_PATH", db_file, raising=False)
    monkeypatch.setattr(s, "LIBRARY_HOME", tmp_path, raising=False)
    monkeypatch.setattr(s, "LICENSE_TOKEN", LICENSE, raising=False)
    monkeypatch.setattr(s, "PROJECTS_MEDIA_DIR", media_dir, raising=False)

    import library.models as m
    # library.models 的全局 engine 单例 — reset 让新 DB_PATH 生效
    monkeypatch.setattr(m, "_engine", None, raising=False)
    monkeypatch.setattr(m, "_SessionLocal", None, raising=False)

    # auth / public / importer 都对 settings 常量做了 from-import 绑定, 逐个 patch
    import library.auth as auth_mod
    monkeypatch.setattr(auth_mod, "LICENSE_TOKEN", LICENSE, raising=False)
    import library.routes.public as pub
    monkeypatch.setattr(pub, "PROJECTS_MEDIA_DIR", media_dir, raising=False)
    import library.importer as imp
    monkeypatch.setattr(imp, "PROJECTS_MEDIA_DIR", media_dir, raising=False)

    m.init_db()

    # 真实 import (走 manifest hash 校验 + copytree 落盘)
    with tempfile.TemporaryDirectory() as td:
        tarball = _make_tarball(Path(td))
        imp.import_tarball(tarball, allow_overwrite=True)

    # importer 默认落 draft, 这里 publish (public 端点硬过滤 published)
    from library.models import Project, ProjectStatus, get_session

    db = get_session()
    try:
        p = db.query(Project).filter_by(slug=SLUG).first()
        assert p is not None, "import 后应有项目"
        p.status = ProjectStatus.published
        db.commit()
    finally:
        db.close()

    # 真实文件确实落盘 (后续断言依赖)
    assert (media_dir / SLUG / "knodes" / "M01-w1-intro" / "lesson.md").exists()

    import library.main as main
    client = TestClient(main.app, raise_server_exceptions=False)
    return client, media_dir


# ---------------------------------------------------------------------------
# scenario 1: GET .../files/../../../../etc/passwd -> 403 或 404
# ---------------------------------------------------------------------------

def test_files_path_traversal_etc_passwd_blocked(lib):
    """原始 '../' URL 被客户端规范化折叠 -> 路由不匹配 -> 404; 不会泄露 /etc/passwd。

    工单接受 403 或 404; 这里实测是 404 'Not Found' (Starlette 路由层)。
    无论哪种, 关键是不返回 200 + /etc/passwd 内容。
    """
    client, _ = lib
    r = client.get(f"/v1/projects/{SLUG}/files/../../../../etc/passwd", headers=AUTH)
    assert r.status_code in (403, 404), r.text
    assert "root:" not in r.text  # 绝不泄露 passwd 内容


def test_files_encoded_traversal_to_real_outside_file_403(lib, tmp_path):
    """编码 '%2e%2e' 绕过客户端规范化, 让 file_path:path 真收到 '../', 遍历到一个
    确实存在但在媒体目录外的文件 -> resolve().relative_to 抛 ValueError -> 403。

    这条直接打到 get_file 的 relative_to 防护分支 (而非靠客户端兜底)。
    """
    client, media_dir = lib
    # 在媒体目录外放真实文件: media_dir/<slug>/../../outside_secret.txt
    #                       == media_dir.parent/outside_secret.txt
    outside = media_dir.parent / "outside_secret.txt"
    outside.write_text("TOP SECRET should never leak", encoding="utf-8")

    r = client.get(
        f"/v1/projects/{SLUG}/files/%2e%2e/%2e%2e/outside_secret.txt", headers=AUTH
    )
    assert r.status_code == 403, r.text
    assert r.json()["detail"] == "path traversal blocked"
    assert "TOP SECRET" not in r.text  # 内容绝不泄露


def test_files_encoded_traversal_to_missing_outside_404(lib):
    """编码遍历到一个不存在的越界路径 (/etc/passwd 在 tmp 深度下解析不到) ->
    exists() 检查先于 relative_to -> 404 'file not found'。

    覆盖工单 '路径在媒体目录外不存在则 404' 分支。
    """
    client, _ = lib
    enc = "%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/etc/passwd"
    r = client.get(f"/v1/projects/{SLUG}/files/{enc}", headers=AUTH)
    assert r.status_code == 404, r.text
    assert "root:" not in r.text


# ---------------------------------------------------------------------------
# scenario 2: GET .../files/knodes/M01-w1-intro/lesson.md -> 200 + 内容
# ---------------------------------------------------------------------------

def test_files_good_path_returns_content(lib):
    client, _ = lib
    r = client.get(
        f"/v1/projects/{SLUG}/files/knodes/M01-w1-intro/lesson.md", headers=AUTH
    )
    assert r.status_code == 200, r.text
    assert "# M01 Intro" in r.text
    assert "for T3 traversal test." in r.text


# ---------------------------------------------------------------------------
# scenario 3: GET .../files/nonexistent.md -> 404 file not found (非 200 空 body)
# ---------------------------------------------------------------------------

def test_files_nonexistent_returns_404(lib):
    client, _ = lib
    r = client.get(f"/v1/projects/{SLUG}/files/nonexistent.md", headers=AUTH)
    assert r.status_code == 404, r.text
    assert r.json()["detail"] == "file not found"


# ---------------------------------------------------------------------------
# scenario 4: GET .../knodes/NOTEXIST -> 404 knode not found
# ---------------------------------------------------------------------------

def test_knode_not_found_returns_404(lib):
    client, _ = lib
    r = client.get(f"/v1/projects/{SLUG}/knodes/NOTEXIST", headers=AUTH)
    assert r.status_code == 404, r.text
    assert r.json()["detail"] == "knode not found"


# ---------------------------------------------------------------------------
# scenario 5: GET /v1/projects/notexist/tree -> 404
# ---------------------------------------------------------------------------

def test_tree_of_missing_project_returns_404(lib):
    client, _ = lib
    r = client.get("/v1/projects/notexist/tree", headers=AUTH)
    assert r.status_code == 404, r.text
    assert r.json()["detail"] == "project not found"


# ---------------------------------------------------------------------------
# scenario 6: GET .../cover/../../secret -> 路径遍历被拦 (403/404)
# ---------------------------------------------------------------------------

def test_cover_path_traversal_blocked(lib):
    """cover 端点是固定 /cover (无 path 参数)。'cover/../../secret' 形态的 URL
    被客户端规范化折叠成 /v1/projects/secret -> 命中 get_project('secret') ->
    404 'project not found or not published'。不会泄露任意文件。

    工单接受 403 或 404。
    """
    client, _ = lib
    r = client.get(f"/v1/projects/{SLUG}/cover/../../secret", headers=AUTH)
    assert r.status_code in (403, 404), r.text
    # 规范化后命中 get_project, 返回项目类 404, 绝非 200 文件内容
    assert "secret" not in r.text.lower() or r.status_code in (403, 404)


# ---------------------------------------------------------------------------
# 补充: 这些防护端点仍需 license (未授权 -> 401/403), 防止"防遍历但无鉴权"误判
# ---------------------------------------------------------------------------

def test_files_endpoint_requires_license(lib):
    """无 license token 时 get_file 应被 require_license 拦 (401), 不进遍历逻辑。"""
    client, _ = lib
    r = client.get(f"/v1/projects/{SLUG}/files/knodes/M01-w1-intro/lesson.md")
    assert r.status_code == 401, r.text


def test_files_endpoint_rejects_bad_license(lib):
    """错误 license token -> 403 Invalid license token。"""
    client, _ = lib
    r = client.get(
        f"/v1/projects/{SLUG}/files/knodes/M01-w1-intro/lesson.md",
        headers={"Authorization": "Bearer wrong-token"},
    )
    assert r.status_code == 403, r.text
    assert r.json()["detail"] == "Invalid license token"
