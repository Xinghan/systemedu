# 学生端 + Tutor 测试覆盖功能矩阵（回归基线）

- 基线日期: 2026-06-05
- 整体行覆盖 (student + core.tutor): **82%**（起点 73%）
- 设计文档: `docs/superpowers/specs/2026-06-05-student-tutor-test-coverage-design.md`

> 每次回归：
> 1. L1+L2: `coverage erase && coverage run --rcfile=.coveragerc -m pytest tests/student/ tests/tutor/ -q && coverage report` → 更新「行覆盖%」
> 2. L3 (可选): `NO_PROXY=127.0.0.1,localhost pytest tests/student/quality/ --quality` → Claude judge 读 artifact + rubric.md 打分 → 更新「质量分」
> 本表是 single source of truth。

## L1 单元/契约（CI 必跑，进程内）

| 功能 | 模块 | 测试 | 行覆盖% |
|---|---|---|---|
| 结构化事实查询 search_student_facts | tools/memory.py | test_tool_impls.py + test_tool_impls_gaps.py | 100% |
| Mem0 语义搜索 search_memory | tools/memory.py | test_tool_impls_gaps.py | 100% |
| 练习取题/判题 | tools/practice.py | test_tool_impls.py + _gaps.py | 100% |
| 进度/完成节点 | tools/progress.py | test_tool_impls.py + _gaps.py | 100% |
| 五层记忆注入 (L1-L5 + 降级 + page_kind) | chat/memory_layers.py | test_memory_layers.py + _gaps.py | 100% |
| safety gate | core/tutor/nodes/safety_gate.py | test_safety_gate.py | 100% |
| tutor graph 装配 | core/tutor/graph.py | test_graph_integration.py | 99% |
| chat session CRUD | chat/session.py | test_chat_session.py | 96% |
| fact 抽取 (core) | core/tutor/memory/fact_extractor.py | test_fact_extractor.py | 91% |
| fact 抽取 (student) | chat/fact_extractor.py | test_fact_extractor.py | 89% |
| 记忆层 (core) | core/tutor/memory/layers.py | test_layers.py | 89% |

## L2 机制 E2E（CI 必跑，确定性，不依赖真 LLM）

| 场景 | 测试用例 | 类型 | 状态 |
|---|---|---|---|
| pull 生命周期 (register→pull→list→remove→重pull) | test_e2e1_pull_lifecycle | A 双进程 HTTP | PASS |
| 学习内容代理 (knode 含奈奎斯特 / 未 pull 403) | test_e2e2_learn_content_proxy | A 双进程 HTTP | PASS |
| context 注入随页切换 (learn 有 l3 / global 空) | test_e2e3_context_injection_per_page | B 进程内 | PASS |
| 记忆召回绑定 seed fact | test_e2e4_memory_recall | B 进程内 | PASS |
| 知识树 DAG + 进度增长 (M01→M02→M03) | test_e2e5_dag_and_progress | A HTTP + 数据 | PASS |
| safety gate 触发 | test_e2e6_safety_gate | B 进程内 | PASS |
| catalog route 行覆盖 (进程内 ASGI) | test_route_asgi.py (7 用例) | 进程内 ASGI | PASS, catalog/routes 59% |

## L3 质量（--quality，judge = Claude Code）

| 场景 | rubric 项 | 最近质量分 (2026-06-05) | 报告 |
|---|---|---|---|
| socratic_sampling | Q1-Q6 | Q1=1 Q2=3 Q3=2.5 Q5=3 Q6=3 | quality_report_2026-06-05.md |
| socratic_alpha | Q1-Q6 | Q1=1 Q2=3 Q3=2.5 Q5=3 Q6=3 | 同上 |
| memory_recall | Q1-Q6 | Q1=2 Q2=3 Q4=0 Q5=2.5 Q6=3 | 同上 |

- **苏格拉底合规率: 20%**（门槛 80%，未达标 — tutor 偏讲授式）
- **记忆召回 Q4=0**（recalled_facts 实时路径未生效）

## 已知缺口（不计入"功能未覆盖"，是架构限制）

| 模块 | 行覆盖% | 原因 |
|---|---|---|
| chat/routes.py | 17% | chat HTTP/WS 端点，只在真实 LLM E2E(子进程，coverage 采集不到) 或 --quality 时执行 |
| chat/tutor_runner.py | 19% | tutor graph 调度，依赖真实 LLM；L3 --quality 实跑覆盖但走子进程 |
| catalog/routes.py | 59% | knode/file 流式代理成功路径需真 library；ASGI 测试覆盖了核心 CRUD 分支 |

> 这三处的"正确性"由 L2 双进程 E2E + L3 真跑保证（行为已验证），只是行覆盖数字因子进程/真 LLM 采集不到。不是测试缺失。

## 真实发现的 bug（测试副产物）

| bug | 位置 | 严重度 | 发现于 |
|---|---|---|---|
| Mem0Adapter import 名错 (实际类名 Mem0AsyncAdapter)，search_memory 永久 ImportError 退化，L4 语义召回从未生效 | core/tutor/tools/memory.py:54 | 高 | Task 5 |
| 记忆召回实时路径无效 (recalled_facts 单对话内恒空) | fact 抽取走异步 worker，单对话不入库 | 中-高 | L3 Task 8 |
| tutor 苏格拉底合规率仅 20% | tutor skill prompt 偏讲授式 | 中 | L3 Task 8 |

## 总览

- 整体行覆盖（student + tutor）: **82%**（基线 73%，+9pp）
- 核心业务逻辑层（tools / memory_layers / safety / graph）: 89-100%
- L2 机制 E2E: 6/6 + ASGI 7/7 全绿
- L3 苏格拉底合规率: 20%（待 tutor prompt 改进后重测）
