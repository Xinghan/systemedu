# 动力发明家发布

2026-09-22 已发布至 https://systeme.xin/library?view=lines&line=energy-motion 。构建 `JpRViHMqD86nXCdfrw0Mw`，上一构建 `rZ1JTOMyEJKojtp-WxFwN`。来源 `76916521..a55be4a6`，共 130 个前端增量文件，无三方合并。

上线太阳能、风能、储能、智能调度的 9 个项目和 29 个学习节点，包含新版成熟工程封面、3D/二维实验、数字原型与实物证据、首次挑战记录。只上传当前引用的 `cover-engineering-v2.png`，保留生产已有资源兼容旧页面。

以实时生产源码为基线隔离构建，核对文件哈希后切换。没有发布工作区其他未提交代码，没有迁移数据库或修改后端，没有写入真实学生作业。账号保存沿用现有 learning_records 服务；本地已完成账号隔离验证。

候选与正式 HTTPS 各 6 组浏览器检查通过：9 项目/10 张图片、三入口操作保存恢复、数字原型快照与实物交付限制、规则/诊断/首轮固定、29 节教材参考与打印文件、390 px/无 WebGL/既有课程及接口。脚本异常为零，截图与结果在 `artifacts/energy-release-20260922/{preview,production}/`。

正式发布只重启前端；后端健康与源码保持通过核对。硬件实际打印、器件匹配和儿童使用效果仍待试验，软件发布不等于物理验证。

发布与回滚：`scripts/releases/energy-project-lines-20260922.sh`。服务器 `/opt/systemedu/releases/energy-project-lines-20260922` 保存旧前端、构建及验证记录。`rollback` 先核对本批文件未被后续修改，再恢复 `student-web-before`，不触碰数据库。

本地验收使用只监听回环地址的 SSH 隧道和临时同源代理；验收结束关闭。新“超能机械师”开发不包含在本次发布中。
