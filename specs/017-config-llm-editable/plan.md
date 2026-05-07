# 017-config-llm-editable - Plan

**Status**: draft
**Owner**: xinghan
**Created**: 2026-05-07

## 总体策略

把 web/api 路径上**唯一可由用户配的 LLM 抽象成 `creative`** 这一条
provider，UI 上让用户填 url/key/model，后端把所有"需要质量"的链路
（idea/tree/anim/game/HTML/diagram/kit）路由到 creative；fast 类
任务（评判/JSON 抽取/audio_script/assignment）系统侧固定 qwen，
用户无感。Claude Code SKILL 路径完全不受影响。

## 关键改动点（按文件）

### 1. Config Schema — `src/systemedu/core/config.py`

- `LLMConfig` 当前已有 `default + providers`
- 不引入 `roles` 字段（spec 决策：本次不暴露）
- 新增 `default_user_editable_providers: tuple[str, ...] = ("creative",)`
  常量（白名单），用于 API 返回
- **首装 / 迁移** 逻辑：
  - `load_config()` 加载完做一次自检：
    - 若 `providers` 没有 `creative`：从已有 `kimi` 拷贝过来重命名
      （旧字段保留），或新建一条 url/key 留空的占位
    - 强制 `default = "creative"`
    - 若 `providers` 没有 `qwen`：写一条占位（让 fast 路径报错时
      错误信息友好）
    - 自检完写回 `~/.systemedu/config.yaml`（一次性，下次启动幂等）

### 2. Gateway Config API — `src/systemedu/gateway/server.py`

- `GET /api/config` 返回里的 `llm` 块加：
  ```json
  {
    "default": "creative",
    "user_editable": ["creative"],
    "providers": { ... }   // 已有
  }
  ```
- **api_key 脱敏**：providers 返回里 `api_key` 改成 mask
  （`sk-***abcd` 或全 `***` 取决于长度），原文不出后端
- `PUT /api/config` 行为调整：
  - 接收 body 里的 `llm.providers.<name>.<field>` 时，如果
    `api_key` 是 mask 值（与上次返回的 mask 一致或为空字符串），
    **保留旧 key 不覆盖**；否则覆盖
  - 仍走 `save_config + reset_config`，gateway 不需重启
- **新端点** `POST /api/config/test-llm`：
  - body: `{provider: "creative"}`
  - 调 `get_llm(provider=...)` 发一次最小 ping
    （`SystemMessage("ping") + HumanMessage("say ok")`，max_tokens=8）
  - 返回 `{ok: bool, message: str, latency_ms: int}`
  - 5 秒超时；任何异常 catch 成 `{ok:false, message: str(e)}`
- **错误码标准化**：在 `get_llm()` 抛"api_key 未配置"时改成
  自定义 `LLMNotConfigured` 异常；gateway 路由层 catch 后返回 412
  `{error: "LLM_NOT_CONFIGURED", message: "请先在设置里配置 LLM"}`

### 3. Gateway Static Routes — `src/systemedu/gateway/server.py`

新增 route：
```python
Route("/api/config/test-llm", api_test_llm, methods=["POST"]),
```

### 4. LLM Client — `src/systemedu/core/llm_client.py`

- 新增 `class LLMNotConfigured(Exception)`
- `get_llm()` 里 `if not prov.api_key` 改抛 `LLMNotConfigured`
- 不改变默认行为（`provider=None` 仍读 `cfg.llm.default`）——
  迁移层已经把 default 改成 `creative` 了

### 5. v3 Pipeline 路由 — `src/systemedu/course_factory_v3/kimi_client.py`

- `ROLE_TO_PROVIDER = {"creative": "creative", "fast": "qwen"}`
- 删除 `kimi()` 兼容函数（用 ripgrep 看到 `revise.py` / `s25` 还
  在用，先保留兼容；只把内部映射改了）
- `llm_for("creative")` 走 `creative` provider，`llm_for("fast")`
  走 qwen，与 spec 决策一致

### 6. factory.py 硬编码移除 — `course_factory/factory.py`

- line 274（assignment）和 line 448（audio scripts）：
  - 改为 `provider = cfg.llm.providers["qwen"]`
  - 不再 `or cfg.llm.providers[cfg.llm.default]` fallback
  - 这两个函数 SKILL 路径也调，但行为一致（qwen 是系统侧）
- 不动其他 SKILL 相关代码

### 7. 前端 `/config` 页面 — `web/src/app/(dashboard)/config/page.tsx`

完全重写 LLM 配置卡片：

- 读 `config.llm.user_editable`（API 返回）作为白名单 filter providers
- 渲染唯一一条 `creative` 卡片，包含：
  - `model` text input
  - `base_url` text input
  - `api_key` password input（默认显示后端给的 mask；用户清空再输入即覆盖）
  - `temperature` number input (0.0–2.0, step 0.1)
  - `max_tokens` number input (optional)
  - "测试连接" Button（调 `POST /api/config/test-llm`，结果 toast）
  - "保存" Button（PUT /api/config）
- 移除"默认 provider"的 Input（用户不需要配）

### 8. 前端 API 客户端 — `web/src/lib/api.ts`

- `gateway.updateConfig` 已存在，只改调用参数结构
- 新增 `gateway.testLLM(provider)` 方法

### 9. 前端 LLM 未配置引导 — toast 拦截

- `gateway` axios / fetch 拦截层检查 `error === "LLM_NOT_CONFIGURED"`
- 弹一个 sonner toast 带"去设置"按钮，跳 `/config`
- 涉及的入口：`/projects/new` 的"AI 生成描述"+"预览知识树"+"创建项目"

### 10. PRD 文档同步 — `docs/prd.md`

- 更新"设置页"章节，说明 creative provider 的可配字段
- 标注 fast = qwen 系统侧不暴露
- 更新 API 表格：加 `POST /api/config/test-llm`

## 影响面

| 模块 | 风险 | 缓解 |
|------|------|------|
| 老 config 自动迁移 | yaml 写坏导致启动失败 | 迁移前备份 `config.yaml.bak.<ts>`；迁移失败回退 |
| api_key mask | 用户输错以为是 mask 没改 | 前端 placeholder 写"输入新 key 覆盖，留空保留旧 key" |
| `default = creative` 强制改写 | 用户原本想用 qwen 做 default | spec 决策是知识树用 creative，按 spec 走；用户想用 qwen 时手动改 yaml |
| 412 error code | 老前端代码不识别 | 全局拦截 + 兜底 toast；新增类型不破坏旧调用 |
| `kimi_client.kimi()` 兼容函数 | 改了路由后 `revise.py`/`s25` 行为变 | 行为不变（`kimi()` → `llm_for("creative")` → 用 creative provider）|

## 测试方案

### Mock E2E（pytest）

新建 `tests/test_017_config_llm_editable.py`：

1. **fixture**：起一个 aiohttp mock server 监听 8765，记录所有 OpenAI 请求
2. **fixture**：写临时 `~/.systemedu/config.yaml` 指 creative 到
   mock server，qwen 也指 mock（不同 port，区分 url）
3. **测试 1**：调 `GET /api/config` → 断言 `llm.user_editable=["creative"]`，
   `api_key` 是 mask
4. **测试 2**：`PUT /api/config` 改 creative `model=foo`，再 GET
   → 断言生效，api_key 没被清掉
5. **测试 3**：`POST /api/config/test-llm` body=`{provider:"creative"}`
   → mock 收到请求 → 断言 `ok=true`
6. **测试 4**：清掉 creative.api_key，调 `POST /api/projects/generate-description`
   → 断言 412 + `LLM_NOT_CONFIGURED`
7. **测试 5**：调 `POST /api/projects/generate-description` 正常路径
   → 断言 mock 上 creative port 收到请求
8. **测试 6**：v3 pipeline s65 (assignment) 跑一次 → 断言 mock 上
   qwen port 收到请求（不是 creative）

### 真实 LLM 验证（手动，记录在本文件 §验收章节）

- 在 web `/config` 配 GLM-5.1（智谱），点测试 → 期望 ok
- 跑 `/projects/new`：标题"小学生编程入门"，年龄 9，节点数 25
  → "AI 生成描述"返回中文描述
  → "预览知识树"返回 V5 树结构
- 创建项目，watch v3 pipeline 跑 audio_script + assignment
  → 期望 audio 走 qwen，assignment 走 qwen，s50 anim/game 走 creative

### 单元测试

- `core/config.py` 迁移逻辑：
  - 老 config 有 `kimi` 没 `creative` → 自动迁移
  - 没 `qwen` → 自动写占位
  - `default != "creative"` → 强制改写
  - 已迁移过的 config（幂等）不变化
- `core/llm_client.py`：
  - `get_llm("creative")` 没 api_key → 抛 `LLMNotConfigured`
- `kimi_client.llm_for("creative")` 用 `creative` provider，
  `llm_for("fast")` 用 `qwen` provider

## 验收记录（本文件，实施后填）

> 实现完成后在此处填写：
> - mock E2E 通过截图 / 日志摘录
> - 真实 LLM 三步链路实际响应

## 上线步骤

1. 本地按 tasks.md 实现并跑通测试
2. commit + push 到 `feat/017-config-llm-editable`
3. PR 到 main，自审
4. merge main 后 `./scripts/deploy.sh` 推到生产 47.92.200.21
5. SSH 上去手动验：访问 http://47.92.200.21/config 看 UI
6. 把 spec.md 标 `Status: shipped (YYYY-MM-DD)`
7. 同步 `docs/prd.md`
