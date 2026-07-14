# Spec 047: 管理端邀请码视图 (码-账户对应)

Status: draft (2026-07-14)
关联: spec 046 (邀请码注册机制)

## WHAT

library-admin-ui (生产 /sysadmin) 新增"邀请码"页面: 列出全部邀请码及其
使用状态与对应账户 (手机号/昵称/使用时间), 支持批次筛选与未用码复制。

## WHY

运营发放邀请码后需要追踪: 哪些码被谁用了、哪些还没发出去。目前只能 SQL 查询。

## 方案

- 数据在 student-app PG, 端点放 student-app: `GET /api/admin/invite-codes`。
- 鉴权复用 library admin JWT: student-app 收到 Bearer token 后反向调
  library-app `GET /admin/auth/me` 验证 (student-app 已有 LIBRARY_BASE_URL 通道),
  管理员无需第二套账号。验证函数模块级可 mock (测试)。
- 前端: admin UI 新页 /invites, 调 /api/admin/invite-codes
  (生产 nginx /api/* → student-app 同源; 本地 dev 跨域走已有 CORS)。
- 返回: {stats: {total, used}, codes: [{code, batch, created_at, used_at,
  user: {phone, display_name} | null}]}。管理端显示完整手机号 (内部运营)。

## 不做

- 管理端生成/作废邀请码 (生成走 CLI; 需要时再加)。

## 验收

- pytest: 无 token 401 / 假 token 401 / 合法 token 返回码列表含账户 join;
- 本地: admin UI 登录后 /invites 页正确显示已用码与账户对应;
- 生产: 部署后 /sysadmin 邀请码页可见 beta-1 批次 200 码。
