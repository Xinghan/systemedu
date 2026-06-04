"""catalog 测试 — /api/my/projects, /api/my/progress."""

from __future__ import annotations


def _register(client, username):
    r = client.post(
        "/api/auth/register", json={"username": username, "password": "passw0rd"}
    )
    return r.json()["token"]


def test_my_projects_empty(client):
    token = _register(client, "cat_empty")
    r = client.get("/api/my/projects", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json() == []


def test_my_projects_requires_login(client):
    r = client.get("/api/my/projects")
    assert r.status_code == 401


def test_pull_creates_row(client, services):
    token = _register(client, "cat_pull")
    H = {"Authorization": f"Bearer {token}"}
    r = client.post(f"/api/my/projects/{services['slug']}", headers=H)
    assert r.status_code == 201
    body = r.json()
    assert body["slug"] == services["slug"]
    assert body["created"] is True
    assert body["unavailable"] is False
    assert body["title_zh"] == "027 测试项目"


def test_pull_existing_unremoves(client, services):
    """第二次 Pull 同 slug → 201/200 都行, 但 created=False 且 removed_at=None。"""
    token = _register(client, "cat_re_pull")
    H = {"Authorization": f"Bearer {token}"}
    client.post(f"/api/my/projects/{services['slug']}", headers=H)
    client.delete(f"/api/my/projects/{services['slug']}", headers=H)
    r2 = client.post(f"/api/my/projects/{services['slug']}", headers=H)
    assert r2.status_code in (200, 201)
    body = r2.json()
    assert body["created"] is False
    assert body["removed_at"] is None


def test_list_includes_library_metadata(client, services):
    token = _register(client, "cat_list_meta")
    H = {"Authorization": f"Bearer {token}"}
    client.post(f"/api/my/projects/{services['slug']}", headers=H)
    r = client.get("/api/my/projects", headers=H)
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 1
    item = items[0]
    assert item["slug"] == services["slug"]
    assert item["title_zh"] == "027 测试项目"
    assert item["knode_count"] == 2
    assert item["last_module_id"] is None


def test_remove_soft_deletes(client, services):
    token = _register(client, "cat_remove")
    H = {"Authorization": f"Bearer {token}"}
    client.post(f"/api/my/projects/{services['slug']}", headers=H)
    r = client.delete(f"/api/my/projects/{services['slug']}", headers=H)
    assert r.status_code == 200
    assert r.json()["removed"] is True
    # 列表应为空 (默认不含 removed)
    r2 = client.get("/api/my/projects", headers=H)
    assert r2.json() == []


def test_remove_unowned_idempotent(client, services):
    """移除一个未 Pull 的 slug → 200 + removed=False (idempotent)."""
    token = _register(client, "cat_rm_unowned")
    H = {"Authorization": f"Bearer {token}"}
    r = client.delete(f"/api/my/projects/{services['slug']}", headers=H)
    assert r.status_code == 200
    assert r.json()["removed"] is False


def test_pull_nonexistent_project_404(client):
    token = _register(client, "cat_404")
    H = {"Authorization": f"Bearer {token}"}
    r = client.post("/api/my/projects/does-not-exist", headers=H)
    assert r.status_code == 404


def test_pull_creates_no_local_dir(client, services):
    """cloud 版本 (spec 037): Pull 只在 DB 记一行关联, 响应体不含任何本地落盘字段。"""
    token = _register(client, "pull_no_disk")
    H = {"Authorization": f"Bearer {token}"}
    resp = client.post(f"/api/my/projects/{services['slug']}", headers=H)
    assert resp.status_code == 201
    body = resp.json()
    # 关联行已建
    assert body["created"] is True
    assert body["slug"] == services["slug"]
    # 不再有任何本地落盘相关字段
    assert "cloned" not in body
    assert "cloned_version" not in body
    assert "local_path" not in body
