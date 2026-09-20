# 03 实物探测车验证 · 2026-09-20

已验证：八节点探测车、五节点远征、接口与耦合预算、诊断与迁移、版本失效、数字不能代替实物、源码与 JPEG 照片的账号保存、提交快照恢复与账号隔离、游客范围、桌面/手机、WebGL 与矢量降级。旧课程回归见 legacy-regression/verification.json。

浏览器报告：verification.json（完整新流程）、review-verification.json（源码恢复、工程图、结构展开、项目库准备说明、降级）。截图中的“E2E / SOFTWARE TEST FIXTURE”是自动化测试输入，仅用于临时隔离账号，测试后删除。不是真实学生作业或硬件试制证据。

制造检查：四个 STL 的有向边闭合、外形尺寸、正体积通过；控制程序模拟检查启动静止、开关断线、触碰停止、异常停止、占空比和单次运行时限。源码模型检查拒绝篡改日志与过期的诊断/任务签名。

未验证：实体打印配合、实际电子电路与运动表现、真实儿童适配、目标学习时长。需要首台样机和儿童试用。源码附入和照片齐备只产生待评阅交付，不构成硬件认证。

全量 tsc 仍有 6 处本轮之前存在的无关错误（slide-demo 两处，course-content-view 四处）；本次文件没有新增类型错误，定向 ESLint 通过。

复跑顺序：node scripts/verify-rover-system.cjs；python3 scripts/verify-rover-hardware.py；准备隔离账号后 node scripts/verify-rover-system-ui.mjs 与 node scripts/verify-rover-review.mjs。不要使用真实学生账号运行填充测试。
