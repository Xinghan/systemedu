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


def test_remove_no_filesystem_touch(client, services):
    """cloud 版本: remove 软删关联 + 清进度, 返回体不含 local_cleaned 字段."""
    token = _register(client, "cat_rm_nofs")
    H = {"Authorization": f"Bearer {token}"}
    client.post(f"/api/my/projects/{services['slug']}", headers=H)
    client.put(f"/api/my/progress/{services['slug']}/M01", headers=H)
    r = client.delete(f"/api/my/projects/{services['slug']}", headers=H)
    assert r.status_code == 200
    body = r.json()
    assert body["removed"] is True
    assert "local_cleaned" not in body
    # remove 同步清进度 (delete_last_visited)
    prog = client.get(f"/api/my/progress/{services['slug']}", headers=H)
    assert prog.json()["last_module_id"] is None


def test_knode_proxy_when_pulled(client, services):
    """已 pull: /api/my/projects/{slug}/knodes/{id} 实时代理 library 内容."""
    token = _register(client, "cat_knode_ok")
    H = {"Authorization": f"Bearer {token}"}
    client.post(f"/api/my/projects/{services['slug']}", headers=H)
    r = client.get(f"/api/my/projects/{services['slug']}/knodes/M01", headers=H)
    assert r.status_code == 200
    body = r.json()
    assert body["knode_id"] == "M01"
    assert body["project_slug"] == services["slug"]
    # library 测试项目 M01 lesson.md 含 "M01 Intro"
    assert "M01 Intro" in body["plan_markdown"]


def test_knode_403_when_not_pulled(client, services):
    """未 pull: knode 返回 403."""
    token = _register(client, "cat_knode_403")
    H = {"Authorization": f"Bearer {token}"}
    r = client.get(f"/api/my/projects/{services['slug']}/knodes/M01", headers=H)
    assert r.status_code == 403


def test_knode_404_when_invalid_id(client, services):
    """已 pull 但 knode_id 不存在: library 404 转成 knode_not_found 404."""
    token = _register(client, "cat_knode_404")
    H = {"Authorization": f"Bearer {token}"}
    client.post(f"/api/my/projects/{services['slug']}", headers=H)
    r = client.get(f"/api/my/projects/{services['slug']}/knodes/M99", headers=H)
    assert r.status_code == 404


def test_file_proxy_when_pulled(client, services):
    """已 pull: /api/my/projects/{slug}/files/{path} 流式代理 library 文件."""
    token = _register(client, "cat_file_ok")
    H = {"Authorization": f"Bearer {token}"}
    client.post(f"/api/my/projects/{services['slug']}", headers=H)
    r = client.get(
        f"/api/my/projects/{services['slug']}/files/knodes/M01-w1-intro/lesson.md",
        headers=H,
    )
    assert r.status_code == 200
    assert "M01 Intro" in r.text


def test_file_403_when_not_pulled(client, services):
    """未 pull: file 返回 403."""
    token = _register(client, "cat_file_403")
    H = {"Authorization": f"Bearer {token}"}
    r = client.get(
        f"/api/my/projects/{services['slug']}/files/knodes/M01-w1-intro/lesson.md",
        headers=H,
    )
    assert r.status_code == 403


def test_file_404_when_library_missing(client, services):
    """已 pull 但 library 端文件不存在: 必须传播 404, 不能是 200 + 空 body.

    回归: 修复前 _stream 在上游非 200 时直接 return, StreamingResponse 已以
    200 发出, 客户端拿到 200 空 body, 无法区分"文件不存在"和"文件正常但空"。
    """
    token = _register(client, "cat_file_404")
    H = {"Authorization": f"Bearer {token}"}
    client.post(f"/api/my/projects/{services['slug']}", headers=H)
    r = client.get(
        f"/api/my/projects/{services['slug']}/files/knodes/M01-w1-intro/does-not-exist.html",
        headers=H,
    )
    assert r.status_code == 404
    assert r.json()["error"] == "file_not_found"
