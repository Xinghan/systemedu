# 生产历史发布存储审计与清理

用户授权：列出历史发布/备份目录，确认不是真正运行中的业务数据后删除。

## 审计目录

根目录 `/opt/systemedu/releases`，清理前 `du` 合计约 21 GB。以下大小为一次整体 `du` 遍历时各目录分摊的磁盘块占用；存在跨目录硬链接，不能把它当成每个目录独立可释放大小。

| 目录（均位于上述根目录） | 清理前占用 | 处理范围 |
| --- | ---: | --- |
| `slides-20260908` | 2.2 GB | 旧前端、暂存课程、课程压缩备份 |
| `m81-evidence-20260908` | 4.2 GB | 旧前端、暂存课程、课程压缩备份 |
| `lesson-reader-20260909` | 1.1 GB | 旧前端 |
| `slide-layout-20260909` | 1.1 GB | 旧前端 |
| `m87-m89-evidence-20260909` | 4.2 GB | 旧前端、暂存课程、课程压缩备份 |
| `m38-m90-evidence-20260909` | 2.3 GB | 旧前端、课程压缩备份 |
| `m01-evidence-20260910` | 590 MB | 旧前端、课程副本、课程压缩包 |
| `m0203-evidence-20260910` | 988 MB | 旧前端、课程副本、课程压缩包 |
| `m0405-evidence-20260911` | 196 MB | 旧前端、课程副本、课程压缩包 |
| `m06-evidence-20260911` | 592 MB | 旧前端、课程副本、课程压缩包 |
| `m23-evidence-20260911` | 2.4 GB | 旧前端、课程副本、课程压缩包 |
| `m08-variable-20260914` | 542 MB | 旧前端、课程副本 |
| `numbering-v2-20260914` | 163 MB | 全部保留：迁移、学生 PG 快照、Library 快照和旧代码 |
| `readonly-20260914` | 596 MB | 全部保留：最新完整回滚版本 |

只允许清理上述前 12 个已确认旧发布下的六类名字：`student-web-before`、`course`、`course-before`、`molecule-monster-hunter.tar.gz`、`course-before.tar.gz`、`previous-upload.tar.gz`。不删除整个 releases 根目录；保留各次发布的数据库备份、脚本、日志和校验记录。清理后这些更早发布不再具有完整的直接回滚能力。

## 与业务数据的区分

- systemd 的实际工作目录是 `/opt/systemedu/packages/student-web` 或 `/opt/systemedu`，不是旧 releases 路径。
- 只读扫描生产进程 cwd/exe/fd/mmap、systemd/nginx/cron 路径、线上目录符号链接，没有发现指向 releases 的运行时引用。
- 没有挂载点位于待删目录下。Docker PostgreSQL 实际使用 `/opt/systemedu/.data/pg`，Redis 使用 `/opt/systemedu/.data/redis`；均不触碰。
- 当前 Library SQLite 位于 `/root/.systemedu-library/db.sqlite`，当前课程资源位于 `/root/.systemedu-library/media`；均不触碰。
- 历史目录确实含数据库快照，并非全部都是可重建缓存：所有根级 `library-before.sqlite` 和 `numbering-v2-20260914/student-before.dump` 保留；不读取或打印其中的业务记录或凭据。
- 旧前端以 `package.json`/`src` 校验身份；课程副本有 manifest/knodes；压缩包逐成员检查为分子猎人课程归档，并排除 SQLite、SQL、PG dump 等数据库文件。保留最新回滚版本和完整迁移资料。
- 硬链接按 inode 计数估算真实可释放量。删除仅 unlink/rmtree 已列出旧路径，不 chmod、不截断、不修改共享文件内容，不跟随符号链接。

## 执行结果：已完成

已删除前 12 次旧发布中的 42 个目录或压缩包。没有删除数据库备份、发布日志和校验记录，两个保留目录完整保留。

- 可用字节：`731664384 → 18988961792`，即约 `698 MiB → 17.7 GiB`；实际释放约 **17.0 GiB**。
- `df -h /`：总量 **40G**，已用 **20G**，可用 **18G**，使用率 **53%**。
- `releases` 总分摊占用：约 **21G → 3.8G**。
- 保留目录当前分摊占用：`readonly-20260914` 约 **2.1G**，`numbering-v2-20260914` 约 **955M**。这些数字比清理前大是因为硬链接的 `du` 计数归属发生变化，并非又创建了备份或写入新业务数据。
- 清理时识别并保留了 **58,430 个仍有其他链接的文件 inode**；仅移除旧路径，没有改写其内容。
- 删除前后，在线前端、全部课程媒体、最近回滚目录和编号迁移目录共 **198,818 条路径**的 inode/大小/修改时间/链接目标等摘要一致（不比较会因移除硬链接自然变化的链接数，不纳入可变 Next 运行缓存）。
- **13 份数据库备份** SHA-256 一致，在线 Library/PG/Redis 数据路径身份未变。
- web、backend、worker、library、admin、nginx 六项服务均 **active**；backend、web、HTTPS 都返回 **200**。当前构建仍为 `ZfGjTkWmIZmJ4F16Si-91`，无需停机或重新部署。

结果由 `scripts/releases/cleanup-release-storage.py` 在审计和 apply 两阶段记录。服务器原始清单为 `/tmp/systemedu-release-cleanup-20260914-plan.json`，原始结果为 `/tmp/systemedu-release-cleanup-20260914-result.json`。本地留存：`artifacts/storage-cleanup-20260914/plan.json`、`artifacts/storage-cleanup-20260914/result.json`。

服务器持久审计副本（0600）：`/opt/systemedu/releases/cleanup-20260914-plan.json` 和 `/opt/systemedu/releases/cleanup-20260914-result.json`。

后续不能再声称前 12 次发布保留完整回滚包；它们只保留数据库备份和审计元数据。近期完整回滚仍使用 `readonly-20260914`，迁移追溯资料仍使用 `numbering-v2-20260914`。
