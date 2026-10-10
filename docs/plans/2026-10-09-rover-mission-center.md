# Rover Mission Center Implementation Plan

**Goal:** 保留探测车 2.0 的三阶段、八节点与原课堂，增加任务中心、真实进度地图、场景简报和已有视频入口。

**Architecture:** 仅为 assemble-a-rover 2.0 启用。无 node 参数进入任务中心，有 node 参数继续原 GuidedProjectCourse；任务简报、地图均链接原课堂锚点。Notebook 仍沿用原 scope/version。工作台和最终交付的状态只读既有记录，不产生新的完成标记。

**Tech Stack:** Next.js / React / CSS Modules / 既有学习记录 API。

## Implementation

1. `lib/project-lines/rover-mission.ts`：定义八个场景简报、进度展示规则及原 scope。验证已提交、草稿、读取失败和最终实物交付的区别。
2. `components/learning/rover-mission-center.tsx` 与样式：场景主视觉、继续任务、三段任务地图、作品进度、前导视频对话框。素材全部复用；不调用生成服务。
3. `guided-project-course.tsx`：无 node 的任务中心；节点内简报与返回地图链接；正文、reference、video、工作台、笔记、下载和旧版本保留。聚合读取使用 allSettled，避免单个失败提前显示完整进度。
4. 浏览器验收：桌面和手机、键盘、视频关闭停止、节点导航、草稿/提交恢复、认证隔离、失败状态、原资料与工作台入口。模型级验证避免打开节点即完成、数字通过即实物交付。
5. 查看 diff，提交并推送当前实验分支；不部署，不合并。

只增加体验层，未生成新课程知识节点；course_factory 的课程内容生成流水线不在本批调用范围。
