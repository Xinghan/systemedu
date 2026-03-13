# Adminsite — Auth

## Authentication
- JWT tokens (same as backend, shared User model)
- Requires `is_staff=True`
- Token endpoint: `POST /api/admin/auth/login/`
- Refresh: `POST /api/admin/auth/refresh/`
- Profile: `GET /api/admin/auth/profile/`
