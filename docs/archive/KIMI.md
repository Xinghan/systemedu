# SystemEdu - Kimi Code 开发指南

## 语言要求

**所有回复必须使用中文**，包括代码注释说明、错误分析、建议等。禁止在回复中混入其他语言。

## 项目概述

SystemEdu 是一款**本地优先的 AI Agent Sandbox 平台**，教育为核心定位，Agent 为底层架构。面向儿童到青少年（6-18岁）的 AI Agent 驱动项目制学习平台。

核心技术特色：
- 本地 Agent Runtime
- 多 LLM provider 支持
- MCP 工具集成
- Skills 系统
- 动态知识树 DAG
- Mem0 记忆
- Hub 项目共享

## 技术栈

### Core (`/src/systemedu/`)
- **Language**: Python 3.12+
- **CLI**: Typer + Rich
- **Config**: YAML + Pydantic models
- **Agent Runtime**: LangGraph + LangChain + OpenAI-compatible LLM
- **Memory**: Mem0 (optional, vector+graph hybrid)
- **Storage**: SQLite (local) + SQLAlchemy
- **MCP**: Python MCP SDK
- **Skills**: SKILL.md format

### LLM Support
- Qwen (DashScope): `qwen-plus`, `qwen-turbo`
- Claude (Anthropic)
- Local (Ollama)
- Any OpenAI-compatible endpoint

## 项目结构

```
systemedu/
├── CLAUDE.md                   # 原始项目指南
├── KIMI.md                     # 本文件
├── pyproject.toml              # Python 包配置
├── src/systemedu/              # 主包
│   ├── cli/                    # CLI 命令
│   │   ├── main.py             # 入口: systemedu
│   │   ├── agent.py            # agent start/stop/status
│   │   ├── project.py          # project init/list/info
│   │   ├── config_cmd.py       # config show/set/get/edit
│   │   ├── mcp.py              # mcp add/list/remove
│   │   ├── skill.py            # skill list/add/remove
│   │   ├── channel.py          # channel list/add/remove
│   │   ├── doctor.py           # 诊断检查
│   │   └── onboard.py          # 交互式引导
│   ├── core/                   # Agent runtime 核心
│   │   ├── config.py           # 配置加载
│   │   ├── runtime.py          # Agent runtime
│   │   ├── llm_client.py       # 多 provider LLM 客户端
│   │   ├── tool_executor.py    # 工具执行
│   │   ├── session.py          # 会话管理
│   │   ├── daemon.py           # Daemon 进程管理
│   │   └── agent_backend.py    # Agent 后端
│   ├── agents/                 # Agent 定义
│   │   ├── base.py             # BaseAgent 抽象类
│   │   ├── manager.py          # Agent 实例管理
│   │   └── builtin/            # 内置 agents
│   ├── channels/               # 通信渠道
│   ├── education/              # 教育层
│   ├── mcp/                    # MCP 管理
│   ├── skills/                 # Skills 系统
│   ├── memory/                 # Mem0 记忆客户端
│   ├── hub/                    # Hub 客户端
│   ├── storage/                # SQLite 存储
│   └── gateway/                # Gateway HTTP + WebSocket 服务
├── projects/                   # 示例项目
├── tests/                      # pytest 测试套件
├── scripts/                    # 工具脚本
└── prd/                        # 产品需求文档
```

## 常用命令

### 重启服务（本地开发）
```bash
./scripts/restart.sh
```

### 运行测试
```bash
source .venv/bin/activate && python -m pytest tests/ -v
```

### 查看系统状态
```bash
source .venv/bin/activate && systemedu status
```

## 开发规范

### Git 工作流
- **每次代码变更必须提交**
- Commit message 格式: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- 禁止 force push

### 代码标准
- Python: PEP 8, type hints, async where appropriate
- Config: Pydantic models for all configuration
- Agents: BaseAgent subclass with `process()` method
- Education: Pydantic models (no Django ORM in core package)
- **禁止使用 emoji** 和特殊 Unicode 符号

### Object 渲染质量标准
- 必须使用 `defs_svg` + `body_svg` 路径
- 必须使用有机曲线（cubic bezier）
- 必须使用渐变 + 多层阴影
- 物体必须填满 viewBox

### 开发循环（必须遵循）
```
1. 开发新功能 → 2. 编写测试 → 3. 运行测试并修复 bug
→ 4. 提交代码 → 5. 回顾系统 → 6. 提出建议
→ 7. 用户确认后更新 PRD → 8. 继续下一轮
```

### 测试要求
- **每个新功能必须附带测试**
- 运行: `source .venv/bin/activate && python -m pytest tests/ -v`
- LLM/Prompt 行为必须用真实 LLM 验证

## 关键文件

| 文件 | 说明 |
|------|------|
| `CLAUDE.md` | 原始完整项目指南 |
| `todolist.md` | 功能待办清单 |
| `prd/prd.md` | 总纲 PRD，包含 Phase 进度 |
| `pyproject.toml` | Python 包配置和依赖 |

## 注意事项

1. **每次完成新功能后，必须同步更新对应的 PRD 文件**
2. **创建新 PRD 文件前需征求用户批准**
3. **Object 生成必须达到质量标准，禁止积木人风格**
4. **用户确认的功能建议记录在 todolist.md**
