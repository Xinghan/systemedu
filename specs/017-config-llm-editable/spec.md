# 017-config-llm-editable

**Status**: draft
**Owner**: xinghan
**Created**: 2026-05-07

## 背景 / 问题

SystemEdu 有两条课程内容生成路径，必须严格分清：

1. **Claude Code SKILL 路径**（不在本次范围）：
   `course_factory/SKILL.md` 是给 Claude Code 当 skill 用的内容创作手册。
   Claude Code 自己读 SKILL 自己写 anim/game，写完调
   `course_factory.factory` 的工具函数把内容灌进 DB。这条路径上的 LLM 是
   "启动 Claude Code 时连的那个"。**这次完全不动**。

2. **Web UI / API 路径**（本次目标）：
   用户从前端 `/projects/new` 开始 → gateway 调
   `systemedu.course_factory_v3.pipeline` 在后端跑 12 步流水线 → 写 DB。
   这条路径里的 creative 类调用（anim/game/HTML 静态图）应该用
   "用户在 web `/config` 里配的那个 LLM"；fast 类调用（JSON 抽取、
   评判、audio_script、assignment）由系统侧 qwen 兜底，用户不配。

现状的两个问题：

**问题 A**：`/config` 页面 providers 字段全部只读，用户没法自助配
url/key/model。

**问题 B**：Web UI / API 路径里硬编码了 provider 名字：

```python
# src/systemedu/course_factory_v3/kimi_client.py
ROLE_TO_PROVIDER = {"creative": "kimi", "fast": "qwen"}

# course_factory/factory.py:274,448
provider = cfg.llm.providers.get("qwen") or cfg.llm.providers[cfg.llm.default]
```

`fast → qwen` 没问题（系统侧固定），但 `creative → kimi` 锁死了 provider
名字，用户没法自己换。

## 决策摘要

- **fast role**：系统级，**写死 `qwen`**，不暴露给用户。生成
  audio_script / assignment / 评判 / JSON 抽取 等文本快任务，由我们
  作为运维方在系统配置里提供 qwen api_key
- **creative role**：用户可配。**provider key 在配置里固定叫 `creative`**
  （UI 不让改 key 名，只让改 `base_url / api_key / model / temperature /
  max_tokens`），用于 anim / game / HTML 静态图、**项目 idea 生成、
  知识树生成** 等需要质量的任务
- **default provider**：**= `creative`**（不再是 qwen）。即"AI 生成描述"
  和"生成知识树"也走用户配的 creative LLM，保留质量。如果用户没配
  creative api_key，gateway 直接抛友好错误"请先在设置里配置 LLM"
- **UI 只显示用户能配的那一条 `creative` provider**：`GET /api/config`
  返回所有 provider，前端按后端给的白名单 (`llm.user_editable`) 渲染
- **配置文件**：仍是单一 `~/.systemedu/config.yaml`，UI 层做 filter
- **labxchange / wanx / travily** 等系统侧资源：不动，本次不让用户碰
- **roles UI**：本次不暴露，写死 `{creative: "creative", fast: "qwen"}`
  在代码 default

## 目标（WHAT）

1. **可编辑 `creative` provider 表单**（UI）：`/config` 页面只显示
   `creative` 一条，字段 `base_url / api_key / model / temperature /
   max_tokens` 都可编辑。`api_key` 用 password input，已存的 key
   显示成 mask（如 `sk-***abcd`），保存空字符串视为"不改"
2. **测试连接**：creative 卡片上一个"测试"按钮，调
   `POST /api/config/test-llm`，返回 `{ok, message, latency_ms}`
3. **保存即生效**：保存后 `PUT /api/config`，`reset_config()` 触发，
   gateway 不需重启
4. **去掉 web/api 路径的 provider 名字硬编码**：
   - `kimi_client.ROLE_TO_PROVIDER` 改为常量 `{"creative":
     "creative", "fast": "qwen"}`，并支持 fallback：当 `creative`
     provider 没配（无 api_key）时 raise 一个能让前端友好提示的错误
     （而不是底层 ValueError）
   - `factory.py:274,448` 改为 `cfg.llm.providers["qwen"]`（去掉
     `or cfg.llm.default` fallback，因为 fast 系统级写死 qwen，
     缺失就该爆错让运维查）
5. **后端 `GET /api/config`** 返回里加一个 `llm.user_editable: ["creative"]`
   字段，前端按这个白名单渲染（更明确，不依赖前端写死过滤名字）
6. **首次安装体验**：安装时如果 `creative` provider 不存在，自动
   写一条占位 `{model: "kimi-k2.6", base_url: "https://api.moonshot.cn/v1",
   api_key: "", temperature: 0.7}` 到 config，UI 上让用户填 key
7. **`cfg.llm.default` 指向 `creative`**：通过修改默认 config（首装时）
   或代码层强制让 `default == "creative"`，使所有"未指定 provider"的
   调用（包括 `api_generate_description` / `tree_generator` / `planner`）
   都走用户配的 creative
8. **E2E 验证**：从一台空 config 起步，UI 配 creative 的 url + key +
   model，点测试 ok → "AI 生成描述"成功（走 creative） → 预览知识树
   成功（走 creative） → 创建项目，v3 pipeline 跑通 audio +
   assignment（走 qwen） + 一个 creative step（走 creative）→ 全程
   不报"找不到 kimi"

## 非目标（不做什么）

- **不改 Claude Code SKILL 路径**：`course_factory/SKILL.md` 不动
- **不暴露 fast / qwen / wanx / travily / labxchange 给用户**
- **不暴露 roles 配置 UI**：写死在代码里，将来要分流再开
- **不允许用户改 provider key 名字**：`creative` 是固定 key
- **不做** provider 健康监控、定时探活
- **不做** api_key 加密存储（继续明文写本地 yaml）
- **不重构** LLM 抽象层，仍用 langchain `ChatOpenAI`

## 用户故事 / 场景

**场景 A（新用户）**：拿到一台空机启动 systemedu，在 web `/config`
看到唯一一条 `creative` 的卡片，url/model 字段为空让用户填。用户填
url + key + model（如 GLM-5.1 + 智谱 url），点测试返回 ok，保存。
然后 `/projects/new` 点"AI 生成描述"成功（**走 creative**），预览
知识树成功（**走 creative**），创建项目后 v3 pipeline 跑通 audio +
assignment（走系统侧 qwen，对用户无感）+ anim/game（走 creative）。

**场景 A'（用户没配 creative 就想用）**：用户跳过 `/config` 直接去
`/projects/new` 点"AI 生成描述"，前端弹出 toast"请先在 设置 → LLM
里填写 API Key"，按钮跳转到 `/config`。

**场景 B（用户换 LLM）**：用户原来填的 moonshot key 想换成阿里 qwen-plus
做 creative。在 `/config` 把 base_url/api_key/model 都改了，保存。
下次生成项目 anim/game 用阿里 qwen-plus。fast 仍是系统侧 qwen（运维配的），
不受影响。

## 验收标准

- [ ] `/config` 页面**只显示 `creative` 一条** provider 卡片
- [ ] `creative` 卡片里 `base_url / api_key / model / temperature /
      max_tokens` 都是 editable input
- [ ] api_key mask 显示，重输覆盖，空字符串不清旧 key
- [ ] 卡片有"测试连接"按钮，后端 `POST /api/config/test-llm` body
      `{provider: "creative"}` 返回 `{ok, message, latency_ms}`
- [ ] 保存触发 `reset_config()`，gateway 不需重启
- [ ] `kimi_client.ROLE_TO_PROVIDER` 改为 `{"creative": "creative",
      "fast": "qwen"}`；creative 没配 api_key 时抛友好错误（HTTP 412
      `LLM_NOT_CONFIGURED`，前端识别后引导去 `/config`）
- [ ] `course_factory/factory.py:274,448` 改为直接 `providers["qwen"]`
- [ ] `cfg.llm.default == "creative"`（首装 / 迁移时强制写入）
- [ ] `api_generate_description` / `tree_generator` / `planner`
      在 creative 没配 key 时也返回 412 `LLM_NOT_CONFIGURED`
- [ ] **不动** `course_factory/SKILL.md` 和 Claude Code SKILL 路径
- [ ] `GET /api/config` 返回里包含 `llm.user_editable: ["creative"]`
- [ ] 首次启动时若 `creative` provider 不存在，自动写占位（key 留空）
- [ ] pytest E2E：mock OpenAI server，UI 配 creative 指向 mock，跑
      idea/tree/v3-creative-step 三步，断言 creative step 请求打到
      mock 的 base_url
- [ ] CLAUDE.md "LLM/Prompt 行为必须用真实 LLM 验证"：用真实 LLM
      跑一遍三步链路，结果记录在 plan 验收章节
- [ ] `docs/prd.md` 设置页章节同步更新
- [ ] 老 config（已有 kimi provider）不破坏：迁移逻辑把 `kimi`
      重命名为 `creative`，或者 `creative` 缺失时从 `kimi` 拷贝
