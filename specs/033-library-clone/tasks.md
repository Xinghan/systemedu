# 033-library-clone — Tasks

**Status**: shipped (2026-05-19)

按 plan.md 第 6 节顺序拆。每条对应一个可独立提交的 commit。

---

## P0 必做

### T1: Library 加 `/download` + import 时存 archive

- [ ] `packages/library-app/src/library/importer.py`: import 时把原始 tarball 拷到 `PROJECTS_MEDIA_DIR/<slug>/_archive/<slug>-<version>.tar.gz`
- [ ] `packages/library-app/src/library/routes/public.py`: 新增 `GET /v1/projects/<slug>/download` 端点, license token 鉴权, stream `_archive/<slug>-<version>.tar.gz`
- [ ] 测试: `tests/library/test_download.py`
  - [ ] 不带 token 401
  - [ ] 错 token 403
  - [ ] 正确 token + 已 import 的项目 200 + binary
  - [ ] 不存在的 slug 404
- [ ] 写 backfill 脚本 `scripts/library_backfill_archives.py`: 扫现有 PROJECTS_MEDIA_DIR, 把每个 slug 重新 tar 出来存 archive (给已 import 的项目用)

### T2: Student-app DB migration

- [ ] `packages/student-app/src/systemedu/student/db.py`: `UserProject` 加 3 列
  - [ ] `cloned_version: String(64) | None`
  - [ ] `local_path: String(512) | None`
  - [ ] `cloned_at: DateTime | None`
- [ ] `packages/student-app/alembic/versions/<rev>_add_user_project_clone_fields.py`: 写 migration
- [ ] 跑 `alembic upgrade head` 验证 dev DB
- [ ] 测试: 老记录 (3 列 NULL) 仍可读取, helper 函数兼容

### T3: Student-app LibraryClient.download_project

- [ ] `packages/student-app/src/systemedu/student/library_proxy/client.py`: 加 `async def download_project(self, slug: str) -> bytes`
- [ ] 测试: `tests/student/test_library_client_download.py` (mock httpx, 验证 url + auth header + bytes return)

### T4: Student-app pull 改造

- [ ] 新建 `packages/student-app/src/systemedu/student/catalog/storage.py`:
  - [ ] `project_local_dir(user_id, slug, version) -> Path`
  - [ ] `extract_tarball_safely(data: bytes, target_dir: Path) -> None` (tar slip 防御)
  - [ ] `cleanup_local_project(user_id, slug) -> None` (卸载用)
- [ ] `packages/student-app/src/systemedu/student/catalog/routes.py` 的 `api_my_projects_pull` 改造:
  - [ ] 调 library 拿 meta + tarball
  - [ ] 同版本跳过 (resurrect removed)
  - [ ] tmp_dir + atomic rename
  - [ ] 失败清理
  - [ ] 写 DB 三个新列
- [ ] 测试: `tests/student/test_pull_clone.py`
  - [ ] 正常路径: mock library, 验证 tarball 下载 + 解压 + DB
  - [ ] 同版本第二次 pull 跳过
  - [ ] Tar slip 攻击: 含 `../../etc/passwd` 的 tarball 被拒
  - [ ] 解压中途失败 → tmp_dir 清掉, DB 未写
  - [ ] 旧记录 (cloned_version=NULL) 重新 pull 升级到新结构

### T5: Student-app api_my_project_knode

- [ ] `packages/student-app/src/systemedu/student/catalog/routes.py`: 加 `api_my_project_knode`
  - [ ] 路由 `GET /api/my/projects/{slug}/knodes/{knode_id}`
  - [ ] 鉴权: login + pulled + local_path 存在
  - [ ] 读 manifest → 找 knode_dir → 读 5 个文件
  - [ ] **回填 `idea.{mode}_path → rendered_sections[id].html_path`** (关键!)
  - [ ] 返回结构跟现 library `get_knode` 兼容
- [ ] 测试: `tests/student/test_my_project_knode.py`
  - [ ] 未 pull → 403
  - [ ] pull 过但 local_path 目录被手动删 → 410
  - [ ] 正常: 验证返 plan_markdown / theories / sections
  - [ ] **验证 html_path 回填**: response.rendered_sections.rendered_sections.<anim_id>.html_path === "media/animation-...html"
  - [ ] 老式 pull (local_path=NULL) → 403 + 提示

### T6: Student-app api_my_project_file

- [ ] `packages/student-app/src/systemedu/student/catalog/routes.py`: 加 `api_my_project_file`
  - [ ] 路由 `GET /api/my/projects/{slug}/files/{path:path}`
  - [ ] 鉴权 + path resolve 安全检查
  - [ ] FileResponse 流出
- [ ] 测试:
  - [ ] 正常路径: 拿到 media/animation-...html
  - [ ] `../../../etc/passwd` 拒绝 403
  - [ ] 文件不存在 404
  - [ ] 未 pull 403

### T7: Student-app remove 真删本地

- [ ] `packages/student-app/src/systemedu/student/catalog/routes.py`: `api_my_projects_remove` 加真删逻辑
- [ ] `storage.py`: 用 T4 写好的 `cleanup_local_project`
- [ ] 测试: pull → remove → 本地目录确实没了

### T8: Student-web gateway 切换 endpoint

- [ ] `packages/student-web/src/lib/api/gateway.ts`:
  - [ ] `getCourseV2 / getCourseV3` 调 `/api/my/projects/<slug>/knodes/<id>` 而不是 `/api/library/...`
  - [ ] `inlineHtmlPaths` 走 `/api/my/projects/<slug>/files/...`
  - [ ] **保留** topic-alias workaround (第一阶段保险)
- [ ] `packages/student-web/src/lib/api/index.ts`: 同步更新
- [ ] 手动测试: 登录 → pull → 进 M11 → 看到 anim/game

### T9: 端到端测试

- [ ] 用浏览器手测 M09/M10/M11 三个 knode 都能渲染 anim + game + diagram
- [ ] (可选) 加 Playwright 测试到 e2e suite

---

## P1 后续

### T10: 删 library 老 knode + files API

- [ ] `packages/library-app/src/library/routes/public.py`: 移除 `/v1/projects/<slug>/knodes/<id>` 和 `/files/<path>` 路由
- [ ] `packages/student-app/src/systemedu/student/library_proxy/routes.py`: 移除老的代理 `api_library_knode` + `api_library_file`
- [ ] 测试: 老 API 返 404, student-web 不再调用

### T11: Library 详情页加版本更新提示

- [ ] student-web `/library/<slug>`: 如果当前用户已 pull (cloned_version < library_version), 显示 "新版本 v0.3.6 可用, 是否更新?"

---

## P2 可选

### T12: Migration 用户体验

- [ ] 老式 pull 的项目 (cloned_version=NULL) 在 /my-projects 显示标签 "需要重新 Pull"
- [ ] 自动 prompt + 一键重 Pull

### T13: 磁盘占用统计

- [ ] /my-projects 顶部显示 "你的项目共占用 X MB"
- [ ] /my-projects/<slug> 卡片显示该项目占用大小

---

## 进度

- ✅ T1 Library /download + archive (importer 存 _archive/, /download 端点 + license token)
- ✅ T2 DB migration (cloned_version + local_path + cloned_at 三列, nullable)
- ✅ T3 LibraryClient.download_project (core 库, 423972 bytes 实测)
- ✅ T4 pull 改造 + storage.py (tar slip 防御, atomic rename, tmp_dir 失败清理)
- ✅ T5 api_my_project_knode (本地读 + Python 层填 idea.{mode}_path → section.html_path)
- ✅ T6 api_my_project_file (本地流文件 + path traversal 404)
- ✅ T7 remove 真删本地目录 (磁盘释放)
- ✅ T8 student-web gateway 切到 myProjects.getKnode + /api/my/.../files/...
- ✅ T9 E2E 验证: M09/M10/M11 三个 knode 的 anim/game/diagram 都正常加载

后续:
- T10/T11 (P1) 删 library 老 knode/files API + 版本更新提示, 留给下一个 spec
- T12/T13 (P2) migration 体验 + 磁盘占用统计, 视需要再做
