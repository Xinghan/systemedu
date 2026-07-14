# Spec 046: 邀请码注册机制

Status: draft (2026-07-14)

## WHAT

注册加邀请码门槛: DB 预存一批邀请码 (首批 200 个), 只有持有效邀请码的新用户才能注册。
老用户登录不受影响。

## WHY

- 内测/早期阶段控制注册规模, 定向发放给种子用户。
- 一码一用, 可追溯 (谁用了哪个码、何时)。

## Scope

1. **DB**: 新表 `invite_codes` (code PK, used_by FK users nullable, used_at, batch,
   created_at) + alembic migration。
2. **后端** (student-app):
   - `POST /api/auth/verify` 改造: 手机号为新用户时要求 `invite_code` 字段;
     缺失 → 403 `{invite_required: true}`; 无效/已用 → 403 中文错误。
     领码与建号同事务, `UPDATE ... WHERE used_by IS NULL` 原子领取防并发双用。
   - 老用户 (手机号已存在) 登录完全不动。
   - 开关: env `INVITE_CODE_REQUIRED` (默认 true); 测试环境关闭以不破坏既有用例。
3. **生成工具**: `python -m systemedu.student.tools.gen_invite_codes <n> [--batch 名]`
   生成 n 个 8 位码 (大写字母数字, 去 0O1I 易混字符), 打印清单供发放。
4. **前端** (student-web): 注册 tab 加邀请码输入框 (必填); verify 请求携带;
   403 invite_required / 无效码错误提示。
5. **测试** (pytest): 新用户无码 403 / 有效码成功且码被消耗 / 已用码 403 /
   同码二次使用 403 / 老用户登录无需码 / 开关关闭时旧行为不变。

## 不做

- 邀请码管理后台 UI (脚本生成 + SQL 查询足够)。
- 邀请码过期时间、多次使用配额 (需要时再加)。

## 验收

- pytest 全绿 (新增用例 + 存量 auth 用例零回归);
- 本地真实流程: 无码注册被拒 → 输入有效码注册成功 → 同码再注册被拒;
- 生产: migration 执行 + 生成 200 个码 + 注册页验证。
