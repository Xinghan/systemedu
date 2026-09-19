# 写出我的第一段驾驶规则

项目 ID：write-driving-rules；作品 ID：driving-rules。本地四节点课程，累计约 50 分钟为设计目标，每节 10–15 分钟，可分次学习，尚无儿童试用证据。首轮受众暂按 10–12 岁，电脑或平板优先；无需注册、材料或编程安装，成人只需协助打开页面。

## 课程结构

入口先展示课程路径。M01 区分输入与动作，M02 编写条件规则，M03 同路对照与换路检验，M04 处理未知并交付。每节有独立正文、参考文档、官方视频与中文观看/替代任务、实践和个人学习记录。具体内容见 course/tree/knowledge_tree.json 和 course/knodes/。

学习记录使用独立的 systemedu:guided-course:write-driving-rules:v1，逐节点保存、可下载；提交只代表留下记录，不是自动评定掌握。M04 可关联按当前模型重新核验的实际实验记录，单独实验通过不会完成全课程。课程包 guided-course/1 是本地预览格式，尚未导入正式内容服务或接入账号进度。

## 操作、模型与交付

先运行只会前进的初始规则，观察软沙打滑或遇到岩石停止。修改 clear / sand / rock / unknown 到 forward / slow / detour / stop 的映射。再运行训练路线与另一条布局不同的路线；两条路线用同一版规则通过，并在未知地形前停下，才能保存成品。

正常完成需至少修改一次、保留一次不合适的动作以及当前版本两条路线的通过结果。修改规则后旧版本测试不作证。草稿自动保存规则和测试记录，刷新可继续。打开以前的规则会清空本轮通过状态，需要重新运行两条路线；记录明确标注 imported-and-retested，不把导入的程序冒充本轮从零创作。

运行器逐段读取平台提供的类别并执行动作。正常前进为一个教学时间单位，慢行为两个；绕行沿预置侧方平整通道走三段。直接驶入岩石碰撞，快速入沙停滞，unknown 仍移动判为未通过。两条路线都在未知地形前结束。旁路、地形分类和运动模型由平台提供，孩子制作的是四条控制规则，不是图像识别模型。

导出包含 controller_version: terrain-actions/1、受限 program.rules、输入/输出枚举、修改及各版本测试记录。运行器不 eval 文件代码。导入检查大小、版本和动作枚举，忽略文件中的完成声明；实际重新计算结果。下载文件经模型测试重新读取执行，证明程序格式确实可消费，但组装项目尚未实现。真实硬件的接口和异常处理仍需重做验证。

## 运行与保存

入口：/explore/space-exploration/write-driving-rules；静态包：/project-lines/space-exploration/write-driving-rules/index.html。项目线位于 /library?view=lines。

通过 HTTP 提供本目录及相邻 _shared/、spot-a-world/vendor/，不能只复制 index.html 后双击打开。3D 复用本地 Three.js 0.184.0（MIT，许可证在 vendor/LICENSE）。程序建模的几何和 Canvas 绘制由本项目生成。实验本身没有运行时外部素材请求；课程的参考和视频来自外部官方来源。规则项目使用 Canvas 路线图；其他项目没有 WebGL 或发生上下文丢失时改用同一状态的 Canvas 示意。

成果格式版本 write-driving-rules/1，origin: simulated，场景版本 mars-training/1。本机键 systemedu:write-driving-rules:v1，保存最近 6 份作品；无跨账号/浏览器同步。损坏数据不覆盖、配额失败明确提示下载，不能宣称已保存。所有提示由本地规则生成，没有在线 Agent。

## 验证与真实试用

模型检查：node --test scripts/tests/space-project-models.test.mjs；课程浏览器检查：node scripts/verify-guided-course.mjs；原实验回归：node scripts/verify-space-projects.mjs（systemedu 仓库，学生端需启动）。截图及样例作品来自自动操作，不是儿童成果或用时数据。完整证据见内容仓库项目线的 verification/space-batch/。

儿童试用观察：能否找到第一个动作、首次卡在哪里、是否需要成人接管、能否说出自己改变了什么、是否能重新打开作品。真实平板与 Safari 尚待验证。
