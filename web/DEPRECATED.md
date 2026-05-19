# DEPRECATED — 老 cloud-app 单用户 web

**Status**: deprecated 2026-05-19 (spec 032)

这个目录是 spec 022 之前的单用户 cloud-app 前端 (Lumina Nexus 紫色 + 老 gateway API).
spec 027 改造为多用户 student-app 时, 新前端写在 `packages/student-web/` (Industrial
Atelier 暖纸色 + topnav + 接 student-app:18820 API), 跟这里完全独立.

## 还有谁在用?

- `scripts/deploy.sh` 部署到生产 47.92.200.21 时仍 build 这个 web (跑在 :3000).
  生产上同时跑 cloud-app gateway (老的) + 老 web. 新 student-web 还没上生产.
- 本地 `scripts/restart.sh` 仍可启动它 (跟 student-web 的 `scripts/restart-student.sh`
  分开)，但日常开发应该用后者.

## 不该再改这个目录

新功能写到 `packages/student-web/`. 这里只做最小 bug fix (生产救急).

## 计划

未来某个独立 spec (032 系列后续) 会:
1. 把 student-web 部署到生产, 替掉这套老 web
2. 之后这个目录连同 `packages/cloud-app/` 一起删
