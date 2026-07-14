# Plan 047: 管理端邀请码视图

## 数据流

```
admin UI /invites (library admin JWT in localStorage)
   │ GET /api/admin/invite-codes  (Bearer <library-admin-JWT>)
   ▼
student-app admin/routes.py
   │ 1. 反查 GET {LIBRARY_BASE_URL}/admin/auth/me (Bearer 同 token) → 200 才放行
   │ 2. db.list_invite_codes_with_users() (invite_codes LEFT JOIN users)
   ▼
{stats, codes[]}
```

- 鉴权反查封装为模块级 `verify_library_admin_token(token) -> bool`,
  测试 monkeypatch; 生产走真 httpx (timeout 5s, 失败视为 401)。
- 路径前缀 /api/admin/* 与学生端 /api/* 同域, 生产 nginx 零改动。
- admin UI 沿用 library-admin-api.ts 的 token 读取, 但请求发往 student-app
  (生产同源相对路径 /api/...; 本地 dev NEXT_PUBLIC_STUDENT_BASE_URL 或默认
  http://127.0.0.1:18820)。

## 影响面

student-app (+admin 模块, server 挂载), tests (+1 文件), library-admin-ui (+1 页 +导航)。
不动 library-app / student-web / nginx / DB schema。
