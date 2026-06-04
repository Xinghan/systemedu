# 037-cloud-realtime-proxy-revert

**Status**: draft (2026-06-04)
**Owner**: Xinghan Cui
**Created**: 2026-06-04
**Reverts**: 033-library-clone (catalog 落盘部分)

## 背景 / 问题

SystemEdu 是 **cloud 版本**: 用户所有操作在浏览器里, 服务端不该有"per-user 本地落盘"。Day-1 架构意图是:

- library-app 是**唯一**课程数据源 (`~/.systemedu-library/db.sqlite` + `media/projects/<slug>/`)。
- student-app **不持有任何课程内容**, 通过 HTTP 实时调 library `/v1/*`。
- student-app 的 PostgreSQL **只存 per-user 关联 + 行为**: `user_projects` (pull 关联), `last_visited` (进度), `chat_sessions`/`chat_messages`, `student_facts`。
- pull 项目 = DB 里多一行关联记录; 学习时 knode/file **实时代理** library。

这套设计从 day-1 就对, 并且 library 浏览 (`/api/library/*` → `library_proxy/routes.py`) 和 chat 一直是这么跑的。

### 病灶: spec 033 把 catalog 改成了本地落盘

spec 033 (2026-05-19) 把 catalog 路径改成 per-user 本地磁盘存储:

- pull 时 `download_project(slug)` 下载 tarball → `extract_tarball_safely` 解压到
  `~/.systemedu/student/users/<uid>/projects/<slug>/<version>/`。
- 学习时 knode/file 从这个本地目录读 `manifest.json` + 文件。
- `user_projects` 表加了 `cloned_version` / `local_path` / `cloned_at` 三列。
- 新增 `catalog/storage.py` 全套本地磁盘逻辑。

这违反 cloud 架构: 服务端不该有 per-user 文件落盘。多实例 / 容器重启 / 水平扩展全部会出问题, 而且跟系统其余部分 (library 浏览 + chat) 用的实时代理模式不一致。

### 附带问题: 封面用占位 SVG, 不用真封面

`/my-projects` 卡片 (ForkCard) 和 dashboard active 卡片用 `CoverArt` (domain SVG 占位), 而不是作者生成的真封面。`/library` 页已经有正确实现 `CoverPhoto` (真封面 `<img>` + onError 降级 `CoverArt`), 应复用。

## 目标 (WHAT)

1. **catalog 回退成无状态实时代理**:
   - pull 只 `upsert_user_project(user_id, slug, library_version=...)` 记一行, **不下载/解压任何文件**。
   - remove 软删关联 + 清进度, **不碰文件系统**。
   - 学习时 knode/file **实时代理** library `/v1` 端点 (复用 `library_proxy` 模式)。
2. **删除本地落盘代码**: 删除 `catalog/storage.py`; `routes.py` 去掉 storage 相关 import 和调用。
3. **db.py 三列保留不写**: `cloned_version` / `local_path` / `cloned_at` 保留 (无 migration), `upsert_user_project` 停止接收/写入这三个参数。
4. **前端封面用真封面**: my-projects ForkCard + dashboard active 卡片复用 `CoverPhoto` (真封面 + onError 降级 `CoverArt`)。
5. **补全测试**: pull / remove / progress / knode / file 全流程测试, 用 mock library client。
6. **清理文档/记忆中所有不符合 cloud 版本的"本地优先"记录**。

## 非目标 (Out of Scope)

- 不改 library-app (`/v1/projects/{slug}/knodes/{id}` / `files/{path}` / `cover` 已存在)。
- 不做 db migration (三列保留)。
- 不改 chat / memory / library 浏览路径 (本来就对)。
- 不改 library 公开 API 的"只暴露元信息"想法 — 当前 `/v1` 已返回全套内容, 实时代理直接转发即可; 是否收窄 library 公开面是另一个 spec 的事。

## 方案 (HOW)

### 后端: `catalog/routes.py` 重写四个端点

参照 `library_proxy/routes.py` 已验证的实时代理模式 (`get_library_client()` + license token + `_lib_error_response`)。

- **`api_my_projects_pull`** (POST `/api/my/projects/{slug}`):
  - 解析 `target_version` (沿用现逻辑: 从 library 取 latest 或用请求指定)。
  - `upsert_user_project(user_id, slug, library_version=target_version)` — **仅此**。
  - 删除: `download_project` / `extract_tarball_safely` / 临时目录 / 原子 rename / `cloned_*` 写入。
  - 返回 pull 成功的 JSON (slug + version + status)。
- **`api_my_projects_remove`** (DELETE `/api/my/projects/{slug}`):
  - `soft_remove_user_project` + `delete_last_visited` 保留。
  - 删除 `cleanup_local_project(user_id, slug)` 调用。
- **`api_my_project_knode`** (GET `/api/my/projects/{slug}/knodes/{id}`):
  - 先校验该 user 已 pull (`get_user_project` 存在且未软删) → 否则 403。
  - 已 pull: `await get_library_client().get_knode(slug, knode_id)` 转发 JSON。
  - 删除本地 `manifest.json` + 文件读取逻辑。
- **`api_my_project_file`** (GET `/api/my/projects/{slug}/files/{path}`):
  - 先校验已 pull → 否则 403。
  - 已 pull: stream-forward library `/v1/projects/{slug}/files/{path}` (复制 `library_proxy/routes.py` `api_library_file` 的流式转发)。
  - 删除本地 `FileResponse`。
- import 块去掉 `from .storage import cleanup_local_project, extract_tarball_safely, project_local_dir`。

### 后端: 删除 `catalog/storage.py`

整个文件是本地磁盘逻辑 (`user_data_root` / `project_local_dir` / `extract_tarball_safely` / `cleanup_local_project` / `project_disk_usage`)。无状态代理后无任何引用。删除整文件。

### 后端: `db.py` 三列保留不写

- `user_projects` 表 `cloned_version` / `local_path` / `cloned_at` 三列**保留** (无 migration, 避免动 schema)。
- `upsert_user_project` 去掉这三个参数, INSERT/UPDATE 不再设置它们 (旧行残留值不清理, 但不再读)。

### 前端: 真封面

复用 `/library` 页的 `CoverPhoto` 模式:

```tsx
function CoverPhoto({ slug, dClass }: { slug: string; dClass: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <CoverArt kind={dClass} />
  return (
    <div style={{ height: 168, position: "relative", overflow: "hidden",
      background: "#15110d", borderBottom: "1px solid var(--border)" }}>
      <img src={library.coverUrl(slug)} alt="" onError={() => setFailed(true)}
        style={{ width: "100%", height: "100%", objectFit: "cover",
          objectPosition: "center 48%", display: "block" }} />
    </div>
  )
}
```

- **my-projects ForkCard** (line 444): `<CoverArt kind={dClass} />` →
  `f.cover_image_path ? <CoverPhoto slug={f.slug} dClass={dClass} /> : <CoverArt kind={dClass} />`。
- **dashboard active 卡片** (home/page.tsx): active project 卡片同样改真封面 + 降级。
- 两处各自定义 `CoverPhoto` 局部组件 (或抽到共享文件); 由 plan 决定是否抽公共。
- 数据已具备: `MyProjectItem.cover_image_path` 存在; `library.coverUrl(slug)` =
  `${STUDENT_API_URL}/api/library/projects/${slug}/cover` (已通过 `library_proxy` 代理到 library `/v1/.../cover`)。

### 测试 (mock library client)

`reset_library_client_for_tests()` + mock `AsyncLibraryClient`。覆盖:

- **pull**: 成功后 `user_projects` 有一行 (slug + version), **不创建任何本地目录/文件** (断言 filesystem 无写入), 不写 `cloned_*` 三列。
- **remove**: 软删 `user_projects` + 清 `last_visited`, 不碰文件系统; re-pull 后进度重置。
- **knode 代理**: 已 pull → 返回 mock library `get_knode` 的内容; 未 pull → 403。
- **file 代理**: 已 pull → 流式转发 mock library 文件; 未 pull → 403。
- **progress**: get/put `last_visited` (沿用现有 test_progress.py, 确认 remove 清进度仍通过)。

放在 `tests/student/test_catalog.py` (扩展) + `tests/student/test_progress.py` (已有)。

### 文档 / 记忆清理

清理所有"本地优先 / 数据存本地 SQLite / per-user 落盘"残留, 与 cloud 版本一致:

- `CLAUDE.md`: L9 开篇定义, L289/L292/L293 决策日志条目。
- `docs/prd.md`: L5/L7/L10/L13/L104/L113/L571-573/L591。
- `docs/superpowers/specs/2026-04-16-tutor-memory-system-design.md`: local-first 表述。
- `specs/033-library-clone/spec.md`: 顶部加 `Status: reverted by spec 037 (2026-06-04)`。
- **保留不动**: `MEMORY.md` L95 (content-production tarball, 是内容生产侧不是 runtime);
  `docs/archive/KIMI.md` (归档)。

## 验收标准

- pull 一个项目后, `user_projects` 多一行, 服务端文件系统**无任何** per-user 写入。
- 学习页能正常拉 knode (lesson/theories/slides) 和 file (anim/game HTML), 全部实时来自 library。
- 未 pull 的项目访问 knode/file 返回 403。
- remove 后 `user_projects` 软删 + `last_visited` 清空; re-pull 进度从零。
- `catalog/storage.py` 不存在; 全仓无对它的 import。
- my-projects + dashboard 卡片显示作者真封面; 无封面项目降级 domain SVG。
- 全部测试通过 (mock library client)。
- 文档/记忆无"本地优先 / 服务端落盘"残留 (除内容生产侧 tarball)。
