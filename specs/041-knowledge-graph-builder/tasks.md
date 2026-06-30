# Tasks: kg-builder (spec 041)

执行细节见 `plan.md`。此处为高层进度追踪。

## 里程碑 1: 工具骨架 + 闸门 + 测试

- [ ] **T1** TreeNode 加 5 个锚点字段 (wikidata_qid/std_codes/mapping_type/provenance/verified) + 向后兼容测试
- [ ] **T2** Wikidata QID 回查模块 (`wikidata.py`, urllib + 缓存 + 限速) + mock 测试
- [ ] **T3** 三道准入闸 (`gate.py`: 回查/有锚点/去重) + 4 个闸门测试
- [ ] **T4** 审批清单合入 (`merge.py`: 新增/回填/校验后落盘) + 3 个合入测试

## 里程碑 2: 修种子

- [ ] **T5** 回填 425 种子锚点 (用 qid_verify.csv): ~405 填QID, 19 NOTFOUND 输出待办
- [ ] **T6** 19 个 NOTFOUND 节点逐个查正确 QID 并回填 (人工辅助)

## 验收

- [ ] 全部 pytest 通过 (schema/gate/merge)
- [ ] platform_tree.json 仍 425 节点过校验, ~405 有 QID, ~123 verified, 0 NOTFOUND

## 里程碑 3-4 (本计划验收后另起)

- 逐学科 LLM 列候选 → 闸门 → 产待审清单 → 人工审 → 合入 (math 首发 → 其余 10 学科)
- 首版完成: platform_tree.json 达 ~1420 节点, 每节点带可验证锚点
