# library-admin-ui (spec 023 Phase 5)

content-library 服务的管理员后台 SPA, 独立 Next.js 应用, 跟 systemedu cloud
完全隔离。

## 页面

| 路由 | 说明 |
|---|---|
| `/login` | 管理员登录 (JWT 存 localStorage) |
| `/projects` | 项目列表 (slug / 标题 / 状态 / 版本 / 规模 / 大小 / 更新时间, 含搜索 + 状态筛选) |
| `/projects/upload` | 拖拽 .tar.gz 上传, 进度条 (XHR), 上传完自动跳详情 |
| `/projects/<slug>` | 摘要 + 元数据编辑 + 文件树 (按 knode 分组) + 发布 / 下线 / 删除 |
| `/projects/<slug>/preview?path=...` | 文件预览 (md / json / html iframe / 图 / 音 / 视频) |
| `/stats` | 简单统计 |

所有页面通过 `localStorage[library-admin-token]` 持 JWT, 401/403 自动跳
回 `/login`.

## 开发

```bash
cd packages/library-admin-ui
npm install
# library-app 跑在 18821
NEXT_PUBLIC_LIBRARY_BASE_URL=http://127.0.0.1:18821 npm run dev
# → http://localhost:3001
```

## 生产部署

```bash
npm run build && npm run start    # port 3001
```

nginx 配置:

```nginx
server {
    server_name library.<your-domain>;
    location /admin/ { proxy_pass http://127.0.0.1:18821; }   # API
    location /v1/    { proxy_pass http://127.0.0.1:18821; }   # public API
    location /       { proxy_pass http://127.0.0.1:3001; }    # admin UI
}
```

`NEXT_PUBLIC_LIBRARY_BASE_URL` 留空 → 走相对路径 (nginx 同源转发)。
