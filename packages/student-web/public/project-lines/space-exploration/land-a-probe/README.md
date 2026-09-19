# 把探测器稳稳送下去

项目 ID：land-a-probe；作品 ID：landing-replay。本地可运行版本，约 3 分钟为设计目标，尚无儿童试用证据。首轮受众暂按 10–12 岁，电脑或平板优先；无需注册、材料或编程安装，成人只需协助打开页面。

## 操作、模型与交付

先点“开始下降”，再点击开启/松开制动。制动改变实际计算的速度与高度；失败可以重试。触地或主动重试都会留下记录，落地快不被包装成成功。记录可通过滑杆回看，并显示最近两次高度曲线。

模型只含垂直方向的恒重力与推力，固定步长 1/60 秒；界面每秒播放 0.6 秒模拟时间。初始高度 60 m、速度 -4 m/s、可制动燃料 9 秒，点火推力对应 9 m/s²，落地速度不超过 3 m/s 记为柔和着陆。除重力近似值 3.7 m/s² 外，参数都是教学设定。燃料耗尽后推力消失；向上飞出范围或 90 秒模拟时间仍未落地终止为未完成。忽略空气阻力、姿态、发动机响应和变质量，不能用于真实飞行设计。

重力参考：[NASA Mars Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html)（2026-09-19）。场景和模型为本项目制作，非 NASA 飞行模拟器。

记录包含 model、frames（时间/高度/速度/燃料/制动）、actions、result（状态/触地速度）、真实页面经过时间。下载 JSON 可重建轨迹；它不是驾驶控制器或实物遥测。

## 运行与保存

入口：/explore/space-exploration/land-a-probe；静态包：/project-lines/space-exploration/land-a-probe/index.html。项目线位于 /library?view=lines&line=space-exploration。

通过 HTTP 提供本目录及相邻 _shared/、spot-a-world/vendor/，不能只复制 index.html 后双击打开。3D 复用本地 Three.js 0.184.0（MIT，许可证在 vendor/LICENSE），没有运行时外部素材请求。设备模型、材质、纹理及 SVG 由本项目制作。高细节 3D 提供跟随、全景、近看和环视；数据仪表使用 SVG。没有 WebGL 或发生上下文丢失时，使用精细 SVG 设备绘入 Canvas，保留同一操作状态。视觉方向、结构、性能分档和素材来源见 visual-brief.md。

成果格式版本 land-a-probe/1，origin: simulated，逻辑场景版本 mars-training/1，新增视觉版本 visual_version: mars-expedition/2，旧作品继续兼容。本机键 systemedu:land-a-probe:v1，保存最近 6 份作品；无跨账号/浏览器同步。损坏数据不覆盖、配额失败明确提示下载，不能宣称已保存。所有提示由本地规则生成，没有在线 Agent。

## 验证与真实试用

模型检查：node --test scripts/tests/space-project-models.test.mjs；浏览器检查：node scripts/verify-space-projects.mjs（systemedu 仓库，学生端需启动）。截图及样例作品来自自动操作，不是儿童成果或用时数据。最新运行与视觉证据见内容仓库项目线的 verification/visual-quality/；视觉验证命令为 node scripts/verify-space-visual-quality.mjs。早期记录仍保留于 verification/space-batch/。

儿童试用观察：能否找到第一个动作、首次卡在哪里、是否需要成人接管、能否说出自己改变了什么、是否能重新打开作品。真实平板与 Safari 尚待验证。
