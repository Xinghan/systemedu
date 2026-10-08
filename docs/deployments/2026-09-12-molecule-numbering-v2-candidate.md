# 分子猎人连续编号候选（未部署）

历史记录：这是 2026-09-12 的未部署候选记录。2026-09-14 已完成协调切换，生产和本地规范源均为 consecutive-v2；正式结果见 `2026-09-14-molecule-numbering-v2.md`。以下保留当时的验收与切换要求，不是当前待办。

## 一致性范围

- 现有 47 节统一为 M01–M47；437 页 slide 保留数量、原始 slide identity 和正文锚点。
- M06 后接 M07（原 M23 / PubChem），再接 M08（原 M24 / 变量）；新 M23 是原 M51 / 批量指纹。
- 内容图、顺序、依赖、阶段收官节点、目录、正文引用、slide 文本、动画文本均进入同一映射。
- 新正式路由 `/learn/molecule-monster-hunter/v2/Mxx`；旧无版本路由只按旧编号重定向。
- 后台迁移覆盖 11 类直接关联表以及 `pending_growth` 中机器生成的 `knode:` 引用。保留用户原文、记录主键和其他项目记录；未知 ID / schema 必须停止，不能猜着迁。
- 对话 checkpoint 仍使用历史不可见身份键；课程概要缓存切新命名空间，避免 M23 冲突。
- 本机取数卡复制到 M07 key，保留旧 key，并用一次性标记防止已清除的新卡复活。

## 候选与验证

- 候选：`artifacts/molecule-numbering-20260912/candidate-v5/molecule-monster-hunter`。v1–v4 是排查过程产物，不得部署。
- 验证回执：同级 `verification.json`、`migration-report.json`。
- 47 节 / 437 页，449 个非文本媒体逐字节不变，364 条 SVG path 几何不变，源文件哈希不变。
- 14 页讲稿中的旧编号发生变化，旧音频已解绑；这些页不能宣称“新配音完成”。
- 本地 150 项前端回归通过；专门迁移 / 版本保护测试另见最新测试日志。
- 浏览器已检查 M06→M07、M07 的取数内容、新 M23 的批量指纹标题。未做生产登录端到端验证。
- 完整 TypeScript 检查仍报告现有 slide-demo / 作业 / capstone / course-content 相关错误；本次新增编号文件未出现在错误中。不能宣称全仓类型检查通过。

## 生产切换前的必做步骤

不要单独跑旧的 course 命令、不要仅部署 web。此次必须是一次协调切换：

1. 检查生产磁盘、当前代码/课程版本及迁移预检。上次已知剩余空间约 1.54 GB，必须重新确认；不自动删除历史备份。
2. 在生产备份 Student PostgreSQL、Library SQLite、课程媒体目录、web/backend 文件与 systemd 配置；备份限制为 root 可读。确认有足够回滚空间。
3. 建立维护窗口，暂停学生写入和 student worker，结束旧 websocket。不得仅依赖 advisory lock，它不阻止普通业务写入。
4. 在写入暂停状态执行 `migrate_student_numbering.py` dry-run。任何未知旧编号需单独处理，不得跳过、删除或宽泛映射学生记录。通过后才 `--apply --writes-paused`。
5. 导入 **candidate-v5** 的完整课程包并 publish。Library importer 会重建课节记录和媒体目录，必须保留之前的 Library DB + media 整体备份。
6. 同步发布新路由 / frontend / backend / worker / backend JSON 映射；为 backend 和 worker 同时设置 `STUDENT_MOLECULE_NUMBERING=consecutive-v2`。启动检查要求 DB marker 与 JSON 映射 SHA 完全一致。
7. 维护状态下验证 47 ID、437 slide、阶段依赖、记录迁移前后总数与抽样对应、旧链接跳转、无版本 HTTP/WS 拒绝写入、新版本正常读写。其他项目也需冒烟验证。通过才开放写入。
8. 将本地课程 canonical source 协调切到 v2，并保留 legacy source 独立快照，再恢复后续生成；否则下一次标准 course 打包会把生产覆盖回旧编号。

失败时保持维护窗口；按事务 audit 回滚 student 关联，并恢复完整 Library DB/media、web/backend/env 备份。恢复旧环境前必须核对 marker 已撤销。不能用全仓反向正则作回滚，也不能在恢复写入后盲目套用迁移前快照。

## 后续生成顺序

预览入口统一为 `/slide-preview/molecule-v2/M01`，按编号连续检查。M01–M07 对应此前顺序重制的前七节；后续重制从新 M08 接着做。历史部署回执与旧 source/fixture 路径不改写为虚假的新编号历史。所有新记录必须标明 `numbering_version=consecutive-v2`；生产迁移未完成前，禁止把候选标成已部署。
