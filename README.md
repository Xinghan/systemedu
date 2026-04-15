# SystemEdu

本地优先的 AI Agent Sandbox 教育平台。详见 `docs/prd.md`。

## 快速开始

```bash
# 本地开发（backend + frontend 一起起）
./scripts/restart.sh

# 后端: http://localhost:18820
# 前端: http://localhost:3000
```

## 文档索引

- `CLAUDE.md` — 项目约定与开发纪律（Claude Code 读）
- `docs/prd.md` — 总纲 PRD（愿景、架构、路线图、API）
- `docs/todolist.md` — Feature backlog
- `specs/` — 单特性 spec/plan/tasks 三件套（speckit 模式）
- `.claude/skills/course_factory/SKILL.md` — 课程生成手册（Claude Code skill）
- `course_factory/` — 课程生成 component（Python 库 + 运行时 + 验证器 + 测试产物）

## 目录结构

```
src/systemedu/   Python 核心包（gateway、agents、education、storage）
web/             Next.js 前端
projects/        示例项目内容
specs/           每个特性一个目录
docs/            长期性文档
tests/           pytest 测试
scripts/         运维脚本（deploy/restart/server-ssh/import_kt_json）
course_factory/  课程生成 component（factory.py、runtime、validate、tests、images）
.claude/skills/  Claude Code skills（speckit-*、course_factory）
.specify/        spec-kit 模板与脚本
```
