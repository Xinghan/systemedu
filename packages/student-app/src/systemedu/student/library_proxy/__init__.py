"""library_proxy — student-app 调 library-app:18821 转给前端.

公开路由 (无需登录):
    /api/library/projects
    /api/library/projects/{slug}
    /api/library/projects/{slug}/tree
    /api/library/projects/{slug}/blueprint

需登录 + 已 Pull 才能访问:
    /api/library/projects/{slug}/knodes/{knode_id}
    /api/library/projects/{slug}/files/{path}
"""
