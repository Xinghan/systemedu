"""systemedu-library: 内容服务 (spec 023).

独立部署的 service, 提供:
- 公开 API (license token): cloud-app 调用拿项目内容
- 管理 API (admin token): admin UI / content-pipeline 上传/管理项目
- AdminUser 系统 (跟 cloud-app 用户系统隔离)

数据存储:
- ~/.systemedu-library/db.sqlite: SQLAlchemy DB
- ~/.systemedu-library/media/projects/<slug>/: package layout 文件存储
"""

__version__ = "0.1.0"
