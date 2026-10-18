# 地球、AI、脑科学任务整合 Implementation Plan

**Goal:** 保留全部既有节点与记录，将剩余三条领域线接成可跟随、可交接的任务线。
**Architecture:** 复用 integrated-mission、MissionControl 和统一课堂，新增三份声明式编排与地图/阶段简报。共享原课不复制内容、不合并不同任务自检记录。
**Tech Stack:** Next.js / React / TypeScript、现有学习记录 API、JSON 编排、WebP / MP4 / VTT。

日期：2026-10-18。用户已授权继续；沿用上一批隔离工作区。当前是实施计划，不表示已上线。

## 设计

地球主线：空气节点 57 节＋三门观察小课 13 节，围绕一个观测站问题交错；卫星 61 节与蚁群 60 节作为独立研究支线。
AI 主线：卫星 61 节＋地形标注 3 节＋预测检验 4 节；蚁群 60 节完整保留为研究助手支线，不能绕开其真实数据前置。机器人、脑科学作为后续领域入口，不硬锁为前置。
脑科学主线：EEG 63 节＋信号清洁 4 节；EMG 61 节为独立肌电机械手路径。脑电、肌电与合成信号身份明确，原始 M09b 等非连续 ID 保留。

默认启动无需购买；专业器材、外部接入、长周期观测在对应节点说明。原课程存在待复核部分（如 DIY 传感器第三方注册、旧活体实验、硬件版本），在任务上下文如实注明；本批保留教材，不假装已完成课程科学审校。学生新自制结构依旧按 3D 打印，不把旧材料操作当成新版打印文件已提供。

## 实施步骤

1. 在 artifacts/remaining-missions-20261018 保存所有引用树和课程文件指纹，核对原树、作业、实际导入版本；编制源身份清单。
2. 新建 tools/mission-authoring/integrate-remaining-missions.py：按原树 ID 建组，逐节点输入/输出/迁移、推荐/独立支线关系；生成 earth / computing / brain-mission.json、TSV 对照与源仓库独立目录。验证覆盖、无重复、原依赖无逆序，错误即停止。
3. 在 components/mission 增加共用剩余任务线页面、配置和阶段简报；/mission/earth、/mission/computing、/mission/brain 及 control 路由接入地图、进度、用时、计划、问题与交接档案。让已有集成组件的分支说明适用于三条线，保持能源/机器人行为。
4. 在 guided-project-course、learn-page、library/[slug] 及两类 micro 入口接入任务上下文和跨课继续，登录/领取保留原节点与任务参数；仍走原课堂，不加媒体 tabs。
5. 采用 imagegen 制作无人科研实验室地图/必要场景，优先复用已批准背景，制作各阶段简报视频，优化 WebP，记录提示词与来源。全部资产在网站和课程源归档。
6. 检查游客与模拟账号保存/恢复、跨线共享原课堂记录与独立任务记录、基础资料授权、非连续原节点、支线结束、视频到站/跳过/重播、320/390 屏宽；回归现有四线。类型/lint 与 9ecc8ae5 基线比较；构建使用已验证 webpack。
7. 更新实施状态与验证报告；只提交本次明确文件，分别 commit/push 两仓库并验证远端 SHA。不部署，不合并 main。

## 复查命令

网站根目录：python3 tools/mission-authoring/integrate-remaining-missions.py；node artifacts/remaining-missions-20261018/verify-core.cjs；浏览器脚本用 4020 开发服务。构建与类型检查串行运行，避免 .next 类型文件被重写。
