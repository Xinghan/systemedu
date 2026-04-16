# Tutor 记忆与教学策略系统

**Spec**: 014-tutor-memory-system
**Status**: draft (2026-04-16)
**Owner**: SystemEdu Core Team
**Related**: `docs/superpowers/specs/2026-04-16-tutor-memory-system-design.md`

---

## 1. 背景（Why）

SystemEdu 的 AI 导师（tutor）是本地 Agent Sandbox 的核心教学入口。当前导师基于 `deepagents` 包运行,过去阶段被验证存在以下关键缺陷,已经成为继续产品化的主要阻塞:

1. **对话状态无法稳定恢复**:现有实现仅持久化纯文本消息,图级中间状态(active skill、skill_state、turn_count 等)在刷新或进程重启后丢失,学生体验不连贯。
2. **学生认知画像缺失**:Mem0 只提供向量召回,无法精确追踪"某学生在某 knode 卡在哪、已经掌握哪个概念、用什么方式学最快"。
3. **教学策略缺失**:LLM 是单轮直答模型,不具备在"苏格拉底引导 / 直接讲解 / 降阶讲前置 / 错因诊断 / 驱动性问题 / 元认知反思"之间切换的能力。PBL 教学的完整循环无法成立。
4. **安全机制缺失**:敏感话题(自杀倾向、色情赌博)没有预筛与升级;写入操作(标记节点通过等)不需要二次确认即可落库;LLM 理论上可伪造 `user_id` 越权访问他人数据;工具调用无审计。

这四项是导师从 demo 走向"儿童产品"必须弥补的基础设施。继续在 deepagents 上打补丁,改动面远大于一次性重写。

## 2. 目标(What)

构建一个一步到位的 tutor 记忆与教学策略系统,具备以下能力:

### 2.1 完整记忆框架
- 结构化学生事实表,支持按 `(user_id, knode_id, category)` 精确查询
- 事实的时间演化可追溯:老事实软删除、链接到覆盖它的新事实,形成成长轨迹
- 语义向量召回作为独立一层存在,不是结构化记忆的兜底
- 每轮对话开始时,5 类记忆信息(学生画像 / 项目上下文 / 当前 knode 状态 / 语义历史 / active skill 进度)以结构化方式并行注入到 LLM 上下文

### 2.2 教学策略系统
- 6 个 PBL 教学 skill 一次性建成,覆盖完整教学循环:
  - **苏格拉底式问答**:概念理解类题目的推导引导
  - **直接讲解**:事实查询 / 学生明确求讲 / 苏格拉底降级兜底
  - **脚手架**:前置知识不足时降阶拉取前置 knode
  - **错因诊断**:学生答错时分类错因(概念 / 计算 / 策略)
  - **驱动性提问**:新 knode 启动时抛出激发兴趣的问题
  - **元认知反思**:学生表达完成时引导总结 / 联结
- LLM 驱动的 skill 路由器,根据当前对话、学生卡点、skill 达成情况决策 `continue / switch / exit`
- 每个 skill 有独立的 max_turns 限制,达到上限强制切换,避免陷入死循环

### 2.3 对话状态稳定
- 消息、active skill、skill_state 等所有图级状态通过 checkpoint 持久化
- 刷新浏览器 / 进程重启 / 跨设备继续对话时,tutor 能从上一轮结束处无缝接续
- 本地单实例场景使用 SQLite 存储;扩容时明确存在迁移到 Postgres 的路径(本 spec 预留接口,不实施迁移)

### 2.4 安全机制
- **工具白名单**:每个 skill 只能看到自己被允许调用的工具,LLM 无法越权
- **写操作二次确认**:涉及学生进度变更的工具(如 `complete_node`)不直接执行,向前端发出确认事件,学生点同意后才落库
- **作用域隔离**:`user_id` 由 gateway 认证会话注入,LLM 传入的 `user_id` 被强制覆盖;跨 project 的数据访问额外校验
- **审计日志**:所有工具调用写入 `tool_call_log` 表,包含 user_id / session_id / active_skill / args / result / 时延,追溯任何异常行为
- **敏感话题升级**:`safety_gate` 节点预筛正则模式,命中即短路到固定话术 + 触发 escalation 记录

### 2.5 可异步的事实抽取
- 学生与导师的对话结束后(或 2 小时兜底触发),后台异步从对话中抽取事实入库
- 异步路径不阻塞学生体验,不影响首 token 延迟
- worker 幂等,进程崩溃重启后能恢复未完成任务

## 3. 范围与非目标

### 3.1 范围
- Tutor 图结构及所有节点(`confirm_handler / safety_gate / memory_inject / skill_router / output_stream`)
- 6 个 skill 子图的完整实现
- StudentFact / PendingFactExtraction / ToolCallLog / Escalation 的 schema 及迁移
- Checkpoint 本地 SQLite 实现,Postgres 适配代码占位
- 10 个 LLM 工具(读 7 / 写 3)
- Gateway `/api/chat` SSE 端点(原地替换老实现)及相关辅助端点
- 异步 fact extraction worker(进程内 asyncio 后台任务)
- 老 runtime(`src/systemedu/core/runtime.py` / `agents/builtin/*.py`)删除
- 单元 / 集成 / 端到端真实 LLM 测试

### 3.2 非目标
- **前端 UI 改造**:SSE 事件消费、tool_confirm 对话框、escalation 横幅、skill badge 等前端工作由 spec 015 单独承接
- **Postgres 迁移实施**:本 spec 只预留切换开关,迁移脚本与灰度由 spec 016 承接
- **MCP 工具扩展**:保留 `src/systemedu/mcp/` 目录,图内不消费 MCP 工具
- **Planner / Assessor agent 重建**:老 runtime 连同 planner/assessor 一并删除,未来独立 spec
- **多 agent 并行编排**:只做单 agent tutor
- **儿童隐私合规专项**(如家长端日志共享、数据导出):独立工作,不在本 spec

## 4. 用户故事

### US-1:学生自然对话,上下文被完整保留
作为一个正在做"火星风险地图"项目的学生,我希望今天说"我喜欢机器人"之后,明天再来时导师记得这件事并能在合适时机引用,以便我感到导师理解我而不是每天重头开始。

**验收**:
- 今天对话结束后,`student_facts` 中写入 `{user_id=X, category=interest, content="喜欢机器人"}`
- 明天新开 session 开启 knode,memory_inject 的 L1 层包含这条 interest
- 学生问相关问题时,导师能基于这条兴趣举例

### US-2:概念理解题被苏格拉底引导,而不是直接给答案
作为学生,我问"为什么纸飞机机头加回形针飞得更直",我希望导师不是直接讲,而是通过一系列问题帮我自己推出来。

**验收**:
- 5 轮之内导师 0 次直接说出"因为重心前移"这样的最终答案
- 每轮只问 1 个问题,问题难度根据我的回答递进
- 如果 5 轮仍卡住,导师切换到 `direct-instruction` 给出讲解

### US-3:答错题时能被精准降阶
作为学生,我在某 knode 连续答错 2 题,我希望导师不是继续出同难度题,而是先诊断错因,如果是前置不牢就先补前置。

**验收**:
- 2 次 `grade_submission` 返回错误后,`skill_router` 切换到 `error-diagnosis`
- error-diagnosis 返回错因分类:`concept / calc / strategy`
- 若错因是 `concept` 且相关前置 knode 未完成,进一步切换到 `scaffolding`

### US-4:导师不可误操作学生进度
作为学生家长,我不希望 LLM 因误解学生"我觉得搞懂了"就直接把节点标记为通过,以免出现虚假进度。

**验收**:
- LLM 调用 `complete_node` 时返回 `pending_confirm` 状态,不落库
- 前端收到 `tool_confirm` 事件弹框请学生确认
- 学生不同意或未确认时,进度保持不变
- 所有确认/拒绝动作写入 `tool_call_log`

### US-5:敏感话题被优先升级
作为运营方,我希望当学生说出"不想活"这类话时,导师立刻停止教学流程,用温和话术回应并触发 escalation。

**验收**:
- 学生发出命中正则的消息后,导师 1 轮之内回复固定安抚话术(含 12355 热线)
- `escalations` 表写入 severity=urgent 记录
- 该轮不执行 skill_router / skill 子图
- 后续该 session 恢复正常对话(一次性触发,不锁死)

### US-6:刷新页面对话不中断
作为学生,我在对话中途不小心刷新了浏览器,我希望回来时对话和当前教学阶段一模一样。

**验收**:
- 同一 `thread_id` 刷新后,历史消息、active_skill、skill_turn_count 全部恢复
- 新一轮对话继续沿用上一个 skill
- checkpoint 写入延迟不影响首 token 感知

## 5. 关键约束

### 5.1 宪法合规(`.specify/memory/constitution.md` v1.0.0)
- **中文优先**:所有文档、UI 文案、对用户可见输出均中文;代码标识符保留英文
- **禁止 emoji**:所有产物(代码 / 文档 / UI)禁止装饰性 Unicode
- **测试先行**:新功能必须附测试;LLM 行为必须真实 LLM 验证(符合原则 IV)
- **YAGNI**:6 skill 一次建成是用户授权的范围决策(见 §6.1 说明);不预留假想未来需求

### 5.2 技术栈
- Python 3.12+ / Pydantic + SQLAlchemy(不引入 Django ORM 进核心包)
- LangGraph StateGraph 作为主图与子图运行时
- LLM 走 OpenAI-compatible API(默认 qwen-plus,router 用 qwen-turbo)
- 本地 SQLite + WAL 模式,非必要不引入独立数据库服务

### 5.3 资源目录
- 新增代码集中在 `src/systemedu/tutor/`
- 测试集中在 `tests/tutor/`
- 不触碰受保留目录(`animation_game_design/` / `knowledge_base_doc/` / `stitch_systemedu_dashboard/` / course_factory 产物)

## 6. 范围决策说明

### 6.1 为什么一次性建 6 个 skill(YAGNI 的边界)
用户明确要求"我们需要一个完整的记忆框架,而不是暂时为了 demo 凑合"。单个 skill 上线(如只做 pbl-driving)会导致:
- 记忆层无法获得多 skill 切换的真实数据,结构化事实只能覆盖单一路径
- skill_router 没有意义(只有一个 skill)
- 产品上无法闭环 PBL 教学循环

这属于用户授权的一次性基建投资,不是"预测性扩展"。在宪法原则 V(YAGNI)下,用户的显式范围决策是允许的豁免。本 spec 的 plan.md 会在 Constitution Check 段落记录该决策依据。

### 6.2 为什么老 runtime 直接删除而不保留
- 尚未上线,没有生产流量
- deepagents 已经是技术上的死路,保留会持续诱导新功能依赖它
- git history 可以恢复任何代码;没有"备份死代码"的价值
- 宪法原则 V(YAGNI)明确要求"移除未使用的代码"

### 6.3 为什么 Postgres 迁移放到后续 spec
本 spec 预留切换开关(`TutorConfig.checkpoint_backend`)与占位实现(`pg_saver.py`),真实迁移需要:
- 独立 Postgres 实例准备
- 数据迁移脚本
- 灰度运维流程

这些工作与 tutor 核心能力建设无直接耦合,独立成 spec 更清楚。触发条件明确(横向扩容、并发 >500、checkpoint DB >20GB)。

## 7. 依赖与前置

### 7.1 依赖包
- `langgraph>=0.2.0` + `langgraph-checkpoint-sqlite`(新增)
- `aiosqlite>=0.19.0`(新增,Checkpoint 异步驱动)
- `alembic`(若已存在沿用,否则新增)
- 已有:`langchain-core` / `pydantic` / `sqlalchemy` / `mem0ai`

### 7.2 配置
- `~/.systemedu/config.yaml` 新增 `tutor.*` 字段(checkpoint_backend / skill_search_paths / mem0_enabled 等)

### 7.3 数据模型
- 4 张新表:`student_facts` / `pending_fact_extraction` / `tool_call_log` / `escalations`
- 沿用现有表:`users` / `projects` / `enrollments` / `chat_messages` / `progress_records` / `practice_submissions`

## 8. 验收标准

本 spec 上线后 2 周内必须达到:

| 维度 | 指标 | 目标 |
|-----|-----|-----|
| 功能 | 6 个用户故事 E2E 通过 | 100% |
| 功能 | 单测覆盖率(`tutor/`) | ≥ 80% |
| 质量 | 苏格拉底 0 直给答案(US-2) | 10/10 人工 review |
| 质量 | 事实抽取准确率 | > 75% |
| 质量 | skill_router 决策准确率 | > 80% |
| 性能 | 首 token p95 | < 2 秒 |
| 性能 | memory_inject p95 | < 200 ms |
| 性能 | checkpoint 写入 p95 | < 10 ms |
| 性能 | fact_extractor 成功率 | > 95% |
| 安全 | escalation 漏检率 | 0 |
| 安全 | 审计日志完整性 | 100% |
| 安全 | 工具白名单违规 | 0 例 |
| 生产事故 | P0 / P1 | 0 |

## 9. 风险

| # | 风险 | 影响 | 概率 | 缓解策略 |
|---|------|------|------|---------|
| R1 | skill_router 决策不稳定 | 用错 skill | 高 | E2E 场景覆盖;max_turns 强制约束 |
| R2 | fact_extractor 错抽污染 | 错上加错 | 中 | confidence<0.5 不注入 L3;定期人工抽查 |
| R3 | checkpoint DB 锁争抢 | 对话卡顿 | 低 | WAL 模式 + aiosqlite 异步 |
| R4 | Mem0 异常 | L4 失败 | 中 | 单层失败返空串,不阻塞主流程 |
| R5 | 老 runtime 删除漏依赖 | 运行时 500 | 中 | 删除前 `grep -r` 全仓扫描;单独 commit |
| R6 | 苏格拉底被套话 | 违反核心原则 | 中 | prompt 反复强调;E2E 场景 2;输出过滤 |
| R7 | confirm 机制被绕过 | 进度误写 | 低 | 写工具入口强制检查 `confirm_required` |
| R8 | 敏感话题漏检 | 儿童产品事故 | 低 | 正则预筛 + E2E 场景 5 覆盖 |
| R9 | 6 skill 并行开发基座变动 | 破坏下游 | 中 | Phase 3.1 先冻结 SkillBase API |
| R10 | 前端 UI 滞后 | 功能不可见 | 中 | spec 015 同步启动;后端保持 SSE 向后兼容 |

## 10. 里程碑(只做范围标记,实施节奏见 plan.md)

- **M1**:记忆层可用 + `direct-instruction` 兜底可对话
- **M2**:6 skill 全部上线,skill_router 决策生效
- **M3**:安全机制 + Gateway 切换完成,前端可联调
- **M4**:E2E 通过 + 性能基线达成,可上线

## 11. 相关文档

- 设计文档(架构决策依据):`docs/superpowers/specs/2026-04-16-tutor-memory-system-design.md`
- 项目宪法:`.specify/memory/constitution.md`
- 实施计划:`specs/014-tutor-memory-system/plan.md`(待生成)
- 任务清单:`specs/014-tutor-memory-system/tasks.md`(待生成)
- 后续 spec 015(前端)/ 016(Postgres 迁移)/ 017(planner/assessor 重建)
