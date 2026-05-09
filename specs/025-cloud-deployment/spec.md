# 025-cloud-deployment

**Status**: draft
**Owner**: xinghan
**Created**: 2026-05-08

## 背景

systemedu 已成多租户 cloud SaaS (spec 024 完成多用户; spec 023 完成
library 服务)。现在的部署还是:

- 单台云服务器 (47.106.220.119) 跑 systemd 三件套 (backend / frontend / nginx)
- HTTP only (导致 spec 022 已修过的 crypto.randomUUID 不能用问题)
- SQLite 单文件 DB
- 直接物理机部署, 没 Docker
- 没自动备份 / 没监控

要做成稳定可对外的 cloud 服务必须升级。

依赖:
- spec 022 (monorepo)
- spec 023 (library service)
- spec 024 (多用户 / per-user 配置)

## 决策摘要

### 1. 域名规划

- `cloud.systemedu.com`: cloud-app 主入口 (用户登录 / 学习)
- `library.systemedu.com`: library service 内部 + 给浏览器提供静态文件
- `api.systemedu.com`: cloud-app gateway API (走子域分离, 方便 CDN / nginx
  优化路由)
- `www.systemedu.com`: 静态 marketing 落地页 (本 spec 不做)

### 2. HTTPS 必须

- Let's Encrypt 自动签发 (certbot + nginx 集成, 90 天自动续)
- 砍掉 HTTP, 80 端口 → 强制 301 → 443
- 解决 crypto.randomUUID / WebSocket wss / 等 secure context 问题

### 3. Docker 化

每个 deployment 一个 image:
- `systemedu-cloud`: cloud-app gateway + Next.js prod build
- `systemedu-library`: library-app
- `nginx`: 反代 (官方镜像 + 自定义 conf)

docker-compose.yml 编排, 起步阶段单机跑 docker compose up, 不上 k8s。

### 4. PostgreSQL 替代 SQLite

- cloud-app: SQLite → PostgreSQL (多用户并发写不能用 SQLite)
- library-app: 仍用 SQLite (写少读多 + 单实例, 够用)
- 加一个 `db migration` 工具 (alembic 或 lightweight ad-hoc 脚本)

### 5. 媒体文件 (anim/audio/png) 走 OSS

- library-app 接 阿里云 OSS / AWS S3
- 存储路径: `oss://systemedu-content/<slug>/<knode_id>/<file>`
- API 返回 signed URL, cloud-app 转发给浏览器 (后期可改浏览器直连 + CDN)

### 6. 监控 + 日志

- Sentry: 应用错误上报
- 阿里云 SLS (Simple Log Service): 日志聚合
- Prometheus + Grafana: metrics (后期)
- uptime monitoring: UptimeRobot (免费)

### 7. 备份

- PostgreSQL: pg_dump 每日 → OSS, 保留 30 天
- library SQLite: 每日 cp → OSS
- OSS 媒体文件: 阿里云 cross-region replication

## 部署架构图

```
Internet
   │
   ▼
DNS (阿里云 / Cloudflare DNS)
   │ cloud.systemedu.com → A 记录指向云服务器 IP
   │ library.systemedu.com → 同上 (或独立 IP)
   ▼
nginx (Docker, 80/443)
   │ /                → cloud-app frontend (Next.js)
   │ /api/*           → cloud-app gateway
   │ /v1/* (library)  → library-app
   │
   ├──▶ Docker network "systemedu"
   │        │
   │        ├── cloud-app:8080
   │        │       │
   │        │       ▼
   │        │   PostgreSQL :5432 (Docker volume)
   │        │
   │        └── library-app:18821
   │                │
   │                ▼
   │            SQLite (Docker volume)
   │                │
   │                └── 媒体文件 → OSS
   │
   └─ certbot (Docker, 自动续 cert)

Sentry (云服务) ←─ 错误上报
SLS (阿里云)   ←─ 日志
```

## 实施 Phase

### Phase 1 (1 周): Docker 化

- 写 `Dockerfile.cloud`, `Dockerfile.library`
- 写 `docker-compose.yml`
- 写 `.dockerignore`
- 本地 `docker compose up` 跑通 (不上云)

### Phase 2 (3-5 天): PostgreSQL 迁移

- cloud-app DB schema 迁移 (alembic)
- migrate script 把 SQLite 数据转 PostgreSQL (生产几乎无数据, MVP 简单)
- 配置层 DSN 改可配置 (本地 SQLite / 生产 PG)

### Phase 3 (3-5 天): HTTPS + 域名

- 准备域名 (买 + DNS A 记录)
- nginx 加 SSL block + 80→443 redirect
- certbot 自动续 (cron)
- cloud-app 改 cookie secure / WebSocket wss

### Phase 4 (3-5 天): OSS 接入

- library-app 加 OSS 客户端
- POST /admin/projects/<slug>/files/* 直接传 OSS
- GET /v1/projects/<slug>/files/* 返回 signed URL (cloud-app 转发或浏览器直连)

### Phase 5 (3-5 天): 监控 + 备份

- Sentry SDK 接入 cloud-app + library-app
- pg_dump cron + OSS 备份
- UptimeRobot ping cloud.systemedu.com

### Phase 6 (1 周): 上线 + 灰度

- 部署到新生产服务器 (推荐另起一台干净的, 不在 47.106.220.119 上叠)
- DNS 切过去
- 老的 47.106.220.119 保留作为 staging

总: **3-5 周**

## 风险

| 风险 | 缓解 |
|---|---|
| Docker 学习曲线 | docker-compose 简单足够; 不上 k8s |
| 数据迁移 SQLite → PG 出错 | 生产几乎无数据 (你测试到这阶段 DB 应该没几条), 直接重建即可 |
| Let's Encrypt 续期失败 | certbot 自动续 + 监控 cert 过期 (用 Sentry / UptimeRobot SSL 检查) |
| OSS 费用失控 | 先单 region, 估 50GB / 月 < ¥10; 监控 |
| 原服务器 (47.106.220.119) 在 spec 025 期间不能停 | spec 022/023/024 的开发都在原服务器, spec 025 上新机器, 切换时 DNS rollback 兜底 |

## 非目标

- 不上 k8s (单机 docker-compose 够撑万级用户)
- 不做 CDN (后期流量起来再加)
- 不做读写分离 / 主从 (用户量小不必)
- 不做多区域容灾 (后期)
- 不做 service mesh / istio
- 不做企业级 SSO

## 验收

- [ ] cloud.systemedu.com + library.systemedu.com 都跑 HTTPS
- [ ] docker-compose up 本地能完整启动 (cloud + library + postgres + nginx)
- [ ] cloud-app DB 在 PostgreSQL
- [ ] library-app 媒体文件存 OSS, signed URL 返回
- [ ] Sentry 收到至少一个测试 error
- [ ] pg_dump cron 跑通, OSS 里能看到备份
- [ ] HTTPS cert 自动续 90 天测试 (certbot dry-run)
- [ ] 新服务器跑 1 周稳定, 切 DNS 上线
- [ ] CLAUDE.md 部署章节更新

## 后续 spec

- **spec 026**: 邮箱验证 / 找回密码
- **spec 027**: 支付 / 订阅升级 / 配额
- 长远: CDN / 多区域 / 数据分析
