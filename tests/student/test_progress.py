"""progress 测试 — /api/my/progress/*."""

from __future__ import annotations


def _register_and_pull(client, services, username):
    r = client.post(
        "/api/auth/register", json={"username": username, "password": "passw0rd"}
    )
    token = r.json()["token"]
    H = {"Authorization": f"Bearer {token}"}
    client.post(f"/api/my/projects/{services['slug']}", headers=H)
    return H


def test_get_progress_empty(client, services):
    H = _register_and_pull(client, services, "prog_empty")
    r = client.get(f"/api/my/progress/{services['slug']}", headers=H)
    assert r.status_code == 200
    assert r.json() == {"last_module_id": None, "last_visited_at": None}


def test_put_progress(client, services):
    H = _register_and_pull(client, services, "prog_put")
    r = client.put(f"/api/my/progress/{services['slug']}/M01", headers=H)
    assert r.status_code == 200
    assert r.json()["last_module_id"] == "M01"
    r2 = client.get(f"/api/my/progress/{services['slug']}", headers=H)
    assert r2.json()["last_module_id"] == "M01"


def test_put_progress_upserts(client, services):
    H = _register_and_pull(client, services, "prog_upsert")
    client.put(f"/api/my/progress/{services['slug']}/M01", headers=H)
    client.put(f"/api/my/progress/{services['slug']}/M02", headers=H)
    r = client.get(f"/api/my/progress/{services['slug']}", headers=H)
    assert r.json()["last_module_id"] == "M02"


def test_put_progress_requires_pull(client, services):
    """未 Pull 的 slug 不应能写进度。"""
    r = client.post(
        "/api/auth/register", json={"username": "prog_unpulled", "password": "passw0rd"}
    )
    token = r.json()["token"]
    H = {"Authorization": f"Bearer {token}"}
    r = client.put(f"/api/my/progress/{services['slug']}/M01", headers=H)
    assert r.status_code == 403


def test_remove_clears_progress(client, services):
    """卸载项目即清学习进度 (卸载 = 彻底移除)."""
    H = _register_and_pull(client, services, "prog_cleared_on_remove")
    client.put(f"/api/my/progress/{services['slug']}/M01", headers=H)
    # 卸载后读进度应为空
    client.delete(f"/api/my/projects/{services['slug']}", headers=H)
    r = client.get(f"/api/my/progress/{services['slug']}", headers=H)
    assert r.json()["last_module_id"] is None


def test_repull_after_remove_starts_fresh(client, services):
    """卸载后再 Pull, 进度从零开始 (旧 last_module_id 不复活)."""
    H = _register_and_pull(client, services, "prog_fresh_repull")
    client.put(f"/api/my/progress/{services['slug']}/M05", headers=H)
    client.delete(f"/api/my/projects/{services['slug']}", headers=H)
    client.post(f"/api/my/projects/{services['slug']}", headers=H)
    r = client.get(f"/api/my/progress/{services['slug']}", headers=H)
    assert r.json()["last_module_id"] is None


def test_progress_per_user(client, services):
    """两个用户的进度互不干扰."""
    H1 = _register_and_pull(client, services, "prog_a")
    H2 = _register_and_pull(client, services, "prog_b")
    client.put(f"/api/my/progress/{services['slug']}/M01", headers=H1)
    client.put(f"/api/my/progress/{services['slug']}/M02", headers=H2)
    assert (
        client.get(f"/api/my/progress/{services['slug']}", headers=H1).json()[
            "last_module_id"
        ]
        == "M01"
    )
    assert (
        client.get(f"/api/my/progress/{services['slug']}", headers=H2).json()[
            "last_module_id"
        ]
        == "M02"
    )


def test_list_shows_last_module(client, services):
    """`/api/my/projects` 列表应反映 last_module_id。"""
    H = _register_and_pull(client, services, "prog_list_show")
    client.put(f"/api/my/progress/{services['slug']}/M02", headers=H)
    items = client.get("/api/my/projects", headers=H).json()
    assert items[0]["last_module_id"] == "M02"
