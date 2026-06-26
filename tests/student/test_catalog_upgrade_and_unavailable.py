"""T8 — student-app 升版检测 + library 不可用降级 (catalog list).

覆盖 catalog/routes.py L86-111 的两条分支:
- 升版检测: UserProject.library_version 与 library 当前 version 不同 → 列表项
  含 upgrade_available=True; 一致时不含该键。
- library 不可用降级: UserProject 行指向一个 library 中不存在的 slug → 列表项
  unavailable=True + 占位字段 (title=slug, knode_count=0), 整个列表不 500。

范式同 conftest._make_token_for: 直连子进程共享的 SQLite 文件改/插行
(绝不真发短信, 经 make_token 直建号签 JWT 等价已登录)。
"""

from __future__ import annotations

import hashlib

from sqlalchemy import create_engine, update
from sqlalchemy.orm import Session

from systemedu.student.db import UserProject, User


def _phone_for(name: str) -> str:
    """把测试用的 name 稳定映射成唯一虚拟手机号 (138 + 8 位)。"""
    digits = int(hashlib.sha1(name.encode()).hexdigest(), 16) % 10**8
    return f"138{digits:08d}"


def _register(make_token, name: str) -> str:
    return make_token(_phone_for(name))


def _user_id_for(services: dict, phone: str) -> str:
    """读子进程 SQLite 里该手机号用户的 id (make_token 已建好该号)。"""
    engine = create_engine(f"sqlite:///{services['db_path']}")
    try:
        with Session(engine) as session:
            row = session.execute(
                User.__table__.select().where(User.phone == phone)
            ).first()
            assert row is not None, f"user {phone} 未建, make_token 应已建号"
            return row.id
    finally:
        engine.dispose()


def _set_user_project_version(services: dict, user_id: str, slug: str, version: str) -> None:
    """直写子进程共享 SQLite: 把该用户该 slug 的 library_version 改成 version。"""
    engine = create_engine(f"sqlite:///{services['db_path']}")
    try:
        with Session(engine) as session:
            result = session.execute(
                update(UserProject)
                .where(UserProject.user_id == user_id)
                .where(UserProject.library_slug == slug)
                .values(library_version=version)
            )
            assert result.rowcount == 1, "应正好命中一行 UserProject"
            session.commit()
    finally:
        engine.dispose()


def _insert_orphan_user_project(services: dict, user_id: str, slug: str) -> None:
    """为用户插一行指向 library 中不存在 slug 的 UserProject (孤儿关联)。"""
    engine = create_engine(f"sqlite:///{services['db_path']}")
    try:
        with Session(engine) as session:
            session.add(
                UserProject(
                    user_id=user_id,
                    library_slug=slug,
                    library_version="9.9.9",
                )
            )
            session.commit()
    finally:
        engine.dispose()


def _find_item(items: list[dict], slug: str) -> dict:
    matches = [it for it in items if it["slug"] == slug]
    assert len(matches) == 1, f"列表中应正好有一项 slug={slug}, 实得 {len(matches)}"
    return matches[0]


def test_list_upgrade_available_when_version_differs(client, services, make_token):
    """pull 后把 UserProject.library_version 改成旧值 → 该项 upgrade_available=True."""
    phone = _phone_for("upg_diff")
    token = make_token(phone)
    H = {"Authorization": f"Bearer {token}"}
    slug = services["slug"]

    # pull, 此时 library_version = library 当前 version
    r = client.post(f"/api/my/projects/{slug}", headers=H)
    assert r.status_code == 201
    current_version = r.json()["library_version"]
    assert current_version, "library meta 应有非空 version"

    # 直写 DB: 模拟用户停留在旧版 (与 library 当前 version 不同)
    user_id = _user_id_for(services, phone)
    _set_user_project_version(services, user_id, slug, "0.0.1-old")

    r = client.get("/api/my/projects", headers=H)
    assert r.status_code == 200
    item = _find_item(r.json(), slug)
    assert item["upgrade_available"] is True
    # library_version 字段返回的是 library 当前版本 (来自 meta), 不是用户停留的旧版
    assert item["library_version"] == current_version
    assert item["unavailable"] is False


def test_list_no_upgrade_when_version_matches(client, services, make_token):
    """version 一致时 → 响应不含 upgrade_available (或 False)."""
    phone = _phone_for("upg_match")
    token = make_token(phone)
    H = {"Authorization": f"Bearer {token}"}
    slug = services["slug"]

    # pull 后 library_version 即与 library 当前 version 一致, 不改 DB
    r = client.post(f"/api/my/projects/{slug}", headers=H)
    assert r.status_code == 201

    r = client.get("/api/my/projects", headers=H)
    assert r.status_code == 200
    item = _find_item(r.json(), slug)
    # 一致时源码不写入该键; 若将来改成显式 False 也接受
    assert item.get("upgrade_available", False) is False
    assert item["unavailable"] is False


def test_list_unavailable_orphan_slug(client, services, make_token):
    """插一个 library 中不存在 slug 的 UserProject → unavailable=True + 占位, 不 500."""
    phone = _phone_for("orphan_slug")
    token = make_token(phone)
    H = {"Authorization": f"Bearer {token}"}
    orphan_slug = "this-slug-does-not-exist-in-library"

    user_id = _user_id_for(services, phone)
    _insert_orphan_user_project(services, user_id, orphan_slug)

    r = client.get("/api/my/projects", headers=H)
    # 整个 list 不能 500, library 拉不到该 slug 元数据应被降级吞掉
    assert r.status_code == 200
    item = _find_item(r.json(), orphan_slug)
    assert item["unavailable"] is True
    # 占位字段: title 回落成 slug 本身, 计数清零
    assert item["title"] == orphan_slug
    assert item["title_zh"] is None
    assert item["knode_count"] == 0
    assert item["stage_count"] == 0
    # 不应误标升版 (meta 缺失分支不写 upgrade_available)
    assert item.get("upgrade_available", False) is False


def test_list_mixes_available_and_unavailable(client, services, make_token):
    """同一用户同时持有正常项目 + 孤儿 slug → 两项都返回, 各自标记正确, 不 500."""
    phone = _phone_for("mixed_avail")
    token = make_token(phone)
    H = {"Authorization": f"Bearer {token}"}
    good_slug = services["slug"]
    orphan_slug = "another-missing-slug"

    r = client.post(f"/api/my/projects/{good_slug}", headers=H)
    assert r.status_code == 201

    user_id = _user_id_for(services, phone)
    _insert_orphan_user_project(services, user_id, orphan_slug)

    r = client.get("/api/my/projects", headers=H)
    assert r.status_code == 200
    items = r.json()
    good = _find_item(items, good_slug)
    orphan = _find_item(items, orphan_slug)
    assert good["unavailable"] is False
    assert good["knode_count"] == 2
    assert orphan["unavailable"] is True
    assert orphan["knode_count"] == 0
