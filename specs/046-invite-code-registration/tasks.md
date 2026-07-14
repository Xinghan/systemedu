# Tasks 046: 邀请码注册机制

- [x] T1 DB: InviteCode 模型 + claim_invite_code/create_user_by_phone_with_invite +
      alembic migration 045_add_invite_codes
- [x] T2 后端: api_verify 邀请码校验 (env 开关 INVITE_CODE_REQUIRED 默认 true)
- [x] T3 工具: tools/gen_invite_codes.py CLI (n 个 8 位码, --batch)
- [x] T4 测试: tests/student/test_invite_code.py 六用例 + 存量零回归
- [x] T5 前端: 注册 tab 邀请码输入 + verify 携带 + 错误提示 (i18n 双语)
- [x] T6 本地端到端验证 (SMS debug 注册流)
- [x] T7 部署生产: migration + 生成 200 码 + 生产验证; spec 标 shipped
