# 凌星课程语言修订：前端验收

本批次同步 32 节课程标题、阶段说明和任务文案，并为确切的已审核内容版本保留历史学习记录。详情见内容仓库 `projects_data/lightkurve-transit-detective/audit/language-revision-20261101/README.md`。

新测试：

```sh
LIGHTKURVE_SOURCE=/path/to/systemeduidea/projects_data/lightkurve-transit-detective node scripts/tests/lightkurve-language-revision.cjs
LIGHTKURVE_SOURCE=/path/to/course LIGHTKURVE_REPORT_DIR=/tmp/lightkurve-check LIGHTKURVE_ORIGIN=http://127.0.0.1:4002 node scripts/tests/lightkurve-language-browser.cjs
```

浏览器测试需要安装仓库根目录的 `@playwright/test`。原有三个导航/进度测试接受 `LIGHTKURVE_MISSION_REPORT`、`LIGHTKURVE_CURRICULUM_REPORT`、`LIGHTKURVE_OPERATIONS_REPORT`，可指定本次报告位置，保留历史验收记录。测试中的 URL 构造同时支持相对 API 路径。

本目录报告和截图来自本地统一课堂。浏览器测试使用真实页面及父页/iframe 实验协议；账号和项目进度测试使用模拟接口，未连接线上账号。原记录保持可读，未迁移或重写服务器历史。

修改文件 ESLint 通过。全项目 `tsc --noEmit --incremental false` 仍报告 6 个既有错误：`slide-demo/page.tsx` 的 2 个类型断言，`course-content-view.tsx` 的 4 个参数数量错误；这些文件未修改。本次未部署线上。
