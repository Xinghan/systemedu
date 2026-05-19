# 033-library-clone — Plan

**Status**: draft

## 1. 目录结构 / 存储路径

### 1.1 Student-app 本地项目目录

```
~/.systemedu/student/
├── student.db                            (spec 027 老 SQLite, 生产 PG 时不存在)
└── users/
    └── <user_id>/                        每用户独立目录, 隔离
        └── projects/
            └── <library_slug>/
                └── <version>/             多版本隔离, 支持升级时回滚
                    ├── manifest.json
                    ├── blueprint/         (README.md + README.zh.md)
                    ├── tree/              (knowledge_tree.json)
                    └── knodes/
                        ├── M01-w0-.../
                        │   ├── lesson.md
                        │   ├── sections.json
                        │   ├── theories.json
                        │   ├── audio_scripts.json
                        │   ├── assignment.md
                        │   └── media/
                        │       └── *.html
                        ...
```

**为啥用 `<user_id>` 而不是共享**: 多用户场景下, 每用户独立目录能彻底隔离。同一项目同一版本在两个用户书架里, 会**重复一份** (浪费空间, 但简单, 没并发锁等问题)。生产可加一层 dedup 层 (用 sha256 索引), 现阶段先不做。

**为啥用 `<version>` 子目录**: 用户升级后能保留老版本作"回退点", 或一直留着追求稳定性。

### 1.2 配置

环境变量:
- `STUDENT_USER_DATA_ROOT` — 默认 `~/.systemedu/student/users/`, 测试时改 `tmp_path` 用
- (现有) `LIBRARY_BASE_URL`, `LIBRARY_LICENSE_TOKEN`

代码:
```python
# student/catalog/storage.py (新增)
def project_local_dir(user_id: str, slug: str, version: str) -> Path:
    root = Path(os.environ.get("STUDENT_USER_DATA_ROOT", Path.home() / ".systemedu" / "student" / "users"))
    return root / user_id / "projects" / slug / version
```

---

## 2. DB Schema 变化

### 2.1 `user_projects` 加列

```python
class UserProject(Base):
    __tablename__ = "user_projects"
    id = ...
    user_id = ...
    library_slug = ...
    library_version = Column(String(64), nullable=True)  # "服务端可见的当前版本"
    cloned_version = Column(String(64), nullable=True)   # 新增: "本地实际下载的版本"
    local_path = Column(String(512), nullable=True)      # 新增: 本地解压绝对路径
    cloned_at = Column(DateTime, nullable=True)          # 新增: clone 完成时间
    pulled_at = ...                                       # 不变, 含义改成 "首次 pull / 最后一次操作时间"
    removed_at = ...
```

**migration**: alembic 加 3 列 (`cloned_version`, `local_path`, `cloned_at`), 默认 NULL, 兼容老记录 (老记录 = 老式 pull, 没本地文件, 学习时返回 "请重新 Pull")。

### 2.2 LastVisited / ChatSession 等不动

跟项目内容不直接相关, 不受影响。

---

## 3. Library API 变化

### 3.1 不变的 (公开, 简介)

- `GET /v1/projects` — 项目列表
- `GET /v1/projects/<slug>` — 项目元信息 (title / summary / cover / version / 模块数)
- `GET /v1/projects/<slug>/tree` — knowledge_tree.json (模块结构)
- `GET /v1/projects/<slug>/blueprint` — README.md
- `GET /v1/projects/<slug>/manifest` — manifest.json (sha256 + 文件清单, 用于 clone 完整性自检)

### 3.2 新增

- `GET /v1/projects/<slug>/download` — 返回项目 tarball
  - Header: `Authorization: Bearer <LICENSE_TOKEN>`
  - Response: `application/gzip`, `Content-Disposition: attachment; filename="<slug>-<version>.tar.gz"`
  - 内部实现: 从 `PROJECTS_MEDIA_DIR/<slug>/` 现场 `tar czf` 或读 admin import 时存的 raw tarball 缓存
  - **方案**: import 时把原始 tarball 也存一份到 `PROJECTS_MEDIA_DIR/<slug>/_archive/<slug>-<version>.tar.gz`, download 直接 stream 这个文件 (省 CPU + 一致性强)

### 3.3 移除 / 改 admin-only

- `GET /v1/projects/<slug>/knodes/<id>` — **删** (或改成 admin-only, 给 library-admin-ui 用)
- `GET /v1/projects/<slug>/files/<path>` — **删** (同上)

破坏性变化, 但客户端只有 student-app, 我们一起改。

### 3.4 Importer 顺带改

`packages/library-app/src/library/importer.py` 在 import tarball 时:
- 现在: 把 tarball 解压到 PROJECTS_MEDIA_DIR + 把 knode 详细字段写 DB
- 新增: 同时把原始 tarball 拷到 `_archive/<slug>-<version>.tar.gz`
- DB 里的 `rendered_sections` / `theories` 等大字段可以保留 (做兼容), 也可以清掉省空间 (反正不再暴露)。**决策**: 保留, 用于 admin debug, 学生不读

---

## 4. Student-app API 变化

### 4.1 pull (POST `/api/my/projects/<slug>`) 改造

```python
async def api_my_projects_pull(request):
    user_id = await require_login(request)
    slug = path_param
    
    # 1. 拿 library 当前元信息
    meta = await library_client.get_project(slug)
    
    # 2. 检查本地是否已有此版本
    existing = get_user_project(user_id, slug)
    if existing and existing.cloned_version == meta.version and existing.local_path:
        local = Path(existing.local_path)
        if local.exists() and (local / "manifest.json").exists():
            # 已 clone 过同版本, 重置 removed_at 即可
            existing.removed_at = None
            db.commit()
            return JSONResponse({"created": False, ...})
    
    # 3. 真下载 + 解压
    target_dir = project_local_dir(user_id, slug, meta.version)
    tmp_dir = target_dir.with_suffix(".tmp")
    try:
        tarball = await library_client.download_project(slug)  # bytes 或 tempfile
        tmp_dir.mkdir(parents=True, exist_ok=True)
        with tarfile.open(fileobj=BytesIO(tarball), mode="r:gz") as tf:
            tf.extractall(tmp_dir, filter="data")  # 安全过滤
        # 4. atomic rename
        if target_dir.exists():
            shutil.rmtree(target_dir)
        tmp_dir.rename(target_dir)
    except Exception:
        if tmp_dir.exists():
            shutil.rmtree(tmp_dir, ignore_errors=True)
        raise
    
    # 5. 写 DB
    project, created = upsert_user_project(
        user_id, slug,
        library_version=meta.version,
        cloned_version=meta.version,
        local_path=str(target_dir),
        cloned_at=datetime.utcnow(),
    )
    return JSONResponse({"created": created, ...})
```

**关键点**:
- `tmp_dir` + atomic rename: 下载失败时不留半成品
- `filter="data"`: Python 3.12+ tarfile 安全过滤, 阻止 `../../etc/passwd` 越界
- `meta.version` 是 library 当前发布版本; 同版本不重下

### 4.2 新增 GET `/api/my/projects/<slug>/knodes/<knode_id>`

```python
async def api_my_project_knode(request):
    user_id = await require_login(request)
    slug = path_param
    knode_id = path_param  # 例如 'M11'
    
    up = get_user_project(user_id, slug)
    if not up or up.removed_at or not up.local_path:
        return JSONResponse({"error": "not_pulled"}, status_code=403)
    
    local = Path(up.local_path)
    if not local.exists():
        return JSONResponse({"error": "local_missing", "hint": "重新 Pull"}, status_code=410)
    
    # 读 manifest 找 knode_dir
    manifest = json.loads((local / "manifest.json").read_text())
    entry = next((k for k in manifest["knodes"] if k["module_id"] == knode_id), None)
    if not entry:
        return JSONResponse({"error": "knode_not_found"}, status_code=404)
    
    knode_dir = local / entry["knode_dir"]
    
    # 读各种文件 + 拼数据
    sections = json.loads((knode_dir / "sections.json").read_text())
    theories = json.loads((knode_dir / "theories.json").read_text())
    audio = json.loads((knode_dir / "audio_scripts.json").read_text())
    lesson_md = (knode_dir / "lesson.md").read_text()
    assignment_md = (knode_dir / "assignment.md").read_text() if (knode_dir / "assignment.md").exists() else ""
    
    # **关键修复**: 把 idea.{mode}_path 回填到 rendered_sections[id].html_path
    rendered = sections.get("rendered_sections", {})
    for idea in sections.get("ideas", []):
        idea_id = idea.get("idea_id")
        mode = idea.get("mode")
        path_key = f"{mode}_path"
        if idea.get(path_key) and idea_id in rendered:
            rendered[idea_id]["html_path"] = idea[path_key]
    
    return JSONResponse({
        "project_slug": slug,
        "knode_id": knode_id,
        "title": entry.get("title"),
        "week": entry.get("week"),
        "stage": entry.get("stage"),
        "duration_minutes": entry.get("duration_minutes"),
        "knode_dir": entry["knode_dir"],
        "plan_markdown": lesson_md,
        "rendered_sections": sections,   # 保持跟现在结构兼容 (整个 sections.json)
        "audio_scripts": audio,
        "assignment_md": assignment_md,
        "theories": theories,
        "files": [f for f in manifest.get("files", []) if f["path"].startswith(entry["knode_dir"] + "/")],
        "version": up.cloned_version,
    })
```

返回结构跟现在 library `get_knode` 一致, 让 student-web `gateway.ts.knodeToCourseContent` 不用改太多 — 但 rendered_sections 里的 html_path 已经被填好了, **inlineHtmlPaths 会工作**。

### 4.3 新增 GET `/api/my/projects/<slug>/files/<path:path>`

```python
async def api_my_project_file(request):
    user_id = await require_login(request)
    slug = path_param
    file_path = path_param
    
    up = get_user_project(user_id, slug)
    if not up or up.removed_at or not up.local_path:
        return JSONResponse({"error": "not_pulled"}, status_code=403)
    
    local = Path(up.local_path)
    target = local / file_path
    
    # 安全: 防止 ../ 越界
    try:
        target = target.resolve()
        local_resolved = local.resolve()
        if not str(target).startswith(str(local_resolved)):
            return JSONResponse({"error": "forbidden"}, status_code=403)
    except Exception:
        return JSONResponse({"error": "bad_path"}, status_code=400)
    
    if not target.exists() or not target.is_file():
        return JSONResponse({"error": "not_found"}, status_code=404)
    
    ct, _ = mimetypes.guess_type(file_path)
    return FileResponse(target, media_type=ct or "application/octet-stream")
```

直接读本地 + 安全 path resolution, 不再走 library 代理。

### 4.4 删除 (DELETE `/api/my/projects/<slug>`) 改造

```python
async def api_my_projects_remove(request):
    user_id = await require_login(request)
    slug = path_param
    
    up = get_user_project(user_id, slug)
    if not up or up.removed_at:
        return JSONResponse({"removed": False})
    
    # 软删 DB
    soft_remove_user_project(user_id, slug)
    
    # 真删本地目录 (释放磁盘)
    if up.local_path:
        local = Path(up.local_path)
        if local.exists():
            shutil.rmtree(local, ignore_errors=True)
        # 顺手清空 slug 父目录 (如果没别的版本了)
        parent = local.parent  # .../projects/<slug>/
        if parent.exists() and not any(parent.iterdir()):
            parent.rmdir()
    
    return JSONResponse({"removed": True})
```

### 4.5 现有 API 处理

- `api_library_knode` (`/api/library/projects/<slug>/knodes/<id>`) — **删** (老的)
- `api_library_file` (`/api/library/projects/<slug>/files/<path>`) — **删**
- `api_library_list / api_library_get / api_library_tree / api_library_blueprint` — **保留** (浏览 library 简介)
- `api_library_manifest` — **保留** (新增之前, library 也提供 manifest)

### 4.6 LibraryClient 加 `download_project`

```python
# packages/student-app/src/systemedu/student/library_proxy/client.py
class LibraryClient:
    async def download_project(self, slug: str) -> bytes:
        url = f"{self.base_url}/v1/projects/{slug}/download"
        async with httpx.AsyncClient(timeout=60.0) as c:
            r = await c.get(url, headers={"Authorization": f"Bearer {self.license_token}"})
            r.raise_for_status()
            return r.content
```

Tarball ≤ 50MB (现实情况 < 1MB), 直接 in-memory 即可。再大再用 stream + tempfile。

---

## 5. Student-web 变化

### 5.1 gateway.ts

```typescript
// 现在: 调 /api/library/projects/<slug>/knodes/<id>
// 改成: 调 /api/my/projects/<slug>/knodes/<id>

// 现在: inlineHtmlPaths 走 /api/library/projects/<slug>/files/...
// 改成: 走 /api/my/projects/<slug>/files/...
```

`knodeToCourseContent` 数据结构不变 (后端已经填好 html_path), 但是要**删掉之前的"topic alias workaround"** (因为后端拼数据时已经直接做了正确的 idea_id → rendered_sections 映射, 不需要 topic 别名兜底)。**保守做法**: 第一阶段保留 alias 逻辑, 第二阶段做完 e2e 验证后再清理。

### 5.2 /library/<slug> 详情页

- 已有 `library` API 拿 `tree` + `blueprint`, 不变
- 加 "Pull 项目" 按钮, 调 `POST /api/my/projects/<slug>`
- Pull 完成后跳 `/my-projects/<slug>` 或 `/my-projects/<slug>/learn/M01`

### 5.3 /my-projects/<slug>/learn/<module_id>

- gateway 调 `/api/my/projects/...` 而不是 `/api/library/...`
- 错误处理: 403 not_pulled → 跳 library 详情页提示 pull; 410 local_missing → 提示重新 Pull

---

## 6. 实现顺序 (Tasks 预览)

P0 = 必须做; P1 = 必须做但可推后; P2 = 可选

1. **P0** Library 加 `/v1/projects/<slug>/download` + importer 存 archive 副本
2. **P0** student-app DB migration: `cloned_version` + `local_path` + `cloned_at` 三列
3. **P0** student-app `LibraryClient.download_project` + 解压 + 安全 filter
4. **P0** `api_my_projects_pull` 改造 + 单元测试 (mock library, 验证落地的目录结构)
5. **P0** `api_my_project_knode` + 单元测试 (验证 html_path 注入 + 文件读取)
6. **P0** `api_my_project_file` + 安全 path resolve 单元测试
7. **P0** `api_my_projects_remove` 真删本地目录
8. **P0** student-web gateway 改 endpoint
9. **P0** 端到端测试: pull → learn → 看到 anim/game → 卸载, M09/M10/M11 数据流通过
10. **P1** 删 / 屏蔽 library 老的 knode + files API
11. **P1** Library 详情页加 "版本更新提示" 逻辑
12. **P2** Migration: 老 user_projects (cloned_version=NULL) 自动重 pull 或友好提示
13. **P2** /my-projects 显示磁盘占用统计

---

## 7. 影响面 / 风险评估

| 改动 | 文件 | 行数 | 风险 |
|---|---|---|---|
| Library `/download` | `library-app/src/library/routes/public.py` + `importer.py` | ~80 | 低 |
| Student-app DB 列 | `student-app/src/systemedu/student/db.py` + `alembic/versions/*.py` | ~40 | 中 (Migration) |
| Student-app pull 改造 | `student-app/src/systemedu/student/catalog/routes.py` + 新建 `storage.py` | ~200 | 中 |
| Student-app 2 个新 API | `catalog/routes.py` (knode + file) | ~150 | 中 |
| Student-app 老 library API 删 | `library_proxy/routes.py` | ~50 | 低 (但破坏性) |
| Student-web gateway endpoint 切换 | `student-web/src/lib/api/gateway.ts` | ~20 | 低 |

总计大约 540 行 + 测试 ~300 行。一次 PR 完成, 不分拆 (因为牵扯 API 切换不能半拉子)。

---

## 8. 测试策略

### 8.1 Library 单元测试 (pytest)
- `/v1/projects/<slug>/download` 返 200 + correct binary + correct headers
- 没有 license token 401
- 不存在的 slug 404

### 8.2 Student-app 单元测试 (pytest, mock library)
- `download_project` 拿到 tarball 字节
- `api_my_projects_pull` 完整流程: 调 library / 解压 / DB 写入 / 目录存在
- 解压失败时 tmp_dir 清掉, DB 不写 (异常路径测试)
- Tar slip 攻击 (恶意 tarball 含 `../etc/passwd`) 被拒
- `api_my_project_knode` 读本地, 返完整数据, **特别验证 anim/game/diagram 的 rendered_sections[id].html_path 被填上了**
- `api_my_project_file` 安全 path: `..` 越界拒绝, 正常路径流出文件
- `api_my_projects_remove` 软删 DB + 真删目录

### 8.3 端到端测试 (Playwright, spec 已有 e2e fixture)
- 用户登录 → `/library` 看到 PurpleAir
- 进 `/library/purpleair-airquality-node` 详情, 点 Pull
- 跳 `/my-projects/purpleair-airquality-node/learn/M11`
- 看到 anim canvas 渲染出来 (检查 iframe + canvas 元素)
- 看到 game 渲染出来
- 点退出, **关掉 library 服务**, 重新 SSH 进 `/my-projects/.../learn/M11` 还能正常工作

### 8.4 验证 anim/game 真的能渲染
- 直接 fetch `/api/my/projects/purpleair-airquality-node/knodes/M11`, 检查响应:
  - `rendered_sections.rendered_sections.<anim_id>.html_path === "media/animation-..."`
  - `rendered_sections.ideas[?].animation_path` 仍存在 (兼容)
- 前端 `inlineHtmlPaths` 应该能匹配 html_path, fetch HTML, 注入 section.html

---

## 9. 部署 / Migration

### 9.1 数据迁移
- alembic 加列 (`cloned_version`, `local_path`, `cloned_at`), 全 NULL
- 启动 student-app 时检查每个 UserProject:
  - `local_path IS NULL` → 标记为 "老式 pull, 需要重新 Pull"
  - student-web 显示这种项目时, 标红 + 按钮 "重新 Pull 以查看完整内容"

### 9.2 上线步骤
1. **Library**: 先部署 (加 `/download` + admin import 写 archive)
2. **跑 Re-import** (用 admin UI 重新 import 现有 v0.3.5 等, 让 archive 生成); 或者写一个 backfill 脚本扫描 PROJECTS_MEDIA_DIR 重新打 tarball 存 archive
3. **Student-app**: 部署 (新 API + migration)
4. **Student-web**: 部署 (gateway endpoint 切换)
5. 用户首次进入 my-projects, 跳出 "重新 Pull" 提示, 用户主动重新 pull 拿到完整本地副本

### 9.3 回滚预案
- Library 老 API (`/knodes/<id>` 等) 第一阶段**保留但加 deprecation header**, student-app 仍有兜底回退, 等所有用户重 pull 后再删
- DB migration 是 nullable 加列, 回滚只删列即可

---

## 10. Future / 不在本次范围

- 跨用户共享 storage (sha256 dedup): clone 多个用户都用同一份硬盘文件
- 增量同步: rsync / git-like diff
- 本地版本管理 (用户能"切换到 v0.3.4 历史版本")
- 学习进度云同步
- 项目签名 (CA / pgp 给 tarball 加密签名)
- 内置离线模式 (现在的 spec 已经天然支持 — 但需要 UI 明确表态 "你已离线")
