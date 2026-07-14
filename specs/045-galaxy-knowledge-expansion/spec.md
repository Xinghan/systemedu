# Spec 045: 知识星图"扩展知识" (Wikidata 一跳邻居)

Status: draft (2026-07-14)
关联: spec 044 (数学星系, 概念 Wikidata 锚定), spec 041 (知识图谱外部映射)

## WHAT

`/galaxy` 星图目前只涵盖 8 门项目课提炼的 504 个概念。真实知识体系中, 每个概念还辐射
着大量图外邻居 (上位/下位概念、组成部分、研究领域等)。本 spec 让用户点击任一概念后
可**扩展**出它在真实知识体系 (Wikidata) 中的一度关系邻居 —— 以"暗物质"视觉呈现
(灰白空心点 + 虚线边), 与图内实心学科色点明确区分。

## WHY

- 星图从"项目知识可视化"升级为"真实知识宇宙的入口": 学生看见项目知识如何嵌入
  更大的知识版图, 强化"真实工业项目背后是真实学科体系"的定位。
- 我们已有关键资产: 504 概念约 95% 锚定 Wikidata QID (spec 041/044), 一度关系是
  Wikidata 现成的结构化数据 (P279/P31/P361/P527/P737/P2579/P1269)。
- 扩展点是 agent tutor 的天然入口 ([[feedback_prereq_skill_via_agent_tutor]]:
  图外知识由 AI 导师按需教) —— 本期先放提示行, 后续接 tutor 对话。

## 方案取舍 (已与用户确认)

- **离线预生成** (选定): 内容管线拉取+过滤, 产出静态 galaxy-neighbors.json 随前端发布。
  理由: 生产与学生都在国内, wikidata.org 线上实时访问不可靠; 静态包秒开、质量可控。
- 线上实时 SPARQL (否): 国内访问不可靠 + 限流 + 噪音。
- LLM 实时生成 (否): 幻觉/无锚定, 不适合做图谱数据源。
- 第一版纯数据工程 (Wikidata zh/en label + description + 规则过滤), 不引入 LLM 加工;
  儿童向说明的 LLM 增强留待后续迭代。

## Scope

1. **数据管线** (IDEA 仓 concept_layer_scripts/):
   - `fetch_neighbors.py`: 对前端 payload 全部带 QID 概念 (~480), 经 wbgetentities
     批量拉 claims 中 7 类教学导向属性的邻居 QID, 再批量拉邻居 labels/descriptions
     (zh 优先, en 兜底)。限速 + 断点续。
   - 规则过滤: 无 en label 丢弃; 描述命中坏词黑名单 (论文/影视/人名/行政区) 丢弃;
     QID 已在图内的丢弃; 每概念每属性上限截断。
   - 产出 `EDU/packages/student-web/public/galaxy/galaxy-neighbors.json`,
     以概念 QID 为 key (emit 重跑不破坏关联)。
2. **前端交互** (student-web):
   - 概念详情卡加"扩展知识"按钮 (仅带 QID 且有邻居数据的概念显示);
   - 3D: 选中概念周围放射状长出灰白空心 sprite + 虚线边, 可 raycast 点击;
   - 2D: 空心圆 + 虚线;
   - 扩展点点击 → 简化详情卡: 名称/关系 (是一种/包含/研究领域...)/描述/Wikidata 链接
     + "这个知识可以问 AI 导师"提示行;
   - 换选概念或点"收起"时扩展收回。
3. **不做**: 二跳及更深扩展 (深挖交给 tutor); 扩展点进 DB/进度体系; LLM 说明加工。

## 验收

- 数据: neighbors JSON 覆盖 >80% 带 QID 概念, 每概念邻居 1-12 个, 无图内重复;
- 前端: 扩展/收起/扩展卡三交互在 3D 与 2D 均工作, 无 console 错误, next build 通过;
- 生产: 部署后 /galaxy 扩展功能可用。
