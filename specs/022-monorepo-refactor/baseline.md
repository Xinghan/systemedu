# spec 022 测试 baseline (Phase 1 T1.2 记录)

**Date**: 2026-05-08
**Tag**: pre-022-monorepo

## 全套测试结果 (`pytest tests/`)

```
903 passed, 19 failed, 32 skipped, 633 warnings in 567s
```

## 19 个 pre-existing failure (与 022 无关, 都是老 spec 残留)

| Test | 原因 |
|---|---|
| `test_config.py::TestLoadConfig::test_load_default_config` | 期望 default="qwen", 但 spec 019/021 已改 thinking |
| `test_config.py::TestLoadConfig::test_load_from_yaml` | 同上 |
| `test_config.py::TestLoadConfig::test_load_nonexistent_returns_default` | 同上 |
| `test_gateway.py::TestGatewayAPI::test_config_endpoint` | spec 021 改了 user_editable 列表 |
| `test_gateway.py::TestGatewayNewEndpoints::test_config_update` | 同上 |
| `test_llm_client.py::TestGetLLM::test_missing_api_key_raises` | spec 017 把 ValueError 改 LLMNotConfigured |
| `test_onboard.py::TestSaveConfig::test_save_and_load` | 老 onboard 流程已废 |
| `gateway/test_tutor_runner.py::TestShutdown::test_shutdown_closes_checkpointer` | langgraph 1.0 升级 |
| `test_cf_v3_pipeline_skeleton.py` (3 个) | v3 pipeline 改流式后输出格式变了 |
| `test_cf_v3_s07_labxchange.py::test_run_real_index` | FileNotFoundError, 数据文件路径变了 |
| `test_cf_v3_s10_plan.py::test_run_with_real_llm_rocket_design` | 需要真 LLM key, 当前 fixture 不配 |
| `test_cf_v3_s15_theory.py::test_run_with_real_llm_rocket_design` | 同上 |
| `test_course_factory_research.py::test_no_research_no_external_resources_field` | research 字段名变了 |
| `test_course_factory_v41.py::test_theories_included_in_course_content` | course_content schema 变了 |
| `test_rocket_m002_style_i18n.py` (3 个) | 测的是 fixtures/rocket-design 已删 (spec 137c62a 清理 47MB) |

## spec 017+019+020+021 重点测试 (本仓库新功能)

```
49 个 spec 017+019+020 测试: ✅ all pass (上次跑过)
46 个 spec 022 P0 改造后测试: ✅ all pass (Phase 0 commit 时跑过)
```

## 022 实施期间的"测试通过"要求

- spec 022 不应该让上面 19 个 pre-existing failure 变多
- spec 017+019+020+021 的核心测试 (~49 个) 必须保持 pass
- import path 改动后, 新位置的测试 import 也必须更新

实施完后跑一次 `pytest tests/` 期望 ≤19 failed。
