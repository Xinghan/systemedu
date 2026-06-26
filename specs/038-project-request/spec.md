# Spec 038: 项目申请 (Project Request)

Status: draft (2026-06-26)

## WHAT

学生在 student-web 任意页面点顶部导航栏的"申请项目"按钮, 弹出一个只含一个多行文本框的弹窗,
填写自己想做的项目 idea, 提交即可。后台记录这条申请 (关联申请人), student-admin 只读后台
新增一个页面展示所有申请 (申请人 / 时间 / idea 全文)。

## WHY

- 现有项目库是平台预置的固定内容。学生有"我想做 X"的真实需求时, 当前无任何反馈渠道。
- 这是收集真实学习意愿、指导后续内容生产 (course_factory 选题) 的第一手输入。
- 最小可用形态: 不做审批流、不做状态流转、不通知, 先把"想做什么"沉淀下来给内容团队看。

## 范围 (已确认决策)

| 决策点 | 选定 |
|---|---|
| 入口位置 | student-header 顶部导航栏按钮 (全站可见) |
| 登录要求 | 必须登录, 复用 JWT, 自动关联 user_id |
| 表单字段 | 仅一段 idea 描述 (多行文本框) |
| admin 能力 | 纯只读列表 (申请人 / 时间 / idea), 跟现有 student-admin 一致 |

## 不做 (YAGNI)

- 不做状态流转 (待处理/采纳/拒绝) — admin 现在是只读连库, 加写权限是另一回事, 以后需要再说
- 不做标题/年龄/领域等额外字段 — 先单文本框上线
- 不做匿名提交 — 必须登录
- 不做邮件/站内通知

## 数据模型 (student-app db.py, init_db 建表)

```
ProjectRequest
  id          String(36) pk uuid
  user_id     String(36) FK users.id  index  not null
  idea_text   Text  not null
  status      String(16) default "pending"  not null   # 预留, 当前不流转
  created_at  DateTime default utcnow  not null
```

student-admin 只读 import 此 model, 不建表 (跟现有只读架构一致)。

## API

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| POST | /api/project-requests | JWT | body {idea_text}; 存一条, 返 {ok, id} |
| GET | /sysadmin/project-requests | admin cookie | 只读 HTML 列表 |
| GET | /api/admin/project-requests | admin cookie | 同数据 JSON |

## 验收

1. 未登录 POST /api/project-requests → 401
2. 登录后提交非空 idea → 200, DB 新增一行, user_id 正确
3. 空 idea → 400
4. student-web 顶栏可见"申请项目"按钮, 点开弹窗, 提交成功 toast
5. /sysadmin/project-requests 列出该申请, 显示申请人 display_name/phone + 时间 + idea 全文
6. pytest 覆盖 1/2/3
```
