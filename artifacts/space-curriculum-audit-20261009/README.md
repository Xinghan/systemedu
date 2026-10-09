# 星际远航课程重编排审核证据

2026-10-09 · **设计草案，未修改应用、部署、知识树或学习记录。**

正式方案位于相邻 `systemeduidea` 仓库：

- `project_lines/space-exploration/mission-resequence-20261009/design.md`
- `project_lines/space-exploration/mission-resequence-20261009/curriculum-map.json`
- `project_lines/space-exploration/mission-resequence-20261009/node-allocation.tsv`
- `project_lines/space-exploration/mission-resequence-20261009/validation.json`

## 生产依据

只读获取生产公开 API：

- `https://systeme.xin/api/library/projects/mars-analog-rover`，保存为 `mars-analog-rover-summary.json`。
- `https://systeme.xin/api/library/projects/mars-analog-rover/tree`，保存为 `mars-analog-rover-tree.json`。

实际知识树 56 节，摘要 knode_count 为 54。M23b/M36b 存在于生产文件和树中，不能误报为缺失。

使用既有部署通道运行 `inspect_published.py`，仅统计已发布课程文件的路径、字节数和 SHA-256，结果为 `published-file-inventory.json`。未查询或修改学生数据。

- 大课 115 个文件：56 正文 + 56 作业 + 树 + 中文蓝图 + manifest。与本地课程源比较，除 manifest 外全部相同。没有据此声明 manifest 内容一致。
- 引导课程 67 个文件：七棵树 + 29 正文 + 29 作业 + 打印车制造说明/控制程序。与网站本地资源全部一致。
- `local-published-comparison.json` 保存上述比对摘要。
- 设计校验进一步逐项核对全部 85 节的正文/作业，共 170 个生产哈希一致的引用。
- 作者源仓库的驾驶规则 M04 有两份文件滞后于网站：仍要求下载记录，缺少最新版独立作品交付说明。映射将生产镜像作为审阅依据并显式标记 `authoring_drift_files`；没有覆盖作者源或混入已有修改。

Lightkurve 的生产摘要和树接口在本次审核时均返回 404。火星车单节点接口匿名请求返回 401，是访问权限要求，不作为内容不存在的证据。本次通过生产文件哈希与本地内容比对，审核线上对应正文和作业。

## 重现设计校验

在两个仓库的现有本地路径下：

```sh
python3 artifacts/space-curriculum-audit-20261009/build_resequence.py
python3 artifacts/space-curriculum-audit-20261009/validate_resequence.py /private/tmp/space-mission-resequence-20261009
```

第一条仅生成临时 JSON/TSV；不会修改真实课程。已审阅的人类说明是作者编写的 `design.md`，不是生成器输出。

校验也接受已保存的方案目录；可通过 `--idea-root` 和 `--web-root` 指定其他检出路径。校验器会在方案目录写入 `validation.json`。

## 结论的边界

本批提供 85 节来源唯一归属、八个任务站、作品依赖、合并远征规则，以及硬件/标签/导航/记录四项必要衔接。媒体原件不重生成，课程仍须沿用统一课堂。

`validation.json` 的通过仅表示设计数据覆盖和引用完整、依赖无环、生产来源可核对。没有进行新增导航实现、样机试制、全部富媒体回归、学生实际课时或能力验证。新编排不能据此标为已上线。
