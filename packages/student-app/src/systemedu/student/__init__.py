"""spec 027: Student Web Service backend.

独立的多用户消费端 web service:
- auth/         注册/登录/JWT (复制自 024-A cloud-app multiuser)
- library_proxy/ 调 library-app 公开 API 转给前端
- catalog/      "我的项目" (UserProject + LastVisited)
- db.py         独立 SQLite (~/.systemedu/student.db)
- server.py     Starlette app, 端口 18820
"""

from .db import init_db, get_session

__all__ = ["init_db", "get_session"]
