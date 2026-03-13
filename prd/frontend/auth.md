# Frontend — Auth

## Pages

| Route | Component | Auth |
|-------|-----------|------|
| `/login` | LoginPage | Public |
| `/register` | RegisterPage | Public |

## Features
- JWT token storage in httpOnly cookies
- Auto-redirect after login (supports `?redirect=` param)
- Registration with age, display name
- Social login (future)

## Components
- `LoginForm` — email + password
- `RegisterForm` — email, password, display_name, age
- `Navbar` — shows user profile or Sign In/Sign Up
