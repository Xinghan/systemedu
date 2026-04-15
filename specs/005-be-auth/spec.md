# Backend — Auth

> **状态**: 本地模式不需要认证，Hub 模式待实现 (Phase 4)

## 当前实现 (本地模式)
- 无认证，所有请求以 `user_id="default"` 处理
- Gateway API 无中间件鉴权
- API 支持 `user_id` 参数预留多用户扩展

## 未来计划 (Phase 4: Hub)

### Models
- `User`: email, display_name, age, total_xp, level, streak_days

### API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register/` | 用户注册 |
| POST | `/api/auth/login/` | JWT login (access + refresh) |
| POST | `/api/auth/refresh/` | 刷新 token |
| GET | `/api/auth/profile/` | 当前用户信息 |

### Auth Method
- JWT tokens (access 30min, refresh 7d)
- `is_staff` 用于 admin 权限
