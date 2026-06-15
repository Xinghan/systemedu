# 手机号 + 短信验证码注册/登录 设计文档

- Status: approved (2026-06-15), 待实现
- Owner: Xinghan Cui
- 影响仓: ~/Dev/systemedu (student-app 后端 + student-web 前端)
- 关联: 取代现有 username/password 注册登录 (auth/routes.py)

## 背景 / 目标

平台从"自由 username 注册"升级为真正的互联网服务：**手机号 = 唯一账号**，
注册/登录统一用"手机号 + 短信验证码"(无密码)，短信走阿里云。首次登录后弹 profile
弹窗补全显示名/学生年龄/性别。

## 决策 (已与用户确认)

1. **手机号 = 唯一账号凭证**。废弃 username 登录、废弃密码登录。
2. **注册即登录**：统一"手机号 + 短信验证码"流程，新手机号自动建号。
3. **首次登录后弹 profile 弹窗**：补全 display_name(用户名/显示名) + student_age + gender。
4. **始终真发短信**(阿里云)。保留 debug 开关字段但默认 false；pytest mock SDK 不真打网络。
5. **手机号仅中国大陆 11 位**，校验正则 `^1[3-9]\d{9}$`，不考虑国际号码。
6. **老用户迁移**：生产现有 7 个用户填占位假手机号；唯独 `xinghan` 填真实 `17744529940`
   (保证用户本人能继续登录)。

## 密钥管理 (已与用户确认)

- 阿里云 AccessKey **写进生产 secrets 文件** `/root/.systemedu-student-secrets`
  (服务器上 root 权限、git 忽略)，由部署脚本注入 systemd Environment。
  **代码库任何文件不含明文密钥** (grep 验收)，代码只用 `os.environ` 读取。
- 部署脚本 do_student/secrets 步骤补写 ALIYUN_SMS_* 五个 env (key/secret/sign/template
  默认值可写 deploy.env 非敏感项，key/secret 仅写服务器 secrets 文件)。
- 提示: 用户在对话里明文贴过这对 AccessKey，已暴露在历史中；是否轮换由用户决定 (本设计
  按"直接用现有 key 写进生产"执行)。

## 数据模型 (DB migration)

`User` 表 (`student/db.py`) 改造：

| 字段 | 变更 | 说明 |
|---|---|---|
| `phone` | **新增** String(11), unique, index, nullable=False | 登录凭证 |
| `display_name` | **新增** String(64), nullable | profile 显示名 (原 username 语义) |
| `student_age` | **新增** Integer, nullable | profile |
| `gender` | **新增** String(16), nullable | profile (male/female/other) |
| `profile_completed` | **新增** Boolean, default false | 驱动首次登录弹窗 |
| `username` | 保留, 去掉登录唯一性依赖 | 迁移期老 username 搬进 display_name |
| `password_hash` | 改 nullable | 不再使用, 新注册不写, 保留列不破坏旧数据 |

迁移 (生产 PG, 走 _ensure_columns 幂等加列模式, 见现有 db init)：
- 加上述新列。
- 老用户回填：`xinghan` → phone=17744529940；其余 6 个 → 占位假号
  (如 `00000000001`..`00000000006`，标记不可真实登录)；username → display_name；
  全部 profile_completed=true (老用户不弹 profile)。

## 短信服务封装 (新模块 `student/sms/`)

- `sms/aliyun.py`：封装阿里云新版 SDK (`alibabacloud_dysmsapi20170525` +
  `alibabacloud_tea_openapi`)，暴露 `send_sms_code(phone: str, code: str) -> bool`。
  调 `SendSms`，传 PhoneNumbers / SignName / TemplateCode / TemplateParam=`{"code": code}`。
- 配置全走 env：`ALIYUN_SMS_KEY` / `ALIYUN_SMS_SECRET` / `ALIYUN_SMS_ENDPOINT`
  (默认 dysmsapi.aliyuncs.com) / `ALIYUN_SMS_SIGN` (北京星健健康科技咨询) /
  `ALIYUN_SMS_TEMPLATE` (SMS_501786105) / `ALIYUN_SMS_DEBUG` (默认 false)。
- debug=true 时：不调阿里云，验证码打日志，供无 key 的环境兜底 (默认关)。

## 验证码存储 (复用 student/cache.py 的 Redis)

频次/反刷限制由**阿里云后台自行配置** (用户决定)，本服务不实现日限/IP 限。
只保留验证码逻辑本身必需的：
- 验证码：6 位数字，存 Redis `sms:code:<phone>`，**TTL 5 分钟**，验证成功即删 (一次性)。
- 发送冷却：`sms:cooldown:<phone>` **60 秒**，期内重复请求拒发 (基本体验/避免误触连发，非反刷策略)。
- 验证失败：连续失败若干次使当前 code 失效需重发 (防暴力猜 6 位码，纯本地逻辑)。

## 认证流程 (auth/routes.py 改造)

新端点：
- `POST /api/auth/send-code` — body `{phone}`。校验格式 → 60s 冷却检查 → 生成码存 Redis →
  调 `send_sms_code` → 返回 `{ok, cooldown_sec}` (不回传验证码)。
- `POST /api/auth/verify` — body `{phone, code}`。校验 Redis 码 → 命中则：
  老用户(phone 已存在) 直接登录；新用户自动建号 (仅 phone, profile_completed=false) →
  返回 `{token, user_id, profile_completed}`。
- `PATCH /api/auth/profile` — 登录态。body `{display_name, student_age, gender}` →
  写入并置 profile_completed=true → 返回更新后 profile。

移除：`POST /api/auth/register`、`POST /api/auth/login` (旧 username/password 端点删除)。
保留：`GET /api/auth/me` (加返回 phone/display_name/age/gender/profile_completed)、
`POST /api/auth/logout`。

JWT 不变：`sub` 仍是 user_id，五层 memory / catalog / chat 等全靠它，不受影响。
`create_access_token` 第二参从 username 改成 display_name 或 phone (仅展示用，不影响鉴权)。

## 前端 (student-web)

- 登录/注册合并为单页：手机号输入 → "获取验证码"(60s 倒计时) → 验证码输入 → 提交调 verify。
- 删除 username/password 注册与登录表单。
- 登录成功后：若 `profile_completed=false` → 弹 **ProfileSetupModal** (display_name/
  student_age/gender，全部必填) → PATCH /api/auth/profile 成功后才进主界面；
  profile_completed=true 直接进主界面。
- API client (`lib/api`) 加 sendCode / verify / updateProfile。

## 测试

- pytest **mock 阿里云 SDK** (不真打网络/不烧短信费)：
  - send-code: 格式校验、60s 冷却命中拒发。
  - verify: 正确码登录、错误码拒、过期码拒、新手机号自动建号、连续失败锁定。
  - profile: 补全后 profile_completed=true、字段校验。
  - 旧 register/login 端点已移除 (404/405)。
- 真实发送手动脚本：用 xinghan 真号 17744529940 跑一次 send-code，确认阿里云链路通
  (生产配 key 后由用户本人执行，不进 CI)。

## 依赖

- 新增 Python 包：`alibabacloud_dysmsapi20170525`、`alibabacloud_tea_openapi`
  (加进 student-app pyproject)。

## 非目标 (YAGNI)

- 不做密码登录 (纯验证码)。
- 不做国际手机号。
- 不做短信以外的验证渠道 (邮箱/微信等)。
- 不做老用户补绑手机号的 UI (占位号用户若要登录，后续单独处理)。
- 不做图形验证码 (先靠 Redis 频率限流；若被刷再加)。

## 验收

- 新手机号: send-code 收到真实短信 → verify 建号登录 → 弹 profile → 补全进主界面。
- 已注册手机号: send-code → verify 直接登录 (不弹 profile)。
- 冷却: 60s 内重复 send-code 被拒。
- xinghan 用 17744529940 能登录 (老数据迁移成功)。
- 旧 username/password 端点已不可用。
- AccessKey 不在代码库任何文件中 (grep 验证)。
- pytest 全绿 (SDK mock)。
