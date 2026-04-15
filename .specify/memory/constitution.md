# SystemEdu Constitution

本章程固化 SystemEdu 项目的长期工程纪律。所有 spec / plan / tasks / implement 阶段的产出必须遵守。与 `CLAUDE.md` 冲突时以本章程为准。

## Core Principles

### I. 中文优先沟通（NON-NEGOTIABLE）

所有对话、PR 说明、commit message 正文、spec/plan/tasks 文档、PRD、代码注释说明、用户可见的 UI 文案均使用**简体中文**。技术标识符（标识符、变量名、API 路径、文件名、commit type 前缀如 `feat:`、英文技术术语）保留英文。严禁混入韩文、日文或其它非中文自然语言。

**执行**：回复中若出现非预期外文（>10 字符连续段），立即自我纠正重写。

### II. 禁止 emoji（NON-NEGOTIABLE）

所有代码、prompt、配置文件、UI 文案、PRD、spec、plan、tasks、commit message、PR 描述中**禁止使用任何 emoji 或装饰性 Unicode 字符**（包括 ✓ ✗ ★ ♥ 🎉 等 ASCII 范围外的状态/装饰符号）。反馈、状态、重点强调使用纯文字或 SVG 图形表达。

**允许的例外**：引用外部文档（例如外部 README、第三方 issue 原文）时原样保留；Mermaid/图表内的标准几何符号（箭头、形状）不算 emoji。

### III. Spec 驱动开发（NON-NEGOTIABLE）

新特性必须按 `spec → plan → tasks → implement` 顺序执行：

1. `/speckit-specify` 生成 `specs/NNN-<slug>/spec.md`（WHAT + WHY，不含实现），用户确认
2. `/speckit-plan` 生成 `plan.md`（HOW，架构决策与权衡），用户批准
3. `/speckit-tasks` 生成 `tasks.md`（逐步可执行清单，每步独立 commit 可回滚）
4. `/speckit-implement` 按 tasks 推进，每个 task 完成后立即 commit
5. 特性上线后在 `spec.md` 顶部标 `Status: shipped (YYYY-MM-DD)`

**豁免**：单点 bugfix（≤ 50 行改动、不涉及架构或数据模型），可以直接 commit，但 commit message 必须讲清根因 + 影响面。

**编号规则**：新 spec 目录使用顺序 `NNN-<slug>` 编号（`ls specs/ | sort | tail -1` + 1），不跳号。

### IV. 测试先行（NON-NEGOTIABLE）

**每个新功能必须附带自动化测试**。未附测试的改动不允许 commit，更不允许合并。

- Python 测试：`pytest tests/` 必须全绿
- 前端改动：若涉及交互/渲染逻辑，需相应 Playwright 或组件测试
- **LLM / prompt 行为必须用真实 LLM 验证**，禁止仅凭 "LLM 应该会 X" 这类预测就下结论。修改 prompt 后跑代表性用例并观察实际输出
- 集成测试必须覆盖：库之间的契约、服务间通信、共享 schema 变更

**红-绿-重构**：对新模块优先走 TDD（先写失败测试→实现→重构），老模块修改至少补回归测试。

### V. YAGNI 与简洁

不构建"可能需要"的功能、抽象、配置项。只做当前 spec/tasks 明确要求的事。

- 三行相似代码优于一次过早抽象
- 不添加面向假想未来需求的灵活性
- 不引入永远不会被第二个调用点使用的 feature flag 或兼容 shim
- 移除未使用的 `_var`、`// 已删除` 注释、re-export 类型
- 错误处理只覆盖真实可能发生的路径；不给内部可信调用加防御校验（只在系统边界验证）

## Additional Constraints

### 技术栈
- **核心包**（`src/systemedu/`）使用 **Pydantic + SQLAlchemy**，不依赖 Django ORM（核心要轻量可独立部署）
- Django 仅保留在 Hub Server (`/hub-server/`, Phase 4) 中
- Python 3.12+，遵循 PEP 8 + 类型标注
- LLM 调用走 OpenAI-compatible API（Qwen/Claude/Ollama 任选，通过配置切换）
- 本地存储使用 SQLite，非必要不引入独立数据库服务

### 资源目录保留规则
- `animation_game_design/`、`knowledge_base_doc/`、`stitch_systemedu_dashboard/` 为用户管理的素材目录，**禁止自动清理**
- `course_factory/tests/anim/*.html`、`course_factory/tests/game/*.html`、`course_factory/fixtures/_fix_*.py`、`scripts/_gen_*.py` 为 Course Factory 固定产物，保留
- `scripts/_debug_*`、`scripts/_regen_*` 为临时调试脚本，可定期清理

### Course Factory 纪律
Course Factory 是 Claude Code 按 SKILL.md 手册执行的内容创作流程，不是 API。扩展时必须读 `.claude/skills/course_factory/SKILL.md` 全量；修改 animation/game 必须遵守深色主题、100vh、i18n 双语、skeleton + runtime 模板规范。

## Development Workflow

### Git
- 每次功能完成后**立即 commit**，不批量累积
- Commit message 遵循 conventional commits：`feat:` / `fix:` / `refactor:` / `docs:` / `chore:` / `test:`
- 每个 commit 必须包含 `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
- **禁止** `--amend` 已推送的 commit、`push --force` 到 main、`--no-verify` 跳过 hook（除非用户显式要求）
- 遇到合并冲突优先解决，禁止用 `reset --hard` 丢弃用户改动

### Development Loop（强制）
```
1. 开发 → 2. 写测试 → 3. 测试通过 → 4. commit
  → 5. 回顾现状，提出改进建议 → 6. 与用户确认
  → 7. 用户确认后更新 PRD / todolist → 8. 进入下一轮
```
**第 5-6 步（回顾与建议）不可跳过**。

### 文档同步
每个特性完成后必须同步：
1. `docs/prd.md` 的 Phase checklist 和 API 表格
2. 对应 `specs/NNN-*/spec.md` 的 `Status` 字段
3. `docs/todolist.md`（新识别的 backlog 项）

### 审慎执行不可逆操作
- 删文件/目录、`rm -rf`、drop 表、force-push、kill 进程前必须与用户确认
- 向第三方发消息（Slack、邮件、GitHub issue/PR 评论）前必须与用户确认
- 授权一次不等于永久授权；超出原始授权范围的后续类似操作要重新确认

## Governance

**章程优先级**：本章程高于 `CLAUDE.md` 所有其它条款、高于任何 spec/plan/tasks 文档、高于 agent 自身偏好。

**修订流程**：
1. 修订草案以 `specs/NNN-constitution-update/` spec 形式提出
2. 修订动机、受影响面、迁移计划必须写清
3. 用户批准后更新本文件，`Version` 按 SemVer 递增：
   - MAJOR：删除或改变不可协商原则
   - MINOR：新增原则或扩展已有原则
   - PATCH：措辞澄清、示例更新、拼写修正
4. 同步更新 `CLAUDE.md` 交叉引用（若有）

**合规检查**：
- `/speckit-plan` 生成时必须检查是否违反章程，违反项需显式列在 plan.md 的 "Constitution Check" 段落并给出理由
- `/speckit-implement` 每次 commit 前自检：中文、无 emoji、有测试、符合 YAGNI
- PR review（若引入）必须包含章程合规项

**运行时参考**：`CLAUDE.md` 是日常操作指南，本章程是不可妥协底线。

**Version**: 1.0.0 | **Ratified**: 2026-04-15 | **Last Amended**: 2026-04-15
