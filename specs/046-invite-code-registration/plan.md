# Plan 046: 邀请码注册机制

## 数据模型

```
invite_codes
  code       String(16) PK      8 位大写字母数字 (字符集去 0O1I)
  batch      String(32) null    批次名 (发放管理)
  used_by    String(36) null    FK users.id, null = 未用
  used_at    DateTime null
  created_at DateTime
```

## 关键流程 (verify 新用户路径)

```
verify(phone, code, invite_code?)
  验证码校验通过
  user = get_user_by_phone(phone)
  if user 存在: 老用户, 直接发 token (完全不动)
  else:                              # 新用户注册
    if INVITE_CODE_REQUIRED (env, 默认 true):
      无 invite_code → 403 {invite_required: true}
      单事务: UPDATE invite_codes SET used_by=新uid, used_at=now
              WHERE code=? AND used_by IS NULL
        rowcount==0 → 403 邀请码无效或已被使用 (回滚, 不建号)
        rowcount==1 → 建 User + commit
    else: 直接建号 (旧行为, 测试环境)
```

原子领取: `UPDATE ... WHERE used_by IS NULL` 的 rowcount 判定在 SQLite (pytest)
与 PostgreSQL (生产) 下行为一致, 天然防并发双用。

## 影响面

- student-app: db.py (+模型+函数), auth/routes.py (verify), tools/ (新), alembic (新)
- student-web: login/register 页 + api verify 签名 + locales
- tests: 新 test_invite_code.py; 存量用例靠 conftest 全局关开关零改动
- 不动 library-app / core / cloud-app

## 部署顺序

code (含 migration 自动执行? 查 deploy 脚本是否跑 alembic) → 生成码 → web → 验证
