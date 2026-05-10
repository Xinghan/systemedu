"""systemedu-cloud: 多租户 SaaS gateway (cloud-app).

spec 022 monorepo 改造后, 这是 systemedu 的 cloud 服务包, 提供:
- gateway (FastAPI/Starlette HTTP server) — 用户 + 学习数据 API
- (spec 024 加) auth / multiuser / per-user LLM 配置

依赖 systemedu-core (共享 lib)。
"""
