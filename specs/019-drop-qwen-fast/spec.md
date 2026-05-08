# 019-drop-qwen-fast

**Status**: shipped (2026-05-08)
**Owner**: xinghan
**Created**: 2026-05-08

## 背景

spec 017 当时为了"让用户少配一个 LLM"把 fast 角色（评判 / JSON
抽取 / audio_script / assignment 等文本任务）固定在系统侧 qwen
provider，不暴露给用户。运行下来发现：

- "系统侧 qwen" 实际上还是要运维方填一个 DashScope key，没真免去
  用户配置一份的麻烦
- 用户其实希望"我配的那个高质量 LLM 你都用"，分两个 provider 是
  人为复杂度
- TTS（DashScope qwen-tts）借的也是这个 qwen.api_key，导致 TTS
  和 LLM 配置耦合到了一起，用户想换 LLM 就把 TTS 也搞坏了

## 目标

合并 fast → creative，让所有 LLM 调用走同一个用户可配的
`creative` provider；TTS api_key 拆出独立字段。

具体：

1. **删除 `qwen` provider**：所有 v3 pipeline / factory.py 里的 fast
   角色调用都改路由到 `creative`；不再 fallback
2. **TTSConfig 加 `api_key` 字段**：TTS 调用从 `cfg.tts.api_key` 读，
   env `DASHSCOPE_API_KEY` 仍可作 fallback
3. **新增 `TTSNotConfigured` 异常 + 412 全局 handler**：与
   `LLMNotConfigured` 同模式
4. **UI `/config` 加 TTS 卡片**：字段 api_key / model / voice +
   "测试连接"按钮（`POST /api/config/test-tts`）
5. **`handle-llm-error.ts` 也处理 TTS_NOT_CONFIGURED**：toast 引导去
   `/config`
6. **迁移**：老 config 已有 `llm.providers.qwen.api_key` 时，自动拷
   贝到 `tts.api_key`；qwen provider 从 yaml 删除

## 非目标

- 不改 Claude Code SKILL 路径
- 不重写 LLM 抽象层，仍用 langchain `ChatOpenAI`
- 不让用户配多个 LLM provider（仍只有一个 creative）
- TTS 仍锁定 DashScope qwen-tts，不通用化

## 验收

- [x] LLM 调用全部走 creative，没配 → 412 LLM_NOT_CONFIGURED
- [x] TTS 调用走 cfg.tts.api_key，没配 → 412 TTS_NOT_CONFIGURED
- [x] 老 config (含 qwen) 启动时自动迁移：qwen.api_key → tts.api_key，
      yaml 里 qwen provider 被删除
- [x] UI /config 显示 Creative LLM + TTS 两张卡片，各有测试按钮
- [x] 39 个 pytest (test_017_*.py + test_019_tts_config.py) 全过
- [x] spec 017 顶部标 amended (2026-05-08)，并指向本 spec
