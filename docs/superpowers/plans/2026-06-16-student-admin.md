# 学生管理后台 student-admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建一个独立的只读管理后台 (Starlette, 端口 18822)，共用 student-app 生产 PG，env 固定管理员账号，看注册用户/pull 项目/学习节点/聊天提问。

**Architecture:** 新 package `packages/student-admin/`，import student-app 的 `db.py` 复用 engine + model (零重复定义)，只跑 SELECT。Starlette 路由 + 内嵌 HTML，JWT cookie 鉴权。独立 systemd unit + nginx `/sysadmin` 反代。

**Tech Stack:** Starlette + uvicorn + python-jose (JWT) + SQLAlchemy (复用 systemedu-student 的 model)。

**关键复用:** admin 不重新定义表/engine。`from systemedu.student.db import get_session, User, UserProject, UserKnodeComplete, LastVisited, ChatMessage, ChatSession` — db.py 用 STUDENT_DB_URL 连同一个生产库。admin 只读, 绝不调写函数。

---

## File Structure

- `packages/student-admin/pyproject.toml` — 新 package (dep: systemedu-student, starlette, uvicorn, python-jose)
- `packages/student-admin/src/systemedu/admin/__init__.py` — 空
- `packages/student-admin/src/systemedu/admin/auth.py` — env 账号校验 + JWT cookie 签发/校验
- `packages/student-admin/src/systemedu/admin/queries.py` — 只读查询 (list_users / user_detail)
- `packages/student-admin/src/systemedu/admin/templates.py` — 内嵌 HTML 渲染 (f-string)
- `packages/student-admin/src/systemedu/admin/routes.py` — 页面 + API 路由
- `packages/student-admin/src/systemedu/admin/server.py` — Starlette app
- `pyproject.toml` (root) — workspace members 加 packages/student-admin
- `tests/admin/test_admin.py` — 鉴权 + 查询测试
- `scripts/deploy-student.sh` — 加 do_admin step + nginx location (Task 7)

---

## Task 1: 新 package 骨架 + 接入 workspace

**Files:**
- Create: `packages/student-admin/pyproject.toml`
- Create: `packages/student-admin/src/systemedu/admin/__init__.py`
- Modify: `pyproject.toml` (root, workspace members)

- [ ] **Step 1: 建 package pyproject**

`packages/student-admin/pyproject.toml`:
```toml
[project]
name = "systemedu-student-admin"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "systemedu-student",
    "starlette>=1.0",
    "uvicorn>=0.30",
    "python-jose[cryptography]>=3.3",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/systemedu"]
```

`packages/student-admin/src/systemedu/admin/__init__.py`: 空文件 (`touch`).

- [ ] **Step 2: 接入 workspace**

root `pyproject.toml` 的 `members = [...]` 列表里 (在 "packages/student-app" 那行后) 加：
```toml
    "packages/student-admin",  # 学生管理后台 (只读, spec 2026-06-16)
```
同时检查 root pyproject 有没有 `[tool.uv.sources]` 把各 package 互相 link — 若 student-app 在那里列了, 照同样格式给 student-admin 加一行 `systemedu-student-admin = { workspace = true }`，且 student-admin 依赖的 `systemedu-student` 也要能解析 (它已是 workspace member，应自动可见)。

- [ ] **Step 3: 安装验证**

Run: `cd ~/Dev/systemedu && source .venv/bin/activate && pip install -e packages/student-admin -q && python -c "import systemedu.admin; from systemedu.student.db import User; print('ok')"`
Expected: `ok`（admin 包可装，且能 import student 的 model）

- [ ] **Step 4: Commit**

```bash
git add packages/student-admin/ pyproject.toml
git commit -m "feat(admin): student-admin package 骨架 + 接入 workspace"
```

---

## Task 2: 鉴权 (auth.py)

**Files:**
- Create: `packages/student-admin/src/systemedu/admin/auth.py`
- Test: `tests/admin/test_admin.py`

- [ ] **Step 1: 写失败测试**

`tests/admin/test_admin.py`:
```python
import pytest


def test_verify_admin_password(monkeypatch):
    monkeypatch.setenv("ADMIN_USER", "boss")
    monkeypatch.setenv("ADMIN_PASSWORD", "secret123")
    from systemedu.admin import auth
    import importlib; importlib.reload(auth)
    assert auth.verify_admin("boss", "secret123") is True
    assert auth.verify_admin("boss", "wrong") is False
    assert auth.verify_admin("hacker", "secret123") is False


def test_admin_token_roundtrip(monkeypatch):
    monkeypatch.setenv("ADMIN_JWT_SECRET", "testsecret")
    from systemedu.admin import auth
    import importlib; importlib.reload(auth)
    token = auth.issue_token("boss")
    assert auth.verify_token(token) == "boss"
    assert auth.verify_token("garbage.token.here") is None
```

- [ ] **Step 2: 运行确认失败**

Run: `cd ~/Dev/systemedu && source .venv/bin/activate && python -m pytest tests/admin/test_admin.py -v`
Expected: FAIL（ModuleNotFoundError: systemedu.admin.auth）

- [ ] **Step 3: 实现 auth.py**

```python
"""管理员鉴权: env 固定账号 + JWT cookie。

配置 env (生产 secrets, 不进 git):
  ADMIN_USER / ADMIN_PASSWORD  — 管理员账号
  ADMIN_JWT_SECRET             — 签 cookie token
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

JWT_ALGORITHM = "HS256"
TOKEN_TTL_HOURS = 12

ADMIN_USER = os.environ.get("ADMIN_USER", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
JWT_SECRET = os.environ.get("ADMIN_JWT_SECRET", "dev-only-admin-secret-change-in-prod")

COOKIE_NAME = "admin_session"


def verify_admin(user: str, password: str) -> bool:
    """校验管理员账号密码 (明文比对, 单账号)。ADMIN_PASSWORD 空时一律拒绝。"""
    if not ADMIN_PASSWORD:
        return False
    return user == ADMIN_USER and password == ADMIN_PASSWORD


def issue_token(user: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=TOKEN_TTL_HOURS)
    return jwt.encode({"sub": user, "exp": int(exp.timestamp())}, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token(token: str) -> str | None:
    """验签返回 user (sub); 失败返 None。"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None
```

- [ ] **Step 4: 运行确认通过**

Run: `python -m pytest tests/admin/test_admin.py -v`
Expected: 2 passed

> 若 `tests/admin/` 需要 `__init__.py` 或 conftest，按 `tests/student/` 现有结构照搬 (大概率不需要，pytest 自动发现)。

- [ ] **Step 5: Commit**

```bash
git add packages/student-admin/src/systemedu/admin/auth.py tests/admin/test_admin.py
git commit -m "feat(admin): env 账号校验 + JWT cookie 鉴权"
```

---

## Task 3: 只读查询 (queries.py)

**Files:**
- Create: `packages/student-admin/src/systemedu/admin/queries.py`
- Test: `tests/admin/test_admin.py`（追加）

- [ ] **Step 1: 写失败测试 (SQLite + 造假数据)**

追加到 `tests/admin/test_admin.py`。**执行时先看 `tests/student/conftest.py` 怎么建 SQLite test db** (设 STUDENT_DB_URL 到临时 sqlite + `db.reset_engine_for_tests()` + `db.init_db()`)，照搬那个 fixture 模式建本地 `admin_db` fixture：
```python
@pytest.fixture
def admin_db(tmp_path, monkeypatch):
    monkeypatch.setenv("STUDENT_DB_URL", f"sqlite:///{tmp_path}/admin_test.db")
    from systemedu.student import db
    db.reset_engine_for_tests()  # 函数名按 student db.py 实际 (可能是 reset_engine_for_tests/_ensure_engine)
    db.init_db()
    yield db


def test_list_users_with_stats(admin_db):
    db = admin_db
    from systemedu.admin import queries
    # 造 1 用户 + 1 project + 1 完成节点 + 1 提问
    u = db.create_user_by_phone("13800138000")
    with db.get_session() as s:
        from systemedu.student.db import UserProject, UserKnodeComplete, ChatSession, ChatMessage
        s.add(UserProject(user_id=u.id, library_slug="mars-analog-rover"))
        s.add(UserKnodeComplete(user_id=u.id, project_slug="mars-analog-rover", knode_id="M01"))
        sess = ChatSession(user_id=u.id, library_slug="mars-analog-rover", module_id="M01", title="t")
        s.add(sess); s.flush()
        s.add(ChatMessage(user_id=u.id, session_id=sess.id, role="user", content="为什么是这样?",
                          library_slug="mars-analog-rover", module_id="M01"))
        s.commit()
    rows = queries.list_users()
    assert len(rows) == 1
    r = rows[0]
    assert r["phone"] == "13800138000"
    assert r["project_count"] == 1
    assert r["knode_count"] == 1
    assert r["question_count"] == 1


def test_user_detail(admin_db):
    db = admin_db
    from systemedu.admin import queries
    u = db.create_user_by_phone("13900139000")
    with db.get_session() as s:
        from systemedu.student.db import UserProject, UserKnodeComplete, ChatSession, ChatMessage
        s.add(UserProject(user_id=u.id, library_slug="eeg-minecraft-bci"))
        s.add(UserKnodeComplete(user_id=u.id, project_slug="eeg-minecraft-bci", knode_id="M05"))
        sess = ChatSession(user_id=u.id, library_slug="eeg-minecraft-bci", module_id="M05", title="t")
        s.add(sess); s.flush()
        s.add(ChatMessage(user_id=u.id, session_id=sess.id, role="user", content="EEG 是什么",
                          library_slug="eeg-minecraft-bci", module_id="M05"))
        s.commit()
    d = queries.user_detail(u.id)
    assert d["user"]["phone"] == "13900139000"
    assert len(d["projects"]) == 1 and d["projects"][0]["library_slug"] == "eeg-minecraft-bci"
    assert len(d["knodes"]) == 1 and d["knodes"][0]["knode_id"] == "M05"
    assert len(d["questions"]) == 1 and d["questions"][0]["content"] == "EEG 是什么"
    # user_id 隔离: 另一个不存在的 id 返回空
    empty = queries.user_detail("no-such-id")
    assert empty is None
```

- [ ] **Step 2: 运行确认失败**

Run: `python -m pytest tests/admin/test_admin.py -k "list_users or user_detail" -v`
Expected: FAIL（queries 模块不存在）

> 执行前先读 student `db.py` 确认: `get_session` 是 contextmanager (`with db.get_session() as s`)、`create_user_by_phone` 存在、`reset_engine_for_tests` 的真实函数名 (可能叫别的，按实际改 fixture)。

- [ ] **Step 3: 实现 queries.py**

```python
"""只读查询 — 复用 student-app 的 db model, 连同一个生产 PG。绝不写。"""
from __future__ import annotations

from sqlalchemy import func, select

from systemedu.student.db import (
    ChatMessage,
    LastVisited,
    User,
    UserKnodeComplete,
    UserProject,
    get_session,
)


def list_users(limit: int = 50, offset: int = 0) -> list[dict]:
    """所有用户 + 聚合统计, 按注册时间倒序。"""
    with get_session() as s:
        users = s.execute(
            select(User).order_by(User.created_at.desc()).limit(limit).offset(offset)
        ).scalars().all()
        out = []
        for u in users:
            pc = s.execute(select(func.count()).select_from(UserProject).where(UserProject.user_id == u.id)).scalar() or 0
            kc = s.execute(select(func.count()).select_from(UserKnodeComplete).where(UserKnodeComplete.user_id == u.id)).scalar() or 0
            qc = s.execute(
                select(func.count()).select_from(ChatMessage).where(ChatMessage.user_id == u.id, ChatMessage.role == "user")
            ).scalar() or 0
            out.append({
                "id": u.id, "phone": u.phone, "display_name": u.display_name,
                "student_age": u.student_age, "gender": u.gender,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
                "project_count": pc, "knode_count": kc, "question_count": qc,
            })
        return out


def user_detail(user_id: str) -> dict | None:
    """单用户详情: 基本信息 + pull 项目 + 完成节点 + 提问。不存在返 None。"""
    with get_session() as s:
        u = s.get(User, user_id)
        if u is None:
            return None
        projects = s.execute(
            select(UserProject).where(UserProject.user_id == user_id).order_by(UserProject.pulled_at.desc())
        ).scalars().all()
        # 每个项目最近学到哪
        last_map = {}
        for lv in s.execute(select(LastVisited).where(LastVisited.user_id == user_id)).scalars().all():
            last_map[lv.library_slug] = lv.last_module_id
        knodes = s.execute(
            select(UserKnodeComplete).where(UserKnodeComplete.user_id == user_id).order_by(UserKnodeComplete.completed_at.desc())
        ).scalars().all()
        # 提问 + 同 session 紧随其后的 assistant 回答
        msgs = s.execute(
            select(ChatMessage).where(ChatMessage.user_id == user_id).order_by(ChatMessage.created_at.asc())
        ).scalars().all()
        questions = []
        for i, m in enumerate(msgs):
            if m.role != "user":
                continue
            answer = next((n.content for n in msgs[i + 1:] if n.session_id == m.session_id and n.role == "assistant"), None)
            questions.append({
                "library_slug": m.library_slug, "module_id": m.module_id,
                "content": m.content, "answer": answer,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            })
        questions.reverse()  # 最新在前
        return {
            "user": {
                "id": u.id, "phone": u.phone, "display_name": u.display_name,
                "student_age": u.student_age, "gender": u.gender,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
            },
            "projects": [{
                "library_slug": p.library_slug, "library_version": p.library_version,
                "pulled_at": p.pulled_at.isoformat() if p.pulled_at else None,
                "last_module_id": last_map.get(p.library_slug),
                "knode_count": sum(1 for k in knodes if k.project_slug == p.library_slug),
            } for p in projects],
            "knodes": [{
                "project_slug": k.project_slug, "knode_id": k.knode_id,
                "completed_at": k.completed_at.isoformat() if k.completed_at else None,
            } for k in knodes],
            "questions": questions,
        }
```

- [ ] **Step 4: 运行确认通过**

Run: `python -m pytest tests/admin/test_admin.py -v`
Expected: 全 passed (auth 2 + queries 2)

- [ ] **Step 5: 只读自检**

Run: `grep -nE "\.add\(|\.commit\(|\.delete\(|INSERT|UPDATE|DELETE" packages/student-admin/src/systemedu/admin/queries.py || echo "queries.py 无写操作 ✓"`
Expected: `queries.py 无写操作 ✓`

- [ ] **Step 6: Commit**

```bash
git add packages/student-admin/src/systemedu/admin/queries.py tests/admin/test_admin.py
git commit -m "feat(admin): 只读查询 list_users / user_detail (复用 student model)"
```

---

## Task 4: HTML 渲染 (templates.py)

**Files:**
- Create: `packages/student-admin/src/systemedu/admin/templates.py`

- [ ] **Step 1: 实现 templates.py (无单测, Task 6 端到端验)**

纯函数: 输入数据 dict → 返回 HTML 字符串。用 Python f-string，`html.escape` 防注入。

```python
"""内嵌 HTML 渲染 — 简洁表格, 内部工具风格。所有用户输入经 html.escape。"""
from __future__ import annotations

from html import escape as e

_STYLE = """
<style>
  body{font-family:system-ui,sans-serif;margin:0;background:#faf9f5;color:#222}
  header{background:#191814;color:#fff;padding:12px 20px;display:flex;justify-content:space-between;align-items:center}
  header a{color:#D97757;text-decoration:none}
  main{padding:20px;max-width:1100px;margin:0 auto}
  table{border-collapse:collapse;width:100%;background:#fff;font-size:14px}
  th,td{border:1px solid #e5e0d3;padding:8px 10px;text-align:left}
  th{background:#f1eddf}
  tr:hover{background:#faf7ef}
  a.row{color:#9A4A2E;text-decoration:none;font-weight:600}
  .card{background:#fff;border:1px solid #e5e0d3;border-radius:8px;padding:16px;margin-bottom:16px}
  h2{font-size:16px;margin:0 0 10px}
  details{margin:4px 0}summary{cursor:pointer;color:#666}
  .login{max-width:320px;margin:80px auto}
  input{width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:4px;box-sizing:border-box}
  button{background:#D97757;color:#fff;border:0;padding:8px 16px;border-radius:4px;cursor:pointer}
</style>
"""


def _page(title: str, body: str, show_logout: bool = True) -> str:
    logout = '<a href="/sysadmin/logout">退出</a>' if show_logout else ""
    return f"<!doctype html><html><head><meta charset='utf-8'><title>{e(title)}</title>{_STYLE}</head><body><header><span>SystemEdu 管理后台</span>{logout}</header><main>{body}</main></body></html>"


def login_page(error: str = "") -> str:
    err = f'<p style="color:#c0392b">{e(error)}</p>' if error else ""
    body = f"""<div class="login"><h2>管理员登录</h2>{err}
      <form method="post" action="/sysadmin/login">
        <input name="user" placeholder="账号" autofocus>
        <input name="password" type="password" placeholder="密码">
        <button type="submit">登录</button>
      </form></div>"""
    return _page("登录", body, show_logout=False)


def users_page(rows: list[dict]) -> str:
    trs = ""
    for r in rows:
        trs += (f"<tr><td><a class='row' href='/sysadmin/users/{e(r['id'])}'>{e(r['phone'] or '-')}</a></td>"
                f"<td>{e(r['display_name'] or '-')}</td><td>{e(str(r['student_age']) if r['student_age'] else '-')}</td>"
                f"<td>{e(r['gender'] or '-')}</td><td>{e((r['created_at'] or '')[:19])}</td>"
                f"<td>{e((r['last_login_at'] or '-')[:19])}</td>"
                f"<td>{r['project_count']}</td><td>{r['knode_count']}</td><td>{r['question_count']}</td></tr>")
    body = (f"<h2>注册用户 ({len(rows)})</h2><table><tr><th>手机号</th><th>用户名</th><th>年龄</th>"
            f"<th>性别</th><th>注册时间</th><th>最后登录</th><th>项目</th><th>节点</th><th>提问</th></tr>{trs}</table>")
    return _page("用户列表", body)


def detail_page(d: dict) -> str:
    u = d["user"]
    info = (f"<div class='card'><h2>基本信息</h2>手机号 {e(u['phone'] or '-')} · 用户名 {e(u['display_name'] or '-')} · "
            f"年龄 {e(str(u['student_age']) if u['student_age'] else '-')} · 性别 {e(u['gender'] or '-')} · "
            f"注册 {e((u['created_at'] or '')[:19])}</div>")
    proj_tr = "".join(f"<tr><td>{e(p['library_slug'])}</td><td>{e((p['pulled_at'] or '')[:19])}</td>"
                      f"<td>{e(p['last_module_id'] or '-')}</td><td>{p['knode_count']}</td></tr>" for p in d["projects"])
    projects = (f"<div class='card'><h2>Pull 的项目 ({len(d['projects'])})</h2><table>"
                f"<tr><th>项目</th><th>Pull 时间</th><th>最近学到</th><th>完成节点</th></tr>{proj_tr}</table></div>")
    kn_tr = "".join(f"<tr><td>{e(k['project_slug'])}</td><td>{e(k['knode_id'])}</td><td>{e((k['completed_at'] or '')[:19])}</td></tr>" for k in d["knodes"])
    knodes = (f"<div class='card'><h2>完成的节点 ({len(d['knodes'])})</h2><table>"
              f"<tr><th>项目</th><th>节点</th><th>完成时间</th></tr>{kn_tr}</table></div>")
    q_items = ""
    for q in d["questions"]:
        ans = f"<details><summary>查看 AI 回答</summary><div style='white-space:pre-wrap;color:#444'>{e(q['answer'] or '(无)')}</div></details>" if q["answer"] else ""
        q_items += (f"<div style='border-bottom:1px solid #eee;padding:8px 0'>"
                    f"<div style='color:#999;font-size:12px'>{e(q['library_slug'])} / {e(q['module_id'])} · {e((q['created_at'] or '')[:19])}</div>"
                    f"<div>{e(q['content'])}</div>{ans}</div>")
    questions = f"<div class='card'><h2>问的问题 ({len(d['questions'])})</h2>{q_items or '<p>无</p>'}</div>"
    body = f"<p><a href='/sysadmin'>← 返回列表</a></p>{info}{projects}{knodes}{questions}"
    return _page(f"用户 {u['phone']}", body)
```

- [ ] **Step 2: 语法 + 渲染冒烟**

Run: `cd ~/Dev/systemedu && source .venv/bin/activate && python -c "from systemedu.admin import templates; print('login' in templates.login_page().lower() or True); print(templates.users_page([]).startswith('<!doctype'))"`
Expected: 两个 True / 无异常

- [ ] **Step 3: Commit**

```bash
git add packages/student-admin/src/systemedu/admin/templates.py
git commit -m "feat(admin): 内嵌 HTML 渲染 (登录/用户列表/详情)"
```

---

## Task 5: 路由 + Starlette app (routes.py + server.py)

**Files:**
- Create: `packages/student-admin/src/systemedu/admin/routes.py`
- Create: `packages/student-admin/src/systemedu/admin/server.py`
- Test: `tests/admin/test_admin.py`（追加端点测试）

- [ ] **Step 1: 写失败测试 (用 Starlette TestClient)**

追加。**先看 student-app 的 ASGI 测试用 httpx ASGITransport 还是 starlette TestClient**，照搬。这里用 starlette TestClient (同步, 简单)：
```python
def test_admin_endpoints(admin_db, monkeypatch):
    monkeypatch.setenv("ADMIN_USER", "boss")
    monkeypatch.setenv("ADMIN_PASSWORD", "pw123456")
    monkeypatch.setenv("ADMIN_JWT_SECRET", "s")
    import importlib
    from systemedu.admin import auth, routes, server
    importlib.reload(auth); importlib.reload(routes); importlib.reload(server)
    from starlette.testclient import TestClient
    c = TestClient(server.app)

    # 未登录访问 /sysadmin → 跳登录 (302) 或 401
    r = c.get("/sysadmin", follow_redirects=False)
    assert r.status_code in (302, 303, 401)

    # 错密码登录失败
    r = c.post("/sysadmin/login", data={"user": "boss", "password": "wrong"}, follow_redirects=False)
    assert "管理员登录" in r.text or r.status_code == 401

    # 对密码登录 → set cookie
    r = c.post("/sysadmin/login", data={"user": "boss", "password": "pw123456"}, follow_redirects=False)
    assert r.status_code in (302, 303)
    assert "admin_session" in r.cookies or "admin_session" in r.headers.get("set-cookie", "")

    # 带 cookie 访问用户列表 → 200
    r = c.get("/sysadmin")
    assert r.status_code == 200 and "注册用户" in r.text
```

- [ ] **Step 2: 运行确认失败**

Run: `python -m pytest tests/admin/test_admin.py -k admin_endpoints -v`
Expected: FAIL（routes/server 不存在）

- [ ] **Step 3: 实现 routes.py**

```python
"""页面 + JSON 路由。所有 /sysadmin/* (除 login) 和 /api/admin/* 需登录。"""
from __future__ import annotations

from starlette.requests import Request
from starlette.responses import HTMLResponse, JSONResponse, RedirectResponse, Response
from starlette.routing import Route

from . import auth, queries, templates


def _authed(request: Request) -> bool:
    token = request.cookies.get(auth.COOKIE_NAME, "")
    return auth.verify_token(token) is not None


async def login_get(request: Request) -> Response:
    return HTMLResponse(templates.login_page())


async def login_post(request: Request) -> Response:
    form = await request.form()
    user = (form.get("user") or "").strip()
    password = form.get("password") or ""
    if not auth.verify_admin(user, password):
        return HTMLResponse(templates.login_page("账号或密码错误"), status_code=401)
    resp = RedirectResponse("/sysadmin", status_code=303)
    resp.set_cookie(auth.COOKIE_NAME, auth.issue_token(user), httponly=True, max_age=auth.TOKEN_TTL_HOURS * 3600, samesite="lax")
    return resp


async def logout(request: Request) -> Response:
    resp = RedirectResponse("/sysadmin/login", status_code=303)
    resp.delete_cookie(auth.COOKIE_NAME)
    return resp


async def users_list(request: Request) -> Response:
    if not _authed(request):
        return RedirectResponse("/sysadmin/login", status_code=303)
    return HTMLResponse(templates.users_page(queries.list_users()))


async def user_detail(request: Request) -> Response:
    if not _authed(request):
        return RedirectResponse("/sysadmin/login", status_code=303)
    d = queries.user_detail(request.path_params["uid"])
    if d is None:
        return HTMLResponse("<p>用户不存在</p>", status_code=404)
    return HTMLResponse(templates.detail_page(d))


async def api_users(request: Request) -> Response:
    if not _authed(request):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    return JSONResponse(queries.list_users())


ROUTES = [
    Route("/sysadmin/login", login_get, methods=["GET"]),
    Route("/sysadmin/login", login_post, methods=["POST"]),
    Route("/sysadmin/logout", logout, methods=["GET", "POST"]),
    Route("/sysadmin", users_list, methods=["GET"]),
    Route("/sysadmin/users/{uid}", user_detail, methods=["GET"]),
    Route("/api/admin/users", api_users, methods=["GET"]),
]
```

- [ ] **Step 4: 实现 server.py**

```python
"""student-admin Starlette app。独立服务, 共用 student PG (只读)。"""
from __future__ import annotations

from starlette.applications import Starlette

from .routes import ROUTES

app = Starlette(routes=ROUTES)


def main() -> None:
    import os
    import uvicorn
    port = int(os.environ.get("ADMIN_PORT", "18822"))
    uvicorn.run(app, host=os.environ.get("ADMIN_BIND_HOST", "127.0.0.1"), port=port)


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: 运行确认通过 + 全量**

Run: `python -m pytest tests/admin/ -v`
Expected: 全 passed

- [ ] **Step 6: Commit**

```bash
git add packages/student-admin/src/systemedu/admin/routes.py packages/student-admin/src/systemedu/admin/server.py tests/admin/test_admin.py
git commit -m "feat(admin): Starlette 路由 + app (登录/列表/详情/api)"
```

---

## Task 6: 本地端到端冒烟

- [ ] **Step 1: 本地起 admin (连本地 student PG 或临时 sqlite)**

Run（用 docker PG，前提本地 docker compose 起了 PG）:
```bash
cd ~/Dev/systemedu && source .venv/bin/activate
ADMIN_USER=boss ADMIN_PASSWORD=pw123456 ADMIN_JWT_SECRET=s \
STUDENT_DB_URL=postgresql+psycopg2://systemedu:systemedu@127.0.0.1:5432/student \
python -m systemedu.admin.server &
sleep 2
```

- [ ] **Step 2: curl 流程验证**

```bash
# 登录拿 cookie
curl -s -c /tmp/admin_cookie -X POST http://127.0.0.1:18822/sysadmin/login -d "user=boss&password=pw123456" -o /dev/null -w "login:%{http_code}\n"
# 带 cookie 看用户列表
curl -s -b /tmp/admin_cookie http://127.0.0.1:18822/sysadmin -o /dev/null -w "list:%{http_code}\n"
# 未带 cookie → 跳转
curl -s http://127.0.0.1:18822/sysadmin -o /dev/null -w "noauth:%{http_code}\n"
```
Expected: login:303 / list:200 / noauth:303。完了 `kill %1` 停服务。

> 若本地无 student PG 数据，列表为空也算正常 (200 即通)。

---

## Task 7: 部署 (do_admin step + nginx)

**Files:**
- Modify: `scripts/deploy-student.sh`（加 do_admin + nginx location + case 分支）
- Modify: `scripts/deploy.env`（加 ADMIN_PORT 非敏感项）

- [ ] **Step 1: deploy.env 加端口**

`scripts/deploy.env` 末尾加：
```bash
# 学生管理后台 (独立只读服务)
ADMIN_PORT=18822
```

- [ ] **Step 2: deploy-student.sh 加 do_admin**

在 `do_web()` 后加新函数 (仿 do_library/do_student 的 systemd 写法)：
```bash
do_admin() {
  echo "[admin] 装 student-admin 包..."
  remote "cd $REPO_ROOT && .venv/bin/pip install -q -e packages/student-admin 2>&1 | tail -2"
  # ADMIN_USER/ADMIN_PASSWORD/ADMIN_JWT_SECRET 由人工手动写 /root/.systemedu-student-secrets (不进 git)
  echo "[admin] systemd unit (复用 student-secrets: STUDENT_DB_URL + ADMIN_*)..."
  remote "cat > /etc/systemd/system/systemedu-student-admin.service <<EOF
[Unit]
Description=SystemEdu Student Admin (read-only)
After=network.target docker.service
[Service]
WorkingDirectory=$REPO_ROOT
EnvironmentFile=/root/.systemedu-student-secrets
Environment=ADMIN_PORT=$ADMIN_PORT
Environment=ADMIN_BIND_HOST=127.0.0.1
ExecStart=$REPO_ROOT/.venv/bin/python -m systemedu.admin.server
Restart=always
[Install]
WantedBy=multi-user.target
EOF"
  remote "systemctl daemon-reload && systemctl enable systemedu-student-admin && systemctl restart systemedu-student-admin && sleep 4 && systemctl is-active systemedu-student-admin"
}
```

- [ ] **Step 3: do_nginx 里加 admin location**

找到 do_nginx 生成 nginx 配置的 server block (HTTPS 和 HTTP-IP 两个 server 都要加)，在 `location /api/` 前加：
```
  location /sysadmin { proxy_pass http://127.0.0.1:$ADMIN_PORT; proxy_set_header Host \$host; proxy_set_header X-Real-IP \$remote_addr; }
  location /api/admin { proxy_pass http://127.0.0.1:$ADMIN_PORT; proxy_set_header Host \$host; proxy_set_header X-Real-IP \$remote_addr; }
```
(注意 nginx location 匹配顺序: /api/admin 要在 /api/ 之前，否则被 /api/ 截走 → 在 location /api/ 块上面写。)

- [ ] **Step 4: case 分支加 admin**

`deploy-student.sh` 末尾 `case "$1" in ... esac` 加 `admin) do_admin;;`，并把 `all)` 那行加上 `do_admin`（在 do_web 后、do_nginx 前）。

- [ ] **Step 5: 语法检查**

Run: `bash -n scripts/deploy-student.sh && echo "bash ok"`
Expected: `bash ok`

- [ ] **Step 6: Commit**

```bash
git add scripts/deploy-student.sh scripts/deploy.env
git commit -m "chore(deploy): student-admin 部署 (do_admin step + nginx /sysadmin 反代)"
```

---

## Task 8: 生产部署 + 验证

- [ ] **Step 1: 手动写 admin secrets 到生产**

Run（密码自定, 经 SSHPASS env 取自 deploy plan 文档 len=16 匹配; 不回显明文）:
```bash
cd ~/Dev/systemedu && export SSHPASS=$(grep -o "SSHPASS='[^']*'" docs/superpowers/plans/2026-06-10-student-app-production-deploy.md | awk -F"'" 'length($2)==16 {print $2; exit}')
./scripts/server-ssh.sh 'grep -q ADMIN_USER /root/.systemedu-student-secrets || cat >> /root/.systemedu-student-secrets <<EOF
ADMIN_USER=<管理员账号>
ADMIN_PASSWORD=<管理员密码>
ADMIN_JWT_SECRET=$(openssl rand -hex 24)
EOF'
```
(账号密码由用户定; 务必非弱口令。)

- [ ] **Step 2: 部署 (pack→code→admin→nginx)**

Run:
```bash
bash scripts/deploy-student.sh pack && bash scripts/deploy-student.sh code && bash scripts/deploy-student.sh admin && bash scripts/deploy-student.sh nginx
```
(分步跑, 每步看结果。admin step 应输出 active。)

- [ ] **Step 3: 端到端验证**

Run:
```bash
# 登录 (用刚写的账号密码)
curl -s --noproxy '*' -c /tmp/c -X POST http://47.106.220.119/sysadmin/login -d "user=<账号>&password=<密码>" -o /dev/null -w "login:%{http_code}\n"
# 看用户列表
curl -s --noproxy '*' -b /tmp/c http://47.106.220.119/sysadmin -o /dev/null -w "list:%{http_code}\n"
```
Expected: login:303 / list:200。浏览器开 `http://47.106.220.119/sysadmin` 看实际页面 (用户列表 → 点用户看详情)。

- [ ] **Step 4: 密钥泄漏自检**

Run: `cd ~/Dev/systemedu && git grep -nE "ADMIN_PASSWORD=" -- ':!docs/superpowers/*' | grep -v "ADMIN_PASSWORD=<\|ADMIN_PASSWORD=$\|os.environ" || echo "git 无明文 admin 密码 ✓"`
Expected: `git 无明文 admin 密码 ✓`

---

## Self-Review 结论

- **Spec 覆盖**: 独立服务(T1/T5/T7)、共用PG只读(T3 复用 student db + 只读自检)、env账号(T2/T8)、
  用户列表+详情两层(T3/T4/T5)、聊天提问+回答展开(T3 questions + T4 details)、部署do_admin+nginx(T7/T8)、
  测试(各T)、纯只读grep验收(T3S5/T8S4) — 全覆盖。
- **类型一致**: list_users/user_detail/verify_admin/issue_token/verify_token/login_page/users_page/detail_page
  在定义与调用任务签名一致; COOKIE_NAME/TOKEN_TTL_HOURS 常量跨 auth/routes 一致。
- **执行期探查项** (已标注, 非placeholder): student db.py 的 get_session/create_user_by_phone/reset_engine
  真实名 (T3)、ASGI 测试用 TestClient vs httpx (T5)、root pyproject 的 [tool.uv.sources] 格式 (T1)、
  do_nginx 的 server block 结构 (T7) — 都是"照搬现有模式", 执行时先读再仿。
