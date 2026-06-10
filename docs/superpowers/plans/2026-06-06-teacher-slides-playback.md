# 老师讲课 — 幻灯片播放全链路 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把已生成但未接通的 slides.json 接通到学习页"老师讲课"场景，渲染可翻页的幻灯片播放器（标题+正文+讲稿常显，音频占位）。

**Architecture:** 4 层补全 — library importer 读 slides.json 入 Knode.slides 列；library knode API 返回 slides；前端 LibraryKnodeContent 类型加 slides；TeacherSceneView 从 myProjects.getKnode 自取 slides 渲染翻页播放器。已 import 的 eeg/purpleair 用一次性回填脚本补 slides 列。

**Tech Stack:** library-app (FastAPI + SQLAlchemy + SQLite, create_all 无 alembic), student-app 反代, student-web (Next.js + TS), pytest。

---

## File Structure

- `packages/library-app/src/library/models.py` (Modify) — Lesson 表加 `slides` 列。
- `packages/library-app/src/library/importer.py` (Modify) — 读 slides.json 写 lesson.slides。
- `packages/library-app/src/library/routes/public.py` (Modify) — get_knode 返回加 slides。
- `packages/student-web/src/lib/api/index.ts` (Modify) — LibraryKnodeContent 加 slides 字段。
- `packages/student-web/src/components/learning/teacher-scene-view.tsx` (Rewrite) — slides 翻页播放器。
- `scripts/backfill_slides.py` (Create) — 给已 import 项目加列 + 回填 slides。
- `tests/test_library_slides.py` (Create) — library importer + API slides 测试。

---

## Task 1: library Lesson 表加 slides 列

**Files:**
- Modify: `packages/library-app/src/library/models.py:131` (theories 列后)

- [ ] **Step 1: 加 slides 列**

在 `models.py` Lesson 类的 `theories = Column(...)` 行 (约 131) 之后加一行：

```python
    theories = Column(JSON, nullable=False, default=list)
    slides = Column(JSON, nullable=False, default=list)  # slides.json 的 slides 数组
```

- [ ] **Step 2: 验证模型可导入 + 新建 DB 含该列**

Run: `cd /Users/xinghan/Dev/systemedu && source .venv/bin/activate && python -c "
from library.models import Lesson
assert hasattr(Lesson, 'slides'), 'slides column missing'
print('slides column OK')
" 2>&1 | tail -3`
（若 import 路径报错，用 `PYTHONPATH=packages/library-app/src python -c ...`）
Expected: `slides column OK`

- [ ] **Step 3: Commit**

```bash
cd /Users/xinghan/Dev/systemedu
git add packages/library-app/src/library/models.py
git commit -m "feat(library): Lesson 表加 slides 列"
```

---

## Task 2: importer 读 slides.json

**Files:**
- Modify: `packages/library-app/src/library/importer.py:143` (theories 读取后)
- Test: `tests/test_library_slides.py`

- [ ] **Step 1: 写失败测试 — importer 读 slides.json 入库**

```python
# tests/test_library_slides.py
"""library slides 链路测试 (spec 2026-06-06)。"""
from __future__ import annotations

import json
from pathlib import Path


def _make_knode_dir(tmp: Path) -> Path:
    """造一个含 slides.json 的 knode 目录。"""
    kd = tmp / "knodes" / "M01-w0-x"
    kd.mkdir(parents=True)
    (kd / "lesson.md").write_text("# M01\n", encoding="utf-8")
    (kd / "sections.json").write_text('{"sections":[]}', encoding="utf-8")
    (kd / "audio_scripts.json").write_text('{"scripts":[]}', encoding="utf-8")
    (kd / "theories.json").write_text("[]", encoding="utf-8")
    (kd / "slides.json").write_text(
        json.dumps({"slides": [
            {"slide_id": "intro", "kind": "intro", "title": "开场",
             "body_markdown": "正文", "audio_script": "讲稿文字", "payload": {}}
        ]}, ensure_ascii=False),
        encoding="utf-8",
    )
    return kd


def test_read_json_safely_reads_slides(tmp_path):
    """importer 的 _read_json_safely 能读 slides.json 的 slides 数组。"""
    import sys
    sys.path.insert(0, "packages/library-app/src")
    from library.importer import _read_json_safely

    kd = _make_knode_dir(tmp_path)
    data = _read_json_safely(kd / "slides.json", default={})
    slides = data.get("slides", []) if isinstance(data, dict) else []
    assert len(slides) == 1
    assert slides[0]["slide_id"] == "intro"
    assert slides[0]["audio_script"] == "讲稿文字"
```

- [ ] **Step 2: 运行测试 (应失败前先确认 import 可行 / 或直接体现待实现)**

Run: `cd /Users/xinghan/Dev/systemedu && source .venv/bin/activate && python -m pytest tests/test_library_slides.py::test_read_json_safely_reads_slides -v 2>&1 | tail -8`
Expected: PASS（_read_json_safely 已存在，本步其实验证读取逻辑正确——它是后续 importer 接线的基础）。若 import library 失败，在测试顶部加 `sys.path.insert(0, "packages/library-app/src")`（已含）。

- [ ] **Step 3: importer 接线 — 写 lesson.slides**

在 `importer.py` 的 `lesson.theories = _read_json_safely(... "theories.json", default=[])` 行 (约 143) 之后加：

```python
                    lesson.theories = _read_json_safely(knode_dir / "theories.json", default=[])
                    _slides_doc = _read_json_safely(knode_dir / "slides.json", default={})
                    lesson.slides = (
                        _slides_doc.get("slides", [])
                        if isinstance(_slides_doc, dict)
                        else (_slides_doc if isinstance(_slides_doc, list) else [])
                    )
```

- [ ] **Step 4: 写 importer 端到端测试 (import 一个含 slides 的 tarball → DB lesson.slides 非空)**

```python
# 追加到 tests/test_library_slides.py
def test_importer_writes_slides_to_db(tmp_path, monkeypatch):
    """import 含 slides.json 的项目 → Lesson.slides 入库。"""
    import sys
    sys.path.insert(0, "packages/library-app/src")
    monkeypatch.setenv("LIBRARY_HOME", str(tmp_path / "libhome"))
    # 重置 settings/engine 让 LIBRARY_HOME 生效
    import importlib
    from library import settings as _s
    importlib.reload(_s)
    from library import models as _m
    importlib.reload(_m)
    _m.init_db()

    # 这里复用 tests/student/conftest 的 tarball 构造思路: 造最小 tarball
    # (含 manifest + tree + 1 knode + slides.json), 调 import_tarball, 查 DB。
    # 具体 tarball 构造参照 tests/student/_fixtures/eeg_project.py 的 build_eeg_tarball,
    # 但需在该 knode 目录额外写 slides.json。
    # 由于 tarball 构造较长, 实现时: 复制 build_eeg_tarball 逻辑 + 给每个 knode 加 slides.json,
    # 然后:
    #   from library.importer import import_tarball  (确认真实函数名)
    #   import_tarball(tarball_path)
    #   with _m.get_session() as db:
    #       lesson = db.query(_m.Lesson).filter_by(knode_id="M01").first()
    #       assert lesson.slides and lesson.slides[0]["slide_id"]
    pass  # 见 Step 5 实现说明
```

> 注：本 Step 的 tarball 端到端测试实现时，先 `grep -n "def import" packages/library-app/src/library/importer.py` 确认导入函数真实名（如 `import_tarball`），再补全断言。tarball 构造复用 `tests/student/_fixtures/eeg_project.py:build_eeg_tarball` 模式 + 每个 knode 目录加 `slides.json`。断言：`lesson.slides[0]["slide_id"] == "intro"`。**若端到端 tarball 测试在此环境构造成本过高，可改为更轻的单元测试**：直接构造 Lesson 行 `Lesson(slides=[{...}])` 存取，验证列可读写 JSON——但优先做真 import 测试。

- [ ] **Step 5: 运行全部 slides 测试**

Run: `cd /Users/xinghan/Dev/systemedu && source .venv/bin/activate && python -m pytest tests/test_library_slides.py -v 2>&1 | tail -12`
Expected: 全部 PASS。

- [ ] **Step 6: Commit**

```bash
cd /Users/xinghan/Dev/systemedu
git add packages/library-app/src/library/importer.py tests/test_library_slides.py
git commit -m "feat(library): importer 读 slides.json 入 Lesson.slides"
```

---

## Task 3: library knode API 返回 slides

**Files:**
- Modify: `packages/library-app/src/library/routes/public.py:222` (theories 后)

- [ ] **Step 1: get_knode 返回加 slides**

在 `public.py` get_knode 的 return dict 里 `"theories": lesson.theories,` (约 222) 之后加：

```python
            "theories": lesson.theories,
            "slides": lesson.slides,
```

- [ ] **Step 2: 写 API 测试 (knode 端点返回含 slides key)**

```python
# 追加到 tests/test_library_slides.py — 用 TestClient 打 get_knode
def test_get_knode_returns_slides_key(tmp_path, monkeypatch):
    """get_knode 响应含 slides 字段 (即使空也要有 key)。"""
    import sys, importlib
    sys.path.insert(0, "packages/library-app/src")
    monkeypatch.setenv("LIBRARY_HOME", str(tmp_path / "libhome2"))
    from library import settings as _s; importlib.reload(_s)
    from library import models as _m; importlib.reload(_m)
    _m.init_db()
    # seed 一个 published project + lesson(slides 非空)
    with _m.get_session() as db:
        from library.models import Project, Lesson, ProjectStatus
        db.add(Project(slug="p1", title="t", status=ProjectStatus.published,
                       manifest_json={}, version="1.0.0"))
        db.add(Lesson(project_slug="p1", knode_id="M01", title="t",
                      slides=[{"slide_id":"s1","kind":"intro","title":"x",
                               "body_markdown":"b","audio_script":"a","payload":{}}],
                      version="1.0.0"))
        db.commit()
    from library.routes.public import get_knode
    out = get_knode("p1", "M01")
    assert "slides" in out
    assert out["slides"][0]["slide_id"] == "s1"
```

> 注：`Project` / `Lesson` / `ProjectStatus` 的构造参数以 models.py 真实字段为准（Project 必填 manifest_json 等），实现时 `grep -n "class Project\|class Lesson\|nullable=False" models.py` 核对必填列补齐。`get_knode` 是普通函数可直接调（非必须走 TestClient）。

- [ ] **Step 3: 运行**

Run: `cd /Users/xinghan/Dev/systemedu && source .venv/bin/activate && python -m pytest tests/test_library_slides.py::test_get_knode_returns_slides_key -v 2>&1 | tail -8`
Expected: PASS。

- [ ] **Step 4: Commit**

```bash
cd /Users/xinghan/Dev/systemedu
git add packages/library-app/src/library/routes/public.py tests/test_library_slides.py
git commit -m "feat(library): knode API 返回 slides"
```

---

## Task 4: 回填脚本 (已 import 的 eeg/purpleair)

**Files:**
- Create: `scripts/backfill_slides.py`

**说明:** create_all 不给已存在表加列。脚本: ALTER TABLE 加列 (若无) → 从 media 目录读 slides.json → UPDATE lessons。

- [ ] **Step 1: 写脚本**

```python
# scripts/backfill_slides.py
"""一次性回填: 给 library DB 的 lessons 表加 slides 列并从 media 读 slides.json。

用法: python scripts/backfill_slides.py
读 LIBRARY_HOME (默认 ~/.systemedu-library)。
"""
from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path

LIBRARY_HOME = Path(os.environ.get("LIBRARY_HOME", str(Path.home() / ".systemedu-library")))
DB_PATH = LIBRARY_HOME / "db.sqlite"
MEDIA = LIBRARY_HOME / "media" / "projects"


def main() -> None:
    if not DB_PATH.exists():
        raise SystemExit(f"DB not found: {DB_PATH}")
    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()
    # 1. 加列 (若不存在)
    cols = [r[1] for r in cur.execute("PRAGMA table_info(lessons)").fetchall()]
    if "slides" not in cols:
        cur.execute("ALTER TABLE lessons ADD COLUMN slides JSON DEFAULT '[]'")
        print("added slides column")
    else:
        print("slides column already exists")
    # 2. 回填: 遍历 media/projects/<slug>/knodes/*/slides.json
    n = 0
    for row in cur.execute("SELECT id, project_slug, knode_dir FROM lessons").fetchall():
        lid, slug, knode_dir = row
        if not knode_dir:
            continue
        sj = MEDIA / slug / knode_dir / "slides.json"
        if not sj.exists():
            continue
        try:
            doc = json.loads(sj.read_text(encoding="utf-8"))
            slides = doc.get("slides", []) if isinstance(doc, dict) else (doc if isinstance(doc, list) else [])
        except Exception:
            continue
        cur.execute("UPDATE lessons SET slides = ? WHERE id = ?", (json.dumps(slides, ensure_ascii=False), lid))
        n += 1
    conn.commit()
    conn.close()
    print(f"backfilled {n} lessons")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 跑回填 (真实 DB)**

Run: `cd /Users/xinghan/Dev/systemedu && python scripts/backfill_slides.py 2>&1 | tail -5`
Expected: `added slides column`（或 already exists）+ `backfilled N lessons`（N 应 ~110 = eeg 62 + purpleair 48）。

- [ ] **Step 3: 验证回填生效 (重启 library 后 knode API 返回 slides 非空)**

Run: `cd /Users/xinghan/Dev/systemedu && lsof -ti:18821 | xargs kill -9 2>/dev/null; sleep 1; source .venv/bin/activate && LIBRARY_HOME=~/.systemedu-library nohup .venv/bin/uvicorn library.main:app --host 127.0.0.1 --port 18821 --app-dir packages/library-app/src > .run/library.log 2>&1 & sleep 4; curl -s --noproxy '*' http://127.0.0.1:18821/v1/projects/eeg-minecraft-bci/knodes/M01 -H "Authorization: Bearer dev-license-027" 2>/dev/null | python3 -c "import sys,json;d=json.load(sys.stdin);print('slides len:', len(d.get('slides',[])))" 2>&1 | tail -3`
Expected: `slides len: N`（M01 应 >0；eeg M01 之前确认有 slides）。
> 注：library 的 license token 以实际为准（restart-student.sh 里是 `dev-license-027`）；端点鉴权头按真实 header 名。若 /v1 health 路径不同，仅以 knode 返回为准。

- [ ] **Step 4: Commit**

```bash
cd /Users/xinghan/Dev/systemedu
git add scripts/backfill_slides.py
git commit -m "feat(library): slides 回填脚本 (已 import 项目加列+读 media)"
```

---

## Task 5: 前端 LibraryKnodeContent 加 slides 类型

**Files:**
- Modify: `packages/student-web/src/lib/api/index.ts:94` (version 后)

- [ ] **Step 1: 加 slides 字段**

先确认 SlideEntry 已在 types 导出可复用：`grep -n "SlideEntry" packages/student-web/src/lib/types/api.ts`（应有，约 720）。
在 `index.ts` 的 `LibraryKnodeContent` interface 里 `version?: string` (约 94) 后加：

```typescript
  version?: string
  slides?: import("../types/api").SlideEntry[]
```

（若文件顶部已 import 了 types，直接用 `SlideEntry[]` 并在顶部 import 区加 `SlideEntry`；inline import 是兜底写法。）

- [ ] **Step 2: 类型检查通过**

Run: `cd /Users/xinghan/Dev/systemedu/packages/student-web && npx tsc --noEmit 2>&1 | grep -i "index.ts\|SlideEntry\|error" | head -5 || echo "no type errors in index.ts"`
Expected: 无 index.ts 相关类型错误。

- [ ] **Step 3: Commit**

```bash
cd /Users/xinghan/Dev/systemedu
git add packages/student-web/src/lib/api/index.ts
git commit -m "feat(web): LibraryKnodeContent 加 slides 字段"
```

---

## Task 6: TeacherSceneView 幻灯片播放器

**Files:**
- Rewrite: `packages/student-web/src/components/learning/teacher-scene-view.tsx`

**说明:** 当前是 stub。改造为: 用 `myProjects.getKnode(projectName, moduleId)` 取 slides → 翻页播放器（标题 + body_markdown + audio_script 讲稿常显 + 禁用播放按钮 + 上/下一张 + 进度 + 空态）。moduleId 来源：props 没直接给 moduleId，但 `knode` (KnodeInfo) 有 `module_id?`；调用处也能拿到。实现时优先用 `knode?.module_id`，无则从 props 增加 moduleId。

- [ ] **Step 1: 确认 props 能拿到 moduleId**

Run: `grep -n "TeacherSceneView\|module_id\|moduleId" packages/student-web/src/components/learning/course-content-view.tsx | head`
确认调用处 (约 2783) 能传 moduleId。**实现决策**: 给 TeacherSceneViewProps 显式加 `moduleId: string`，并在 course-content-view 调用处补传 `moduleId={knode?.module_id ?? String(nodeId)}`（nodeId 已是 prop）。这样数据来源明确，不依赖 knode 内部字段。

- [ ] **Step 2: 改造 course-content-view 调用处补传 moduleId**

在 `course-content-view.tsx` 的 `<TeacherSceneView ... />` (约 2783) 加一个 prop：

```tsx
            <TeacherSceneView
              knode={knode}
              projectName={projectName}
              nodeId={nodeId}
              moduleId={knode?.module_id ?? String(nodeId)}
              versionLabel={
                v3SelectedVersion ||
                v3Versions.find((v) => v.is_active)?.version_label ||
                null
              }
              courseContent={content as CourseContent | undefined ?? null}
            />
```

> 若调用处当前未传 `courseContent`，以现有真实代码为准，只新增 `moduleId` 一行，不动其它 prop。

- [ ] **Step 3: 重写 teacher-scene-view.tsx**

```tsx
"use client"

/**
 * 老师讲课 — 幻灯片播放器 (spec 2026-06-06)。
 * 从 myProjects.getKnode 取 knode.slides, 翻页展示 (标题 + 正文 + 讲稿常显)。
 * 音频占位: 禁用的播放按钮 (音频文件由用户单独生成后接入)。
 */

import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, Play } from "lucide-react"

import { myProjects } from "@/lib/api"
import type { SlideEntry } from "@/lib/types/api"
import { MarkdownRenderer } from "@/components/chat/markdown-renderer"

interface TeacherSceneViewProps {
  knode: unknown
  projectName: string
  nodeId: number
  moduleId: string
  versionLabel: string | null
  courseContent?: unknown
}

export function TeacherSceneView({ projectName, moduleId }: TeacherSceneViewProps) {
  const [slides, setSlides] = useState<SlideEntry[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [err, setErr] = useState(false)

  useEffect(() => {
    let cancelled = false
    setSlides(null); setErr(false); setIdx(0)
    myProjects
      .getKnode(projectName, moduleId)
      .then((k) => {
        if (cancelled) return
        setSlides((k.slides as SlideEntry[]) ?? [])
      })
      .catch(() => {
        if (cancelled) return
        setErr(true); setSlides([])
      })
    return () => { cancelled = true }
  }, [projectName, moduleId])

  if (slides === null) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--sub)]">
        加载讲课幻灯片...
      </div>
    )
  }

  if (err || slides.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--paper-2)] text-sm text-[var(--sub)]">
        <p>本节暂无讲课幻灯片</p>
      </div>
    )
  }

  const slide = slides[idx]
  const atFirst = idx === 0
  const atLast = idx === slides.length - 1

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      {/* slide 主区 */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8">
        <h2 className="mb-4 text-2xl font-semibold text-[var(--ink)]">{slide.title}</h2>
        <div className="prose prose-sm max-w-none text-[var(--ink)]">
          <MarkdownRenderer content={slide.body_markdown || ""} />
        </div>
      </div>

      {/* 讲稿区 (常显) + 音频占位 */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--paper-2)] p-4">
        <div className="mb-2 flex items-center gap-2">
          <button
            type="button"
            disabled
            title="音频生成中"
            className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs text-[var(--sub)] opacity-60 cursor-not-allowed"
          >
            <Play size={12} /> 播放 (音频生成中)
          </button>
          <span className="text-xs text-[var(--sub)]">讲稿</span>
        </div>
        <p className="text-sm leading-relaxed text-[var(--ink)] whitespace-pre-wrap">
          {slide.audio_script || "(本张无讲稿)"}
        </p>
      </div>

      {/* 导航 */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={atFirst}
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
        >
          <ChevronLeft size={14} /> 上一张
        </button>
        <span className="text-sm text-[var(--sub)]">{idx + 1} / {slides.length}</span>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={atLast}
          onClick={() => setIdx((i) => Math.min(slides.length - 1, i + 1))}
        >
          下一张 <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
```

> 实现前确认两处真实导出：
> 1. `grep -n "MarkdownRenderer\|export" packages/student-web/src/components/chat/markdown-renderer.tsx` — 确认组件名与 prop 名 (是 `content` 还是 `children`/`text`)；不符则按真实签名改。
> 2. `grep -n "getKnode" packages/student-web/src/lib/api/index.ts` — 确认 `myProjects.getKnode(slug, knodeId)` 签名 (返回 LibraryKnodeContent，含 slides)。

- [ ] **Step 4: 类型检查 + 构建**

Run: `cd /Users/xinghan/Dev/systemedu/packages/student-web && npx tsc --noEmit 2>&1 | grep -iE "teacher-scene|error TS" | head -8 || echo "no teacher-scene type errors"`
Expected: 无 teacher-scene-view 相关类型错误。

- [ ] **Step 5: Commit**

```bash
cd /Users/xinghan/Dev/systemedu
git add packages/student-web/src/components/learning/teacher-scene-view.tsx packages/student-web/src/components/learning/course-content-view.tsx
git commit -m "feat(web): TeacherSceneView 幻灯片翻页播放器 (讲稿常显+音频占位)"
```

---

## Task 7: 端到端验收 + 文档

**Files:**
- Modify: `docs/todolist.md`, `docs/superpowers/specs/2026-06-06-teacher-slides-playback-design.md`

- [ ] **Step 1: 重启系统**

Run: `cd /Users/xinghan/Dev/systemedu && bash scripts/restart-student.sh 2>&1 | tail -6`
Expected: backend ready + web pid。

- [ ] **Step 2: 端到端验证 slides 到前端**

Run: `cd /Users/xinghan/Dev/systemedu && U="slidev_$(date +%s)"; TOK=$(curl -s --noproxy '*' -X POST http://127.0.0.1:18820/api/auth/register -H 'Content-Type: application/json' -d "{\"username\":\"$U\",\"password\":\"pw123456\"}" | python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))"); curl -s --noproxy '*' -X POST http://127.0.0.1:18820/api/my/projects/eeg-minecraft-bci -H "Authorization: Bearer $TOK" -o /dev/null; curl -s --noproxy '*' "http://127.0.0.1:18820/api/my/projects/eeg-minecraft-bci/knodes/M01" -H "Authorization: Bearer $TOK" | python3 -c "import sys,json;d=json.load(sys.stdin);print('slides len:', len(d.get('slides') or []))"`
Expected: `slides len: N`（N>0，证明全链路通：library→反代→前端可取）。

- [ ] **Step 3: 浏览器手动验收**

打开 http://localhost:4000 → 登录 → pull eeg-minecraft-bci → 进 M01 学习页 → 切"老师讲课" → 应看到幻灯片（标题/正文/讲稿）、能翻页、音频按钮灰显"音频生成中"。

- [ ] **Step 4: 更新文档**

- spec 顶部加 `Status: shipped (2026-06-06)` + 验收结果。
- todolist 若有"老师讲课"相关项标记完成；加一条后续"slides 音频文件生成 + 接入播放"（用户单独处理）。

- [ ] **Step 5: Commit**

```bash
cd /Users/xinghan/Dev/systemedu
git add docs/todolist.md docs/superpowers/specs/2026-06-06-teacher-slides-playback-design.md
git commit -m "docs: 老师讲课 slides 链路 shipped + todolist 音频后续项"
```

---

## 验收标准

- library knode API 返回 slides（eeg/purpleair 回填后非空）。
- 反代 knode 响应含 slides（无需改 KnodeContent dataclass — public.py 直接返回，反代透传 __dict__ 已带；若反代是 dataclass 映射需确认，见下注）。
- 前端"老师讲课"渲染幻灯片翻页 + 讲稿 + 音频占位，不再空。
- backfill 脚本对 eeg+purpleair 生效。
- library slides 测试全 PASS。

> **反代注意**: spec §3 L3 提到 KnodeContent dataclass 加 slides。但 catalog route `api_my_project_knode` 用 `copy.deepcopy(k.__dict__)` 返回 KnodeContent 实例的 dict — 若 dataclass 无 slides 字段，则 from_dict 不会映射、__dict__ 也无 slides。**Task 6 前必须确认**: `grep -n "slides\|class KnodeContent\|from_dict" packages/core/src/systemedu/core/library_client/client.py`。若 KnodeContent 无 slides，需加 `slides: Any = None` + from_dict 映射 `d.get("slides")`（与 audio_scripts 同模式）。**此为 Task 3 与 Task 5 之间的必要补充任务，见 Task 3.5。**

---

## Task 3.5: 反代 KnodeContent 加 slides 映射 (必要)

**Files:**
- Modify: `packages/core/src/systemedu/core/library_client/client.py` (KnodeContent dataclass + from_dict)

- [ ] **Step 1: 确认 KnodeContent 结构**

Run: `grep -n "class KnodeContent\|audio_scripts\|theories\|from_dict\|d.get" packages/core/src/systemedu/core/library_client/client.py | head`
Expected: 看到 dataclass 字段 (audio_scripts/theories 等) + from_dict 里的 `d.get(...)` 映射。

- [ ] **Step 2: 加 slides 字段 + 映射**

在 KnodeContent dataclass 的 `audio_scripts: Any = None` 附近加 `slides: Any = None`；在 from_dict 里 `audio_scripts=d.get("audio_scripts"),` 附近加 `slides=d.get("slides"),`。（以真实字段名/行为准，与 audio_scripts 完全同模式。）

- [ ] **Step 3: 验证反代映射**

Run: `cd /Users/xinghan/Dev/systemedu && source .venv/bin/activate && python -c "
from systemedu.core.library_client.client import KnodeContent
k = KnodeContent.from_dict({'knode_id':'M01','slides':[{'slide_id':'x'}]})
assert k.slides and k.slides[0]['slide_id']=='x', k.slides
print('KnodeContent.slides OK')
"`
Expected: `KnodeContent.slides OK`

- [ ] **Step 4: Commit**

```bash
cd /Users/xinghan/Dev/systemedu
git add packages/core/src/systemedu/core/library_client/client.py
git commit -m "feat(core): 反代 KnodeContent 加 slides 映射"
```

> 执行顺序: Task 1 → 2 → 3 → 3.5 → 4 → 5 → 6 → 7。
