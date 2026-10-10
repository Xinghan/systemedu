# Continuous Molecule Lesson Numbering Implementation Plan

**Status:** Superseded. User confirmed full identifier consistency on 2026-09-12. Follow `2026-09-12-molecule-full-renumbering.md`; this file retains the historical design discussion only.

**Goal:** 分子猎人现有 47 节按实际课程顺序连续展示 M01–M47，不再跳号。

**Architecture:** 推荐将 display_id 与稳定 module_id 分离。目录、学习页、依赖提示及后续预览汇报使用统一映射；路由、进度、聊天、作业和本机存储继续使用稳定 ID。不能把旧 URL 的 M23 同时解释为原节点 M23 和新展示 M23。若用户要求底层 ID 一并改，必须单独设计版本化路由、数据库迁移与历史内容兼容，不进行全仓正则替换。

**Tech Stack:** Existing Next.js/TypeScript frontend, JSON knowledge tree; no new dependency for display-only option.

## Findings

- modules / manifest 当前是 47 节，旧编号有跳跃和 b 后缀。
- Student DB stores module IDs in progress, sessions/messages, drills, facts and exercise attempts: packages/student-app/src/systemedu/student/db.py.
- Frontend currently renders raw IDs in library map, knowledge-tree modal and lesson/previews. Existing record schemas and IDs must not be treated as display strings.
- Unrelated worktree changes and prior deployment artifacts must be preserved.
- Scope is the current molecule-monster-hunter project; no silent renumbering of other projects.
- Production deployment requires verification of the selected design; this design document does not authorize migration of production learner records.

## Proposed implementation steps, after the design is confirmed

1. Create a single module label mapping/helper with tests for all 47 unique sequential labels and unchanged stable IDs. Verify M23→M07, M24→M08, M90→M47; unknown IDs and other projects unchanged.
2. Update display sites in packages/student-web/src/app/(home)/library/[slug]/page.tsx, components/learning/knowledge-tree-modal.tsx and learning navigation. All request, key, dependency lookup and URL values retain original stable IDs.
3. Audit lesson/slideshow/preview references. Format author-provided human-readable labels only; never rewrite user observations, executable code, storage keys, assets, provenance or historical release hashes. Add explicit new/old mapping to generation progress so subsequent slide work uses the visible sequence.
4. Test navigation to the correct original node, old links, source references, and record persistence. Verify browser before/after screenshots.
5. Report which surfaces are changed and any legacy narration/image text that still contains old IDs. Do not claim a full ID migration for a display-only solution.

## Proposed mapping

| New display | Stable ID | Stage | Title |
|---|---|---|---|
| M01 | M01 | S1 | 看真药故事写“我要打的怪兽”立项卡 |
| M02 | M02 | S1 | 装好 RDKit 在命令行打印第一行分子 |
| M03 | M03 | S1 | 用 RDKit 读出真分子的骨架(原子/键/环) |
| M04 | M04 | S1 | 给分子挂官能团, 用 RDKit 看性质真的变了 |
| M05 | M05 | S1 | 敲出 SMILES, 让 RDKit 画成真分子图 |
| M06 | M06 | S1 | S1 阶段成品: 把化学+SMILES 总装成'真药识读'小工作台 |
| M07 | M23 | S2 | 进 PubChem 搜一个真药拿到它的 SMILES |
| M08 | M24 | S2 | 把一个 SMILES 存进变量再打印出来 |
| M09 | M25 | S2 | 用列表装下一串分子 |
| M10 | M26 | S2 | 用循环一次处理整列表分子(最大坎) |
| M11 | M27 | S2 | 用 RDKit 检查每个 SMILES 能不能读通 |
| M12 | M28 | S2 | 把分子转成 canonical SMILES 去重 |
| M13 | M32 | S2 | 用 pandas 把分子和标签拼成一张表 |
| M14 | M33 | S2 | 读懂第一条红色报错并修好它 |
| M15 | M34 | S2 | 数一数库里正负样本各多少(命门) |
| M16 | M35b | S2 | 把多源原料总装成一个去重带标签的分子库并验收 |
| M17 | M36 | S3 | 数出每个分子的原子质量算出 MW |
| M18 | M38 | S3 | 用 RDKit 算 LogP 给分子打“油水分” |
| M19 | M39 | S3 | 找出谁伸手给氢(HBD) |
| M20 | M44 | S3 | 把一个分子的 8 个描述符拼成一行数 |
| M21 | M49 | S3 | 点亮桶生成第一串 0/1 指纹 |
| M22 | M50 | S3 | 用 Tanimoto 算两分子指纹有多像 |
| M23 | M51 | S3 | 给全库每个分子批量生成指纹 |
| M24 | M52 | S3 | 把描述符列拉到同一量纲(缩放) |
| M25 | M53 | S3 | 拼出“指纹+描述符”最终特征表 |
| M26 | M54b | S3 | 把全库特征工程总装成一张可复现特征表+数据字典并验收 |
| M27 | M56 | S4 | 把数据切成训练集和测试集 |
| M28 | M57 | S4 | 故意让模型背答案看见过拟合 |
| M29 | M60 | S4 | 训一棵真决策树看它也会过拟合 |
| M30 | M61 | S4 | 种很多棵树投票搭随机森林(bagging) |
| M31 | M62 | S4 | 用接力补错搭 XGBoost(boosting) |
| M32 | M63 | S4 | 用随机切分先跑出一版漂亮分数 |
| M33 | M64 | S4 | 用 Bemis-Murcko 抽出分子的骨架 |
| M34 | M67 | S4 | 按骨架整组分实现 scaffold split |
| M35 | M68 | S4 | 同模型跑随机 vs scaffold 看分数暴跌 |
| M36 | M71 | S4 | 让模型吐出 0 到 1 的“是怪兽”概率 |
| M37 | M74 | S4 | 补全真假阴阳混淆四格 |
| M38 | M78 | S4 | 扫一遍所有阈值画出 ROC 曲线 |
| M39 | M80 | S4 | 拿不平衡数据揭穿准确率骗人(命门) |
| M40 | M81 | S4 | 给溶解度模型量每个的误差 |
| M41 | M84b | S4 | 把训练评估总装成一个诚实评估的属性预测模型包并验收 |
| M42 | M85 | S5 | 用 Lipinski 五规则给分子打门槛分 |
| M43 | M86 | S5 | 串起多层漏斗一层层筛掉分子 |
| M44 | M87 | S5 | 把多个分数加权综合排出 Top10 |
| M45 | M88 | S5 | 用 Tanimoto 查 Top10 太像就换(连回 scaffold) |
| M46 | M89 | S5 | 为每个被拒分子写一句拒绝理由 |
| M47 | M90 | S5 | 组装 Workbench 出最终 go/no-go 报告 |
