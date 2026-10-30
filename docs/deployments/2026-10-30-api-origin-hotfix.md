# 2026-10-30 我的项目页 API 地址热修复

用户反馈 `https://systeme.xin/my-projects` 加载报错。浏览器复现确认，构建 `UgihOHSw-XeycGxl60dQP` 请求了访问者本机的 `http://localhost:18820/api/my/badges`；隔离账户的项目列表也请求 `http://localhost:18820/api/my/projects`。

## 原因与修复

专项发布脚本没有像原部署脚本一样，在构建阶段显式设置空的 `NEXT_PUBLIC_STUDENT_API_URL` 和 `NEXT_PUBLIC_GATEWAY_URL`。原代码在变量缺失时无论环境都回退到本机后端。此前浏览器验收按 API 路径拦截后转发，未先验证请求来源，因此掩盖了错误地址。

- 新增共享 API 地址配置：仅开发环境默认使用 `localhost:18820`，生产环境缺省使用当前网站；显式地址及合法空字符串保持原含义。
- 课堂音频、插图和 API 客户端使用相同的生产缺省规则。
- 发布脚本恢复两项显式构建配置。热修复发布在切换前检查全部新生成的 JS，拒绝包含本机后端地址的构建。
- 浏览器验收在任何测试响应或转发之前检查请求来源。生产匿名验收直接访问真实接口，不改写请求地址。

修复源码：`1d65f91b318f1a57e76294ed36f1fd1a9cbb0f8f`；线上 Build ID：`9ScDKpY55RhMl093JijA0`。本次只发布三个前端源码文件，课程、后端、学生记录未改动。分支为 `codex/lightkurve-integration-20261029`。

## 验证证据

证据保存在 `artifacts/api-origin-20261030/`：

- `before/verification.json` 是预期失败的旧版回归，记录了发往本机的真实请求。
- `unit-verification.json` 验证五种生产/开发/显式配置组合，并检查实际 API 调用的地址、认证和内容版本请求头。
- `build-verification.json` 检查 154 个新生成 JS 文件，不包含本机后端地址。
- `candidate/verification.json`、`production/verification.json` 检查公开项目目录、登录跳转、项目网格/列表、进行中/已暂停/已完成/空列表状态、继续学习路径和请求来源；候选和线上报告的 `passed` 均为 true，错误域名请求和页面错误均为空。
- `classroom/candidate/verification.json` 使用已核对课程源的隔离数据，检查 32 节统一课堂、媒体入口、旧笔记与实验产物恢复、讲课、下载包以及独立验证封存。
- `server-verification.json` 核对部署源散列、当前 Build ID、三个服务及后端未改动。

项目列表和课堂的登录状态均使用完全拦截的隔离夹具，不向真实学生账号写入测试记录。公开目录、匿名接口与登录边界使用真实生产服务。课堂文件仍有三个既有 ESLint 错误与四个警告，修改前后结果完全相同，API 两文件无 lint 问题，见 `lint-baseline.json`。构建沿用既有 TypeScript 配置。

## 回退

完整旧前端保存在 `/opt/systemedu/releases/api-origin-20261030/student-web-before`，持久脚本为同目录 `release.py`。回退会恢复旧版，也会恢复本次修复前的 API 地址问题；应仅在新构建出现更严重回归时使用。脚本先核对当前源码，拒绝覆盖后续发布。

```sh
SYSTEMEDU_DEPLOY_SECRET=/absolute/path/to/deploy-secret.local \
  bash scripts/releases/api-origin-20261030.sh rollback
```
