# Tasks 047: 管理端邀请码视图

- [ ] T1 db: list_invite_codes_with_users() join users
- [ ] T2 student-app: admin/routes.py — require_library_admin (反查 library /admin/auth/me,
      模块级可 mock) + GET /api/admin/invite-codes; server.py 挂载
- [ ] T3 测试: 401 无 token / 401 假 token / 200 列表含账户 join
- [ ] T4 admin UI: /invites 页 (统计 + 批次筛选 + 表格 + 复制未用码); 导航入口
- [ ] T5 本地验证 (admin UI 登录 → /invites)
- [ ] T6 部署生产 (student + admin) + 验证; spec 标 shipped
