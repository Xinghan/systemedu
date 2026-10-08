# 分子怪物猎人 · M01 讲课视觉替换记录

> 最新决策：s1 的深色蛋白渲染已取消映射，保留为未引用候选文件。项目路线需要精确、可读的流程关系，当前以浅色 HTML/SVG 流程图为唯一教学面。

## 范围

- 课程项目：`molecule-monster-hunter`
- 节点：`M01-w0-module`
- 原始教学目标：建立“靶点 → 候选分子 → AI 预测排序 → 真实验验证 → Top 10 报告”的正确模型，并写出项目立项卡。
- 视觉规则：概念流程、预测与证据、任务结构均用可缩放的 HTML/SVG 技术图；动态讲解保留互动 HTML。M01 开场另用一张真实蛋白结合口袋的压缩 WebP 建立科学情境，随后保留 SVG 流程图解释精确链路。

## 逐页媒介与映射

| Slide | 原始教学主张 | 最终媒介 | 替换内容 / 映射 | 理由 |
| --- | --- | --- | --- | --- |
| `s1` | 整个项目最终要交付什么 | Hybrid：WebP + HTML/SVG 流程图 | `payload.images[0]`：`images/m01-protein-target-candidates-v1.webp`；`payload.inline_svg`：靶点 → 候选分子库 → AI 筛选 → 真实验 → Top 10 报告 | 蛋白结合口袋提供真实的研究对象和尺度感；流程图仍精确解释项目架构与交付链路。 |
| `s2` | 靶点、候选分子、AI 模型各负责什么 | HTML/SVG 数据流图 | `payload.inline_svg`：靶点与候选集输入模型，输出优先级 | 将“角色”落实为技术系统中的输入、约束和输出。 |
| `s3` | AI 在药物发现中的位置 | HTML/SVG 虚拟筛选流程图 | `payload.inline_svg`：10,000+ 候选 → 虚拟筛选 → Top 10 → 真实验 | 需要精确表达 AI 缩小实验范围的位置。 |
| `s4` | 预测不是结论 | HTML/SVG 证据对照图 | `payload.inline_svg`：模型分数 → 优先送检 → 一个继续、一个验证失败 | 直接呈现“高分只是值得优先试”。 |
| `s5` | 候选数量会如何随筛选减少 | 既有互动 HTML 动画 | `idea_id=anim_1781593352281_qnil`，不替换静态缩略图 | 计数变化需要动态呈现；静态图片会丢失教学机制。 |
| `s6` | 在有限真实验中体会模型会失误 | 既有互动 HTML 游戏 | `idea_id=game_1781593352281_bjjh`，不替换静态缩略图 | 用户操作与结果反馈是该页的核心。 |
| `s7` | 立项卡如何约束全项目 | HTML/SVG 项目结构图 | `payload.inline_svg`：立项卡 → 最终工作台 → 贯穿的诚实底线 | 将本节产出和后续 90 节的递进关系可视化。 |
| `s8` | M01 的完成标志与 M02 的明确下一步 | HTML/SVG 学习路线图 | `payload.inline_svg`：立项卡完成 → 安装 RDKit → 让电脑看懂分子 | 强化可执行的下一步和完成标志。 |

## 实现位置

所有讲课视觉与开场图均直接保存或映射于课程数据：

`/Users/xinghan/Dev/systemeduidea/projects_data/molecule-monster-hunter/knodes/M01-w0-module/slides.json`

流程图复用学生端现有的 `inline_svg` 渲染面；s1 的 `visual_mode="hybrid"` 使压缩图像先作为情境层呈现，再显示精确 SVG。公式、化学结构等后续节点会优先使用现有 KaTeX 与 DOM/SVG 精确渲染；在研究对象、实验装置、工程实物或空间结构能显著提高理解时，保存压缩后的 WebP 栅格图并建立 `images` 映射。

## 质量检查

- `slides.json` 已通过 JSON 解析。
- 6 张新 SVG 已用 macOS Quick Look 在浅色学生端背景上渲染检查，确认中文、箭头、面板和流程关系均可见；s1 的新 WebP 为 1280×721、约 57KB。
- 本轮只改 M01 的讲课视觉；未部署生产环境。
