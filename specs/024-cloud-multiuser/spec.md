# 024-cloud-multiuser

**Status**: draft
**Owner**: xinghan
**Created**: 2026-05-08

## 背景

systemedu 当前是单用户应用 (硬编码 root/123systemedu, 所有 user_id=
"default")。产品定位 cloud-only C 端家长 SaaS, 必须改造成多用户。

依赖:
- spec 022 完成 (monorepo 拆出 packages/cloud-app/)
- spec 023 完成 (library_client SDK, cloud 调 library 拿内容)

## 决策摘要

**目标**: cloud-app 成为真正的多租户 SaaS:

- 用户系统: 邮箱注册 / 登录 / 密码重置
- per-user 数据隔离: progress / note / submission / chat / memory
  全部按 user_id 分
- per-user LLM 配置: 用户在 /config 配自己的 LLM key (DB 加密存)
- 用户加入项目 (来自 library): cloud DB user_projects 表
- TTS 配置不再全局: 也是 per-user
- 生产部署仍用 SQLite MVP (PostgreSQL 留给 spec 025 上云时一起做)

**砍掉**:
- 硬编码 root/123systemedu
- 全局 ~/.systemedu/config.yaml 的 LLM/TTS 配置 (改为 per-user DB 字段)
- "default" user_id

## 数据模型

### 新表

```python
class User(Base):
    """注册用户."""
    id: UUID                          # primary key
    email: str (unique, indexed)
    password_hash: str                # bcrypt
    display_name: str | None
    created_at: datetime
    last_login_at: datetime | None
    status: enum                      # active / suspended / deleted
    locale: str                       # "zh-CN" / "en"

class UserLLMConfig(Base):
    """每个用户自己的 LLM 配置 (替代 ~/.systemedu/config.yaml 全局设置)."""
    user_id: FK(User)
    role: str                         # "thinking" / "coding" / "fast"
    base_url: str
    api_key_encrypted: str            # fernet 加密
    model: str
    temperature: float
    max_tokens: int | None
    UniqueConstraint(user_id, role)

class UserTTSConfig(Base):
    """每个用户自己的 TTS 配置."""
    user_id: FK(User)
    api_key_encrypted: str
    model: str                        # default qwen3-tts-flash
    voice: str                        # default Cherry

class UserProject(Base):
    """用户加入的项目 (来自 library)."""
    user_id: FK(User)
    project_slug: str                 # library 里的 slug
    joined_at: datetime
    status: enum                      # active / archived
    UniqueConstraint(user_id, project_slug)

class Subscription(Base):
    """订阅状态 (现在免费, 字段先留好)."""
    user_id: FK(User)
    tier: enum                        # free / pro / family
    started_at: datetime
    expires_at: datetime | None       # null = 永久 (免费档)
    auto_renew: bool
```

### 现有表加 user_id 实质生效

(schema 早就有 user_id 列, 现在不再总是 "default", 用真实 user.id)

- `ProgressRecord`
- `Enrollment`
- `Note`
- `Highlight`
- `Submission`
- `ChatMessage` (如果还没加 user_id 就加)
- LangGraph checkpoint key 包含 user_id

## 用户旅程

### 注册 + 配 LLM

1. 用户访问 `cloud.systemedu.com` → 注册页
2. 填邮箱 + 密码 + display_name → 验证邮箱 (后期, MVP 先跳过)
3. 登录 → 直奔 `/config` 填 3 个 LLM provider (Thinking / Coding / Fast) + TTS
4. 测试连接 OK → 主页可用

### 加入项目 (来自 library)

1. 主页有"内容库"入口 → 列出 library 项目
2. 点项目卡片 → 详情 + "加入"按钮
3. 点"加入" → cloud DB 写 user_projects 行 → 进入项目主页
4. 项目主页全部内容来自 library (调 library_client.get_project / get_lesson)
5. 用户进度 / 笔记 / chat 全部 per-user 存在 cloud DB

### 学习

跟当前流程一致, 但所有 user-specific 数据都按 auth_user.id 隔离。

## 实现要点

### Auth 层 (替换硬编码 root)

- `packages/cloud-app/src/systemedu/cloud/auth/` (新模块)
- JWT (python-jose) + bcrypt (passlib)
- middleware 解析 token → 注入 `request.state.user_id`
- 所有 `user_id="default"` 改成 `request.state.user_id`

### per-user LLM 配置

- 删 `~/.systemedu/config.yaml` 的 llm/tts 字段 (config.yaml 仍存系统级:
  gateway port / hub url 等)
- LLM 配置全部从 `UserLLMConfig` DB 表读
- `core/llm_client.py:get_llm()` 加 `user_id` 参数, 内部:
  ```python
  def get_llm(role: str, user_id: str):
      cfg = db.query(UserLLMConfig).filter_by(user_id=user_id, role=role).first()
      if not cfg or not cfg.api_key_encrypted:
          raise LLMNotConfigured(role)
      api_key = decrypt(cfg.api_key_encrypted)
      return ChatOpenAI(api_key=api_key, ...)
  ```
- 所有调 `get_llm()` 的地方都传 user_id

### 数据隔离 audit

- 所有 SQL query 加 `WHERE user_id = ?`
- 写一个 lint script 扫 query 漏 user_id 过滤的代码

### library 接入

- cloud-app 配置一个 `library.base_url` + `library.service_token` (system-level)
- 用 `core/library_client/` SDK 调 library
- 用户 acquire 项目时写 user_projects, 不复制 library 内容

### encryption

- 用 `cryptography.fernet` 对 api_key 加密存 DB
- master key 从 env var `SYSTEMEDU_FERNET_KEY` 读 (启动时必须有)

## API 改动

### 新增

```
POST /api/auth/register    body: {email, password, display_name}
POST /api/auth/login       (改: 取 user from DB, 不再 hardcode root)
POST /api/auth/forgot      发邮件 (后期)
GET  /api/library/projects             列出 library 所有项目 (proxy library)
POST /api/library/projects/<slug>/join 加入项目
GET  /api/me                           当前用户信息
GET  /api/me/projects                  我加入的项目
```

### 改造

- 所有 `/api/projects/<name>/*` 的 path 现在指向 user 加入的项目, 后端
  query library 拿源数据, query cloud DB 拿用户数据
- `/api/config` 仍存在, 但改成读 UserLLMConfig + UserTTSConfig

## Phase 推进 (~3-4 周)

### Phase 1 (1 周): User 表 + Auth 改造

- DB 加 User / UserLLMConfig / UserTTSConfig / UserProject / Subscription 表
- migration 脚本
- auth middleware (JWT)
- 注册 / 登录 / 注销 API
- 测试: 假装 2 个用户, 确认 token 隔离

### Phase 2 (1 周): per-user LLM/TTS 配置

- `core/llm_client.py:get_llm()` 加 user_id
- 把 `~/.systemedu/config.yaml` 里的 llm/tts 字段全 deprecate
- gateway 所有 `get_llm()` 调用点加 user_id (request.state.user_id)
- /config UI 改成读写 UserLLMConfig (后端 GET 时解密 → mask, PUT 时加密存)
- 测试: 2 个用户配不同的 key, 互不影响

### Phase 3 (1 周): 数据隔离 + library 接入

- 所有 query 加 user_id 过滤
- audit script: grep `user_id="default"` 应该 0 命中
- cloud-app 接入 library_client (调 spec 023 的 library service)
- "加入项目" API 实现
- 用户访问项目时 cloud 编排 library 内容 + cloud DB user 数据

### Phase 4 (3-5 天): 部署 + 上线

- 部署到 47.106.220.119 (或新机器)
- smoke test 注册 2 个测试账号, 确认数据互不串
- spec 标 shipped

## 验收

- [ ] User 表 + UserLLMConfig + UserTTSConfig + UserProject + Subscription
      schema 创建
- [ ] 注册 / 登录 / 注销 API + JWT auth
- [ ] 所有现有 API 改成 per-user (audit 过)
- [ ] 2 个测试用户互相看不到对方进度 / 笔记 / chat
- [ ] /config 读写 UserLLMConfig (api_key 加密)
- [ ] cloud-app 接入 library_client, 用户加入项目后能看到 library 内容
- [ ] core 测试 (49+) 全过, 加新单测覆盖 multi-user 场景
- [ ] 部署到生产 + smoke test

## 风险 + 缓解

| 风险 | 缓解 |
|---|---|
| api_key 加密 master key 丢了 | 部署文档强调备份, 加密 key 用 KMS (后期) |
| 现有 user_id="default" 数据迁移 | spec 022 + 023 通后, 生产 DB 几乎是空的 (只有几条 default 测试数据), 直接 truncate 即可 |
| LLM 配置突然 per-user 后, 原 yaml config 失效, 老用户登录后看到空白 | 启动期把现有 config.yaml 里的 key 自动塞到 root 用户 (1 次性 migration) |
| JWT 泄露不能撤销 | token 7 天过期 + 刷新 token 机制; 用户主动登出会 blacklist |
| /config UI 改后, 老 spec 021 的 mask 保护 / 测试连接逻辑要重写 | 大改但工作量可控, 跟着改 |

## 非目标

- 不做支付 / 计费 (订阅 schema 留好, 但实际收钱留给后续)
- 不做邮箱验证 / 找回密码 (MVP 先跳过, 等用户量上来加)
- 不做 OAuth 第三方登录
- 不做角色 / 权限 (家长账号下管多孩子留给后续)
- 不做 PostgreSQL 迁移 (留给 spec 025 上云一起做)
- 不做配额限制 / 限速 (留给后续)

## 后续 spec

- **spec 025**: cloud 部署上云 (Docker / HTTPS / 域名 / PostgreSQL)
- **spec 026**: 邮箱验证 / 找回密码
- **spec 027**: 支付 / 订阅升级 / 配额
- **spec 028**: 多孩子账号 / 家长 dashboard
