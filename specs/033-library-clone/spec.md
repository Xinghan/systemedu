# 033-library-clone

**Status**: shipped (2026-05-19)
**Owner**: Xinghan Cui
**Created**: 2026-05-19

## 背景 / 问题

当前 PurpleAir / AI-Ant-Ethologist 这种**完整项目**已经能从 content-pipeline 导出 tarball, 经过 admin 上传到 library-app, 然后 student-web `/library` 页面看到。但有几个不对劲的设计:

### 1. Library API 暴露了"全套课程内容", 不只是介绍

`GET /v1/projects/<slug>/knodes/<id>` 直接返回 lesson_md / rendered_sections / theories / audio_scripts / assignment, 等于"任何登录用户都能拿全套数据"。
`GET /v1/projects/<slug>/files/<path>` 同理把 anim/game HTML 流给任何人。

这跟 library 的定位"**项目仓库 + 浏览**"不符。library 应该像 GitHub 或 App Store 那样, 公开 API 只暴露元信息 (title / cover / 简介 / 模块树概览), 详细课程内容只在用户**真的 pull/clone** 之后才放到学生那边。

### 2. "Pull" 操作目前只是一行数据库记录, 没有真 clone

`POST /api/my/projects/<slug>` 只往 `user_projects` 表插一条 `(user_id, slug, version)` 记录, 用作"权限闸门"。每次学生学习时, student-app 还是**实时**从 library 拉 `get_knode()` 把整套数据流过来。

实际效果:
- Library 一关掉, 学生连已经"pull 过"的项目都打不开
- "项目版本"概念失效 — library 升 v0.4.0 后, 学生立刻看到新内容, 没有"我在学的是 v0.3.5" 的稳定性
- 离线 / 慢网 / 跨设备 体验都很差 (每个 knode 切换都要再拉一遍 22KB+ HTML)

### 3. 副作用: anim/game/diagram 渲染 bug 暴露

近期 M09/M10/M11 学生页看不到 anim/game。根因是 `course_factory.workspace_bridge._split_html_assets` 把 HTML 抽到 `media/*.html` 后只在 `idea.{mode}_path` 上记路径, **没**在 `rendered_sections[id].html_path` 上记。前端 `gateway.ts.inlineHtmlPaths()` 找不到 `html_path` 就跳过 → anim/game 不渲染。

这个 bug 在"实时从 library 拉"的现状下需要前端 / library API 二选一打补丁。如果走 clone 方案, student-app **在 clone 时本地拼一遍数据**, 这个问题自然消失 — Python 那一层一次性把 `idea.{mode}_path` 复制到 `section.html_path`, 前端不再处理这些细节。

### 4. 跟当前架构定位一致

CLAUDE.md 里 SystemEdu 的定位是**本地优先的 AI Agent Sandbox 平台**。"项目 clone 到学生本地"非常符合这个定位 — 项目像 git repo 一样, 用户可以"pull"/"clone"/"update"。

---

## 目标 (WHAT)

### 1. Library 公开 API 只返**简介**

- `GET /v1/projects` (列表) — 不变, 已经是简介列表
- `GET /v1/projects/<slug>` — **不变**, 但响应里去掉 / 不再透出完整 knode 详情
- `GET /v1/projects/<slug>/tree` — 模块树骨架 (module_id / title / depends_on), 用于 library 详情页"看课程大纲"
- `GET /v1/projects/<slug>/blueprint` — 项目简介 markdown (README.md), 用于 library 详情页"项目介绍"

### 2. 新增 `/v1/projects/<slug>/download` — 完整 tarball

- 凭 license token 鉴权
- 返回原始 tarball (含 manifest.json + 全部 knodes/* + media/*)
- student-app pull 时调这个端点拿到完整内容

### 3. 老的"完整 knode + 文件流" API 不再公开

- `GET /v1/projects/<slug>/knodes/<id>` 改成 admin-only (或者完全删掉, 给学生侧 student-app 服务)
- `GET /v1/projects/<slug>/files/<path>` 同理

### 4. Student-app: pull 时真 clone 到本地

- `POST /api/my/projects/<slug>` 调 library `/download`, 把 tarball 解压到 `~/.systemedu/student/users/<user_id>/projects/<slug>/<version>/`
- `UserProject` 表加 `local_path TEXT` + `cloned_version TEXT` 列
- 同一个项目 pull 多次只重下最新版本 (除非版本号一致就跳过)
- "pull 失败" 要清掉部分写入的目录, 不留半成品

### 5. Student-app: 学习时从本地拼数据

- 新增 `GET /api/my/projects/<slug>/knodes/<knode_id>` — **从本地** `<local_path>/knodes/<dir>/{lesson,sections,theories,audio_scripts,assignment}` 拼 knode 数据
- 新增 `GET /api/my/projects/<slug>/files/<path>` — **从本地** `<local_path>/knodes/<dir>/media/*.html` 流出 HTML
- 拼数据时, **在 Python 层把 `idea.{mode}_path` 复制到 `rendered_sections[id].html_path`** (顺手修了 anim/game 渲染 bug)
- 老的 `api_library_knode` 跟 `api_library_file` 删掉或仅作管理后台用

### 6. Student-web: 调新 API

- `/library` 列表 + `/library/<slug>` 详情: 仍调 `api_library_*` (只看简介)
- `/my-projects/<slug>/learn/<module_id>`: 改调 `/api/my/projects/<slug>/knodes/<id>`
- gateway.ts 的 `knodeToCourseContent` 数据结构基本不变, 只是 endpoint 换

### 7. 卸载 / 重 pull

- `DELETE /api/my/projects/<slug>` 软删 (现已实现) + **真的删本地目录** (新增)
- 重新 pull 时如果 library 版本变了, 提示"有新版本, 是否更新", 用户确认后真下载

---

## 非目标 (不做什么)

- **不做差量同步**: 整个 tarball 重下, 不 diff. v0.3.5 跟 v0.3.4 改 1 个字也整个重下。这是"clone"语义 (Git 行为是 fetch + apply, 我们简化版只 fetch 整包)。
- **不做云端学生进度同步**: 进度 (last_visited_module 等) 暂时只在本数据库, 不上传到 library
- **不做项目签名 / 校验**: tarball 信任 library 来源, 不做 hash 校验 (manifest.json 内已有 sha256, 用作完整性自检即可, 不做密码学签名)
- **不动 content-pipeline 跟 admin upload 流程**: 项目内容产出依然走 `systemedu-content export` + admin UI import, 不变
- **不动 library 的存储结构** (`~/.systemedu/library/`): 还是 SQLite + PROJECTS_MEDIA_DIR, 只是 API 不再公开 knode 详情
- **不做 'fork' / '编辑' clone 后的内容**: 学生看的是只读的 clone, 不能改

---

## 用户故事 / 场景

### 场景 1: 新用户浏览 library
- 小明登录 student-web, 进 `/library`, 看到 PurpleAir 项目卡片 (标题/封面/简介/30 模块)
- 点项目卡进 `/library/purpleair-airquality-node` 详情页
- 看到项目介绍 (`blueprint`) + 模块树 (`tree`), 但**不能直接进任何模块学习**
- 页面上有 "**Pull 到我的项目**" 按钮

### 场景 2: Pull 操作
- 小明点 Pull, student-app 后端去 library 拉 tarball (约 0.4 MB)
- 进度条显示"下载中..."(可选), 完成后跳到 `/my-projects/purpleair-airquality-node`
- 后端把 tarball 解压到 `~/.systemedu/student/users/<uid>/projects/purpleair-airquality-node/0.3.5/`
- DB 标记 `local_path = ".../0.3.5/"`, `cloned_version = "0.3.5"`

### 场景 3: 学习 — 从本地读
- 小明进 `/my-projects/.../learn/M11`
- student-web 调 `/api/my/projects/purpleair-airquality-node/knodes/M11`
- student-app 读 `~/.systemedu/student/.../0.3.5/knodes/M11-w0-.../`, 拼 sections+theories+lesson_md
- anim HTML 走 `/api/my/projects/.../files/knodes/M11-w0-.../media/animation-...html`
- **不再访问 library 服务**

### 场景 4: Library 离线 — 已 pull 的还能学
- Library 服务挂了
- 小明已经 pull 了 PurpleAir, 进入 `/my-projects/...` 还能正常学
- `/library` 页面才会报"library 暂不可用"

### 场景 5: 项目升级
- Admin 在 library 升级 PurpleAir 到 v0.3.6
- 小明的 `/my-projects/...` 还是 v0.3.5 (不会自动变)
- 进 `/library/.../`, 详情页发现"已 pull v0.3.5, 远端 v0.3.6 可用, 是否更新?"
- 小明点更新 → 重下 v0.3.6 → 老的 v0.3.5 目录可删 (或保留作历史)

### 场景 6: 卸载
- 小明在 `/my-projects/.../settings` 点"从我的项目移除"
- student-app 软删 user_project + 真删本地目录
- 释放磁盘空间

---

## 验收标准

### 必须
1. **Library API 不再暴露完整 knode** — 直接 `GET /v1/projects/<slug>/knodes/M01` 应该 404 或返公开错误 (取决于改 admin-only 还是删)
2. **新增 `/v1/projects/<slug>/download` 端点能下载 tarball**, 大小跟 export 时一致
3. **`POST /api/my/projects/<slug>` 真把 tarball 解压到 `~/.systemedu/student/users/<uid>/projects/<slug>/<version>/`**, 目录结构跟 `content-workspace/generated/<slug>/` 一致
4. **`GET /api/my/projects/<slug>/knodes/<id>` 从本地读**, 不发任何到 library 的请求 (用 mock library down 验证)
5. **anim/game/diagram 在 M09/M10/M11 学习页能渲染出来** — 这就是 spec 的副产品, 同时也是 spec 起源 bug 的修复
6. **`DELETE /api/my/projects/<slug>` 真删本地目录**, 磁盘空间释放
7. **DB migration**: `user_projects` 表加 `local_path` + `cloned_version` 列, alembic 生效, 旧记录 `local_path=NULL` (代表"老式 pull, 没真下载") 兼容运行
8. **`student-web /library /library/<slug> /my-projects/<slug>/learn/<id>` 三个页面正常工作**, 不再依赖老的 library knode/files API

### 可选 (扩展)
- "新版本可用" 通知 UI
- 项目卸载前 "确认对话框" + "保留进度/不保留进度" 选项
- 本地项目目录用空间统计 (在 `/my-projects` 上方显示"已占用 X MB")

---

## 风险

| 风险 | 说明 | 缓解 |
|---|---|---|
| 解压 tarball 的安全性 | tar slip 攻击 (`../../etc/passwd`) | 用 Python `tarfile.extractall(filter='data')` (3.12+) 拒绝任何越界路径 |
| 磁盘空间 | 多用户 × 多项目, 每项目 ~0.5MB-50MB | 卸载真删 + 后续可加配额, 现阶段先不做 |
| Library 跟 student-app 部署在不同机器 | clone 走网络下载, 网络慢就卡 | 加 timeout 60s + 失败清理 + 用户友好错误提示 |
| 旧用户 (老 pull 没 local_path) | 直接看不到 anim/game | Migration 后端兼容: `local_path=NULL` 时优雅降级到"提示请重新 Pull"; 不强行迁移 |
| 进度迁移 | 老式 pull 在 v0.3.5 学到 M07, 新式 clone 后 last_visited 还在 | LastVisited 表跟 user_id+slug 关联, 重新 clone 不影响, 数据无损 |

---

## 跟其他 spec 的关系

- **依赖**: `spec 023 content-library` (library 已经存在) + `spec 027 multi-user` (有 user_id) + `spec 022 monorepo`
- **不冲突**: spec 031 tutor memory 跟课程内容只读访问, 不写, 不受影响
- **后续**: 这个改动落地后, spec 30 "项目终极交付" + 后续 "spec 035 离线模式" 等都建立在 clone 基础上
