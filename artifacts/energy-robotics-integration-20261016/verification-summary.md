# 未来能源＋机器人觉醒：本地整合验收

日期：2026-10-16。本批已实现并通过下列本地检查；没有部署，没有合并 main，没有实物验收或儿童试教。

## 当前范围

| 项目线 | 原课堂节点 | 主线 | 独立支线 | 任务段 | 3 分钟入口 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 未来能源 | 167 | 87 | 80（机构 14＋热机 66） | 26 | 3 |
| 机器人觉醒 | 106 | 106 | 0 | 19 | 1 |

能源主线把 pvlib 58 节与可再生能源小课 29 节按同一次观测站任务交错。机器人将 ALOHA 原始 82 节与 24 节引导课程交错，先做夹爪、接口、打印试配，再进入四臂示教和学习。旧热机不是默认低压打印路线，不成为风光储的前置。

每段有输入、交付、迁移边界；节点逐一对应见 energy-node-allocation.tsv / robotics-node-allocation.tsv。原课堂、原记录版本与来源路径保留，交接档案仅为索引，不冒充上传文件或自动实物验收。

## 验证证据

- core-verification.json：5015 个原始来源文件 SHA-256 未变化；全部 524 条原课程依赖无逆序；104 个旧能源任务 ID、动作、交付和自检项未变。旧计时、计划、证据、状态可恢复。
- browser-verification.json：任务地图、任务中心、引导课堂、跨课程继续、两版交接保存与刷新恢复；模拟账号 API 下清缓存恢复与账号隔离；320/390 像素手机布局通过。
- classroom-verification.json：用真实源教材与模拟授权接口检查 ALOHA M10/M82、pvlib M04、热机 M20；统一课堂、原幻灯片/作业和跨课导航保留；未领取时保留任务与节点返回入口。
- resources-verification.json：两线共 16 个阶段短片格式、音轨、字幕；首次到达、跳过、重播；原课 16 份基础资料通过既有授权下载，403 不被绕过；星际与分子任务中心回归。
- preview-verification.json：实际本地 ALOHA 源课程可打开；旧 M58 动画地址进入原正文媒体；没有独立学生媒体 tabs；图片与音频可读，越界路径、非媒体文件和非本地域名被拒绝。生产构建中预览仍关闭。
- auth-resume-verification.json：四条任务线 API 401 后保留节点、任务参数与锚点返回登录。
- lint-baseline.json / typecheck-baseline.json：与 8aa96295 基线对比，无新增 lint / 类型问题；仓库仍有既有问题，不声称全库零错误。
- webpack-build.log：最终生产构建成功。既有配置跳过构建内类型验证，类型检查另行比较。默认 Turbopack 构建仍受原 Google Fonts 模块解析错误影响，本批未修复或掩盖。

## 资源与发布边界

机器人新增一张无人室内实验室地图，复用已批准的精细实验台素材制作分辨率不同的 WebP 背景。八段新短片为 1080p 有声任务简报，带字幕与轻微镜头运动；云 TTS 因 SSL 请求失败，本批采用 macOS Tingting 本地语音。不是新增课堂实验动画，也不是实机演示录像。能源原八段短片保留。

published-source-audit.json：核对时生产 pvlib 58 节、热机 66 节公开树可读取，ALOHA 公开课程树返回 404。本地机器人课程使用真实源文件验收；正式发布前仍须接入 ALOHA 课程资源与授权访问，不能将本批称为已上线。

## 七条领域线与四条任务线

目录有 7 条领域线：机器人觉醒、星际远航、分子寻药、未来能源、地球脉动、智能造物、大脑解码。本批完成后，前四条有完整任务入口和节点编排；后三条仍保留项目目录，不能据此声称任务组件已齐全。脑科学没有合并回机器人，本批仅复用信号处理的基础方法。

## 本地入口

- http://localhost:4020/mission/energy
- http://localhost:4020/mission/robotics
- http://localhost:4020/mission/energy/control
- http://localhost:4020/mission/robotics/control
- http://localhost:4020/preview/aloha/M10?mission=robotics

## 复查方式

在网站工作区根目录执行 artifacts/energy-robotics-integration-20261016 下 verify-core.cjs、verify-auth.cjs、verify-types.cjs、verify-lint.cjs。浏览器脚本需本地开发服务 4020 和 Playwright。verify-types.cjs 应在构建结束后串行运行，避免 .next 类型文件被同时重写。

媒体脚本在网站仓库执行；在课程仓库执行时先设置 SYSTEMEDU_ROOT 为网站工作区。构建地图还需要 provenance 中记录的原图路径；交付的压缩媒体已经归档，无需重生成即可验收。
