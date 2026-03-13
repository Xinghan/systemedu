# Backend — Auth

## Models
- `User` (Django default + extensions): email, display_name, age, total_xp, level, streak_days

## API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register/` | User registration |
| POST | `/api/auth/login/` | JWT login (access + refresh) |
| POST | `/api/auth/refresh/` | Refresh access token |
| GET | `/api/auth/profile/` | Current user profile |

## Auth Method
- django-simplejwt for JWT tokens
- Access token: 30 min, Refresh token: 7 days
- `is_staff` field used for admin access
