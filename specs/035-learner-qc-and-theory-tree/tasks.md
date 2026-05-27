# 035 Tasks

按顺序实现, 每完成一项立刻勾选.

## T1 平台知识树 baseline (4-6h)

- [ ] T1.1 `course_factory/knowledge_tree/__init__.py` + `schema.py` (Pydantic models: TreeNode/Subject/PlatformTree + cross-subject prereq validator + 环检测)
- [ ] T1.2 `course_factory/knowledge_tree/platform_tree.json` Claude 手写 11 学科 ~425 节点
  - math 60: 算数 / 分数小数 / 比例 / 一次函数 / 几何 / 概率 / 统计 / 微积分初步
  - phys 50: 运动学 / 力 / 能量 / 光学 / 电磁 / 热 / 波 / 量子初步
  - chem 35: 元素周期 / 化学键 / 反应 / 平衡 / 有机
  - bio 50: 细胞 / 遗传 / 演化 / 生态 / 神经 / 分子生物
  - cs 50: 变量 / 控制流 / 数据结构 / 算法 / 网络 / 数据库 / 编译 / AI
  - elec 35: 电路基础 / 模拟 / 数字 / 信号 / 嵌入式 / 通信协议
  - env 35: 气候 / 大气 / 海洋 / 生态系统 / 可持续
  - astro 25: 太阳系 / 恒星 / 银河 / 宇宙学
  - med 30: 解剖 / 生理 / 病理 / 流行病学
  - eng 30: 机械 / 材料 / 控制 / 制造
  - geo 25: 矿物 / 板块 / 古生物
- [ ] T1.3 `tests/test_platform_tree.py` schema 校验 + prereq 存在性 + 环检测 + 跨学科 prereq 禁止
- [ ] T1.4 跑测试 PASS

## T2 lit_tree CLI (2h)

- [ ] T2.1 `course_factory/prompts/lit_mapper.md` agent prompt 模板 (强制 trace 文本引用, 输出 lit_nodes + missing_concepts JSON)
- [ ] T2.2 `course_factory/lit_tree.py` CLI 入口
  - 参数: `<slug>`
  - 加载 workspace project 所有 theories/key_concepts/plan
  - 加载 platform_tree.json
  - dispatch agent (用 Claude API direct call, 不 sub-agent — 因为 spec 034 哲学是 Claude 主导)
  - 写入 manifest.json.lit_nodes / missing_concepts
- [ ] T2.3 `tests/test_lit_tree.py` (mock LLM, 验证 JSON 结构 + manifest 写盘)
- [ ] T2.4 跑测试 PASS

## T3 learner_qc CLI (3h)

- [ ] T3.1 `course_factory/personas/` 写 3 个 persona md (10-12 / 13-15 / 16-18)
- [ ] T3.2 `course_factory/prompts/learner_simulator.md` agent prompt 模板
- [ ] T3.3 `course_factory/learner_qc.py` CLI 入口
  - 参数: `<slug>` + `--persona` (可选 override)
  - 加载 workspace project age_band → 选 persona
  - 按 M01..MN 顺序串 lesson.md + theories.json + assignment.md
  - dispatch agent (持续 prompt 单次跑)
  - 写报告到 `content-workspace/_review/<slug>_learner_report.md`
- [ ] T3.4 `tests/test_learner_qc.py` (mock LLM)
- [ ] T3.5 跑测试 PASS

## T4 library API + manifest (1h)

- [ ] T4.1 `packages/library-app/src/library/manifest.py` Manifest model 加 `lit_nodes: list[dict] = []` + `missing_concepts: list[dict] = []`
- [ ] T4.2 `packages/library-app/src/library/routes/public.py` 加 2 端点
  - `GET /v1/projects/{slug}/knowledge-tree` 返回 lit_nodes + subjects_used + missing_concepts
  - `GET /v1/platform/knowledge-tree` 返回完整 platform_tree.json (caching)
- [ ] T4.3 importer.py 处理 lit_nodes (新 manifest 字段写入 DB / 老 manifest 默认空)
- [ ] T4.4 `tests/test_library_knowledge_tree_api.py`
- [ ] T4.5 跑测试 PASS

## T5 student-web 知识树 tab (4h)

- [ ] T5.1 `packages/student-web/src/lib/api.ts` 加 fetch helpers (getProjectKnowledgeTree / getPlatformKnowledgeTree)
- [ ] T5.2 `packages/student-web/src/components/KnowledgeTreeView.tsx`
  - chip 横排 (学科, "math (12/60)" 形式, 默认选点亮最多)
  - 主区 SVG 渲染 1 棵子树 (横向 K1-K13 分层, 纵向同 level 排, prereq 箭头)
  - 点亮 coral / 未点亮 hairline 灰
  - hover tooltip "本项目 M_X 教了这个"
  - click 节点跳 knode 学习页 (lit_by[0])
- [ ] T5.3 `library/[slug]/page.tsx` 集成: tab bar (学习路线 | 知识树), 知识树 tab 内嵌组件
- [ ] T5.4 处理空状态: 老项目无 lit_nodes 时显示 "本项目未跑知识树映射"

## T6 实战验证 (2h)

- [ ] T6.1 跑 `python -m course_factory.lit_tree purpleair-airquality-node`
- [ ] T6.2 manifest.json.lit_nodes ≥ 30, 检查 missing_concepts 收集
- [ ] T6.3 跑 `python -m course_factory.learner_qc purpleair-airquality-node`, 检查 _review report 有断崖识别
- [ ] T6.4 publish v0.13.0
- [ ] T6.5 前端打开 /library/purpleair-airquality-node, 切到 "知识树" tab 验证 SVG 渲染 + chip 切学科 + hover/click 交互

## T7 文档 + 收尾 (1h)

- [ ] T7.1 `course_factory/SKILL.md` 加 Step 7 "项目级 QC + 点亮" 简短章节
- [ ] T7.2 `docs/prd.md` 加 spec 035 entries (Phase checklist + API 表)
- [ ] T7.3 spec.md 顶部加 `Status: shipped (2026-MM-DD)`
- [ ] T7.4 commit + push

## Definition of Done

所有 [ ] 勾完 + 验收 (spec.md/plan.md 列的) 全过 + library v0.13.0 上架 + 前端可视效果用户确认.
