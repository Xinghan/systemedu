# Spec 047: 管理端邀请码视图 (码-账户对应)

Status: shipped (2026-07-14)
关联: spec 046 (邀请码注册机制)

## WHAT

管理后台 (生产 /sysadmin, student-admin 服务) 新增"邀请码"页面: 列出全部邀请码及其
使用状态与对应账户 (手机号/昵称/使用时间), 支持批次筛选与未用码复制。

## WHY

运营发放邀请码后需要追踪: 哪些码被谁用了、哪些还没发出去。目前只能 SQL 查询。

## 方案 (实现中修正)

初版做在 library-admin-ui + student-app 端点, 实现中发现生产已有专职
**student-admin 服务** (packages/student-admin, :18822, nginx /sysadmin + /api/admin
前缀都归它, 自带 admin 登录, 直连 student PG 只读) —— 用户运营视图的正确归属。
已迁移并撤销初版:
- student-admin: /sysadmin/invites SSR 页 (统计/码-账户表/未用码一键复制) +
  GET /api/admin/invite-codes JSON; 导航加"邀请码"。
- 查询复用 student.db list_invite_codes_with_users() (invite_codes LEFT JOIN users)。
- 管理端显示完整手机号 (内部运营)。nginx 零改动。

## 不做

- 管理端生成/作废邀请码 (生成走 CLI; 需要时再加)。

## 验收

- pytest: 无 token 401 / 假 token 401 / 合法 token 返回码列表含账户 join;
- 本地: admin UI 登录后 /invites 页正确显示已用码与账户对应;
- 生产: 部署后 /sysadmin 邀请码页可见 beta-1 批次 200 码。
