# Spec 040: 用户级 LLM 配置 (User LLM Config)

Status: draft (2026-06-29)

## WHAT

用户点头像菜单进入"系统配置"页，为自己设置 chat 用的大模型。两种来源:
- **系统预设**: 从友好别名 (标准 / 更聪明 / 更快) 下拉选, 平台 key, 用户不碰 key
- **自定义**: 填 base_url + api_key + model (OpenAI-compatible), 用自己的 key/端点

chat (tutor) 按当前用户的配置选模型; 用户没配或配置失效时自动回退系统默认, 聊天不中断。

## WHY

- 现状: LLM 配置是服务器全局单例 (config.yaml 的 llm.providers + llm.default),
  所有用户共享一套 Qwen, 用户无法选。
- 用户希望自己控制用哪个模型 — 既能用平台预设, 也能接自己的 key/端点 (Qwen / 本地
  Ollama / 任何 OpenAI-compatible)。

## 范围 (已确认决策)

| 决策 | 选定 |
|---|---|
| 配置层级 | 每用户独立 (per-user) |
| 入口可见性 | 所有登录用户 (头像菜单 → 系统配置) |
| key 来源 | 两者都支持: 系统预设 (平台 key) / 用户自填 key |
| 预设形态 | 友好别名 (标准/更聪明/更快), 背后映射真实 provider |
| 自填字段 | base_url + api_key + model (完整 OpenAI-compatible 三件套) |
| 失败处理 | 自动回退系统默认 + 前端提示"已临时回退" |

## 不做 (YAGNI)

- 不做 per-role 配置 (用户只配 chat 用的单一模型, 不分 thinking/coding/fast)
- 不做 base_url 严格白名单 (SSRF 防护) — 见"已知风险", MVP 先记录
- 不做管理员级全局配置 UI (全局仍走 config.yaml)

## 数据模型 (student-app db.py, alembic 迁移)

```
UserLLMConfig
  id            String(36) pk uuid
  user_id       String(36) FK users.id  unique  not null
  mode          String(16) not null    # "preset" | "custom"
  preset_key    String(32) nullable     # mode=preset 时: standard/smart/fast
  base_url      String(512) nullable    # mode=custom
  api_key_enc   Text nullable           # mode=custom: Fernet 加密的 key (不明文)
  model         String(128) nullable    # mode=custom
  updated_at    DateTime not null
```

- api_key 用 **Fernet 对称加密** 存。密钥来自 env `STUDENT_LLM_CONFIG_KEY`
  (32 字节 urlsafe base64, deploy 时写进 /root/.systemedu-student-secrets, 不进 git)。
- 密钥缺失时: 自定义 key 功能禁用 (保存自填 key 报错引导), 预设模式不受影响。

## 预设别名映射 (服务端定义, 非用户可改)

| 别名 (preset_key) | 展示名 | 映射 |
|---|---|---|
| standard | 标准 | 全局 default provider (thinking) |
| smart | 更聪明 | 全局 thinking provider |
| fast | 更快 | 全局 fast provider |

(初期三个都指向已配的 Qwen role; 将来后台加 provider 时别名映射可扩展。)

## API (student-app, 需登录)

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /api/settings/llm | 当前用户配置 (key 脱敏: 返回 has_key=true, 不返明文) |
| PUT | /api/settings/llm | 保存 (body: {mode, preset_key?} 或 {mode:custom, base_url, api_key?, model}) |
| GET | /api/settings/llm/presets | 可选预设别名列表 + 展示名/描述 |

- PUT custom 时 api_key 可选 (留空=保留原 key, 不覆盖); 明确传新值才更新。
- 删除/重置: PUT {mode: "preset", preset_key: "standard"} 即回到默认。

### 保存时校验 (custom 模式, 硬阻断)

PUT custom 配置时, 落库前先用 base_url + (新填或保留的) api_key + model
**真发一次最小 LLM 请求** (例: 1 条 "ping" 消息, max_tokens 极小, 超时 10s):
- 成功 → 落库保存, 返回 200
- 失败 → **不保存**, 返回 422 + 明确错误分类:
  - `invalid_key`: 鉴权失败 (401/403)
  - `model_not_found`: 模型不存在 (404 / 模型名错)
  - `endpoint_unreachable`: 连不上 / 超时 / DNS 错
  - `invalid_response`: 连上了但返回不是合法 LLM 响应
- preset 模式不校验 (平台 provider 已知可用)。

保存校验 (挡一开始就错的) + 运行时回退 (挡保存后才失效的) = 双保险。

## chat 链路改造 (tutor_runner)

- chat 启动时, 按 user_id 查 UserLLMConfig:
  - 无配置 / mode=preset → 解析 preset_key 到全局 provider (复用 resolve_role_provider)
  - mode=custom → 用 base_url + 解密 api_key + model 构造 ChatOpenAI (get_llm 传参覆盖)
- LLM 调用失败 (鉴权/网络/模型不可用):
  - 捕获异常 → 用全局默认 provider 重建 LLM 重试
  - 向前端 WS 推一个 `llm_fallback` 事件 (前端 toast "你的模型配置暂不可用, 已临时用默认模型")
- get_llm 已支持 provider/model/base_url/api_key 传参覆盖, 复用之, 不改 core。

## 已知风险 (MVP 接受, 记录在案)

1. **SSRF**: 用户自填 base_url 可指向内网。MVP 只校验 https:// 前缀 + 记日志,
   不做严格白名单。用户量小、可控。后续 spec 可加。
2. **key 加密密钥单点**: STUDENT_LLM_CONFIG_KEY 丢失 = 所有自填 key 无法解密
   (用户需重填)。密钥随 secrets 文件备份。

## 前端 (student-web)

- 头像菜单加 "系统配置" 入口 → /settings 页 (或 /settings/llm)
- 配置页: tab/切换 [系统预设 | 自定义]
  - 预设: 别名下拉 (标准/更聪明/更快) + 各自说明
  - 自定义: base_url / api_key (password, 占位显示 has_key) / model 三输入框
  - 保存按钮 + 当前生效配置状态显示
- chat 收到 llm_fallback 事件 → sonner toast 提示

## 验收

1. 未登录访问 /api/settings/llm → 401
2. 保存 preset (standard) → 不校验直接存; GET 返回 mode=preset/preset_key=standard
3. 保存 custom (有效 base_url+key+model) → 校验通过, DB 存的 api_key_enc 是密文
   (非明文); GET 返回 has_key=true 不返明文
4. 保存 custom (错 key) → 422 + error=invalid_key, **不落库** (DB 无该用户 custom 行
   或保持原值)
5. 保存 custom (错 model / 连不上端点) → 422 + 对应 error 分类, 不落库
6. chat 用 custom 配置 → tutor 实际用用户的 base_url+model (真实 LLM 验证)
7. 已存的 custom 配置事后 key 失效 → chat 触发回退, 收到 llm_fallback 事件, 聊天仍出结果
8. pytest 覆盖 1-5 + 回退逻辑 (校验用 mock LLM 响应模拟成功/各类失败)
9. 前端头像菜单可进系统配置; 两种模式可切换/保存; custom 校验失败时展示对应错误提示
