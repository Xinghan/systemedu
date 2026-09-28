# pvlib 本地预览检查

日期：2026-09-28。状态：**预览骨架完成，课程制作中**。这不是已经开放或部署的课程，也不是硬件验证报告。

本批次新增独立 `/preview/pvlib` 预览读取和交互，不修改共享播放器或其他课程。内容源为 `systemeduidea/projects_data/pvlib-solar-forecast-station`。本地开发主机限制、manifest 路径、符号链接、资源类型、artifact 结构/长度/深度和课堂记录合同通过 102 项检查。

- `preview-boundary-report.json`：67 项纯逻辑/来源合同检查。
- `file-boundary-report.json`：35 项真实临时文件边界检查。
- 两个 `verify-*.cjs` 保存可复跑检查；临时 fixture 不属于课程。
- 新增 TypeScript/TSX 的 ESLint 通过。`tsc.txt` 保存全项目检查输出：已有共享文件错误，未出现 pvlib 文件错误；不能据此称全项目类型检查通过。

尚待课程内容落地后执行真实页面、iframe、游客恢复、登录保存、科学图形与完整课程验收。硬件模型、真实打印与测量验证状态由内容仓库分别记录。
