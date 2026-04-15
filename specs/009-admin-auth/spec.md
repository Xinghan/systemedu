# Adminsite — Auth

> **状态**: 暂冻结 (Phase 4: Hub 管理后台)
> 本地 Agent Sandbox 无 admin 界面。此文件描述未来 Hub 管理后台的认证方案。

## Authentication
- JWT tokens (same as Hub backend, shared User model)
- Requires `is_staff=True`
- Token endpoint: `POST /api/admin/auth/login/`
- Refresh: `POST /api/admin/auth/refresh/`
- Profile: `GET /api/admin/auth/profile/`
