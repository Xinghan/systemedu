# 太空探索新增三项目验收

2026-09-19，本地学生端 http://localhost:4000。来源为自动浏览器操作和模型测试；不是儿童试用、真实车辆或真实火星观测证据。当前未发布生产。

## 结果

- node --test scripts/tests/space-project-models.test.mjs：5 项通过。自由落体解析公式、燃料/制动、障碍与取景、规则轨迹和版本验收。
- node scripts/verify-space-projects.mjs：9 组通过，运行错误列表为空。原始记录见 verification.json。
- node scripts/verify-library-discovery.mjs：10 组通过，覆盖目录数量、筛选、导航、双语、窄屏和内容服务故障。
- 本次修改的 TypeScript 页面、目录、卡片及文案 ESLint 通过。

互动检查覆盖：无制动失败与实际操作成功；失败保留、着陆回放、JSON 下载；障碍阻挡、路线与照片一致、重新打开；换目标/朝向会改变可拍摄条件；初始规则失败、修改后双路线检验、unknown 停车；当前版本重新验收；导入规则需要重测，错误文件不覆盖；390 像素触屏按钮与无横向溢出；三个项目的存储读取/写入异常；实际项目线入口与嵌入页面；手机 3D、键盘驾驶、WebGL 上下文丢失后保留位置并继续拍照。

## 证据

- landing-desktop.png、driving-desktop.png、rules-desktop.png：桌面完整页面。
- 各项目 -mobile.png：Canvas 降级的 390 像素触屏布局；driving-mobile-webgl.png：手机尺寸 3D 场景。
- *-cover.png：对应项目的实际运行画面，作为项目库封面。
- sample-landing.json：无制动着陆失败轨迹。
- sample-drive.json、sample-rover-photo.jpg：绕过障碍并亲手取景的样例。
- sample-driving-rules.json：包含失败、修改、两条路线通过证据的规则程序。

## 使用边界与下一步

三个新项目的运行器和素材均在本地静态包中；3D 依赖既有 spot-a-world/vendor 的 Three.js。规则项目使用二维路线图，地形类别由平台提供；导出规则由同一个动作模型实际执行，尚未接入规划中的组装页面。场景和记录均标记 simulated。

约 3 / 15 分钟是设计目标。项目内提示是本地规则；作品保存在当前浏览器，不能跨账号同步。真实儿童、真实平板及 Safari 尚未验证。全量 TypeScript 检查此前受独立学习页面既有类型错误影响，本次没有宣称整个工作区类型检查通过。

建议试用先走“驾驶拍照 → 驾驶规则”：观察孩子能否找到第一步、在哪里需要成人介入、是否理解自己的改动，以及能否重新打开自己的作品。
