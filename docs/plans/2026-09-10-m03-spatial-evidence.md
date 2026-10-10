# M03 Spatial Evidence Implementation Plan

**Goal:** 将 M03 10 页已有空间草稿推进为带个人成果递进、完整运行模板和横向播放器的 v2 本地预览。

**Architecture:** 复用经过 SDF/RDKit 核验的四分子坐标和现有 3D/KaTeX 表达，使用独立 `molecule-skeleton-evidence` 分派保持 v1 可复查。第 8 页保存个人逐分子识读，第 9 页提供完整 Python 模板并核查本人粘贴的输出，第 10 页读取真实保存状态。M02/原始 M03 课程和生产不变。

**Tech Stack:** 现有 Three.js、RDKit.js、KaTeX/mhchem、React、LessonSlidesProvider；不新增依赖。

1. 核对原文、旧草稿、来源与每页媒介决策。使用 `course-slide-visuals`，不按图片/3D 配额生成。继承用户已确认的浅色技术教学方向。
2. 写独立成果模型测试：空白/非整数/错误计数/重复 ID/无确认/缺失运行环境都不得通过；保存恢复不冒充真实执行。
3. 实现纯模型、三个成果页和 M02 衔接；保持 1–7 页空间/公式准确，补齐原子定位的可访问方式和模型降级。
4. 生成 `M03-spatial-evidence-v2.json`、registry、完整 Python 模板。保留 10 个 ID/kind/anchor，旧音频不绑定。
5. 新建 `/slide-preview/m03-evidence`，页码按钮明确标记 3D/公式/动态/成果。使用现有横向切换和放大浮窗，不平铺。
6. 执行新增模型测试、现有 3D/RDKit/公式回归、ESLint/类型检查；浏览器核对 10 页、视角/氢/定位/单步/保存/错误/降级及窄屏。
7. 补完 M02 的 720/960 宽度和控制台检查，按实际证据更新 QA。交付 M03 预览；本轮不部署。

用户已要求继续，按上述有限范围直接实施；不新增子任务，不处理无关 dirty files，不提交或全量部署。

## 执行结果 · 2026-09-10

1–7 已完成到本地预览范围。新增 `molecule-skeleton-evidence` 包装器与个人成果模型，复用来源可核验的 3D/RDKit 实现；第 8–10 页不再用默认示例冒充学生成果。47 项相关测试通过，新文件 ESLint 和 diff 检查通过。10 页宽屏和放大浮窗、代表性 480px 页面与关键交互实际验收完成。M02 720/960px 和最终控制台补查完成。

完整验收与局限见 `docs/slide-image-prompts/molecule-monster-hunter-M03-spatial-evidence-v2.md`。M02/M03 原课程和生产未修改；新版无配音。下一节点推荐 M04；发布前需单独同步正文与音频映射。
