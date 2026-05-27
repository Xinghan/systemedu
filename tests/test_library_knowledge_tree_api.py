"""library knowledge-tree API 测试 (spec 035 T4.4)."""

import json

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(monkeypatch, tmp_path):
    """library FastAPI app + 独立 sqlite file 每个测试.

    library.models 的 _engine 是全局单例 — 必须 patch + reset.
    """
    db_file = tmp_path / "test_library.db"
    media_dir = tmp_path / "media"
    media_dir.mkdir()

    import library.settings as s
    monkeypatch.setattr(s, "DB_PATH", db_file, raising=False)
    monkeypatch.setattr(s, "LIBRARY_HOME", tmp_path, raising=False)
    monkeypatch.setattr(s, "LICENSE_TOKEN", "test-license", raising=False)
    monkeypatch.setattr(s, "PROJECTS_MEDIA_DIR", media_dir, raising=False)

    import library.models as m
    # reset 全局 engine 让新 DB_PATH 生效
    monkeypatch.setattr(m, "_engine", None, raising=False)
    monkeypatch.setattr(m, "_SessionLocal", None, raising=False)

    # auth.py 模块也缓存了 LICENSE_TOKEN; reset 它
    import library.auth as auth_mod
    monkeypatch.setattr(auth_mod, "LICENSE_TOKEN", "test-license", raising=False)

    m.init_db()
    import library.main as main
    return TestClient(main.app)


def _seed_project(slug: str, lit_nodes: list, missing: list):
    """直接插 DB."""
    from library.models import Project, ProjectStatus, get_session
    from datetime import datetime, timezone

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
            manifest_json={
                "slug": slug,
                "title": f"Test {slug}",
                "version": "0.1.0",
                "lit_nodes": lit_nodes,
                "missing_concepts": missing,
            },
            knowledge_tree_json={"schema_version": "5.0", "stages": [], "modules": []},
        )
        db.add(p)
        db.commit()
    finally:
        db.close()


def test_project_knowledge_tree_endpoint(client):
    lit = [
        {"node_id": "math.algebra.piecewise_func", "lit_by": ["M05"], "reason": "M05 AQI 公式"},
        {"node_id": "elec.comm.uart", "lit_by": ["M10"], "reason": "M10 PMS5003 UART"},
        {"node_id": "cs.prog.loop_for", "lit_by": ["M08"], "reason": "M08 Python for"},
    ]
    missing = [{"concept": "测试缺", "first_seen": "M17", "suggested_subject": "elec"}]
    _seed_project("test-proj", lit, missing)

    r = client.get("/v1/projects/test-proj/knowledge-tree",
                   headers={"Authorization": "Bearer test-license"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["slug"] == "test-proj"
    assert len(data["lit_nodes"]) == 3
    assert sorted(data["subjects_used"]) == ["cs", "elec", "math"]
    assert data["missing_concepts"] == missing


def test_project_knowledge_tree_empty(client):
    """老项目无 lit_nodes 字段应返回空 list."""
    _seed_project("old-proj", [], [])
    r = client.get("/v1/projects/old-proj/knowledge-tree",
                   headers={"Authorization": "Bearer test-license"})
    assert r.status_code == 200
    data = r.json()
    assert data["lit_nodes"] == []
    assert data["subjects_used"] == []


def test_platform_knowledge_tree_endpoint(client):
    """全平台树端点应返回 11 学科."""
    r = client.get("/v1/platform/knowledge-tree",
                   headers={"Authorization": "Bearer test-license"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["schema_version"] == "1.0"
    assert len(data["subjects"]) == 11
    subject_ids = {s["id"] for s in data["subjects"]}
    assert subject_ids == {"math", "phys", "chem", "bio", "cs", "elec",
                           "env", "astro", "med", "eng", "geo"}


def test_project_knowledge_tree_not_found(client):
    r = client.get("/v1/projects/nonexistent/knowledge-tree",
                   headers={"Authorization": "Bearer test-license"})
    assert r.status_code == 404
