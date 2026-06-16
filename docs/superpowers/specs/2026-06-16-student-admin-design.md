# 学生管理后台 student-admin 设计文档

- Status: approved (2026-06-16), 待实现
- Owner: Xinghan Cui
- 影响仓: ~/Dev/systemedu (新 package packages/student-admin)
- 关联: student-app (共用其 PostgreSQL), core (复用 db model)

## 背景 / 目标

运营需要一个管理后台，查看：注册用户、各用户 pull 了哪些项目、学习到哪个节点、
问了什么问题。当前没有任何后台，数据只能手动连 PG 查。

## 决策 (已与用户确认)

1. **完全独立的服务** —— 独立进程 / 独立端口 (18822) / 独立 systemd unit / 独立部署，
   与学生端 (student-app:18820 / student-web:4000) 解耦。admin 挂不影响学生使用。
2. **共用生产数据库** —— admin 直连 student-app 同一个生产 PostgreSQL
   (`STUDENT_DB_URL = postgresql+psycopg2://systemedu:systemedu@127.0.0.1:5432/student`)，
   **不另起库、不复制数据**。看到的永远是学生端实时数据，零同步零副本。
3. **只读** —— 只跑 SELECT，绝不 INSERT/UPDATE/DELETE 学生数据。
4. **固定管理员账号** —— env 配 ADMIN_USER / ADMIN_PASSWORD (写生产 secrets, 不进 git)，
   仿 library-app admin 模式。
5. **技术栈** —— Starlette (与 student-app/library-app 一致) + 内嵌 HTML 页面 (不引前端框架,
   保持简单)。复用 core 的 SQLAlchemy model (同一套表定义, 不重复声明)。
6. **聊天记录** —— 详情页默认只显示学生的提问，AI 回答点击展开 (隐私 + 界面清爽)。
7. **访问路径** —— `http://<生产>/sysadmin` (nginx 反代到 18822, 不显眼路径)。

## 架构

```
浏览器 → nginx → student-admin (Starlette, :18822)
                    ├─ GET  /sysadmin/login    登录页 (HTML)
                    ├─ POST /sysadmin/login     验证账号密码 → 发 session cookie
                    ├─ GET  /sysadmin           用户列表页 (HTML, 需登录)
                    ├─ GET  /sysadmin/users/<id> 用户详情页 (HTML, 需登录)
                    ├─ POST /sysadmin/logout
                    └─ GET  /api/admin/*         数据 JSON 接口 (需登录)
                直连 student PG (只读 SELECT, 复用 core db model)
```

## 包结构 (packages/student-admin/)

```
packages/student-admin/
├── pyproject.toml                  systemedu-student-admin, dep: systemedu-core, starlette, uvicorn, python-jose
└── src/systemedu/admin/
    ├── server.py                   Starlette app + 路由挂载 + 启动
    ├── auth.py                     env 账号校验 + session cookie 签发/校验 (JWT)
    ├── deps.py                     require_admin (cookie 校验, 未登录跳 /sysadmin/login)
    ├── queries.py                  只读查询 (用户列表统计 / 用户详情各项), 复用 core model
    ├── routes.py                   页面路由 (login/list/detail/logout) + /api/admin/* JSON
    └── templates.py                内嵌 HTML 渲染 (Python f-string / 简单模板, 不引 Jinja 也可)
```

> DB session: 复用 core 的 SQLAlchemy engine 构造方式, 用 STUDENT_DB_URL 连同一个库。
> 只建只读 session, 不调任何写函数。

## 认证 (auth.py / deps.py)

- env: `ADMIN_USER` / `ADMIN_PASSWORD` (生产 secrets, 不进 git); `ADMIN_JWT_SECRET` (签 cookie)。
- POST /sysadmin/login: 校验 user==ADMIN_USER and password==ADMIN_PASSWORD (明文比对,
  单账号够用; 或 bcrypt, MVP 明文)。通过 → 签 JWT (exp 12h) 写 HttpOnly cookie。
- require_admin: 读 cookie → 验签 → 失败跳登录页 (页面) 或返 401 (API)。
- 所有 /sysadmin/* (除 login) 和 /api/admin/* 都过 require_admin。

## 数据查询 (queries.py, 只读)

复用 core 的 model: User / UserProject / UserKnodeComplete / LastVisited / ChatMessage / ChatSession。

**用户列表** (`list_users()`): users 按 created_at 倒序, 每行带聚合统计:
- pull 项目数 = count(user_projects WHERE user_id)
- 完成节点数 = count(user_knode_complete WHERE user_id)
- 提问数 = count(chat_messages WHERE user_id AND role='user')
- 字段: phone, display_name, student_age, gender, created_at, last_login_at + 上述 3 个计数
- 简单分页 (limit/offset, 默认 50/页)

**用户详情** (`user_detail(user_id)`):
- 基本信息: User 全字段
- pull 的项目: user_projects (slug, pulled_at) + 每个项目的 last_visited (最近学到哪个 module)
  + 完成进度 (count user_knode_complete WHERE user_id AND library_slug / 该项目总节点数)
- 学习节点: user_knode_complete 列表 (library_slug, knode_id/module_id, completed_at) 按时间倒序
- 问的问题: chat_messages WHERE user_id AND role='user' 按 created_at 倒序
  (library_slug, module_id, content, created_at); 每条可关联同 session 的下一条 assistant 回答
  (点击展开, 默认折叠)

## 页面 (HTML, 内嵌)

样式: 简洁表格, 暖纸色调可选 (不强求跟 student-web 一致, 内部工具够用即可)。

- **/sysadmin/login**: 账号 + 密码表单, POST 提交。
- **/sysadmin** (用户列表): 表格 9 列 (手机号/显示名/年龄/性别/注册时间/最后登录/项目数/节点数/提问数),
  每行手机号链接到详情页。分页。
- **/sysadmin/users/<id>** (详情): 三块 —— 基本信息卡 / pull 项目表 / 学习节点表 / 提问列表
  (提问默认显示, AI 回答 `<details>` 折叠展开)。

## 部署

- `deploy-student.sh` 加 `do_admin` step (仿 do_library):
  - secrets: ADMIN_USER / ADMIN_PASSWORD / ADMIN_JWT_SECRET 由人工手动写生产
    `/root/.systemedu-student-secrets` (含 STUDENT_DB_URL 已在); 脚本不写明文。
  - systemd unit `systemedu-student-admin.service`: EnvironmentFile=secrets,
    ExecStart uvicorn admin.server:app --port 18822 --host 127.0.0.1。
- nginx: 加 location `/sysadmin` + `/api/admin` 反代到 127.0.0.1:18822。
- pyproject: 新 package 加进 uv workspace (root pyproject members)。

## 测试

pytest (SQLite + 造假数据, 复用 student conftest 风格):
- 登录: 对密码 → 200 发 cookie; 错密码 → 401; 未登录访问 /sysadmin → 跳登录/401。
- 用户列表: 造 2 用户 + 各自 project/knode/chat, 验证统计计数正确、按时间倒序。
- 用户详情: 验证 pull 项目 / 完成节点 / 提问 各项查询正确, user_id 隔离 (只返该用户)。
- 只读保证: 查询代码不含任何 add/commit/delete (grep 验收)。

## 非目标 (YAGNI)

- 不做编辑/删除用户 (纯只读查看)。
- 不做图表/报表 (先表格)。
- 不做导出 CSV (需要再加)。
- 不做多管理员/权限分级 (一个固定账号)。
- 不做实时刷新/WebSocket (刷新页面即最新)。

## 验收

- 生产 `http://<IP>/sysadmin/login` 用 env 账号登录成功, 错密码被拒。
- 用户列表显示所有注册用户 + 正确的项目/节点/提问统计。
- 点用户进详情, 看到其 pull 的项目、学到的节点、问的问题 (回答可展开)。
- admin 服务独立 (停 admin 不影响 student-app/web)。
- admin 只读 (代码无写操作, grep 验收)。
- ADMIN_PASSWORD 等不在 git 任何文件。
