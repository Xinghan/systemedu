"""进程内 ASGI route 测试 — 给 catalog routes 拿真实行覆盖。

asgi_client 是 async fixture (httpx 0.28 ASGITransport 仅 async)，故全部 async def。
"""
from __future__ import annotations

import pytest

from systemedu.core.library_client import LibraryNotFound, ProjectMeta


async def _register(asgi_client, username="usr1") -> str:
    await asgi_client.post("/api/auth/register", json={"username": username, "password": "pw123456"})
    r = await asgi_client.post("/api/auth/login", json={"username": username, "password": "pw123456"})
    return r.json()["token"]


def _fake_meta(slug="eeg-signals-test") -> ProjectMeta:
    return ProjectMeta(
        slug=slug, title="EEG", title_zh="脑电", description="d",
        version="1.0.0", knode_count=7, stage_count=3,
        domain="Neuroscience", age_band="12-15", difficulty=2, tags=["test"],
    )


@pytest.fixture
def mock_lib(monkeypatch):
    """mock catalog routes 用的 library client.get_project。"""
    meta = _fake_meta()

    class _Client:
        async def get_project(self, slug):
            if slug == "missing":
                raise LibraryNotFound(slug)
            return meta

    import systemedu.student.catalog.routes as routes_mod
    monkeypatch.setattr(routes_mod, "get_library_client", lambda: _Client())
    return meta


async def test_list_requires_login(asgi_client):
    r = await asgi_client.get("/api/my/projects")
    assert r.status_code == 401


async def test_pull_then_list(asgi_client, mock_lib):
    tok = await _register(asgi_client, "usrpull")
    H = {"Authorization": f"Bearer {tok}"}
    r = await asgi_client.post("/api/my/projects/eeg-signals-test", headers=H)
    assert r.status_code == 201
    assert r.json()["created"] is True
    r2 = await asgi_client.get("/api/my/projects", headers=H)
    assert r2.status_code == 200
    assert any(p["slug"] == "eeg-signals-test" for p in r2.json())


async def test_pull_missing_404(asgi_client, mock_lib):
    tok = await _register(asgi_client, "usrmiss")
    r = await asgi_client.post("/api/my/projects/missing", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 404


async def test_progress_put_requires_pull(asgi_client, mock_lib):
    tok = await _register(asgi_client, "usrprog1")
    H = {"Authorization": f"Bearer {tok}"}
    r = await asgi_client.put("/api/my/progress/never-pulled/M01", headers=H)
    assert r.status_code == 403
    assert r.json()["error"] == "pull_required"


async def test_progress_roundtrip(asgi_client, mock_lib):
    tok = await _register(asgi_client, "usrprog2")
    H = {"Authorization": f"Bearer {tok}"}
    await asgi_client.post("/api/my/projects/eeg-signals-test", headers=H)
    g0 = await asgi_client.get("/api/my/progress/eeg-signals-test", headers=H)
    assert g0.json()["last_module_id"] is None
    await asgi_client.put("/api/my/progress/eeg-signals-test/M02", headers=H)
    g1 = await asgi_client.get("/api/my/progress/eeg-signals-test", headers=H)
    assert g1.json()["last_module_id"] == "M02"


async def test_remove_idempotent(asgi_client, mock_lib):
    tok = await _register(asgi_client, "usrrem")
    H = {"Authorization": f"Bearer {tok}"}
    await asgi_client.post("/api/my/projects/eeg-signals-test", headers=H)
    r1 = await asgi_client.delete("/api/my/projects/eeg-signals-test", headers=H)
    assert r1.json()["removed"] is True
    r2 = await asgi_client.delete("/api/my/projects/eeg-signals-test", headers=H)
    assert r2.status_code == 200


async def test_knode_not_pulled_403(asgi_client, mock_lib):
    tok = await _register(asgi_client, "usrknode")
    H = {"Authorization": f"Bearer {tok}"}
    r = await asgi_client.get("/api/my/projects/eeg-signals-test/knodes/M01", headers=H)
    assert r.status_code == 403
    assert r.json()["error"] == "not_pulled"
