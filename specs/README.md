# Specs

本目录按 [speckit](https://github.com/github/spec-kit) 模式组织，每个特性一个目录，包含三件套：

```
specs/NNN-<slug>/
├── spec.md     # 做什么 + 为什么（WHAT + WHY）
├── plan.md     # 怎么做（技术方案、影响面、验收）
└── tasks.md    # 拆到可执行的任务清单
```

总纲文档位于 `docs/prd.md`（产品愿景、架构、路线图）。本目录只记录**单个特性**的细化。

## Workflow

**新特性必须按以下顺序走**，与 [superpower](https://github.com/obra/superpower) 流程对齐：

1. **Spec**（一起写）：用户描述需求 → Claude 生成 `spec.md`，用户确认 WHAT + WHY
2. **Plan**（Claude 主导，用户审）：Claude 生成 `plan.md`，列方案/影响面/验收，用户批准后进入实现
3. **Tasks**（Claude 主导）：Claude 生成 `tasks.md`，拆成可执行步骤；实现过程中勾选进度
4. **实现 + 测试**：按 tasks.md 推进，每个任务完成立刻勾选
5. **归档**：特性上线后在 spec.md 顶部加 `Status: shipped (YYYY-MM-DD)`

**不跳 spec.md 直接写代码**，这是纪律。简单 bugfix 可以豁免（commit message 里讲清楚即可）。

## 命名

- 目录：`NNN-<slug>`，NNN 三位顺序号（001 起），slug kebab-case
- 带模块前缀以便溯源（`fe-` `be-` `admin-` `factory-` `infra-`）
- 新号取 `ls specs/ | sort | tail -1` + 1

## Spec 模板

见 `_template/` 目录（若后续需要可创建）。最简版结构：

```markdown
# NNN-<slug>

**Status**: draft | in-progress | shipped
**Owner**: <name>
**Created**: YYYY-MM-DD

## 背景 / 问题
## 目标（WHAT）
## 非目标（不做什么）
## 用户故事 / 场景
## 验收标准
```

## 特性索引

见 git log 与各目录 spec.md。已迁移的历史特性（来自旧 `prd/`）：

| ID | 模块 | 特性 |
|----|------|------|
| 001 | fe | auth |
| 002 | fe | challenge-hall |
| 003 | fe | my-projects |
| 004 | fe | project-detail |
| 005 | be | auth |
| 006 | be | learning-refactor |
| 007 | be | progress |
| 008 | be | projects |
| 009 | admin | auth |
| 010 | admin | knowledge-tree |
| 011 | admin | projects |
| 012 | admin | tasks |
