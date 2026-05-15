"""library_proxy 测试 — /api/library/*."""

from __future__ import annotations


def _register(client, username):
    r = client.post(
        "/api/auth/register", json={"username": username, "password": "passw0rd"}
    )
    return r.json()["token"]


def test_library_list_public(client, services):
    r = client.get("/api/library/projects")
    assert r.status_code == 200
    projects = r.json()
    assert any(p["slug"] == services["slug"] for p in projects)


def test_library_get_public(client, services):
    r = client.get(f"/api/library/projects/{services['slug']}")
    assert r.status_code == 200
    assert r.json()["slug"] == services["slug"]


def test_library_tree_public(client, services):
    r = client.get(f"/api/library/projects/{services['slug']}/tree")
    assert r.status_code == 200
    tree = r.json()
    assert tree["schema_version"] == "5.0"


def test_library_blueprint_public(client, services):
    r = client.get(f"/api/library/projects/{services['slug']}/blueprint")
    assert r.status_code == 200
    assert "027 测试项目" in r.json()["content"]


def test_knode_unauthenticated_401(client, services):
    r = client.get(f"/api/library/projects/{services['slug']}/knodes/M01")
    assert r.status_code == 401


def test_knode_unpulled_403(client, services):
    token = _register(client, "lp_eve")
    r = client.get(
        f"/api/library/projects/{services['slug']}/knodes/M01",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403
    assert r.json()["error"] == "pull_required"


def test_knode_pulled_200(client, services):
    token = _register(client, "lp_frank")
    H = {"Authorization": f"Bearer {token}"}
    r = client.post(f"/api/my/projects/{services['slug']}", headers=H)
    assert r.status_code == 201
    r2 = client.get(
        f"/api/library/projects/{services['slug']}/knodes/M01", headers=H
    )
    assert r2.status_code == 200
    assert r2.json()["plan_markdown"].startswith("# M01 Intro")


def test_file_pulled_200(client, services):
    token = _register(client, "lp_grace")
    H = {"Authorization": f"Bearer {token}"}
    client.post(f"/api/my/projects/{services['slug']}", headers=H)
    r = client.get(
        f"/api/library/projects/{services['slug']}/files/knodes/M01-w1-intro/lesson.md",
        headers=H,
    )
    assert r.status_code == 200
    assert "M01 Intro" in r.text


def test_file_unpulled_403(client, services):
    token = _register(client, "lp_hank")
    H = {"Authorization": f"Bearer {token}"}
    r = client.get(
        f"/api/library/projects/{services['slug']}/files/knodes/M01-w1-intro/lesson.md",
        headers=H,
    )
    assert r.status_code == 403


def test_removed_user_loses_access(client, services):
    """已 Pull 又 remove 后, knodes 应 403。"""
    token = _register(client, "lp_iris")
    H = {"Authorization": f"Bearer {token}"}
    client.post(f"/api/my/projects/{services['slug']}", headers=H)
    client.delete(f"/api/my/projects/{services['slug']}", headers=H)
    r = client.get(
        f"/api/library/projects/{services['slug']}/knodes/M01", headers=H
    )
    assert r.status_code == 403
