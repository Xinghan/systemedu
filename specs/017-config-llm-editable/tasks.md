# 017-config-llm-editable - Tasks

按顺序执行，每完成立刻打勾 + commit。

## A. 后端基础

- [x] A1. `src/systemedu/core/llm_client.py`：新增 `class LLMNotConfigured(Exception)`，`get_llm()` 在 `not prov.api_key` 时改抛此异常
- [x] A2. `src/systemedu/core/config.py`：新增 `_migrate_legacy_config(raw: dict) -> dict` 函数：
  - 备份原文件到 `config.yaml.bak.<ts>`
  - 若 providers 没有 `creative` 但有 `kimi`，重命名（保留 url/key/model）
  - 若 providers 没有 `qwen`，写占位 `{model:"qwen3.6-plus", base_url:"https://dashscope.aliyuncs.com/compatible-mode/v1", api_key:"", temperature:0.3, max_tokens:8192}`
  - 强制 `llm.default = "creative"`
  - 仅当发生改动时写回 yaml
- [x] A3. `load_config()` 加载前先跑 `_migrate_legacy_config`
- [x] A4. 写 `tests/test_017_config_migration.py`：覆盖迁移幂等性、kimi → creative 改名、占位写入、default 强制
- [x] A5. commit `feat(017-A): config schema migration + LLMNotConfigured`

## B. Gateway API 改造

- [x] B1. `gateway/server.py: api_config (GET /api/config)`：providers 返回里 api_key 改 mask（`_mask_api_key(s)` 工具函数：≤8 char 全 `***`，>8 显示前 3 后 4）
- [x] B2. 同上：在 `llm` 块增加 `user_editable: ["creative"]`
- [x] B3. `gateway/server.py: api_config_update (PUT /api/config)`：检测 body 里 api_key 是 mask 串则保留旧值（按 provider 名比对原 yaml）
- [x] B4. 新增 `api_test_llm` handler：调 `get_llm(provider)` 发 ping，带 5s timeout，返回 `{ok, message, latency_ms}`
- [x] B5. 注册 route `Route("/api/config/test-llm", api_test_llm, methods=["POST"])`
- [x] B6. 全局异常 middleware（或在涉及 LLM 的 handler 里）catch `LLMNotConfigured` → 412 + `{error:"LLM_NOT_CONFIGURED", message:"请先在设置里配置 LLM"}`
- [x] B7. 写 `tests/test_017_gateway_config.py`：覆盖 GET mask、PUT mask 保护、test-llm ok/fail、412 错误码
- [x] B8. commit `feat(017-B): gateway config API + test-llm endpoint + 412`

## C. v3 Pipeline 路由解硬编码

- [x] C1. `course_factory_v3/kimi_client.py`：`ROLE_TO_PROVIDER` 改为 `{"creative":"creative","fast":"qwen"}`，`kimi()` 兼容函数保留（仍走 creative）
- [x] C2. 复查 `revise.py / s25_divergence.py / s50_implement_*.py / s40_debate.py / s15_theory.py / s20_ideation.py / gates/*` 的所有 `llm_for / kimi / astream_html` 调用，确认 role 选择符合 spec：
  - `creative`：`s50_implement_anim/game/diagram/image/kit`、`s25_divergence`、`revise`
  - `fast`：所有 gates 评判 / theory / ideation / debate / s15
- [x] C3. `course_factory/factory.py:274,448`：改为 `provider = cfg.llm.providers["qwen"]`，删除 `or cfg.llm.default` fallback
- [x] C4. 写 `tests/test_017_v3_role_routing.py`：mock `get_llm`，断言 `llm_for("creative")` → provider=`creative`，`llm_for("fast")` → `qwen`
- [x] C5. commit `feat(017-C): remove kimi/qwen hardcode in v3 pipeline + factory`

## D. 前端 `/config` 重写

- [x] D1. `web/src/lib/api.ts`：新增 `gateway.testLLM(provider: string)` 方法
- [x] D2. `web/src/app/(dashboard)/config/page.tsx`：删除"默认 provider"输入框；新建 `<CreativeProviderCard>` 组件
- [x] D3. CreativeProviderCard 字段：model / base_url / api_key (password) / temperature (number) / max_tokens (number, optional)
- [x] D4. api_key 占位文本"输入新 key 覆盖；留空保留旧 key"；初始值是后端给的 mask 串
- [x] D5. "测试连接" Button → 调 `testLLM("creative")` → toast 显示 ok/error + latency
- [x] D6. "保存" Button → PUT /api/config，body 只发改过的字段；api_key 保持 mask 时跳过该字段
- [x] D7. 用 `config.llm.user_editable` 白名单 filter providers，未来加新 provider 不用改前端
- [x] D8. commit `feat(017-D): config page editable creative provider + test button`

## E. 前端错误引导

- [x] E1. `web/src/lib/api.ts`：在 fetch 失败时识别 412 + `error="LLM_NOT_CONFIGURED"`，throw 一个带 `code` 字段的 Error
- [x] E2. 在 `/projects/new/page.tsx`：catch 这个错，sonner toast `"请先配置 LLM"` + 行动按钮"去设置"跳 `/config`
- [x] E3. （可选）创建项目流程也加同样的 catch
- [x] E4. commit `feat(017-E): 412 LLM_NOT_CONFIGURED frontend guidance`

## F. E2E 测试

- [x] F1. 写 `tests/test_017_e2e_llm_routing.py`：
  - 起 aiohttp mock 双 port（creative=8765, qwen=8766）记录请求
  - 临时 config 指向两个 mock
  - 跑 generate-description → 断言 creative port 收到请求
  - 跑 generate-tree → 断言 creative port 收到请求
  - 跑 v3 s65 assignment → 断言 qwen port 收到请求
  - 清掉 creative.api_key 跑 generate-description → 断言 412
- [x] F2. commit `test(017-F): e2e mock LLM routing`

## G. 真实 LLM 验证

- [x] G1. 本地启动 gateway + web，访问 `/config` 配 creative=GLM-5.1（智谱）
- [x] G2. 点测试 → 期望 ok
- [x] G3. `/projects/new` 测"AI 生成描述" + "预览知识树" 真实跑通
- [x] G4. 创建项目，watch v3 pipeline 至少跑通 audio + assignment（qwen）+ 一个 anim step（creative）
- [x] G5. 把 G2-G4 的真实响应记录到 plan.md §验收记录
- [x] G6. commit `docs(017-G): real LLM e2e verification log`

## H. 文档

- [x] H1. `docs/prd.md` 设置页章节同步：creative 字段说明、qwen 系统侧不暴露、测试连接、412 引导
- [x] H2. `docs/prd.md` API 表格加 `POST /api/config/test-llm`
- [x] H3. spec.md 顶部标 `Status: shipped (2026-MM-DD)`（最后一步）
- [x] H4. commit `docs(017-H): prd update + spec shipped`

## I. 上线

- [x] I1. 推到 `feat/017-config-llm-editable`，PR 到 main
- [x] I2. merge main
- [x] I3. `./scripts/deploy.sh` 部署生产
- [x] I4. 访问 http://47.92.200.21/config 验证

## 估算

- A: 1-2h（迁移逻辑 + 测试）
- B: 2-3h（API + mask + test-llm + 412）
- C: 1h（删硬编码 + 验证 role 分布）
- D: 3-4h（前端 UI + mask 交互）
- E: 1h（错误引导）
- F: 2h（E2E mock）
- G: 1h（真实跑）
- H+I: 1h

合计约 **12-15h**，可在 1.5 天内完成。
