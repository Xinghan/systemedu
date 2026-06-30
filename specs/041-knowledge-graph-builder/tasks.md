# Tasks: kg-builder (spec 041)

执行细节见 `plan.md`。此处为高层进度追踪。

## 里程碑 1: 工具骨架 + 闸门 + 测试 (完成 2026-06-30)

- [x] **T1** TreeNode 加 5 个锚点字段 (wikidata_qid/std_codes/mapping_type/provenance/verified) + 向后兼容测试
- [x] **T2** Wikidata QID 回查模块 (`wikidata.py`, urllib + 缓存 + 限速) + mock 测试
- [x] **T3** 三道准入闸 (`gate.py`: 回查/有锚点/去重) + 4 个闸门测试
- [x] **T4** 审批清单合入 (`merge.py`: 新增/回填/校验后落盘) + 3 个合入测试

## 里程碑 2: 修种子 (完成 2026-06-30)

- [x] **T5** 回填 425 种子锚点 (用 qid_verify.csv): 405 填QID, 1 none, 19 NOTFOUND 隔离待办
- [x] **T6** 19 个 NOTFOUND 节点 search_qid 搜正确 QID + label 核对 + verified 回填
  - 关键发现: QID 号绝不能凭记忆/凭号 (实测几乎全错), 必须 search_qid 按名搜 + label 核对

## 验收 (通过 2026-06-30)

- [x] 全部 pytest 通过 (schema/gate/merge, 24 passed)
- [x] platform_tree.json 仍 425 节点过校验, 424 有 QID, 142 verified, 0 NOTFOUND (唯一无QID=chem.lab.safety 合理none)

## 里程碑 3: 逐学科扩建 + 节点间关系 (进行中)

- [x] **math 首发** 60→80节点(总445): candidates(LLM列候选)+emit(search_qid+闸门)+merge合入
- [x] **关系二 related** (本体论, Wikidata P279/P361/P527): relations.py+batch_labels. math 9内部边+202悬空边
- [x] **关系一 prerequisites** (学习顺序DAG): prerequisites.py LLM推断. math 20新节点全补出无环前置
- [x] **pipeline 固化**: `python -m kg_builder <subj>` / `--merge` / `--relations` / `--prereq` / `--status`. 35测试过
- [x] **phys** 手动跑通(50→73), 验证模板+限流优化(search_qid重试退避+缓存+去冗余回查)
- [x] **其余9学科** workflow we8e6pd33 并行扩建(worktree隔离, 18分钟, 0失败):
      chem56/bio63/cs60/elec46/env53/astro37/med41/eng36/geo44
- [x] **全11学科完成**: platform_tree 425→589节点, 每学科都有节点+QID+两类关系
- 关键发现: 人工审QID必需(search_qid top1易被同名学术论文/期刊/软件/游戏抢词,
  agent自检修正18处错配); 悬空边高频目标=补全优先级; broader节点不参与related

## 里程碑 4 (首版收官, 待10学科跑完)

- platform_tree.json 达 ~1420 节点, 每节点带可验证锚点 + 两类关系
- CCSS/NGSS 标准码本地数据集 (std_code 目前靠LLM给未机器校验)
