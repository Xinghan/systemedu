# 021-multi-role-llm

**Status**: shipped (2026-05-08)
**Owner**: xinghan
**Created**: 2026-05-08

## 背景

spec 019 把所有 LLM 角色合并到唯一 `creative` provider, 用户体验简化但
牺牲了"按任务路由不同模型"的能力:

- 知识树规划 (planner) 是规划任务, 适合 **thinking model** (GLM-5.1)
- anim/game/HTML 实现 是 coding 任务, 适合 **coding model** (GLM-4.6,
  非 thinking, 速度快 2-3 倍)
- idea / 评判 / audio_script / assignment 是文本快任务, 适合 **fast
  model** (GLM-4.6 或 4.7-flash)

GLM-5.1 thinking 模型生成 anim/game 单次 5-8 分钟过慢, 而它的能力 (规划
深度) 在 coding 任务里也用不上。需要按角色拆分。

## 决策摘要

**用户在 web /config 看到 4 张卡片** (TTS 已有, 新增 3 张 LLM):

| 卡片 | 角色 | 默认推荐模型 | 用途 |
|---|---|---|---|
| **Thinking LLM** | planner | glm-5.1 (智谱) | 知识树规划; reasoning |
| **Coding LLM** ⭐ 新 | coder | glm-4.6 (智谱) | anim/game/HTML 静态图; coding 强 + 速度快 |
| **Fast LLM** ⭐ 新 | fast | glm-4.6 或 glm-4.7-flash | idea / 评判 / audio_script / assignment / JSON 抽取 |
| **TTS** (spec 019) | tts | qwen3-tts-flash (DashScope) | 语音合成 |

**Fallback 链** (用户填得越多越精细, 只填一个也能跑):
```
coder    没配 → fast 没配 → thinking
fast     没配 → coder 没配 → thinking
planner  没配 → 报错 (412)        # planner 是底线必填
```

`cfg.llm.default = "thinking"` (旧代码 `provider=None` 默认走 thinking)。

## 目标

1. **schema**: `cfg.llm.providers` 加 `thinking / coding / fast` 三条
   (`creative` 自动改名为 `thinking` 迁移)
2. **路由**:
   - `planner.py` → `thinking`
   - v3 pipeline `s50_implement_anim/game/diagram/image/kit` + `s25_divergence` + `revise` (creative role) → `coding`
   - v3 pipeline `s15_theory / s20_ideation / s40_debate / gates/*` (fast role) + factory `audio_script / assignment` → `fast`
   - `api_generate_description` (idea) → `fast`
   - `api_generate_tree` → `thinking` (经 planner)
3. **UI**: `/config` 渲染 3 张 LLM 卡片 + 1 张 TTS 卡片, 各有
   测试连接按钮, mask 保护
4. **后端 API**:
   - `GET /api/config` 返回 `llm.user_editable=["thinking","coding","fast"]`
   - `POST /api/config/test-llm body:{provider}` 仍然按名字测试任意 provider
5. **fallback resolver**: `get_llm()` 内部不直接 fallback, 在
   `kimi_client.ROLE_TO_PROVIDER` 解析时 resolve, 若指定 provider 未配
   key 则按上述链向后退一档

## 非目标

- 不暴露 default 给用户 (代码层固定 thinking)
- 不暴露 fallback 链给用户 (代码层硬编码)
- 不改 Claude Code SKILL 路径
- 不动 image_gen.py / wanx 那条独立路径 (本 spec 不处理图片生成)

## 用户故事

**场景 A (新用户最简配)**:
- /config 只填 Thinking LLM (GLM-5.1 + 智谱 key)
- coding / fast 全部 fallback 到 thinking 跑
- 知识树正常, anim/game 慢但能跑

**场景 B (老用户分流)**:
- Thinking: glm-5.1 + key1
- Coding:   glm-4.6 + key2 (同一智谱账号也行, 共用 key)
- Fast:     glm-4.6 + key3
- 知识树用 thinking, anim/game 用 coding 快 2-3 倍, 评判类用 fast

**场景 C (老 spec 019 用户)**:
- 启动时迁移: `creative → thinking` 改名 (key/url/model 都保留)
- coding / fast 自动写空 key 占位
- 用户登录后再去 /config 填即可

## 验收

- [x] `/config` 显示 4 张可编辑卡片 (Thinking / Coding / Fast / TTS)
- [x] 后端 `cfg.llm.providers` schema 含 thinking / coding / fast
- [x] 老 config (creative) 启动时自动迁移到 thinking
- [x] 路由按 spec 表分流, fallback 链工作
- [x] 各角色没配 key 时 fallback 不报错; planner 没配时 412
- [x] 单测 + 真实 LLM 验证一次
- [x] 部署 47.106.220.119
