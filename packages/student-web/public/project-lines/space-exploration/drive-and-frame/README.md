# 开车找到观察点

项目 ID：drive-and-frame；作品 ID：first-drive。本地可运行版本，约 3 分钟为设计目标，尚无儿童试用证据。首轮受众暂按 10–12 岁，电脑或平板优先；无需注册、材料或编程安装，成人只需协助打开页面。

## 操作、模型与交付

选择层状岩石或沙丘，使用东南西北按钮或方向键驾驶。中间的岩石墙不能穿过；从上方或下方绕行。进入目标 2.25 格内并朝向它、视线未被障碍挡住且至少实际移动 3 次后，才可拍照。镜头可独立每次转动 45 度。

主视图表示车辆与路线；右下角取景窗显示当前相机。照片来自取景窗实际渲染，保存当时的目标、位置和镜头方向，不以预制照片替换。相册和路线可重新打开；拖动滑杆回看位置不会增加移动次数或产生新照片。

每格为教学地图单位；几何、车辆、地形和影像均由程序生成。障碍和可驾驶地图来自同一个逻辑定义，3D 和 Canvas 采用相同状态。照片不是 HiRISE 或真实火星影像，也不能证明实际车辆性能。

记录包含 target、pose、path、actions、当前相机 image（JPEG data URL）、渲染方式和页面经过时间。JPEG 和 JSON 可以独立下载。它可作为远征探索记录，不是视觉识别器。

## 运行与保存

入口：/explore/space-exploration/drive-and-frame；静态包：/project-lines/space-exploration/drive-and-frame/index.html。项目线位于 /library?view=lines。

通过 HTTP 提供本目录及相邻 _shared/、spot-a-world/vendor/，不能只复制 index.html 后双击打开。3D 复用本地 Three.js 0.184.0（MIT，许可证在 vendor/LICENSE），没有运行时外部素材请求。程序建模的几何和 Canvas 绘制由本项目生成。规则项目使用 Canvas 路线图；其他项目没有 WebGL 或发生上下文丢失时改用同一状态的 Canvas 示意。

成果格式版本 drive-and-frame/1，origin: simulated，场景版本 mars-training/1。本机键 systemedu:drive-and-frame:v1，保存最近 6 份作品；无跨账号/浏览器同步。损坏数据不覆盖、配额失败明确提示下载，不能宣称已保存。所有提示由本地规则生成，没有在线 Agent。

## 验证与真实试用

模型检查：node --test scripts/tests/space-project-models.test.mjs；浏览器检查：node scripts/verify-space-projects.mjs（systemedu 仓库，学生端需启动）。截图及样例作品来自自动操作，不是儿童成果或用时数据。完整证据见内容仓库项目线的 verification/space-batch/。

儿童试用观察：能否找到第一个动作、首次卡在哪里、是否需要成人接管、能否说出自己改变了什么、是否能重新打开作品。真实平板与 Safari 尚待验证。
