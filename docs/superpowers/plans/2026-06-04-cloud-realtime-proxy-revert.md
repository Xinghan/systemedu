# Cloud 实时代理回退 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 student-app catalog 的项目 pull 从「本地落盘 (spec 033)」回退成纯 cloud 无状态实时代理 library-app，并把前端卡片改成真封面。

**Architecture:** pull 只在 PostgreSQL 记一行 `user_projects` 关联；学习时 knode/file 通过 `get_library_client()` 实时转发 library `/v1` 端点 (复用 `library_proxy/routes.py` 已验证的代理模式)；删除 `catalog/storage.py`；`db.py` 三列保留但 `upsert_user_project` 停止写入。前端 my-projects + dashboard 复用 `/library` 页的 `CoverPhoto` 真封面 + onError 降级 `CoverArt`。

**Tech Stack:** Python 3.12 / Starlette / SQLAlchemy / httpx (后端)；Next.js 16 / React / TypeScript (前端)；pytest + 真 subprocess `services` fixture (测试)。

**测试策略说明:** 本仓 `tests/student/conftest.py` 的 `services` fixture 已经起**真** library-app + student-app 两个 subprocess + 导入一个 published 测试项目。这比 mock library client 更强：它真实跑通 student→library 的 HTTP 代理往返。因此本计划**沿用 `services` fixture**（不引入 mock），并新增"服务端文件系统无 per-user 写入"断言来锁定无状态语义。

---

## File Structure

| 文件 | 职责 | 动作 |
|---|---|---|
| `packages/student-app/src/systemedu/student/catalog/routes.py` | /api/my/* 路由 | 重写 pull/remove/knode/file 四端点为无状态代理 |
| `packages/student-app/src/systemedu/student/catalog/storage.py` | 本地磁盘落盘逻辑 | **删除整文件** |
| `packages/student-app/src/systemedu/student/db.py` | DB schema + 助手 | `upsert_user_project` 去掉 3 个 cloned_* 参数 (列保留) |
| `tests/student/test_catalog.py` | catalog 端点测试 | 扩展: 无落盘 / knode 代理 / file 代理 / 403 |
| `tests/student/test_progress.py` | 进度测试 | 已有, 跑通确认不回归 |
| `packages/student-web/src/app/(home)/my-projects/page.tsx` | 我的项目页 | ForkCard 用 CoverPhoto 真封面 |
| `packages/student-web/src/app/(home)/home/page.tsx` | dashboard | active 卡片加真封面 banner |
| `CLAUDE.md` / `docs/prd.md` / 设计稿 / `specs/033` | 文档 | 清理"本地优先"残留 |

---

## Task 1: db.py — upsert_user_project 停止写 cloned_* 三列

**Files:**
- Modify: `packages/student-app/src/systemedu/student/db.py:475-522`

- [ ] **Step 1: 改 upsert_user_project 签名与函数体**

把 `packages/student-app/src/systemedu/student/db.py` 第 475-522 行整段替换为 (去掉 `cloned_version` / `local_path` / `cloned_at` 三个 keyword 参数, INSERT/UPDATE 不再设置它们; 列在表定义里保留不动):

```python
def upsert_user_project(
    user_id: str,
    library_slug: str,
    library_version: str | None = None,
) -> tuple[UserProject, bool]:
    """Pull: 如果存在 (即便 removed) 则 removed_at=NULL + 刷 version; 否则新建.

    cloud 版本 (spec 037): pull 仅记一行关联, 不落盘, 不写 cloned_* 列。
    cloned_version / local_path / cloned_at 列保留在表里但不再写入 (无 migration)。

    Returns: (project, created) — created=True 表示是新行。
    """
    with get_session() as session:
        existing = session.execute(
            select(UserProject).where(
                UserProject.user_id == user_id,
                UserProject.library_slug == library_slug,
            )
        ).scalar_one_or_none()
        if existing is not None:
            existing.removed_at = None
            if library_version:
                existing.library_version = library_version
            existing.pulled_at = datetime.utcnow()
            session.commit()
            session.refresh(existing)
            return _detach_user_project(existing), False  # type: ignore[return-value]
        p = UserProject(
            user_id=user_id,
            library_slug=library_slug,
            library_version=library_version,
        )
        session.add(p)
        session.commit()
        session.refresh(p)
        return _detach_user_project(p), True  # type: ignore[return-value]
```

- [ ] **Step 2: 确认无其它调用方还传 cloned_* 参数**

Run:
```bash
cd /Users/xinghan/Dev/systemedu && grep -rn "cloned_version=\|local_path=\|cloned_at=" packages/student-app/src/
```
Expected: 唯一命中应只剩 `catalog/routes.py` 里 (Task 2 会一并删除)。若还有别处, 记下来在 Task 2 处理。

- [ ] **Step 3: 跑 import 冒烟, 确认无语法错**

Run:
```bash
cd /Users/xinghan/Dev/systemedu && source .venv/bin/activate && python -c "from systemedu.student.db import upsert_user_project; import inspect; print(list(inspect.signature(upsert_user_project).parameters))"
```
Expected: `['user_id', 'library_slug', 'library_version']` (无 cloned_* )

- [ ] **Step 4: Commit**

```bash
cd /Users/xinghan/Dev/systemedu && git add packages/student-app/src/systemedu/student/db.py
git commit -m "$(cat <<'EOF'
refactor(spec-037): upsert_user_project 停止写 cloned_* 三列

cloud 版本 pull 仅记关联行, 不落盘。列保留在表 (无 migration) 但不再写入。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: catalog/routes.py — pull 改为只记 DB 关联行

**Files:**
- Modify: `packages/student-app/src/systemedu/student/catalog/routes.py:138-218` (pull)
- Modify: `packages/student-app/src/systemedu/student/catalog/routes.py:44-49` (去掉 storage import)

- [ ] **Step 1: 写失败测试 — pull 只建 DB 行, 不建任何本地目录**

在 `tests/student/test_catalog.py` 末尾追加:

```python
def test_pull_creates_no_local_dir(client, services):
    """cloud 版本: pull 不落盘 — 响应体不含 cloned/local_path 落盘字段."""
    token = _register(client, "cat_no_disk")
    H = {"Authorization": f"Bearer {token}"}
    r = client.post(f"/api/my/projects/{services['slug']}", headers=H)
    assert r.status_code == 201
    body = r.json()
    # 旧 spec 033 落盘版返回 cloned=True / cloned_version / local_path;
    # cloud 版本只记关联行, 这些字段必须全部消失。
    assert "cloned" not in body
    assert "cloned_version" not in body
    assert "local_path" not in body
    # 关联行仍在 (created=True)
    assert body["created"] is True
```

> **落盘 root 说明:** spec 033 的 `storage.py` 把文件写到 `STUDENT_USER_DATA_ROOT` (env, 测试未设) 或 `~/.systemedu/student/users` (测试 runner 真 HOME)。`services` fixture 不隔离该路径, 所以无法可靠地用文件系统断言"无落盘"。改用**响应体契约**断言 (cloned/local_path 字段消失) 作为无落盘的代理信号 — pull 代码路径里已无任何 `storage.py` 调用 (Task 2 删了 import), 字段消失即证明走的是新路径。Task 6 删文件后 grep 双保险。

- [ ] **Step 2: 跑测试确认失败**

Run:
```bash
cd /Users/xinghan/Dev/systemedu && source .venv/bin/activate && python -m pytest tests/student/test_catalog.py::test_pull_creates_no_local_dir -v
```
Expected: FAIL — 当前 pull 仍落盘, `leaked` 非空 (或 body 含 `cloned`)。

- [ ] **Step 3: 删除 storage import**

把 `packages/student-app/src/systemedu/student/catalog/routes.py` 第 44-49 行:

```python
from ..library_proxy.client import get_library_client
from .storage import (
    cleanup_local_project,
    extract_tarball_safely,
    project_local_dir,
)
```

替换为:

```python
from ..library_proxy.client import get_library_client
```

- [ ] **Step 4: 重写 api_my_projects_pull**

把第 138-218 行整个 `api_my_projects_pull` 函数替换为:

```python
async def api_my_projects_pull(request: Request) -> JSONResponse:
    """cloud 版本 (spec 037): Pull = 只在 DB 记一行关联, 不下载/解压任何文件."""
    slug = request.path_params["slug"]
    user_id, err = await require_login(request)
    if err:
        return err
    try:
        meta = await get_library_client().get_project(slug)
    except LibraryNotFound:
        return JSONResponse({"error": "project_not_found"}, status_code=404)
    except Exception as e:
        return _lib_error_response(e)

    target_version = meta.version or ""
    project, created = upsert_user_project(
        user_id, slug, library_version=target_version
    )
    lv = get_last_visited(user_id, slug)
    body = _project_to_dict(project, meta, lv.last_module_id if lv else None)
    body["created"] = created
    return JSONResponse(body, status_code=201 if created else 200)
```

- [ ] **Step 5: 清理现在不再用的 import**

`shutil` / `datetime` / `Path` 可能在 pull 删除后不再被其它函数引用 (knode/file 在 Task 4/5 也会去掉)。先不删 import (避免误删 knode/file 仍在用的), 等 Task 5 完成后 Task 6 统一清理。本步只确认编译通过:

Run:
```bash
cd /Users/xinghan/Dev/systemedu && source .venv/bin/activate && python -c "import systemedu.student.catalog.routes"
```
Expected: 无 ImportError (注意: 此时 `from .storage import` 已删, 但 knode/file 仍引用 `Path` 等, 所以不会报)。

- [ ] **Step 6: 跑测试确认通过**

Run:
```bash
cd /Users/xinghan/Dev/systemedu && source .venv/bin/activate && python -m pytest tests/student/test_catalog.py::test_pull_creates_no_local_dir tests/student/test_catalog.py::test_pull_creates_row tests/student/test_catalog.py::test_pull_existing_unremoves -v
```
Expected: 全 PASS (`test_pull_creates_row` 仍要求 status 201 + created True + title_zh, 新 pull 逻辑满足)。

- [ ] **Step 7: Commit**

```bash
cd /Users/xinghan/Dev/systemedu && git add packages/student-app/src/systemedu/student/catalog/routes.py tests/student/test_catalog.py
git commit -m "$(cat <<'EOF'
refactor(spec-037): pull 改为只记 DB 关联行 (不再落盘 tarball)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: catalog/routes.py — remove 去掉本地清理

**Files:**
- Modify: `packages/student-app/src/systemedu/student/catalog/routes.py:221-236` (remove)

- [ ] **Step 1: 写失败测试 — remove 后立即可 re-pull, 且返回不含 local_cleaned**

在 `tests/student/test_catalog.py` 末尾追加:

```python
def test_remove_no_filesystem_touch(client, services):
    """cloud 版本: remove 软删关联, 返回体不含 local_cleaned 字段."""
    token = _register(client, "cat_rm_nofs")
    H = {"Authorization": f"Bearer {token}"}
    client.post(f"/api/my/projects/{services['slug']}", headers=H)
    r = client.delete(f"/api/my/projects/{services['slug']}", headers=H)
    assert r.status_code == 200
    body = r.json()
    assert body["removed"] is True
    assert "local_cleaned" not in body
```

- [ ] **Step 2: 跑测试确认失败**

Run:
```bash
cd /Users/xinghan/Dev/systemedu && source .venv/bin/activate && python -m pytest tests/student/test_catalog.py::test_remove_no_filesystem_touch -v
```
Expected: FAIL — 当前 remove 返回体含 `local_cleaned`。

- [ ] **Step 3: 重写 api_my_projects_remove**

把第 221-236 行整个 `api_my_projects_remove` 函数替换为:

```python
async def api_my_projects_remove(request: Request) -> JSONResponse:
    slug = request.path_params["slug"]
    user_id, err = await require_login(request)
    if err:
        return err
    existed = soft_remove_user_project(user_id, slug)
    # cloud 版本: 无本地文件可清; 仅同步清学习进度, 避免"卸载->重新 pull"后
    # 旧 last_module_id 复活。
    delete_last_visited(user_id, slug)
    return JSONResponse({"removed": existed}, status_code=200)
```

- [ ] **Step 4: 跑测试确认通过 (含已有 remove + progress 测试不回归)**

Run:
```bash
cd /Users/xinghan/Dev/systemedu && source .venv/bin/activate && python -m pytest tests/student/test_catalog.py::test_remove_no_filesystem_touch tests/student/test_catalog.py::test_remove_soft_deletes tests/student/test_catalog.py::test_remove_unowned_idempotent tests/student/test_progress.py -v
```
Expected: 全 PASS。注意 `test_remove_unowned_idempotent` 现在 `existed=False` → `{"removed": False}` 仍满足断言。

- [ ] **Step 5: Commit**

```bash
cd /Users/xinghan/Dev/systemedu && git add packages/student-app/src/systemedu/student/catalog/routes.py tests/student/test_catalog.py
git commit -m "$(cat <<'EOF'
refactor(spec-037): remove 去掉本地目录清理, 仅软删关联+清进度

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: catalog/routes.py — knode 改为实时代理 library

**Files:**
- Modify: `packages/student-app/src/systemedu/student/catalog/routes.py:270-390` (knode)

**关键设计点:** library `/v1/projects/{slug}/knodes/{id}` 返回的 `rendered_sections` 是**原样**存储 (importer 未做 html_path 回填)。spec 033 catalog 端点曾在读本地时做 `idea.{mode}_path` → `rendered_sections[id].html_path` 回填, 前端 `inlineHtmlPaths()` 依赖它。代理后必须**保留这段回填**, 否则 anim/game HTML 找不到。

- [ ] **Step 1: 写失败测试 — 已 pull 时 knode 实时返回 library 内容; 未 pull 403**

在 `tests/student/test_catalog.py` 末尾追加:

```python
def test_knode_proxy_when_pulled(client, services):
    """已 pull: /api/my/projects/{slug}/knodes/{id} 实时代理 library 内容."""
    token = _register(client, "cat_knode_ok")
    H = {"Authorization": f"Bearer {token}"}
    client.post(f"/api/my/projects/{services['slug']}", headers=H)
    r = client.get(
        f"/api/my/projects/{services['slug']}/knodes/M01", headers=H
    )
    assert r.status_code == 200
    body = r.json()
    assert body["knode_id"] == "M01"
    assert body["project_slug"] == services["slug"]
    # library 测试项目 M01 lesson.md 含 "M01 Intro"
    assert "M01 Intro" in body["plan_markdown"]


def test_knode_403_when_not_pulled(client, services):
    """未 pull: knode 返回 403."""
    r = client.post(
        "/api/auth/register",
        json={"username": "cat_knode_403", "password": "passw0rd"},
    )
    token = r.json()["token"]
    H = {"Authorization": f"Bearer {token}"}
    r = client.get(
        f"/api/my/projects/{services['slug']}/knodes/M01", headers=H
    )
    assert r.status_code == 403
```

- [ ] **Step 2: 跑测试确认失败**

Run:
```bash
cd /Users/xinghan/Dev/systemedu && source .venv/bin/activate && python -m pytest tests/student/test_catalog.py::test_knode_proxy_when_pulled tests/student/test_catalog.py::test_knode_403_when_not_pulled -v
```
Expected: FAIL — 当前 knode 走本地读, 已 pull 但无本地目录会返回 409 `needs_reclone` (不是 200)。

- [ ] **Step 3: 重写 api_my_project_knode (含 html_path 回填)**

把第 270-390 行整个 `api_my_project_knode` 函数替换为:

```python
def _backfill_section_html_paths(rendered_sections) -> None:
    """spec 033 起的兼容: 把 idea.{mode}_path 回填到 rendered_sections[id].html_path,
    让前端 inlineHtmlPaths() 能找到 HTML 文件。原地修改 dict。

    library /v1 返回 sections.json 原样, 不含 html_path, 所以代理后在这里补。
    """
    if not isinstance(rendered_sections, dict):
        return
    rendered = rendered_sections.get("rendered_sections") or {}
    if not isinstance(rendered, dict):
        return
    for idea in rendered_sections.get("ideas", []) or []:
        if not isinstance(idea, dict):
            continue
        idea_id = idea.get("idea_id")
        mode = idea.get("mode")
        if not idea_id or not mode:
            continue
        path = idea.get(f"{mode}_path")
        section = rendered.get(idea_id)
        if (
            path
            and isinstance(section, dict)
            and not section.get("html_path")
            and not section.get("html")
        ):
            section["html_path"] = path


async def api_my_project_knode(request: Request) -> JSONResponse:
    """cloud 版本 (spec 037): 学习时实时代理 library /v1 knode, 不再读本地."""
    slug = request.path_params["slug"]
    knode_id = request.path_params["knode_id"]
    user_id, err = await require_login(request)
    if err:
        return err

    up = get_user_project(user_id, slug)
    if up is None or up.removed_at is not None:
        return JSONResponse({"error": "not_pulled", "slug": slug}, status_code=403)

    try:
        k = await get_library_client().get_knode(slug, knode_id)
    except LibraryNotFound:
        return JSONResponse(
            {"error": "knode_not_found", "knode_id": knode_id}, status_code=404
        )
    except Exception as e:
        return _lib_error_response(e)

    data = dict(k.__dict__)
    _backfill_section_html_paths(data.get("rendered_sections"))
    return JSONResponse(data)
```

- [ ] **Step 4: 跑测试确认通过**

Run:
```bash
cd /Users/xinghan/Dev/systemedu && source .venv/bin/activate && python -m pytest tests/student/test_catalog.py::test_knode_proxy_when_pulled tests/student/test_catalog.py::test_knode_403_when_not_pulled -v
```
Expected: 全 PASS。

- [ ] **Step 5: Commit**

```bash
cd /Users/xinghan/Dev/systemedu && git add packages/student-app/src/systemedu/student/catalog/routes.py tests/student/test_catalog.py
git commit -m "$(cat <<'EOF'
refactor(spec-037): knode 改为实时代理 library /v1 (保留 html_path 回填)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: catalog/routes.py — file 改为流式代理 library

**Files:**
- Modify: `packages/student-app/src/systemedu/student/catalog/routes.py:393-427` (file)
- Modify: import 区 (改用 StreamingResponse + os + httpx)

- [ ] **Step 1: 写失败测试 — 已 pull 时 file 流式返回; 未 pull 403**

在 `tests/student/test_catalog.py` 末尾追加:

```python
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
    r = client.post(
        "/api/auth/register",
        json={"username": "cat_file_403", "password": "passw0rd"},
    )
    token = r.json()["token"]
    H = {"Authorization": f"Bearer {token}"}
    r = client.get(
        f"/api/my/projects/{services['slug']}/files/knodes/M01-w1-intro/lesson.md",
        headers=H,
    )
    assert r.status_code == 403
```

- [ ] **Step 2: 跑测试确认失败**

Run:
```bash
cd /Users/xinghan/Dev/systemedu && source .venv/bin/activate && python -m pytest tests/student/test_catalog.py::test_file_proxy_when_pulled tests/student/test_catalog.py::test_file_403_when_not_pulled -v
```
Expected: FAIL — 当前 file 走本地读, 已 pull 但无本地目录返回 409/410。

- [ ] **Step 3: 重写 api_my_project_file (复制 library_proxy 流式转发)**

把第 393-427 行整个 `api_my_project_file` 函数替换为:

```python
async def api_my_project_file(request: Request):
    """cloud 版本 (spec 037): 流式代理 library /v1 媒体文件, 不再读本地."""
    slug = request.path_params["slug"]
    file_path = request.path_params["path"]
    user_id, err = await require_login(request)
    if err:
        return err

    up = get_user_project(user_id, slug)
    if up is None or up.removed_at is not None:
        return JSONResponse({"error": "not_pulled", "slug": slug}, status_code=403)

    url = get_library_client().get_file_url(slug, file_path)
    license_token = os.environ.get(
        "LIBRARY_LICENSE_TOKEN", "dev-only-license-token-change-me"
    )
    base_url = os.environ.get("LIBRARY_BASE_URL") or os.environ.get(
        "LIBRARY_URL", "http://127.0.0.1:18821"
    )
    trust_env = "127.0.0.1" not in base_url and "localhost" not in base_url

    async def _stream():
        async with httpx.AsyncClient(timeout=60.0, trust_env=trust_env) as client:
            async with client.stream(
                "GET", url, headers={"Authorization": f"Bearer {license_token}"}
            ) as r:
                if r.status_code != 200:
                    return
                async for chunk in r.aiter_bytes():
                    yield chunk

    ct, _ = mimetypes.guess_type(file_path)
    if not ct:
        ct = "application/octet-stream"
    return StreamingResponse(_stream(), media_type=ct)
```

- [ ] **Step 4: 修 import 区 (顶部)**

把 `packages/student-app/src/systemedu/student/catalog/routes.py` 第 10-24 行的 import 块:

```python
from __future__ import annotations

import asyncio
import json
import logging
import mimetypes
import shutil
from datetime import datetime
from pathlib import Path

from starlette.responses import FileResponse

from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route
```

替换为 (去掉 `json` / `shutil` / `datetime` / `Path` / `FileResponse`, 加 `os` / `httpx` / `StreamingResponse`):

```python
from __future__ import annotations

import asyncio
import logging
import mimetypes
import os

import httpx
from starlette.requests import Request
from starlette.responses import JSONResponse, StreamingResponse
from starlette.routing import Route
```

- [ ] **Step 5: 确认无残留引用 (json/shutil/Path/FileResponse/datetime)**

Run:
```bash
cd /Users/xinghan/Dev/systemedu && grep -n "json\.\|shutil\.\|Path(\|FileResponse\|datetime\." packages/student-app/src/systemedu/student/catalog/routes.py
```
Expected: 无输出 (空)。若有命中, 说明还有旧逻辑残留, 需删除。

- [ ] **Step 6: 跑测试确认通过**

Run:
```bash
cd /Users/xinghan/Dev/systemedu && source .venv/bin/activate && python -m pytest tests/student/test_catalog.py::test_file_proxy_when_pulled tests/student/test_catalog.py::test_file_403_when_not_pulled -v
```
Expected: 全 PASS。

- [ ] **Step 7: Commit**

```bash
cd /Users/xinghan/Dev/systemedu && git add packages/student-app/src/systemedu/student/catalog/routes.py tests/student/test_catalog.py
git commit -m "$(cat <<'EOF'
refactor(spec-037): file 改为流式代理 library /v1, 清理 catalog import

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 删除 catalog/storage.py

**Files:**
- Delete: `packages/student-app/src/systemedu/student/catalog/storage.py`

- [ ] **Step 1: 确认全仓无对 storage 的 import**

Run:
```bash
cd /Users/xinghan/Dev/systemedu && grep -rn "catalog.storage\|from .storage\|from \.\.catalog.storage\|cleanup_local_project\|extract_tarball_safely\|project_local_dir\|project_disk_usage\|user_data_root" packages/ tests/ | grep -v "\.pyc"
```
Expected: 无输出 (空) — Task 2 已删 import。若有命中, 先处理引用再删文件。

- [ ] **Step 2: 删除文件**

Run:
```bash
cd /Users/xinghan/Dev/systemedu && git rm packages/student-app/src/systemedu/student/catalog/storage.py
```
Expected: `rm 'packages/student-app/src/systemedu/student/catalog/storage.py'`

- [ ] **Step 3: 删 storage 自己的测试 (若有)**

Run:
```bash
cd /Users/xinghan/Dev/systemedu && ls tests/student/ | grep -i storage; grep -rln "extract_tarball_safely\|project_local_dir" tests/
```
Expected: 无 storage 专属测试文件 (若有则 `git rm` 它)。

- [ ] **Step 4: 冒烟 import catalog 模块**

Run:
```bash
cd /Users/xinghan/Dev/systemedu && source .venv/bin/activate && python -c "import systemedu.student.catalog.routes; print('ok')"
```
Expected: `ok`

- [ ] **Step 5: 跑整个 catalog + progress 测试套**

Run:
```bash
cd /Users/xinghan/Dev/systemedu && source .venv/bin/activate && python -m pytest tests/student/test_catalog.py tests/student/test_progress.py -v
```
Expected: 全 PASS。

- [ ] **Step 6: Commit**

```bash
cd /Users/xinghan/Dev/systemedu && git add -A packages/student-app/src/systemedu/student/catalog/ tests/student/
git commit -m "$(cat <<'EOF'
refactor(spec-037): 删除 catalog/storage.py 本地落盘逻辑

cloud 版本无 per-user 文件落盘, 全部走实时代理 library。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 前端 my-projects ForkCard 用真封面

**Files:**
- Modify: `packages/student-web/src/app/(home)/my-projects/page.tsx` (import library; 加 CoverPhoto; ForkCard line 444)

- [ ] **Step 1: 加 library import**

把 `packages/student-web/src/app/(home)/my-projects/page.tsx` 第 20 行:

```tsx
import { myProjects, type MyProjectItem } from "@/lib/api"
```

替换为:

```tsx
import { library, myProjects, type MyProjectItem } from "@/lib/api"
```

- [ ] **Step 2: 加 CoverPhoto 局部组件 (放在 CoverArt 定义前, 第 695 行 `function CoverArt` 之上)**

在 `function CoverArt({ kind }: { kind: string }) {` 这一行之前插入:

```tsx
function CoverPhoto({ slug, dClass }: { slug: string; dClass: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <CoverArt kind={dClass} />
  return (
    <div
      style={{
        height: 168,
        position: "relative",
        overflow: "hidden",
        background: "#15110d",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <img
        src={library.coverUrl(slug)}
        alt=""
        onError={() => setFailed(true)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center 48%",
          display: "block",
        }}
      />
    </div>
  )
}

```

- [ ] **Step 3: ForkCard 用条件封面**

把第 444 行:

```tsx
        <CoverArt kind={dClass} />
```

替换为:

```tsx
        {f.cover_image_path ? (
          <CoverPhoto slug={f.slug} dClass={dClass} />
        ) : (
          <CoverArt kind={dClass} />
        )}
```

- [ ] **Step 4: 前端类型检查 + 构建冒烟**

Run:
```bash
cd /Users/xinghan/Dev/systemedu/packages/student-web && npx tsc --noEmit
```
Expected: 无 error (注意 `f.cover_image_path` 是 `MyProjectItem` 上的可选字段, 已存在)。

- [ ] **Step 5: Commit**

```bash
cd /Users/xinghan/Dev/systemedu && git add packages/student-web/src/app/\(home\)/my-projects/page.tsx
git commit -m "$(cat <<'EOF'
feat(spec-037): my-projects 卡片用作者真封面 (onError 降级 domain SVG)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 前端 dashboard active 卡片加真封面 banner

**Files:**
- Modify: `packages/student-web/src/app/(home)/home/page.tsx` (import library; 加 CoverPhoto banner; line ~302 左 meta 列顶部)

- [ ] **Step 1: 加 library import**

把 `packages/student-web/src/app/(home)/home/page.tsx` 第 23 行:

```tsx
import { myProjects, type MyProjectItem } from "@/lib/api"
```

替换为:

```tsx
import { library, myProjects, type MyProjectItem } from "@/lib/api"
```

- [ ] **Step 2: 加 CoverBanner 局部组件 (放在 `function domainClass` 定义之上, 第 678 行)**

在 `function domainClass(domain: string): string {` 这一行之前插入:

```tsx
function CoverBanner({
  slug,
  hasCover,
}: {
  slug: string
  hasCover: boolean
}) {
  const [failed, setFailed] = useState(false)
  if (!hasCover || failed) return null
  return (
    <div
      style={{
        height: 120,
        marginBottom: 14,
        borderRadius: 10,
        overflow: "hidden",
        background: "#15110d",
        border: "1px solid var(--border)",
      }}
    >
      <img
        src={library.coverUrl(slug)}
        alt=""
        onError={() => setFailed(true)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center 48%",
          display: "block",
        }}
      />
    </div>
  )
}

```

- [ ] **Step 3: 在 active 卡片左 meta 列顶部渲染 banner**

把第 299-304 行 (slug mono 那个 div) 之前插入 banner — 即把:

```tsx
                <div
                  className="mono"
                  style={{ fontSize: 11.5, color: "var(--sub-2)" }}
                >
                  {activeProject.slug}
                </div>
```

替换为:

```tsx
                <CoverBanner
                  slug={activeProject.slug}
                  hasCover={!!activeProject.cover_image_path}
                />
                <div
                  className="mono"
                  style={{ fontSize: 11.5, color: "var(--sub-2)" }}
                >
                  {activeProject.slug}
                </div>
```

- [ ] **Step 4: 前端类型检查**

Run:
```bash
cd /Users/xinghan/Dev/systemedu/packages/student-web && npx tsc --noEmit
```
Expected: 无 error。

- [ ] **Step 5: Commit**

```bash
cd /Users/xinghan/Dev/systemedu && git add packages/student-web/src/app/\(home\)/home/page.tsx
git commit -m "$(cat <<'EOF'
feat(spec-037): dashboard active 卡片加作者真封面 banner (无封面则不显示)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: 文档 / 记忆清理 — 移除"本地优先"残留

**Files:**
- Modify: `CLAUDE.md` (L9, L289, L292, L293 — 实际行号以 grep 为准)
- Modify: `docs/prd.md` (本地优先表述)
- Modify: `docs/superpowers/specs/2026-04-16-tutor-memory-system-design.md`
- Modify: `specs/033-library-clone/spec.md` (顶部标 reverted)

- [ ] **Step 1: 定位 CLAUDE.md 本地优先残留**

Run:
```bash
cd /Users/xinghan/Dev/systemedu && grep -n "本地优先\|本地运行 agent\|数据存本地\|local-first\|存本地 SQLite" CLAUDE.md
```
Expected: 命中开篇定义 (L9 附近) + 决策日志 (L289/292/293 附近)。

- [ ] **Step 2: 改 CLAUDE.md 开篇定义 (L9)**

把 `SystemEdu 是一款**本地优先的 AI Agent Sandbox 平台**` 这句替换为:

```
SystemEdu 是一款 **cloud 优先的 AI Agent 教育平台**, 教育为核心定位, Agent 为底层架构。课程内容由 library 服务统一托管, 学生在浏览器里 pull 项目 (仅在 DB 记一行关联), 学习时实时代理 library 内容; 所有用户学习进度 / 行为数据 / agent chat 数据存 student-app 的 PostgreSQL。
```

(若用户原文不同, 以 grep 实际命中文本为准做等价替换 — 核心是去掉"本地优先 / 本地运行 / 存本地 SQLite"语义。)

- [ ] **Step 3: 改 CLAUDE.md 决策日志 (L289/292/293 附近)**

把决策日志里 `Architecture pivot to local-first Agent Sandbox` / `SQLite for local storage` / `本地优先` 等条目, 各加一句 cloud 修订说明 (不删历史, 标注已演进):

例如把:
```
| 2026-03-14 | Architecture pivot to local-first Agent Sandbox | 类似 OpenClaw，本地运行 agent，Hub 共享项目 |
```
改为:
```
| 2026-03-14 | Architecture pivot to local-first Agent Sandbox | 类似 OpenClaw (注: 已于 cloud 化后废弃, 见 spec 037 — 现 library 托管内容 + student 仅存关联/行为) |
```
其余两条 (`SQLite for local storage`) 同样追加 `(注: cloud 版本改 PostgreSQL, 本地 SQLite 仅 pytest 用)`。

- [ ] **Step 4: 改 docs/prd.md**

Run:
```bash
cd /Users/xinghan/Dev/systemedu && grep -n "本地优先\|存本地 SQLite\|数据存本地\|local-first\|本地运行 agent" docs/prd.md
```
对每个命中, 改成 cloud 表述 (library 托管内容 + student PostgreSQL 存进度/行为)。逐条编辑, 保持文档整体可读。

- [ ] **Step 5: 改 tutor-memory 设计稿**

Run:
```bash
cd /Users/xinghan/Dev/systemedu && grep -n "本地优先\|local-first\|本地 SQLite\|存本地" docs/superpowers/specs/2026-04-16-tutor-memory-system-design.md
```
对命中处加一句 `(已 cloud 化, 见 spec 037)` 或改为 PostgreSQL 表述。

- [ ] **Step 6: 给 spec 033 标 reverted**

把 `specs/033-library-clone/spec.md` 顶部的:
```
**Status**: shipped (2026-05-19)
```
改为:
```
**Status**: reverted by spec 037 (2026-06-04) — catalog 本地落盘部分已回退为纯 cloud 实时代理; library 只暴露元信息的想法保留待后续 spec
```

- [ ] **Step 7: 确认 MEMORY.md L95 (内容生产 tarball) 与 docs/archive/ 未被改动**

Run:
```bash
cd /Users/xinghan/Dev/systemedu && git status --short docs/archive/ && grep -n "tarball 在 ~/Desktop\|Desktop" /Users/xinghan/.claude/projects/-Users-xinghan-Dev-systemedu/memory/MEMORY.md 2>/dev/null | head
```
Expected: docs/archive 无改动; MEMORY.md 内容生产侧条目保留 (不动)。

- [ ] **Step 8: Commit**

```bash
cd /Users/xinghan/Dev/systemedu && git add CLAUDE.md docs/prd.md docs/superpowers/specs/2026-04-16-tutor-memory-system-design.md specs/033-library-clone/spec.md
git commit -m "$(cat <<'EOF'
docs(spec-037): 清理"本地优先"残留, 统一为 cloud 架构表述

CLAUDE.md 开篇定义 + 决策日志, prd.md, tutor-memory 设计稿改 cloud 语义;
spec 033 标 reverted by spec 037。内容生产侧 tarball 记录保留不动。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: 全量回归 + spec/prd Status 更新

**Files:**
- Modify: `specs/037-cloud-realtime-proxy-revert/spec.md` (Status → shipped)

- [ ] **Step 1: 跑 student 全套测试**

Run:
```bash
cd /Users/xinghan/Dev/systemedu && source .venv/bin/activate && python -m pytest tests/student/ -v
```
Expected: 全 PASS (特别确认 test_catalog / test_progress / test_library_proxy / test_user_knode_complete 不回归)。

- [ ] **Step 2: 若 test_user_knode_complete 因旧本地语义失败, 修它**

Run:
```bash
cd /Users/xinghan/Dev/systemedu && grep -n "local_path\|cloned\|needs_reclone\|manifest" tests/student/test_user_knode_complete.py
```
若该测试断言旧本地行为 (如 `needs_reclone` / `local_path`), 改为断言新代理行为 (200 + 实时内容 / 403)。逐条对照 Task 4 的知识修。改完重跑该文件确认 PASS。

- [ ] **Step 3: 前端整体构建**

Run:
```bash
cd /Users/xinghan/Dev/systemedu/packages/student-web && npm run build
```
Expected: build 成功 (Next.js 编译通过, 无 type error)。

- [ ] **Step 4: 标 spec 037 shipped**

把 `specs/037-cloud-realtime-proxy-revert/spec.md` 顶部:
```
**Status**: draft (2026-06-04)
```
改为:
```
**Status**: shipped (2026-06-04)
```

- [ ] **Step 5: Commit**

```bash
cd /Users/xinghan/Dev/systemedu && git add specs/037-cloud-realtime-proxy-revert/spec.md tests/student/
git commit -m "$(cat <<'EOF'
test(spec-037): 全量回归通过, spec 037 标 shipped

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## 验收对照 (spec → task)

| spec 目标 | 落实 task |
|---|---|
| pull 只记 DB 关联行, 不落盘 | Task 1 (db) + Task 2 (pull) |
| remove 软删+清进度, 不碰 FS | Task 3 |
| knode 实时代理 + html_path 回填 | Task 4 |
| file 流式代理 | Task 5 |
| 删除 storage.py | Task 6 |
| db.py 三列保留不写 | Task 1 |
| my-projects 真封面 | Task 7 |
| dashboard 真封面 | Task 8 |
| pull/remove/progress/knode/file 测试 | Task 2/3/4/5 (+已有 progress) |
| 文档/记忆清理 | Task 9 |
| 全量回归 | Task 10 |
