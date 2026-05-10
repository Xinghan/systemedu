# spec 022 Phase 1 T1.3: import 依赖图分析

**Date**: 2026-05-10

## 顶层模块依赖

```
agents             → core
cli                → core, storage
core               → gateway (!), storage (子模块)
course_factory_v3  → core, storage
education          → agents, core, storage
gateway            → agents, core, course_factory_v, education, skills, storage, tutor
mcp                → core
memory             → core
storage            → core
tutor              → core, memory, storage
```

## 发现的反向依赖

### 1. `core/daemon.py` → `gateway` ❌ 真反向依赖

- **现状**: `core/daemon.py:281` `from systemedu.gateway.server import create_app`
- **使用方**: 只被 `cli/` 用 (cli/agent.py / cli/main.py / cli/onboard.py / cli/doctor.py)
- **决策**: spec 022 已决定**删 cli/** (§决策点 1 方案 A)。删完后 daemon.py
  也无人引用, **一并删除**。
- **Phase 3 处理**: T3.3 删 cli/ 时同时删 core/daemon.py + tests/test_daemon.py

### 2. `core/session.py` → `storage`

- **现状**: `core/session.py` 多处 `from systemedu.storage.db import ChatMessage / ChatSession`
- **使用方**: 只被 `gateway/server.py` 用
- **决策**: session.py **不属于 core**, 应该挪到 cloud-app
  (`packages/cloud-app/src/systemedu/cloud/gateway/session.py`)
- **Phase 3 处理**: T3.x 把 session.py 跟 gateway 一起 mv 到 cloud-app

### 3. `course_factory_v3` → `course_factory_v` (?)

- 这是 grep 误识别 (regex 匹配 `course_factory_v` 短前缀);
  实际上是 `course_factory_v3` 内部相对引用, 不是反向依赖。

## 修订后的目标依赖图 (Phase 5 后)

```
core (lib, no deps on cloud-app)
  ├── config
  ├── llm_client
  ├── agents
  ├── education
  ├── course_factory_v3
  ├── storage (子模块, 含 db.py)
  ├── tutor
  ├── memory
  └── library_client (spec 023 实现)

cloud-app (gateway, depends on core)
  ├── gateway (含 session.py)
  └── (image_gen / channels 已 Phase 0 删)

(cli/ 删除)
(daemon.py 删除)
```

依赖单向: `cloud-app → core`, `core` 不知道 cloud-app 存在 ✓

## 准备工作 (Phase 1 完成)

- [x] git tag pre-022-monorepo
- [x] 测试 baseline 记录 (903 passed / 19 pre-existing failed)
- [x] 反向依赖识别 + 处理方案 (删 daemon, mv session)
- [ ] .gitignore + tools/content-pipeline 占位 (T1.4)
- [ ] commit Phase 1 (T1.5)

## Phase 2/3 实施前的额外动作 (跟 spec 022 主线无冲突)

- Phase 2 抽 core 时, **不**把 daemon.py 进 core (它要删)
- Phase 2 抽 core 时, **不**把 session.py 进 core (它要进 cloud-app)
- Phase 3 抽 cloud-app 时, session.py 跟 gateway 一起 mv
- Phase 3 抽 cloud-app 时, 删 cli/ 整目录 + daemon.py
