# 测试覆盖审计报告 (2026-06-26)

三端 (student-app / library-app / core) 全量 coverage 审计 + 集成测试补充。

## 一、客观基线

全量 `pytest tests/` (1315 收集): **1150 passed / 71 failed / 58 errors / 36 skipped** (610s)。
coverage 跑在 student-app + library-app + core 三端源码上。

### 运行时服务覆盖率 (集成测试的真正战场)

| 模块 | 覆盖率 | 性质 |
|---|---|---|
| student `chat/routes.py` | 16.9% | `/api/chat/stream` WebSocket, 依赖真 LLM, 见 deferred |
| student `chat/tutor_runner.py` | 19.5% | LangGraph + 五层 memory, 依赖真 LLM |
| student `library_proxy/routes.py` | 22.4% | 反代 library /v1/* — **本轮已补** (升版/降级) |
| student `library_proxy/stream.py` | 20.0% | 流式代理媒体文件 |
| student `workers/fact_extractor_worker.py` | 30.3% | chat→fact — **本轮已补端到端链** |
| student `project_request/routes.py` | 42.3% | spec 038 新功能, 成功路径已测 |
| **library `routes/admin.py`** | **29.9%** | import/publish/delete — **本轮已补** |
| **library `routes/public.py`** | **39.8%** | /v1/* 公开内容 — **本轮已补** (draft 过滤/路径遍历) |
| **library `auth.py`** | **33.3%** | admin JWT + LICENSE_TOKEN — **本轮已补** |
| student `db.py` / `memory_layers.py` / `auth/routes.py` | 89% / 100% / 91% | 已扎实 |

**结论**: 审计前系统最薄弱、风险最高的是 **library-app 的 admin/public API 集成层** (内容流水线 + 安全), 几乎零集成测试。student-app 学习旅程主路径其实已被 `test_e2e_learning_flow.py` / `test_inject_page_matrix.py` / `test_catalog.py` / `test_library_proxy.py` 较好覆盖。

## 二、本轮已补 (68 个集成测试, 全绿, commit 9a58e17)

| 文件 | 测试数 | 覆盖 |
|---|---|---|
| `test_library_admin_auth_e2e.py` | 12 | admin 登录/token/未授权 401 |
| `test_library_license_auth_e2e.py` | 9 | LICENSE_TOKEN 校验 /v1/* |
| `test_library_path_traversal_e2e.py` | 10 | %2e%2e 编码绕规范化, 服务端 path-traversal-blocked + 内容不泄露 |
| `test_library_admin_import_e2e.py` | 13 | tarball 导入 + sha256 校验 + 异常 |
| `test_library_admin_publish_e2e.py` | 6 | publish/unpublish 状态流转 |
| `test_library_public_status_filtering_e2e.py` | 4 | draft 不出现在公开 /v1/projects |
| `test_library_admin_delete_e2e.py` | 5 | 删除 + 级联 |
| `test_catalog_upgrade_and_unavailable.py` | 4 | 升版检测 + library 不可用降级 (不 500) |
| `test_fact_worker_e2e_chain.py` | 5 | enqueue→tick→StudentFact 写入→下个 session 召回 (FakeLLM) |

四类集成路径对照: **B-跨服务** (升版/降级/代理) + **C-chat-memory** (fact worker 链) + **D-鉴权边界** (admin/license/路径遍历/draft 过滤) 已补; **A-端到端** 主路径此前已覆盖。

## 三、Deferred (本轮不做, 有明确原因)

- **WS `/api/chat/stream` 流式全链路** + **POST `/api/chat` happy path**: 依赖真 LLM 流式 (`tutor_runner.stream/invoke`), 子进程 `STUDENT_SKIP_TUTOR_PRELOAD=1` 不预热, 无法跑绿。**可测的鉴权/payload 子路径已被 `test_chat_ws_auth.py` + `test_chat_payload.py` 全覆盖**。留给 L3/--quality 专项接真 LLM。
- **五层 memory project-vs-global scope 矩阵**: 实测 `inject()` 无独立 scope 参数, 由 page_kind 派生, 已被 `test_inject_page_matrix.py` (4 page × L1-L5) 完整覆盖, 新建会重复。
- **Mem0 (L4 真向量) / 真 Redis enqueue**: `memory.enabled=false` 时 L4 走 mock, enqueue 走 SQLite。真 Mem0/Redis 集成不在本轮基础设施。
- **library_client SDK 网络弹性 (timeout/retry)**: 现无 retry 实现, 价值低。

## 四、需另行处理 (非测试缺口)

1. **`student auth/passwords.py` 0% 覆盖 = 疑似 dead code**: auth 已改手机号+短信, `hash_password` 未被调用。属代码清理, 建议确认后删除 (不立测试工单)。
2. **`tests/test_gateway.py` 70 个失败 = 废弃 cloud-app 的测试**: import `systemedu.cloud.gateway.server` (cloud-app 已 deprecated 2026-05-19, 被 student-app 替代)。占 129 个失败的 54%。建议随 cloud-app 一起退役删除。
3. **其余 ~59 个 fail/error**: 多为需真 LLM key 的配置/routing 测试 (`test_017_*` / `test_capstone` / `test_cf_v3_*` / `test_memory_client`)。环境无 key 时失败, 非代码 bug。

## 五、审计统计

- 缺口总数: 50 (P0=18 / P1=21 / P2=11)
- 本轮工单: 9 个全部实现并跑绿
- 新增测试: 68, 全 passing
- 方式: 多 agent workflow (13 agent, 三端并行审计 → 汇总排序 → 并行实现 → 复跑验证)
