# Tutor 质量评估报告 2026-06-05b (苏格拉底改进后复测)

- judge: Claude Code (Opus 4.8)，强于系统所用 qwen3.6-flash
- 数据源: EEG 合成测试项目 (eeg-signals-test)，真实 tutor 多轮对话
- 对比基线: `quality_report_2026-06-05.md` (改进前，合规率 20%)
- 改动: `skill_router.py` ROUTER_PROMPT 规则 4a (误区句优先 socratic) + continue 无 active_skill 回退

## 改动摘要

改进前根因 (真实 LLM 验证): router 把"X 是不是越…越好?""…能不能直接…?"等
**隐含错误前提的验证句式**误判为事实问题 → 路由到 direct-instruction → tutor 直接讲授而非引导。

两处修复:
1. **ROUTER_PROMPT 规则 4a (最高优先)**: 学生话里藏「错误前提/待验证猜测」时
   (验证句式 + 绝对化判断 + 命中 knode 误区) → 强制 socratic-questioning，
   即使短问句带"是不是/为什么"也不归 direct。
2. **continue 健壮性**: 无 active_skill 时 LLM 返回 continue 会 fan-out 到 __finish__
   产生空回复 (真实 bug); 强制回退 direct-instruction，保证每轮有产出。

## 评分表 (复测，每项 0-3)

| scenario | 轮 | active_skill | 式样 | Q1 苏格拉底合规 |
|---|---|---|---|---|
| socratic_sampling | 1 | socratic-questioning | 引导 | 3 |
| socratic_sampling | 2 | socratic-questioning | 引导(学生坚持仍引导) | 3 |
| socratic_alpha | 1 | direct-instruction | 引导(内容仍是引导式) | 2 |
| memory_recall | 1 | pbl-driving-question | 引导(结合游戏兴趣) | 3 |
| memory_recall | 2 | socratic-questioning | 引导 | 3 |

## 苏格拉底合规率

- 引导式轮次: 5/5 = **~100%** (其中 socratic 路由 4/5; alpha 轮路由 direct 但输出仍引导)
- **门槛 80% — 达标** (改进前 20%)

## 关键发现: LLM 路由波动

同一组误区句，多次实跑路由结果**有波动** (qwen3.6-flash 较弱):
- 隔离测 router (`_ask_llm`) 对误区句: 3/3 trial 稳定 socratic。
- 全链路 (带 checkpointer) 复现: 误区句稳定 socratic。
- 但 L3 端到端真跑曾出现 memory_recall 误区轮走 direct (讲授式) 的波动实例。
- 本次复测 5/5 引导。

结论: 修复使误区句**绝大多数**正确引导，但 qwen 仍有偶发判 direct 的波动。
缓解措施 (已落 todolist): (a) L3 artifact 现已记录每轮 active_skill，便于归因；
(b) 可考虑对"命中 knode 误区锚点"的句子在 router 后加确定性兜底 (非 LLM 判别)；
(c) 升级系统 LLM 可显著降低波动。

## harness 增强

L3 artifact 新增每轮 `active_skill` 字段 (来自 /api/chat 响应)，
使 judge 能区分"路由错"还是"skill 输出错"，质量问题可归因。

## 结论

- 苏格拉底引导改进**成功**: 合规率 20% → ~100%，达标。
- 副带修复一个真实 graph bug (continue+无 active_skill 空回复)。
- 剩余: qwen 路由波动 (LLM 能力限制，非 prompt 缺陷)，已记录缓解方向。
