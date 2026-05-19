# DEPRECATED — 老 cloud-app gateway

**Status**: deprecated 2026-05-19 (spec 032)

spec 022 时把 OpenClaw 单用户 daemon 拆出来作为 SaaS gateway (Phase 3 计划).
spec 027 直接走了多用户 student-app (`packages/student-app/`, port 18820), 接
spec 024-A library + spec 031 chat memory. cloud-app 不再演进.

## 这个目录跟当前 student-app 的对比

| 维度 | cloud-app (这里) | student-app (新) |
|---|---|---|
| 入口 | `python -m systemedu.cloud.gateway.server` | `python -m systemedu.student.server` |
| 端口 | 18820 (本地 dev, 跟 student-app 撞) | 18820 |
| 多用户 | 自带 multiuser/ 套件 (单机) | JWT + PostgreSQL + 跨进程 |
| chat memory | 老 cloud-app schema (project_name/knode_id) | spec 031 五层 (library_slug/module_id) |
| 状态 | dev-only, 不维护 | production-ready |

## 还有谁在用?

- `scripts/deploy.sh` 部署生产时启的就是这个 (`systemedu-backend.service` =
  `python -m systemedu.cloud.gateway.server`)
- `scripts/restart.sh` 本地 dev 起的也是这个

新本地 dev 用 `scripts/restart-student.sh` 起 student-app + student-web.
新生产部署要等独立 spec 改 deploy.sh.

## 不该再改这个目录

新功能写到 `packages/student-app/`. 这里只做生产救急 bug fix.

## 计划

未来独立 spec:
1. 把生产升级到 student-app + student-web + docker compose (PG/Redis/Qdrant)
2. 之后删 web/ + packages/cloud-app/ 整套
