# 凌星调查展示格式一致性

本批以现有火星探索为基准，抽出两条路线共用的首屏、阶段条、下一步推荐、搭档站点说明和课程步骤。凌星保持六阶段、32 节及所有原记录，采用同风格观测场景与按阶段编写的文字简报；没有把文字或静态图标成新视频。

- `local/verification.json` 与截图：1440、390、320px 共享样式对比、阶段切换、32 个正式入口、地图键盘/缩放、简报焦点恢复、任务中心场景检查；全部通过。
- `node-record-regression.json`、`curriculum-regression.json`、`operations-regression.json`：原节点、任务顺序与学习记录保持兼容。
- `typecheck.txt`：六个既有类型错误，无本批新增错误；不是全量零错误。
- `image-provenance.json`：内置 `image_gen.imagegen` 提示词、参考图、项目内三个 WebP 文件位置和 SHA-256。无人地图与虚构任务搭档首屏已分别检查。

本地阶段成果完成时尚未发布。最终生产状态以 `artifacts/transit-format-release-20261030/` 的发布报告为准。课程源和版本没有改动，原流程图资源保留以兼容历史引用。
