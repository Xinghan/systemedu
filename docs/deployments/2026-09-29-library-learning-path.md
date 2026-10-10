# 项目库学习路径图发布

用户授权部署后，将已提交的实物路径图、配套矢量过程图和 pvlib 课程加载图标修复发布到生产站。

- 来源提交：`c8bd3ac0afa7416eb630bd11a64415b8f78c7072`，包含 `e63f27b4`、`5a9fe7f8`、`c8bd3ac0` 的前端增量。
- 基线构建：`bchoKNftDtuWBobX7IWqd`。
- 发布构建：`-tVkAQAU5ol1PVAsChFxX`。
- 入口：<https://systeme.xin/library>。
- 服务器发布目录：`/opt/systemedu/releases/library-learning-path-20260929`。

## 发布范围

只从 Git 导出 10 个前端文件，包含 6 张 WebP/SVG 资源和 4 个页面/组件/样式文件。以线上现有前端为基线，三方合并项目库页面，保留线上定制；不打包本地其他未提交改动。不修改数据库、后端或课程内容，也未合并分支。

构建在隔离目录完成。切换前核对线上基线和候选文件哈希，保留上一版静态资源，避免已打开的浏览器页面丢失旧资源。服务器检查确认三个服务正常，后端代码、课程目录清单及 pvlib 课程文件与发布前一致。

## 验收

生产构建通过；候选与原生产代码均有 3 条已有类型诊断，没有新增错误。候选及正式 HTTPS 浏览器检查均通过，中英文各覆盖 1440 / 1024 / 390 / 320px，验证两类图片加载、四阶段布局、无横向溢出、搜索筛选和项目线入口。课程加载状态显示运行中的 SVG 图标，并保持失效登录跳转。

正式 HTTPS 验收状态和截图保存于 `artifacts/library-learning-path-release-20260929/production/`；服务器完整性检查在同目录的 `server/` 下。公开项目库使用真实匿名 GET 请求，候选环境代理同一公开接口；加载状态检查单独使用全量拦截的模拟 API，不向生产发送模拟令牌或写入学生记录。

## 操作与回滚

```sh
python3 scripts/releases/prepare-library-learning-path-20260929.py
bash scripts/releases/library-learning-path-20260929.sh upload
bash scripts/releases/library-learning-path-20260929.sh stage
bash scripts/releases/library-learning-path-20260929.sh build
bash scripts/releases/library-learning-path-20260929.sh preview
bash scripts/releases/library-learning-path-20260929.sh tunnel
node scripts/releases/verify-library-learning-path-20260929.mjs http://127.0.0.1:14903 candidate -tVkAQAU5ol1PVAsChFxX
bash scripts/releases/library-learning-path-20260929.sh verification-evidence
bash scripts/releases/library-learning-path-20260929.sh publish
bash scripts/releases/library-learning-path-20260929.sh verify
node scripts/releases/verify-library-learning-path-20260929.mjs https://systeme.xin production -tVkAQAU5ol1PVAsChFxX
```

以上是本次单次发布的操作记录，不能重复用于覆盖后续发布。旧前端保存在发布目录内的 `student-web-before`。需要回滚时运行 `bash scripts/releases/library-learning-path-20260929.sh rollback`，脚本会拒绝覆盖后续前端改动。候选服务在切换时停止。
