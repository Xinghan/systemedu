"""T6 — library 公开列表 draft+published 混合排序与硬过滤矩阵 (B-cross-service)。

覆盖 library-app 的 /v1/* 公开端点对 ProjectStatus 的行为:

scenario 1: GET /v1/projects (include_draft 默认 True)
            -> published+draft 都返回, published 按 published_at desc 在前,
               draft 按 slug asc 在后 (public.py list_projects 排序逻辑)。
scenario 2: include_draft=false -> 仅 published。
scenario 3: 对一个 draft 项目的 详情 / tree / manifest / knodes / files / download
            -> 全部 404 (硬过滤, 只有 status=published 才放行)。
scenario 4: 对同一 draft 项目的 cover -> 200
            (spec 036: 封面是橱窗资源, 是唯一对 draft 放行的资源)。

fixture: in-process FastAPI TestClient + license token (沿用
tests/test_library_knowledge_tree_api.py 的 monkeypatch settings + reset engine 范式)。
直接插 DB 种 N 个项目, 混 published/draft, 设不同 published_at/slug。
不起子进程, 不发网络, 不依赖 LLM/Redis。
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

LICENSE = "test-license-t6"
AUTH = {"Authorization": f"Bearer {LICENSE}"}


@pytest.fixture
def ctx(monkeypatch, tmp_path):
    """library FastAPI app + 独立 sqlite + 独立 media_dir。

    返回 (TestClient, media_dir)。media_dir 用于 scenario 4 落封面文件。

    library.models 的 _engine / _SessionLocal 是全局单例, settings 的常量
    是 import 时绑定的 Final, public.py 又 `from ..settings import
    PROJECTS_MEDIA_DIR` 早绑定 — 全部用 monkeypatch.setattr 覆盖, 并 reset
    engine 让新 DB 生效。
    """
    db_file = tmp_path / "test_library_t6.db"
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

    # auth.py 模块级 import 了 LICENSE_TOKEN, 必须同步覆盖
    import library.auth as auth_mod

    monkeypatch.setattr(auth_mod, "LICENSE_TOKEN", LICENSE, raising=False)

    # public.py 模块级 `from ..settings import PROJECTS_MEDIA_DIR` — 早绑定,
    # cover/files 端点读这个, 必须同步覆盖到本测试的 media_dir
    import library.routes.public as pub

    monkeypatch.setattr(pub, "PROJECTS_MEDIA_DIR", media_dir, raising=False)

    m.init_db()
    import library.main as main

    return TestClient(main.app), media_dir


def _seed(
    slug: str,
    status,
    *,
    published_at: datetime | None = None,
    cover_image_path: str | None = None,
):
    """直接插一行 Project。published 才设 published_at。"""
    from library.models import Project, get_session

    db = get_session()
    try:
        p = Project(
            slug=slug,
            title=f"Title {slug}",
            title_zh=f"标题 {slug}",
            description="",
            version="1.0.0",
            knode_count=1,
            stage_count=1,
            duration_weeks=1,
            domain="test",
            age_band="10-12",
            difficulty=2,
            tags=[],
            languages=["zh-CN"],
            status=status,
            published_at=published_at,
            cover_image_path=cover_image_path,
            manifest_json={"slug": slug, "title": f"Title {slug}", "version": "1.0.0"},
            knowledge_tree_json={"schema_version": "5.0", "stages": [], "modules": []},
        )
        db.add(p)
        db.commit()
    finally:
        db.close()


def _seed_lesson(slug: str, knode_id: str = "M01"):
    """给项目插一个 lesson, 让 /knodes/<id> 在 published 时能命中内容。"""
    from library.models import Lesson, get_session

    db = get_session()
    try:
        db.add(
            Lesson(
                project_slug=slug,
                knode_id=knode_id,
                title=f"{knode_id} lesson",
                version="1.0.0",
                knode_dir=f"knodes/{knode_id}-w1",
            )
        )
        db.commit()
    finally:
        db.close()


# 固定 published_at: 越大越新。pub2 最新, pub1 次之, 用于断言 desc 排序。
_NOW = datetime(2026, 6, 1, 12, 0, 0, tzinfo=timezone.utc)


def _seed_mixed(media_dir):
    """种 4 个项目: 2 published (不同 published_at) + 2 draft (不同 slug)。

    published:
      - "pub-alpha"  published_at = _NOW - 2d (较旧)
      - "pub-beta"   published_at = _NOW       (最新)  -> 应排在 pub-alpha 前
    draft:
      - "draft-xray"  (slug 字母序较后)
      - "draft-mike"  (slug 字母序较前) -> draft 内部应 mike 在前
    返回各 slug 方便断言。
    """
    from library.models import ProjectStatus

    _seed("pub-alpha", ProjectStatus.published, published_at=_NOW - timedelta(days=2))
    _seed("pub-beta", ProjectStatus.published, published_at=_NOW)
    _seed("draft-xray", ProjectStatus.draft)
    # draft 项目带封面 (scenario 4 用), 真实落一个封面文件
    cover_rel = "cover.png"
    _seed("draft-mike", ProjectStatus.draft, cover_image_path=cover_rel)
    cover_dir = media_dir / "draft-mike"
    cover_dir.mkdir(parents=True, exist_ok=True)
    (cover_dir / cover_rel).write_bytes(b"\x89PNG\r\n\x1a\nfake-cover-bytes")
    return {
        "pub_old": "pub-alpha",
        "pub_new": "pub-beta",
        "draft_late": "draft-xray",
        "draft_early": "draft-mike",
    }


# ---------------------------------------------------------------------------
# scenario 1: 默认 include_draft=True -> published(desc) 在前, draft(slug asc) 在后
# ---------------------------------------------------------------------------

def test_list_default_mixes_published_then_draft_sorted(ctx):
    client, media_dir = ctx
    s = _seed_mixed(media_dir)

    r = client.get("/v1/projects", headers=AUTH)
    assert r.status_code == 200, r.text
    data = r.json()
    slugs = [p["slug"] for p in data]

    # 4 个全部返回 (include_draft 默认 True)
    assert set(slugs) == {
        s["pub_new"], s["pub_old"], s["draft_late"], s["draft_early"]
    }

    # published 排在所有 draft 之前
    statuses = [p["status"] for p in data]
    assert statuses == ["published", "published", "draft", "draft"], statuses

    # published 内部按 published_at desc: pub-beta(最新) 在 pub-alpha 前
    assert slugs[:2] == [s["pub_new"], s["pub_old"]], slugs

    # draft 内部按 slug asc: draft-mike 在 draft-xray 前
    assert slugs[2:] == [s["draft_early"], s["draft_late"]], slugs


# ---------------------------------------------------------------------------
# scenario 2: include_draft=false -> 仅 published
# ---------------------------------------------------------------------------

def test_list_include_draft_false_returns_only_published(ctx):
    client, media_dir = ctx
    s = _seed_mixed(media_dir)

    r = client.get("/v1/projects", params={"include_draft": "false"}, headers=AUTH)
    assert r.status_code == 200, r.text
    data = r.json()
    slugs = [p["slug"] for p in data]

    # 只剩 2 个 published, 无任何 draft
    assert set(slugs) == {s["pub_new"], s["pub_old"]}, slugs
    assert all(p["status"] == "published" for p in data)
    # 仍按 published_at desc
    assert slugs == [s["pub_new"], s["pub_old"]], slugs


# ---------------------------------------------------------------------------
# scenario 3: draft 项目的 详情/tree/manifest/knodes/files/download -> 全 404 (硬过滤)
# ---------------------------------------------------------------------------

def test_draft_content_endpoints_hard_filtered_404(ctx):
    client, media_dir = ctx
    s = _seed_mixed(media_dir)
    draft = s["draft_early"]  # draft-mike (即便有封面文件, 内容端点仍硬过滤)
    # 给 draft 也插一个 lesson, 证明 404 来自 status 过滤而非"无 lesson"
    _seed_lesson(draft, "M01")

    cases = {
        "detail": f"/v1/projects/{draft}",
        "tree": f"/v1/projects/{draft}/tree",
        "manifest": f"/v1/projects/{draft}/manifest",
        "knode": f"/v1/projects/{draft}/knodes/M01",
        "file": f"/v1/projects/{draft}/files/some/asset.html",
        "download": f"/v1/projects/{draft}/download",
    }
    for name, url in cases.items():
        r = client.get(url, headers=AUTH)
        assert r.status_code == 404, f"{name} {url} -> {r.status_code} {r.text}"

    # 对照: 同样的端点在 published 项目上不是 404 (证明 404 是 status 过滤而非端点本身坏)
    pub = s["pub_new"]
    _seed_lesson(pub, "M01")
    assert client.get(f"/v1/projects/{pub}", headers=AUTH).status_code == 200
    assert client.get(f"/v1/projects/{pub}/tree", headers=AUTH).status_code == 200
    assert client.get(f"/v1/projects/{pub}/manifest", headers=AUTH).status_code == 200
    assert client.get(f"/v1/projects/{pub}/knodes/M01", headers=AUTH).status_code == 200
    # download: published 但无 _archive tarball -> 503 (而非 404); 关键是它过了
    # status 过滤, 跟 draft 的 404 区分开。
    assert client.get(f"/v1/projects/{pub}/download", headers=AUTH).status_code == 503


# ---------------------------------------------------------------------------
# scenario 4: draft 项目的 cover -> 200 (唯一对 draft 放行的资源)
# ---------------------------------------------------------------------------

def test_draft_cover_is_served_200(ctx):
    client, media_dir = ctx
    s = _seed_mixed(media_dir)
    draft = s["draft_early"]  # draft-mike, 已落 cover.png

    r = client.get(f"/v1/projects/{draft}/cover", headers=AUTH)
    assert r.status_code == 200, r.text
    # FileResponse 返回真实字节
    assert r.content == b"\x89PNG\r\n\x1a\nfake-cover-bytes"

    # 红线对照: 同一个 draft 的"详情"仍 404, 证明 cover 是特例放行而非整体放行
    assert client.get(f"/v1/projects/{draft}", headers=AUTH).status_code == 404
