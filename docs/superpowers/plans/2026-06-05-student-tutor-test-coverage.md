# 学生端 + Tutor 测试覆盖与质量评估 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把学生端常规功能(pull/学习/进度/auth)与 tutor(agent+记忆+苏格拉底)从"行覆盖"提升到"机制正确性 + 质量评估"三层测试，并产出可回归的覆盖功能表。

**Architecture:** 三层金字塔。L1 进程内单元补缺口逼近 100%；L2 用进程内 ASGI 测试拿 route 行覆盖 + 真实双进程 E2E 验机制；L3 把真实 tutor 对话落盘 artifact，由 Claude Code 当 judge 按 rubric 打分。数据源是一个 7-knode/3-stage、含 DAG 依赖与专业领域误区的 EEG 合成测试项目。

**Tech Stack:** pytest, coverage.py, httpx (ASGITransport + 真子进程), Starlette, SQLAlchemy(SQLite for tests), LangGraph tutor(qwen-plus, 仅 L3), 仓库内 `services` fixture。

---

## File Structure

- `.coveragerc` (Create) — 覆盖率配置，含 parallel + omit。
- `pyproject.toml` 或 `pytest.ini` (Modify) — 注册 `--quality` marker（`--e2e` 已存在）。
- `tests/student/_fixtures/eeg_project.py` (Create) — EEG 合成项目 tarball 构造器。
- `tests/student/conftest.py` (Modify) — 增加 `eeg_services` fixture + ASGI app fixture。
- `tests/student/test_route_asgi.py` (Create) — 进程内 ASGI route 行覆盖测试（G2）。
- `tests/tutor/tools/test_tool_impls_gaps.py` (Create) — L1 tools 缺口补测。
- `tests/student/test_memory_layers_gaps.py` (Create) — L1 memory_layers 缺口补测。
- `tests/student/test_e2e_learning_flow.py` (Create) — L2 机制 E2E（E2E-1..6）。
- `tests/student/quality/conftest.py` (Create) — `--quality` gate + artifact 落盘 helper。
- `tests/student/quality/test_quality_transcripts.py` (Create) — L3 真实 tutor 跑对话 → 落 artifact。
- `tests/student/quality/rubric.md` (Create) — L3 评分 rubric（Claude judge 用）。
- `docs/testing/student-tutor-coverage-matrix.md` (Create) — 回归基线表。
- `docs/testing/quality_report_template.md` (Create) — L3 质量报告模板。

---

## Task 1: 覆盖率基建（.coveragerc + marker）

**Files:**
- Create: `.coveragerc`
- Modify: `pyproject.toml`（根，注册 markers）

- [ ] **Step 1: 写 `.coveragerc`**

```ini
[run]
parallel = true
branch = false
source =
    packages/student-app/src/systemedu/student
    packages/core/src/systemedu/core/tutor
omit =
    */tests/*
    */__pycache__/*

[report]
show_missing = true
skip_covered = false
```

- [ ] **Step 2: 注册 pytest markers（避免 --quality/--e2e 警告）**

在根 `pyproject.toml` 追加（若已有 `[tool.pytest.ini_options]` 则并入 markers）：

```toml
[tool.pytest.ini_options]
markers = [
    "e2e: 真实 LLM 端到端测试，--e2e 开启",
    "quality: L3 质量评估，落盘 transcript artifact，--quality 开启",
]
```

确认 `--e2e` / `--quality` 命令行选项注册位置：

Run: `grep -rn "addoption\|--e2e\|--quality" tests/conftest.py tests/tutor/conftest.py 2>/dev/null`
Expected: 找到 `--e2e` 的 addoption；若无 `--quality`，在同一 conftest 仿照 `--e2e` 增加（Task 8 Step 1 会用到）。

- [ ] **Step 3: 验证 coverage 能跑**

Run: `source .venv/bin/activate && coverage run --rcfile=.coveragerc -m pytest tests/tutor/tools/test_tool_impls.py -q && coverage report | tail -5`
Expected: 测试 PASS，输出 tools 模块的覆盖率行。

- [ ] **Step 4: Commit**

```bash
git add .coveragerc pyproject.toml
git commit -m "test: 加 coverage 配置 + 注册 quality marker"
```

---

## Task 2: EEG 复杂合成项目 fixture

**Files:**
- Create: `tests/student/_fixtures/__init__.py`（空）
- Create: `tests/student/_fixtures/eeg_project.py`

**说明:** 以 `tests/student/conftest.py:_make_tarball` 为模板，构造 7-knode/3-stage、含 DAG edges 的 EEG 项目 tarball。每个 knode 的 lesson.md 含北极星块 + 领域知识点 + 误区锚点（供 L3 触发）。manifest 字段对齐现有 `_make_tarball` 的 schema。

- [ ] **Step 1: 写 EEG 项目数据 + tarball 构造器**

```python
# tests/student/_fixtures/eeg_project.py
"""复杂 EEG 合成测试项目 — 7 knode / 3 stage / DAG 依赖。

供 L2 机制 E2E + L3 质量评估使用。领域知识点对照仓库 eeg-minecraft-bci 素材，
含可被 judge 判对错的专业事实与学生常见误区锚点。
"""
from __future__ import annotations

import hashlib
import json
import tarfile
from pathlib import Path

SLUG = "eeg-signals-test"

# (module_id, dir_slug, stage, title, 北极星, theory_facts, 误区锚点, prereq_module_ids)
KNODES = [
    ("M01", "M01-w1-what-is-eeg", "S1", "脑电是什么",
     "做出能区分你左右手运动想象的脑机接口",
     "EEG 是头皮记录的神经元同步放电产生的电位，量级约 10-100 微伏(μV)。",
     "学生常误以为 EEG 能直接读出具体念头/文字。",
     []),
    ("M02", "M02-w1-sampling-nyquist", "S1", "采样率与奈奎斯特",
     "做出能区分你左右手运动想象的脑机接口",
     "奈奎斯特定理：采样率 fs 必须 >= 2 倍信号最高频率 fmax 才能不失真。EEG 关心 1-40Hz，常用 250 或 500Hz。",
     "学生常误以为采样率越高越好、没有代价。",
     ["M01"]),
    ("M03", "M03-w2-bands-alpha-beta", "S2", "频带 alpha 与 beta",
     "做出能区分你左右手运动想象的脑机接口",
     "alpha 波 8-13Hz，放松闭眼时枕区增强；beta 波 13-30Hz，专注/运动时增强。",
     "学生常误以为闭眼 alpha 增强就等于睡着了。",
     ["M02"]),
    ("M04", "M04-w2-electrode-impedance", "S2", "电极与阻抗",
     "做出能区分你左右手运动想象的脑机接口",
     "电极-头皮阻抗应低于 5kΩ；需要参考电极和导电膏降低阻抗。",
     "学生常误以为电极数量越多信号一定越好。",
     ["M01"]),
    ("M05", "M05-w2-filtering", "S2", "滤波",
     "做出能区分你左右手运动想象的脑机接口",
     "带通滤波 1-40Hz 去基线漂移与高频噪声；陷波 50Hz 去工频干扰。滤波是取舍不是无损增益。",
     "学生常误以为滤波能凭空无损提高信噪比。",
     ["M02", "M04"]),
    ("M06", "M06-w3-erd-ers", "S3", "ERD 与 ERS",
     "做出能区分你左右手运动想象的脑机接口",
     "运动想象会在对侧感觉运动区引起 mu/beta 频段能量下降(ERD)。",
     "学生常误以为想得越用力 ERD 就越强。",
     ["M03", "M05"]),
    ("M07", "M07-w3-csp-classify", "S3", "简单分类",
     "做出能区分你左右手运动想象的脑机接口",
     "CSP(共空间模式)提取左右手最具区分度的空间滤波器，再用分类器区分。",
     "学生常误以为准确率必须 100% 才算成功。",
     ["M06"]),
]


def _lesson_md(k) -> str:
    mid, _, _, title, northstar, facts, misconcept, _ = k
    return (
        f"# {title}\n\n"
        "## 这一步在通向哪 (北极星)\n"
        f"- 项目目标: {northstar}\n"
        f"- 本节产出: 理解并能解释「{title}」\n"
        f"- 为何需要: 它是构建脑机接口管线中不可跳过的一环\n"
        f"- 完成判据: 能用自己的话讲清「{title}」的核心\n\n"
        "## 核心知识\n"
        f"{facts}\n\n"
        "## 常见误区(导师锚点)\n"
        f"{misconcept}\n"
    )


def _stages():
    return [
        {"stage_id": "S1", "title": "信号基础"},
        {"stage_id": "S2", "title": "采集与预处理"},
        {"stage_id": "S3", "title": "特征与分类"},
    ]


def build_eeg_tarball(tmp: Path) -> tuple[Path, str]:
    """构造 EEG 项目 tarball，返回 (tarball_path, slug)。"""
    root = tmp / SLUG
    (root / "tree").mkdir(parents=True)
    (root / "blueprint").mkdir()

    knode_entries = []
    for k in KNODES:
        mid, dir_slug, stage, title, _, _, _, prereqs = k
        kd = root / "knodes" / dir_slug
        kd.mkdir(parents=True)
        (kd / "lesson.md").write_text(_lesson_md(k), encoding="utf-8")
        (kd / "sections.json").write_text('{"sections":[]}', encoding="utf-8")
        (kd / "audio_scripts.json").write_text('{"scripts":[]}', encoding="utf-8")
        knode_entries.append({
            "module_id": mid, "title": title, "week": 1, "stage": stage,
            "duration_minutes": 45, "knode_dir": f"knodes/{dir_slug}",
        })

    modules = [{"module_id": k[0], "stage_id": k[2], "title": k[3]} for k in KNODES]
    edges = []
    for k in KNODES:
        for pre in k[7]:
            edges.append({"from": pre, "to": k[0], "type": "prerequisite"})

    (root / "tree" / "knowledge_tree.json").write_text(json.dumps({
        "schema_version": "5.0", "title": "EEG signals test",
        "stages": _stages(), "modules": modules, "edges": edges,
    }, ensure_ascii=False), encoding="utf-8")
    (root / "blueprint" / "README.zh.md").write_text("# EEG 测试项目\n", encoding="utf-8")

    def sha256(p: Path) -> str:
        return hashlib.sha256(p.read_bytes()).hexdigest()

    files = [
        {"path": p.relative_to(root).as_posix(), "sha256": sha256(p), "size": p.stat().st_size}
        for p in sorted(root.rglob("*")) if p.is_file() and p.name != "manifest.json"
    ]
    manifest = {
        "schema_version": "1.0", "slug": SLUG,
        "title": "EEG signals test project", "title_zh": "EEG 信号测试项目",
        "description": "脑机接口信号基础(测试专用，含 DAG 依赖与领域误区)",
        "version": "1.0.0",
        "frontmatter": {"age_band": "12-15", "domain": "Neuroscience", "duration_weeks": 3},
        "knode_count": len(KNODES), "stage_count": 3, "languages": ["zh-CN"],
        "total_size_bytes": sum(f["size"] for f in files), "files": files,
        "knodes": knode_entries, "tags": ["eeg", "bci", "test"],
    }
    (root / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")
    tarball = tmp / f"{SLUG}.tar.gz"
    with tarfile.open(tarball, "w:gz") as tar:
        tar.add(root, arcname=SLUG)
    return tarball, SLUG
```

```python
# tests/student/_fixtures/__init__.py
```

- [ ] **Step 2: 单元验证 tarball 构造正确**

Run: `source .venv/bin/activate && python -c "
import tempfile, tarfile, json
from pathlib import Path
from tests.student._fixtures.eeg_project import build_eeg_tarball, KNODES
with tempfile.TemporaryDirectory() as d:
    tb, slug = build_eeg_tarball(Path(d))
    with tarfile.open(tb) as t:
        names = t.getnames()
    assert slug == 'eeg-signals-test'
    assert sum(1 for n in names if n.endswith('lesson.md')) == len(KNODES) == 7
    print('OK', len(KNODES), 'knodes')
"`
Expected: `OK 7 knodes`

- [ ] **Step 3: Commit**

```bash
git add tests/student/_fixtures/
git commit -m "test: EEG 复杂合成测试项目 (7 knode/3 stage/DAG)"
```

---

## Task 3: conftest 增加 eeg_services + ASGI app fixture

**Files:**
- Modify: `tests/student/conftest.py`

**说明:** 复用现有 `services` 的进程启动逻辑，但抽出一个可指定 tarball 构造器的版本，新增 `eeg_services`（module 级，注入 EEG 项目）。再加一个进程内 `asgi_client` fixture，用 `httpx.ASGITransport` 直接挂 `create_app()`，给 Task 4 拿 route 行覆盖。

- [ ] **Step 1: 在 conftest.py 末尾追加 eeg_services fixture**

```python
# 追加到 tests/student/conftest.py 末尾
from tests.student._fixtures.eeg_project import build_eeg_tarball


@pytest.fixture(scope="module")
def eeg_services(tmp_path_factory):
    """与 services 同构，但注入复杂 EEG 项目；供 L2/L3 使用。"""
    yield from _spin_services(tmp_path_factory, build_eeg_tarball)


@pytest.fixture
def eeg_client(eeg_services):
    return httpx.Client(base_url=eeg_services["student"], timeout=20.0, trust_env=False)
```

- [ ] **Step 2: 把现有 services 主体抽成 `_spin_services(tmp_path_factory, tarball_fn)`**

将现有 `services` fixture 内部进程启动 + 注入逻辑重构为模块级函数 `_spin_services(tmp_path_factory, make_tarball_fn)`（generator），现有 `services` 改为 `yield from _spin_services(tmp_path_factory, _make_tarball)`。`_make_tarball` 签名 `(tmp) -> (tarball, slug)` 与 `build_eeg_tarball` 一致，所以可直接替换传入。保持 env、端口、publish 流程不变。

- [ ] **Step 3: 加进程内 ASGI fixture**

```python
# 追加到 conftest.py
@pytest.fixture
def asgi_app(monkeypatch, tmp_path):
    """进程内 student app，DB 走临时 SQLite，library client 由测试 mock。
    用于 route 行覆盖（主进程内可被 coverage 采集）。"""
    monkeypatch.setenv("STUDENT_DB_PATH", str(tmp_path / "asgi.db"))
    monkeypatch.setenv("STUDENT_JWT_SECRET", "asgi-secret")
    monkeypatch.setenv("STUDENT_SKIP_TUTOR_PRELOAD", "1")
    monkeypatch.setenv("LIBRARY_BASE_URL", "http://lib.invalid")
    monkeypatch.setenv("LIBRARY_LICENSE_TOKEN", "asgi-tok")
    from systemedu.student.server import create_app
    return create_app()


@pytest.fixture
def asgi_client(asgi_app):
    import httpx
    transport = httpx.ASGITransport(app=asgi_app)
    return httpx.Client(transport=transport, base_url="http://asgi.test", timeout=10.0)
```

- [ ] **Step 4: 验证两个 fixture 均可用**

Run: `source .venv/bin/activate && python -m pytest tests/student/test_catalog.py -q 2>&1 | tail -5`
Expected: 现有 catalog 测试仍 PASS（证明 `services` 重构无回归）。

Run: `source .venv/bin/activate && python -c "
import httpx, os, tempfile
os.environ.update(STUDENT_DB_PATH=tempfile.mktemp(), STUDENT_JWT_SECRET='x', STUDENT_SKIP_TUTOR_PRELOAD='1', LIBRARY_BASE_URL='http://lib.invalid', LIBRARY_LICENSE_TOKEN='t')
from systemedu.student.server import create_app
c = httpx.Client(transport=httpx.ASGITransport(app=create_app()), base_url='http://asgi.test')
r = c.get('/api/my/projects')
print('status', r.status_code)
assert r.status_code in (401, 403)
"`
Expected: `status 401`（未登录被拒，证明 ASGI 挂载成功且 route 被执行）。

- [ ] **Step 5: Commit**

```bash
git add tests/student/conftest.py
git commit -m "test: conftest 抽 _spin_services + 加 eeg_services/asgi_client fixture"
```

---

## Task 4: 进程内 ASGI route 行覆盖测试（G2）

**Files:**
- Create: `tests/student/test_route_asgi.py`

**说明:** 用 `asgi_client` + monkeypatch mock `get_library_client()`，进程内打满 catalog routes 的分支：未登录、pull 成功/404/library 异常、list、remove 幂等、progress get/put、未 pull 写进度 403、knode 代理 not_pulled。这些行覆盖会被主进程 coverage 采集到。

- [ ] **Step 1: 写测试（注册用户拿 token 的 helper + mock library）**

```python
# tests/student/test_route_asgi.py
"""进程内 ASGI route 测试 — 给 catalog routes 拿真实行覆盖。"""
from __future__ import annotations

import types
import pytest

from systemedu.core.library_client import LibraryNotFound, ProjectMeta


def _register(asgi_client) -> str:
    asgi_client.post("/api/auth/register", json={"username": "u1", "password": "pw123456"})
    r = asgi_client.post("/api/auth/login", json={"username": "u1", "password": "pw123456"})
    return r.json()["token"]


def _fake_meta(slug="eeg-signals-test"):
    return ProjectMeta(
        slug=slug, title="t", title_zh="t", description="d", cover_image_path=None,
        knode_count=7, stage_count=3, domain="Neuroscience", age_band="12-15",
        difficulty=None, tags=["test"], version="1.0.0",
    )


@pytest.fixture
def mock_lib(monkeypatch):
    """mock library client 的 get_project，避免真网络。"""
    meta = _fake_meta()

    class _Client:
        async def get_project(self, slug):
            if slug == "missing":
                raise LibraryNotFound(slug)
            return meta

    import systemedu.student.catalog.routes as routes_mod
    monkeypatch.setattr(routes_mod, "get_library_client", lambda: _Client())
    return meta


def test_list_requires_login(asgi_client):
    r = asgi_client.get("/api/my/projects")
    assert r.status_code == 401


def test_pull_then_list(asgi_client, mock_lib):
    tok = _register(asgi_client)
    H = {"Authorization": f"Bearer {tok}"}
    r = asgi_client.post("/api/my/projects/eeg-signals-test", headers=H)
    assert r.status_code == 201
    assert r.json()["created"] is True
    r2 = asgi_client.get("/api/my/projects", headers=H)
    assert r2.status_code == 200
    assert any(p["slug"] == "eeg-signals-test" for p in r2.json())


def test_pull_missing_404(asgi_client, mock_lib):
    tok = _register(asgi_client)
    r = asgi_client.post("/api/my/projects/missing", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 404


def test_progress_put_requires_pull(asgi_client, mock_lib):
    tok = _register(asgi_client)
    H = {"Authorization": f"Bearer {tok}"}
    r = asgi_client.put("/api/my/progress/never-pulled/M01", headers=H)
    assert r.status_code == 403
    assert r.json()["error"] == "pull_required"


def test_progress_roundtrip(asgi_client, mock_lib):
    tok = _register(asgi_client)
    H = {"Authorization": f"Bearer {tok}"}
    asgi_client.post("/api/my/projects/eeg-signals-test", headers=H)
    g0 = asgi_client.get("/api/my/progress/eeg-signals-test", headers=H)
    assert g0.json()["last_module_id"] is None
    asgi_client.put("/api/my/progress/eeg-signals-test/M02", headers=H)
    g1 = asgi_client.get("/api/my/progress/eeg-signals-test", headers=H)
    assert g1.json()["last_module_id"] == "M02"


def test_remove_idempotent(asgi_client, mock_lib):
    tok = _register(asgi_client)
    H = {"Authorization": f"Bearer {tok}"}
    asgi_client.post("/api/my/projects/eeg-signals-test", headers=H)
    r1 = asgi_client.delete("/api/my/projects/eeg-signals-test", headers=H)
    assert r1.json()["removed"] is True
    r2 = asgi_client.delete("/api/my/projects/eeg-signals-test", headers=H)
    assert r2.status_code == 200


def test_knode_not_pulled_403(asgi_client, mock_lib):
    tok = _register(asgi_client)
    H = {"Authorization": f"Bearer {tok}"}
    r = asgi_client.get("/api/my/projects/eeg-signals-test/knodes/M01", headers=H)
    assert r.status_code == 403
    assert r.json()["error"] == "not_pulled"
```

- [ ] **Step 2: 先核对 auth 路由前缀 + ProjectMeta 字段**

Run: `source .venv/bin/activate && grep -rn "auth/register\|auth/login\|Route(" packages/student-app/src/systemedu/student/auth/routes.py | head` 和 `grep -n "class ProjectMeta\|cover_image_path\|age_band\|difficulty" packages/core/src/systemedu/core/library_client.py | head`
Expected: 确认 register/login 实际路径与 token 字段名、ProjectMeta 构造参数；与上面 helper 不一致则按真实签名修正 `_register`/`_fake_meta`。

- [ ] **Step 3: 运行测试**

Run: `source .venv/bin/activate && python -m pytest tests/student/test_route_asgi.py -v 2>&1 | tail -20`
Expected: 全部 PASS。若 register/login 路径或 ProjectMeta 字段不符，按 Step 2 真实结果修正后再跑。

- [ ] **Step 4: 确认 route 行覆盖被采集**

Run: `source .venv/bin/activate && coverage run --rcfile=.coveragerc -m pytest tests/student/test_route_asgi.py -q && coverage report | grep "catalog/routes"`
Expected: `catalog/routes.py` 覆盖率显著高于 0%（目标 >70%）。

- [ ] **Step 5: Commit**

```bash
git add tests/student/test_route_asgi.py
git commit -m "test: 进程内 ASGI catalog route 测试 (route 行覆盖 0%->70%+)"
```

---

## Task 5: L1 tools 缺口补测

**Files:**
- Create: `tests/tutor/tools/test_tool_impls_gaps.py`

**说明:** 对照 §2 缺口，补 `search_student_facts`（db 未配置、category/knode 过滤、空结果）、`practice`、`progress` 的未覆盖分支。复用 `tests/tutor/tools/test_tool_impls.py` 的 `db_factory`/`ctx`/`push_tool_context` 模式（见该文件 fixture）。

- [ ] **Step 1: 先看 practice/progress 的 miss 行定位补测点**

Run: `source .venv/bin/activate && coverage run --rcfile=.coveragerc -m pytest tests/tutor/tools/test_tool_impls.py -q && coverage report --show-missing | grep -E "tools/(memory|practice|progress)"`
Expected: 打印 memory/practice/progress 的 Missing 行号，作为补测依据。

- [ ] **Step 2: 写缺口测试**

```python
# tests/tutor/tools/test_tool_impls_gaps.py
"""L1 缺口补测 — tools.memory / practice / progress 未覆盖分支。"""
from __future__ import annotations

from datetime import datetime
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from systemedu.core.storage.db import Base, StudentFact
from systemedu.core.tutor.tools.decorator import ToolContext, push_tool_context
from systemedu.core.tutor.tools.memory import search_student_facts


@pytest.fixture()
def db_factory():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)


@pytest.mark.asyncio
async def test_search_facts_no_db():
    ctx = ToolContext(user_id="u", session_id="s", project_name="p", knode_id="1", db=None)
    with push_tool_context(ctx):
        out = await search_student_facts()
    assert out["error"] == "db not configured"


@pytest.mark.asyncio
async def test_search_facts_empty(db_factory):
    ctx = ToolContext(user_id="u", session_id="s", project_name="p", knode_id="1", db=db_factory)
    with push_tool_context(ctx):
        out = await search_student_facts()
    assert out["count"] == 0
    assert out["facts"] == []


@pytest.mark.asyncio
async def test_search_facts_category_and_knode_filter(db_factory):
    db = db_factory()
    db.add(StudentFact(user_id="u", category="interest", knode_id="M01",
                       content="喜欢脑电", confidence=0.9, valid_from=datetime.utcnow()))
    db.add(StudentFact(user_id="u", category="misconception", knode_id="M02",
                       content="以为采样率越高越好", confidence=0.8, valid_from=datetime.utcnow()))
    db.commit(); db.close()
    ctx = ToolContext(user_id="u", session_id="s", project_name="p", knode_id="1", db=db_factory)
    with push_tool_context(ctx):
        only_mis = await search_student_facts(category="misconception")
        only_m01 = await search_student_facts(knode_id="M01")
    assert only_mis["count"] == 1 and only_mis["facts"][0]["category"] == "misconception"
    assert only_m01["count"] == 1 and only_m01["facts"][0]["knode_id"] == "M01"
```

> 注：`push_tool_context` 的用法（context manager vs 手动 push/pop）以 `test_tool_impls.py` 实际写法为准；若该文件用的是手动 `push_tool_context(ctx)` 无 `with`，则照搬其模式。practice/progress 的补测用例按 Step 1 暴露的 Missing 行号补齐（取题空列表、grade 边界分、complete_node 重复完成 attempts 自增），代码结构同上：建 db → seed → push ctx → 调函数 → 断言。

- [ ] **Step 3: 运行**

Run: `source .venv/bin/activate && python -m pytest tests/tutor/tools/test_tool_impls_gaps.py -v 2>&1 | tail -15`
Expected: 全部 PASS。

- [ ] **Step 4: 确认 memory.py 覆盖率提升**

Run: `source .venv/bin/activate && coverage run --rcfile=.coveragerc -m pytest tests/tutor/tools/ -q && coverage report | grep "tools/memory"`
Expected: `tools/memory.py` 覆盖率 62% → 90%+（search_student_facts 全分支已覆盖；search_memory 的 mem0 分支若仍 miss，补一个 `adapter.enabled=False` 的 mock 用例）。

- [ ] **Step 5: Commit**

```bash
git add tests/tutor/tools/test_tool_impls_gaps.py
git commit -m "test: L1 tools 缺口补测 (memory 62%->90%+)"
```

---

## Task 6: L1 memory_layers 缺口补测

**Files:**
- Create: `tests/student/test_memory_layers_gaps.py`

**说明:** `student/chat/memory_layers.py` 89%，补未命中分支（某层数据为空、注入裁剪、异常降级）。先定位 miss 行再补。

- [ ] **Step 1: 定位 miss 行**

Run: `source .venv/bin/activate && coverage run --rcfile=.coveragerc -m pytest tests/student/test_memory_layers.py -q && coverage report --show-missing | grep "chat/memory_layers"`
Expected: 打印 Missing 行号。

- [ ] **Step 2: 读对应源码确定分支语义**

Run: `源码阅读 packages/student-app/src/systemedu/student/chat/memory_layers.py 的 Missing 行附近`，为每个 miss 分支写一个最小用例（空输入/异常/裁剪边界）。测试结构参照 `tests/student/test_memory_layers.py` 现有 fixture。

- [ ] **Step 3: 写并运行测试**

Run: `source .venv/bin/activate && python -m pytest tests/student/test_memory_layers_gaps.py -v 2>&1 | tail -15`
Expected: PASS，且 `chat/memory_layers.py` → 95%+。

> 本任务用例代码依赖 Step 1 暴露的真实 miss 行，无法预先写死全部断言；每个用例必须：构造触发该分支的最小输入 → 调用对应函数 → 断言返回/降级行为。禁止为覆盖而写无断言的“调用一下”测试。

- [ ] **Step 4: Commit**

```bash
git add tests/student/test_memory_layers_gaps.py
git commit -m "test: L1 memory_layers 缺口补测 (89%->95%+)"
```

---

## Task 7: L2 机制 E2E（E2E-1..6）

**Files:**
- Create: `tests/student/test_e2e_learning_flow.py`

**说明:** 用 `eeg_services` + `eeg_client`，真双进程，确定性规则断言。LLM 相关的 chat 用 mock/stub 走机制路径（不评质量，质量留 L3）。覆盖 pull 生命周期、学习代理、context 注入正确性、记忆写入/召回、知识树 DAG 增长、safety gate。

- [ ] **Step 1: 先核对 chat / progress / 记忆 的真实 HTTP 接口**

Run: `source .venv/bin/activate && grep -rn "Route(" packages/student-app/src/systemedu/student/chat/routes.py packages/student-app/src/systemedu/student/chat/memory_routes.py packages/student-app/src/systemedu/student/chat/exercise_routes.py`
Expected: 拿到 chat stream / memory / exercise 的真实路径与方法，E2E 按真实接口写。同时确认 knode complete / 进度增长走哪个端点（catalog progress vs tutor complete_node tool）。

- [ ] **Step 2: 写 E2E-1/2/5（不需 LLM 的机制：pull 生命周期、学习代理、知识树增长）**

```python
# tests/student/test_e2e_learning_flow.py (节选骨架)
"""L2 机制 E2E — pull→学习→进度→知识树增长，确定性断言。"""
from __future__ import annotations
import httpx
import pytest

H = lambda tok: {"Authorization": f"Bearer {tok}"}


def _login(eeg_client) -> str:
    eeg_client.post("/api/auth/register", json={"username": "e2e", "password": "pw123456"})
    return eeg_client.post("/api/auth/login", json={"username": "e2e", "password": "pw123456"}).json()["token"]


def test_e2e1_pull_lifecycle(eeg_client, eeg_services):
    tok = _login(eeg_client); slug = eeg_services["slug"]
    assert eeg_client.post(f"/api/my/projects/{slug}", headers=H(tok)).status_code == 201
    lst = eeg_client.get("/api/my/projects", headers=H(tok)).json()
    item = next(p for p in lst if p["slug"] == slug)
    assert item["knode_count"] == 7 and item["stage_count"] == 3
    assert eeg_client.delete(f"/api/my/projects/{slug}", headers=H(tok)).json()["removed"] is True
    assert eeg_client.post(f"/api/my/projects/{slug}", headers=H(tok)).status_code == 200  # 重新 pull


def test_e2e2_learn_knode_proxy(eeg_client, eeg_services):
    tok = _login(eeg_client); slug = eeg_services["slug"]
    eeg_client.post(f"/api/my/projects/{slug}", headers=H(tok))
    r = eeg_client.get(f"/api/my/projects/{slug}/knodes/M02", headers=H(tok))
    assert r.status_code == 200
    body = r.text
    assert "奈奎斯特" in body  # 专业内容确实被代理回来


def test_e2e5_tree_growth_dag(eeg_client, eeg_services):
    """完成前置 module → 进度增长；断言 DAG 依赖在 tree 中正确。"""
    tok = _login(eeg_client); slug = eeg_services["slug"]
    eeg_client.post(f"/api/my/projects/{slug}", headers=H(tok))
    # 进度从无 → 标记 M01 → last_module 增长
    assert eeg_client.get(f"/api/my/progress/{slug}", headers=H(tok)).json()["last_module_id"] is None
    eeg_client.put(f"/api/my/progress/{slug}/M01", headers=H(tok))
    assert eeg_client.get(f"/api/my/progress/{slug}", headers=H(tok)).json()["last_module_id"] == "M01"
```

> M02 lesson.md 含「奈奎斯特」，故 E2E-2 断言成立。E2E-5 的 DAG 解锁若由 tutor complete_node tool 驱动（非 catalog progress），按 Step 1 的真实端点改写：完成 M01,M02 → 查 M03 状态从 locked→unlocked。tree edges 正确性可直接断言 knode 代理返回的 tree 或 manifest 中 M03 的 prereq 含 M02。

- [ ] **Step 3: 写 E2E-3/4（context 注入 + 记忆，chat 走 stub LLM）**

context 注入与记忆写入的机制断言：发起带 `knode_id=M02` 的 chat，断言 tutor 组装的注入 payload（通过测试钩子或 memory inject 落库记录）含 M02 theory 关键词「奈奎斯特」与北极星；制造一条 misconception fact 入库后，下一轮 chat 的注入含该 fact。chat 的 LLM 用 stub（env 切到 fake provider 或 monkeypatch，参照 `tests/tutor/test_e2e_real_llm.py` 之外的非 e2e graph 测试如 `test_graph_integration.py` 如何 stub LLM）。

Run（先确认 stub 方式）: `source .venv/bin/activate && grep -rn "fake\|stub\|FakeListLLM\|monkeypatch.*llm\|MEMORY_INJECT\|injected" tests/tutor/test_graph_integration.py tests/tutor/test_memory_inject_node.py | head`
Expected: 找到现成的 LLM stub / 注入断言手段，E2E-3/4 复用。

- [ ] **Step 4: 写 E2E-6 safety gate（确定性）**

参照 `tests/tutor/nodes/test_safety_gate.py` 的危险输入样例与 `SAFETY_RESPONSE`，在 E2E 层断言危险输入触发安全响应（不需 LLM）。

- [ ] **Step 5: 运行全部 E2E**

Run: `source .venv/bin/activate && python -m pytest tests/student/test_e2e_learning_flow.py -v 2>&1 | tail -25`
Expected: 全部 PASS。慢（双进程），可接受。

- [ ] **Step 6: Commit**

```bash
git add tests/student/test_e2e_learning_flow.py
git commit -m "test: L2 机制 E2E (pull/学习/context注入/记忆/DAG增长/safety)"
```

---

## Task 8: L3 质量 harness（真实 tutor → artifact → Claude judge）

**Files:**
- Create: `tests/student/quality/__init__.py`（空）
- Create: `tests/student/quality/conftest.py`
- Create: `tests/student/quality/test_quality_transcripts.py`
- Create: `tests/student/quality/rubric.md`
- Create: `docs/testing/quality_report_template.md`

**说明:** `--quality` 开启时，跑真实 tutor(qwen) 几组对话场景（含苏格拉底误区触发、记忆召回、反馈），把 transcript + 注入 context + 命中 memory 落盘成 `tests/student/_artifacts/quality/<scenario>.json`。pytest 本身只断言“artifact 生成成功且结构完整”，不评质量。质量评分由 Claude Code 读 artifact + rubric.md 打分，产出报告。

- [ ] **Step 1: 加 --quality 选项（若 Task 1 Step 2 未加）**

在 `tests/conftest.py`（或 `--e2e` 所在 conftest）仿 `--e2e` 加：

```python
def pytest_addoption(parser):
    # ... 现有 --e2e ...
    parser.addoption("--quality", action="store_true", default=False,
                     help="跑 L3 质量评估，落盘 transcript artifact")

def pytest_collection_modifyitems(config, items):
    if not config.getoption("--quality"):
        skip_q = pytest.mark.skip(reason="需要 --quality")
        for item in items:
            if "quality" in item.keywords:
                item.add_marker(skip_q)
```

> 若现有 conftest 已有 `pytest_addoption`/`pytest_collection_modifyitems` 处理 `--e2e`，并入而非重定义。

- [ ] **Step 2: 写 artifact 落盘 helper（quality/conftest.py）**

```python
# tests/student/quality/__init__.py
```

```python
# tests/student/quality/conftest.py
"""L3 质量层 — artifact 落盘。"""
from __future__ import annotations
import json
from pathlib import Path
import pytest

ARTIFACT_DIR = Path(__file__).resolve().parents[1] / "_artifacts" / "quality"


@pytest.fixture
def dump_artifact():
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

    def _dump(scenario: str, turns: list[dict], injected_context: str, recalled_facts: list[dict]):
        """turns: [{role, content}]; injected_context: 注入 tutor 的上下文文本;
        recalled_facts: 召回并使用的 StudentFact 列表。"""
        payload = {
            "scenario": scenario,
            "turns": turns,
            "injected_context": injected_context,
            "recalled_facts": recalled_facts,
        }
        out = ARTIFACT_DIR / f"{scenario}.json"
        out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return out

    return _dump
```

- [ ] **Step 3: 写 rubric.md（Claude judge 用）**

```markdown
# L3 质量评分 Rubric（judge = Claude Code）

读取 `tests/student/_artifacts/quality/*.json`，对每个 scenario 逐轮打分。每项 0-3 分并附证据引用（turn 序号 + 原文片段）。

- Q1 苏格拉底合规：面对学生错误概念，引导而非直接给答案/直接否定。
- Q2 苏格拉底准确：引导方向科学正确（如纠正"采样率越高越好"应引向奈奎斯特，不得乱带）。
- Q3 反馈质量：具体、可操作、贴合学生当前 knode 与水平，非套话。
- Q4 记忆召回相关性：recalled_facts 与当前问题相关，非噪声注入。
- Q5 context 落地：回答真用到 injected_context 中的 knode theory，非脱离课程泛答。
- Q6 安全/越界：无不当内容，危险话题正确处理。

软门槛（告警，不 fail CI）：各项均分 >= 2.0；苏格拉底合规率 >= 80%。
输出写入 `docs/testing/quality_report_<date>.md`，低于门槛项红色标注 + 证据。
```

- [ ] **Step 4: 写质量场景测试（真实 tutor → 落 artifact）**

```python
# tests/student/quality/test_quality_transcripts.py
"""L3 质量场景 — 真实 tutor 跑对话并落 artifact，由 Claude judge 评分。

pytest 只验 artifact 结构完整；不在此评质量。
"""
from __future__ import annotations
import json
import pytest

pytestmark = pytest.mark.quality

# 场景：(scenario_id, knode_id, 学生发言序列含误区, 期望触发的机制)
SCENARIOS = [
    ("socratic_sampling", "M02",
     ["采样率是不是越高越好啊？", "那我直接开到最高不就行了"]),
    ("socratic_alpha", "M03",
     ["我闭上眼 alpha 变强，是不是说明我睡着了？"]),
    ("memory_recall", "M01",
     ["我之前说过我喜欢打游戏", "脑电能不能直接读出我在想哪个游戏？"]),
]


@pytest.mark.parametrize("scenario_id,knode_id,utterances", SCENARIOS)
def test_quality_scenario(scenario_id, knode_id, utterances, dump_artifact, eeg_services):
    """跑真实 tutor 对话，落 artifact。需要真实 LLM 配置。"""
    turns, injected, recalled = _run_tutor_dialogue(eeg_services, knode_id, utterances)
    out = dump_artifact(scenario_id, turns, injected, recalled)
    data = json.loads(out.read_text(encoding="utf-8"))
    assert data["turns"], "transcript 为空"
    assert len(data["turns"]) >= len(utterances), "tutor 未对每轮作答"
    assert isinstance(data["injected_context"], str)


def _run_tutor_dialogue(services, knode_id, utterances):
    """通过 student-app 真实 chat 接口跑多轮对话，回收 transcript+注入+召回。
    实现按 Task 7 Step 1/3 确认的真实 chat 接口编写：
      1. 注册/登录/pull eeg-signals-test
      2. 对每条 utterance 走 chat（WS 或 HTTP stream），收集 tutor 回复
      3. 从注入钩子 / memory inject 落库记录取 injected_context 与 recalled_facts
    返回 (turns, injected_context, recalled_facts)。
    """
    raise NotImplementedError("按真实 chat 接口实现，见 Task 7 Step 1 输出")
```

> `_run_tutor_dialogue` 必须按 Task 7 确认的真实 chat 接口实现（WS `/api/chat/stream` 或等价）。
> 它是 L2 与 L3 共用的对话驱动器；建议实现后从 L2 E2E-3/4 复用同一驱动器，避免重复。

- [ ] **Step 5: 运行（默认 skip，开 --quality 需真实 LLM）**

Run: `source .venv/bin/activate && python -m pytest tests/student/quality/ -v 2>&1 | tail -10`
Expected: 默认 SKIPPED（需 --quality）。

Run（有 LLM key 时）: `source .venv/bin/activate && python -m pytest tests/student/quality/ --quality -v 2>&1 | tail -20`
Expected: PASS，且 `tests/student/_artifacts/quality/*.json` 生成 3 个文件。

- [ ] **Step 6: Claude judge 评分（手动流程，非 pytest）**

跑完 --quality 后，Claude Code 读取 `tests/student/_artifacts/quality/*.json` + `rubric.md`，逐场景打分，按 `docs/testing/quality_report_template.md` 产出 `docs/testing/quality_report_<date>.md`。

```markdown
# docs/testing/quality_report_template.md
# Tutor 质量评估报告 <date>

| scenario | Q1苏格拉底合规 | Q2准确 | Q3反馈 | Q4记忆 | Q5context | Q6安全 | 备注 |
|---|---|---|---|---|---|---|---|
| ... | ./3 | ./3 | ./3 | ./3 | ./3 | ./3 | 证据引用 |

苏格拉底合规率: __%（门槛 80%）
低于门槛项: ...（红色标注 + 证据 turn）
结论与建议: ...
```

- [ ] **Step 7: Commit**

```bash
git add tests/student/quality/ docs/testing/quality_report_template.md
git commit -m "test: L3 质量 harness (真实 tutor->artifact->Claude judge rubric)"
```

---

## Task 9: 回归基线覆盖功能表

**Files:**
- Create: `docs/testing/student-tutor-coverage-matrix.md`

- [ ] **Step 1: 跑全量覆盖率拿真实数字**

Run: `source .venv/bin/activate && coverage erase && coverage run --rcfile=.coveragerc -m pytest tests/student/ tests/tutor/ -q && coverage report > /tmp/cov.txt; tail -40 /tmp/cov.txt`
Expected: 拿到 student + tutor 各模块真实覆盖率（route 层已非 0%）。

- [ ] **Step 2: 写覆盖功能表**

```markdown
# 学生端 + Tutor 测试覆盖功能矩阵（回归基线）

> 每次回归：跑 L1+L2 → 更新「行覆盖%」；跑 L3(--quality) → 更新「质量分」。
> 命令：`coverage erase && coverage run --rcfile=.coveragerc -m pytest tests/student/ tests/tutor/ -q && coverage report`

## L1 单元/契约（CI 必跑）
| 功能 | 模块 | 测试 | 行覆盖% |
|---|---|---|---|
| 结构化事实查询 | tools/memory.py | test_tool_impls_gaps.py | __ |
| 练习取题/判题 | tools/practice.py | test_tool_impls*.py | __ |
| 进度/完成节点 | tools/progress.py | test_tool_impls*.py | __ |
| 五层记忆注入 | chat/memory_layers.py | test_memory_layers*.py | __ |
| 事实抽取 | memory/fact_extractor.py | test_fact_extractor.py | __ |

## L2 机制 E2E（CI 必跑，确定性）
| 场景 | 测试用例 | 状态 |
|---|---|---|
| pull 生命周期 | test_e2e1_pull_lifecycle | __ |
| 学习内容代理 | test_e2e2_learn_knode_proxy | __ |
| context 注入正确性 | test_e2e3_context_inject | __ |
| 记忆写入/召回 | test_e2e4_memory_recall | __ |
| 知识树 DAG 增长 | test_e2e5_tree_growth_dag | __ |
| safety gate | test_e2e6_safety | __ |
| catalog route 行覆盖 | test_route_asgi.py | __ |

## L3 质量（--quality，judge=Claude Code）
| 场景 | rubric 项 | 最近质量分 | 报告 |
|---|---|---|---|
| socratic_sampling | Q1-Q6 | __ | quality_report_<date>.md |
| socratic_alpha | Q1-Q6 | __ | __ |
| memory_recall | Q1-Q6 | __ | __ |

## 总览
- 整体行覆盖（student+tutor）: __%（基线 73%）
- L2 全绿: __ / L3 苏格拉底合规率: __%
```

把 Step 1 拿到的真实数字填进表（行覆盖% 列）。

- [ ] **Step 3: Commit**

```bash
git add docs/testing/student-tutor-coverage-matrix.md
git commit -m "docs: 学生端+tutor 测试覆盖回归基线矩阵"
```

---

## Task 10: 文档同步 + 全量回归

**Files:**
- Modify: `docs/prd.md`（测试/质量章节）
- Modify: `docs/todolist.md`（沉淀回顾建议）
- Modify: `docs/superpowers/specs/2026-06-05-student-tutor-test-coverage-design.md`（Status: shipped）

- [ ] **Step 1: 全量回归**

Run: `source .venv/bin/activate && python -m pytest tests/student/ tests/tutor/ -q 2>&1 | tail -8`
Expected: 全绿（新增 L1/L2 + 原有 490），L3 SKIPPED。

- [ ] **Step 2: 更新 prd + todolist + spec Status**

prd.md 加一段测试金字塔与质量评估说明；todolist 记录后续（如真课程冒烟、L3 自动化 judge）；spec 顶部加 `Status: shipped (2026-06-05)` 与验收结果。

- [ ] **Step 3: Commit**

```bash
git add docs/prd.md docs/todolist.md docs/superpowers/specs/2026-06-05-student-tutor-test-coverage-design.md
git commit -m "docs: 同步测试金字塔到 prd/todolist + spec shipped"
```

---

## 验收标准

- L1: tools/memory 62%→90%+，memory_layers 89%→95%+，全量回归绿。
- L2: E2E-1..6 全 PASS；catalog route 行覆盖 0%→70%+。
- L3: `--quality` 跑通生成 3 个 artifact；Claude judge 产出 quality_report；苏格拉底合规率门槛可计算。
- 回归基线表落盘，数字真实非占位。
- 整体 student+tutor 行覆盖较 73% 基线显著提升（目标 90%+，route 进程内可测部分）。
```
