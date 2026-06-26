"""T5 — library admin 发布/取消发布 → 公开可见性联动 (A-e2e)。

范式: in-process FastAPI TestClient + admin JWT + license token, 调同一 library
app 的两套路由 (/admin/* 管理 + /v1/* 公开)。覆盖 admin publish/unpublish 与
public.py 各端点 status==published 硬过滤 + get_cover 不过滤 的联动。

隔离: settings.py 的路径 / token 是 import 时固化的 Final 常量, models 的 engine
是全局单例。故 fixture 先把 env 指到临时 LIBRARY_HOME, 再 importlib.reload 整条
library 模块链 (settings -> models -> auth/importer/routes/main), 让本测试用一个
干净、与其它测试隔离的 SQLite + media 目录。TestClient 触发 lifespan 完成
ensure_dirs + init_db + bootstrap admin。

参考范式:
- tests/test_library_client.py: admin login -> import -> publish 的 HTTP 序列、断言风格
- tests/student/conftest.py: tarball 构造 (sha256 manifest)、license/admin token 用法
- public.py: get_project/manifest/tree/knode/file/download 均 filter status==published;
  get_cover 唯一不过滤 status (spec 036 橱窗资源)
- admin.py: publish 设 status=published + published_at=utcnow(); unpublish 设
  status=draft + published_at=None

T5 不依赖网络 / LLM / Redis, 全程进程内, 真跑可绿。
"""

from __future__ import annotations

import hashlib
import importlib
import json
import tarfile
import tempfile
from pathlib import Path

import pytest

SLUG = "t5-publish-e2e"
LICENSE = "t5-license"
ADMIN_USER = "admin"
ADMIN_PW = "adminpw"


# ---------------------------------------------------------------------------
# tarball 构造 (1 knode M01 + 封面, draft 导入)
# ---------------------------------------------------------------------------

def _build_tarball(tmp: Path, slug: str = SLUG) -> Path:
    root = tmp / slug
    (root / "tree").mkdir(parents=True)
    (root / "blueprint").mkdir()
    knode_dir = root / "knodes" / "M01-w1-intro"
    knode_dir.mkdir(parents=True)

    (knode_dir / "lesson.md").write_text("# M01 Intro\n\nT5 publish e2e.\n", encoding="utf-8")
    (knode_dir / "sections.json").write_text('{"sections":[]}', encoding="utf-8")
    (knode_dir / "audio_scripts.json").write_text('{"scripts":[]}', encoding="utf-8")
    (root / "blueprint" / "README.zh.md").write_text("# T5 蓝图\n", encoding="utf-8")
    # spec 036: 封面 (cover.png), import 后 Project.cover_image_path 指向它
    (root / "cover.png").write_bytes(b"\x89PNG\r\n\x1a\nfake-cover-bytes")
    (root / "tree" / "knowledge_tree.json").write_text(
        json.dumps({
            "schema_version": "5.0",
            "title": "T5 test",
            "stages": [{"stage_id": "S1", "title": "Phase 1"}],
            "modules": [{"module_id": "M01", "stage_id": "S1", "title": "Intro"}],
            "edges": [],
        }),
        encoding="utf-8",
    )

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
        "title": "T5 Publish E2E",
        "title_zh": "T5 发布联动",
        "description": "T5 admin publish/unpublish e2e",
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
        "cover_image_path": "cover.png",
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
# fixtures: 进程内 TestClient + token, 注入 1 个 draft 项目
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def lib_app(tmp_path_factory):
    """在隔离的 LIBRARY_HOME 下 reload library 模块链, 返回 (app, admin_token)。

    项目以 draft 状态导入 (import_tarball 默认 status=draft), 让每个 scenario
    自行把它推到所需的 draft / published 起点。
    """
    import os

    home = tmp_path_factory.mktemp("t5-lib-home")
    os.environ["LIBRARY_HOME"] = str(home)
    os.environ["LIBRARY_JWT_SECRET"] = "t5-jwt-secret"
    os.environ["LIBRARY_LICENSE_TOKEN"] = LICENSE
    os.environ["LIBRARY_BOOTSTRAP_ADMIN"] = f"{ADMIN_USER}:{ADMIN_PW}"

    # 整条 library 模块链 reload, 让 Final 常量 + engine 单例重新绑定到上面 env
    import library.settings as settings
    importlib.reload(settings)
    assert str(home) in str(settings.PROJECTS_MEDIA_DIR)

    import library.models as models
    importlib.reload(models)
    models._engine = None
    models._SessionLocal = None

    import library.auth as auth
    importlib.reload(auth)
    import library.importer as importer
    importlib.reload(importer)
    import library.routes.public as public
    importlib.reload(public)
    import library.routes.admin as admin
    importlib.reload(admin)
    import library.main as main_mod
    importlib.reload(main_mod)

    from fastapi.testclient import TestClient

    # TestClient 上下文触发 lifespan: ensure_dirs + init_db + bootstrap admin
    with TestClient(main_mod.app) as boot:
        r = boot.post("/admin/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PW})
        r.raise_for_status()
        admin_token = r.json()["token"]

        with tempfile.TemporaryDirectory() as t:
            tb = _build_tarball(Path(t))
            with tb.open("rb") as f:
                r = boot.post(
                    "/admin/projects/import",
                    headers={"Authorization": f"Bearer {admin_token}"},
                    files={"file": (tb.name, f, "application/gzip")},
                )
            r.raise_for_status()
            assert r.json()["slug"] == SLUG

    yield {"app": main_mod.app, "admin_token": admin_token}

    # 还原 engine 单例, 避免 reload 副作用泄漏到后续 library 测试
    models._engine = None
    models._SessionLocal = None


@pytest.fixture
def client(lib_app):
    """指向同一 library app 的进程内 TestClient (两套路由共用)。"""
    from fastapi.testclient import TestClient

    with TestClient(lib_app["app"]) as c:
        yield c


@pytest.fixture
def ah(lib_app):
    """admin Authorization 头 (/admin/* 用)。"""
    return {"Authorization": f"Bearer {lib_app['admin_token']}"}


@pytest.fixture
def lh():
    """license Authorization 头 (/v1/* 用)。"""
    return {"Authorization": f"Bearer {LICENSE}"}


# ---------------------------------------------------------------------------
# 状态推手: 把项目稳定地拉到 draft / published 起点 (让 scenario 顺序无关)
# ---------------------------------------------------------------------------

def _to_draft(client, ah) -> None:
    r = client.post(f"/admin/projects/{SLUG}/unpublish", headers=ah)
    assert r.status_code == 200
    assert r.json()["status"] == "draft"


def _to_published(client, ah) -> dict:
    r = client.post(f"/admin/projects/{SLUG}/publish", headers=ah)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "published"
    return body


# ---------------------------------------------------------------------------
# Scenario 1: draft 项目 publish → status=published + published_at 设时间戳
# ---------------------------------------------------------------------------

def test_publish_sets_status_and_published_at(client, ah):
    _to_draft(client, ah)
    body = _to_published(client, ah)
    assert body["status"] == "published"
    assert body["published_at"] is not None
    # published_at 是一个可解析的 ISO 时间戳 (admin.py datetime.utcnow().isoformat())
    from datetime import datetime

    parsed = datetime.fromisoformat(body["published_at"])
    assert isinstance(parsed, datetime)


# ---------------------------------------------------------------------------
# Scenario 2: publish 后 GET /v1/projects (include_draft=false) 查得到;
#             publish 前 (draft) 查不到
# ---------------------------------------------------------------------------

def test_publish_visibility_in_public_list(client, ah, lh):
    # draft 阶段: include_draft=false 查不到
    _to_draft(client, ah)
    r = client.get("/v1/projects", params={"include_draft": "false"}, headers=lh)
    assert r.status_code == 200
    assert SLUG not in {p["slug"] for p in r.json()}

    # publish 后: 查得到, 且 status=published
    _to_published(client, ah)
    r = client.get("/v1/projects", params={"include_draft": "false"}, headers=lh)
    assert r.status_code == 200
    matched = [p for p in r.json() if p["slug"] == SLUG]
    assert len(matched) == 1
    assert matched[0]["status"] == "published"


# ---------------------------------------------------------------------------
# Scenario 3: publish 后 GET /v1/projects/{slug}/knodes/M01 -> 200;
#             publish 前 (draft) -> 404
# ---------------------------------------------------------------------------

def test_knode_gated_by_publish(client, ah, lh):
    # draft 阶段: knode 硬过滤 404 (project not found)
    _to_draft(client, ah)
    r = client.get(f"/v1/projects/{SLUG}/knodes/M01", headers=lh)
    assert r.status_code == 404

    # publish 后: knode 200, 字段贴合 public.get_knode 返回
    _to_published(client, ah)
    r = client.get(f"/v1/projects/{SLUG}/knodes/M01", headers=lh)
    assert r.status_code == 200
    body = r.json()
    assert body["project_slug"] == SLUG
    assert body["knode_id"] == "M01"
    assert body["plan_markdown"].startswith("# M01 Intro")


# ---------------------------------------------------------------------------
# Scenario 4: published POST /unpublish → status=draft + published_at=NULL
# ---------------------------------------------------------------------------

def test_unpublish_resets_status_and_published_at(client, ah):
    _to_published(client, ah)
    r = client.post(f"/admin/projects/{SLUG}/unpublish", headers=ah)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "draft"
    assert body["published_at"] is None


# ---------------------------------------------------------------------------
# Scenario 5: unpublish 后 detail/tree/knode/download 硬过滤回 404;
#             cover 仍 200 (spec 036: cover 不过滤 status)
# ---------------------------------------------------------------------------

def test_unpublish_hard_filters_but_cover_stays(client, ah, lh):
    # 先确保是 published, 再 unpublish 回 draft
    _to_published(client, ah)
    r = client.post(f"/admin/projects/{SLUG}/unpublish", headers=ah)
    assert r.status_code == 200
    assert r.json()["status"] == "draft"

    # detail / tree / knode / download 全部硬过滤回 404
    assert client.get(f"/v1/projects/{SLUG}", headers=lh).status_code == 404
    assert client.get(f"/v1/projects/{SLUG}/tree", headers=lh).status_code == 404
    assert client.get(f"/v1/projects/{SLUG}/knodes/M01", headers=lh).status_code == 404
    assert client.get(f"/v1/projects/{SLUG}/download", headers=lh).status_code == 404

    # cover 仍 200 (spec 036 橱窗资源, 唯一对 draft 放行的端点)
    r = client.get(f"/v1/projects/{SLUG}/cover", headers=lh)
    assert r.status_code == 200
    # 返回的是封面文件字节 (FileResponse)
    assert r.content == b"\x89PNG\r\n\x1a\nfake-cover-bytes"


# ---------------------------------------------------------------------------
# Scenario 6: draft -> publish -> draft -> publish: published_at 更新为最后一次
# ---------------------------------------------------------------------------

def test_published_at_updates_on_republish(client, ah):
    from datetime import datetime

    _to_draft(client, ah)

    first = _to_published(client, ah)
    first_at = datetime.fromisoformat(first["published_at"])

    # 回 draft -> published_at 清空
    r = client.post(f"/admin/projects/{SLUG}/unpublish", headers=ah)
    assert r.status_code == 200
    assert r.json()["published_at"] is None

    # 制造一个肉眼可分辨的时间差, 保证第二次时间戳 >= 第一次
    import time

    time.sleep(0.01)

    second = _to_published(client, ah)
    second_at = datetime.fromisoformat(second["published_at"])

    # 第二次发布的时间戳是最新的一次 (>= 第一次), 且非空
    assert second["published_at"] is not None
    assert second_at >= first_at
