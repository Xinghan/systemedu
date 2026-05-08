# 020-streaming-llm

**Status**: shipped (2026-05-08)
**Owner**: xinghan
**Created**: 2026-05-08

## 背景

知识树生成在生产偶发 504。链路追踪发现：

- GLM-5.1 是 reasoning model，前 30-50% 时间在内部 thinking（**不输出任何
  byte**），content 阶段才开始返回
- OpenAI SDK 默认 `request_timeout=300s`（spec 017 在
  `core/llm_client.py:75` 设置），且**自动重试 2 次**
- 复杂项目（7 milestones × ~50 节点）的 expand 阶段单次可能 > 5 分钟，
  触发 SDK 重试，累计 10+ 分钟仍未完成
- nginx `proxy_read_timeout 600s`（spec 020 之前 300s）会先断连，前端 504

## 目标

把 planner 的 LLM 调用改为 **streaming 模式 + 关闭 SDK 自动重试**，达成：

1. **超时不重试**：单次失败就抛 `RuntimeError`，由 `tree_generator.py`
   外层的 `max_retries=3` 重试逻辑接管，避免双倍累计超时
2. **stream 中即便 reasoning 慢，content 阶段一旦开始就持续有 chunk**，
   nginx / SDK 都按"chunk 间空闲超时"判活，不再触发"总响应时间超时"
3. **不改前端 / 不改 gateway endpoint 接口**：returns 仍是完整 JSON

## 非目标

- 不做 SSE / 前端进度条（方案 Q）— UX 改进留以后做
- 不动 v3 pipeline 的 streaming（`astream_html` 早已 streaming）
- 不动 generate_description（描述只 200-300 字符，秒级返回，无意义）

## 实现要点

### 后端

**`core/llm_client.py:get_llm()`**：参数加默认 `max_retries=0`，让用户
（planner 等）显式控制是否要 SDK 重试。LangChain 的 `ChatOpenAI` 透传
给 OpenAI SDK 客户端配置。

**`agents/builtin/planner.py:process()`**：
- `get_llm(provider, temperature=0.4, streaming=True, max_retries=0)`
- 把 `await llm.ainvoke(messages)` 改为
  ```
  buf = []
  async for chunk in llm.astream(messages):
      buf.append(chunk.content or "")
  full_text = "".join(buf)
  ```
- 用 `_extract_json(full_text)` 从 buffer 解析 JSON

不需要改 `tree_generator.py`：它已经有 `max_retries=3` 重试逻辑，
单次 `process()` 失败就重试。

### 测试

`tests/test_017_v3_role_routing.py` 等测试 mock 的是 `get_llm`
返回的对象，astream 接口和 ainvoke 不一样——但 planner 走 astream，
其他用 ainvoke 的地方（factory.generate_assignment 等）保持不变。

新增 `tests/test_020_planner_streaming.py`：
- mock 一个支持 astream 的 fake LLM，断言 planner 收完所有 chunk
  后 _extract_json 仍正确工作

### 真实 LLM 验证

本地跑一次 `generate_knowledge_tree`，target_nodes=50，观察：
- 不出现 `INFO:openai._base_client:Retrying request to /chat/completions`
- 单次完成时间 < 6 分钟（stream 把 reasoning + content 一起算，
  比 non-stream 总时长持平或略短）

## 验收

- [x] planner 用 astream 收 chunk 拼 buffer，最终 _extract_json 解析 JSON
- [x] OpenAI SDK 自动重试关闭（`max_retries=0`）
- [x] 39 个 spec 017+019 测试全过
- [x] 新增 test_020 streaming 测试至少 2 个（happy path + 收 chunk 后 parse）
- [x] 本地真实 GLM 跑通 8 节点知识树（小项目 baseline）
- [x] 部署到 47.106.220.119 + 重启 backend
