# Frontend — Auth

> **状态**: 未实现（Phase 4 Hub 功能）
> 本地 Agent Sandbox 模式不需要认证，所有用户以 `default` 身份使用。
> Auth 仅在接入 Hub 后需要。

## 当前实现
- 本地模式无登录，`user_id` 默认为 `"default"`
- Gateway API 无认证中间件

## 未来计划 (Phase 4: Hub)

| Route | Component | Auth |
|-------|-----------|------|
| `/login` | LoginPage | Public |
| `/register` | RegisterPage | Public |

### Features
- JWT token storage in httpOnly cookies
- Auto-redirect after login (supports `?redirect=` param)
- Registration with age, display name
- Social login (future)
