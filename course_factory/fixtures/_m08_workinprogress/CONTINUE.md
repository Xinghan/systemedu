# M08 课程生成 — context 压缩后接力指南

**slug**: purpleair-airquality-node
**module_id**: M08
**dir**: M08-w0-5  (在 content-workspace/generated/purpleair-airquality-node/knodes/)
**title**: 电与焊接安全：万用表 5 分钟入门 + 电平转换概念
**core_question**: 为什么 5V 接到 3.3V 的 Pi 引脚上会烧板？

## 已完成步骤

| Step | 状态 | 产物位置 |
|---|---|---|
| 0 加载 ctx | ✅ | (内存) |
| 0.5 Tavily 研究 | ✅ | /tmp/m08_research.pkl (5 yt + 6 web) |
| 0.7 LabXchange | ✅ | /tmp/m08_labxchange.pkl (4 命中) |
| 1 plan_markdown | ✅ | /tmp/m08_work/plan.md (~1500 字) |

## 待完成

### Step 1.5 theories — 必须写 3 个
plan.md 已埋 3 个 placeholder:
- `[[THEORY:theory_voltage_current_resistance]]` — 欧姆定律 V=IR (subject: physics)
- `[[THEORY:theory_solder_basics]]` — 焊锡的物理化学 + 助焊剂 (subject: chemistry)
- `[[THEORY:theory_voltage_divider]]` — 分压公式 V_out=V_in×R2/(R1+R2) (subject: physics/math)

每个 theory schema:
```json
{
  "theory_id": "...",
  "title": "...",
  "subject": "physics|math|chemistry|biology",
  "tags": [],
  "body_markdown": "总览 200 字",
  "level_bodies": [
    {"level": "K1", "body_markdown": "..."},  // 必有
    {"level": "K2", "body_markdown": "..."}   // 可选
  ],
  "exercises": [
    {
      "question": "...",
      "options": ["A...", "B...", "C...", "D..."],
      "correct": 0,
      "explanation": "..."
    }
  ],  // 1-3 题
  "related_paragraph": "对应 plan_markdown 哪段"
}
```

### Step 2 ideas — 5 个
plan.md 已埋 placeholder:
1. `[[IDEA:anim_multimeter_three_dials]]` — animation, 万用表三档动态演示
2. `[[IDEA:game_voltage_detective]]` — game, 拿万用表测虚拟电路找故障
3. `[[IDEA:image_soldering_safety_grip]]` — image, 烙铁正确握法照片 (Tavily 图)
4. `[[IDEA:anim_voltage_divider_water]]` — animation, 分压电路用水流比喻
5. `[[IDEA:game_resistor_divider_lab]]` — game, 选电阻搭分压电路验证 V_out
6. `[[IDEA:kit_m08_electronics_starter]]` — hands_on_kit, 万用表+烙铁+电阻+面包板入门套装 (~120元)

### Step 2.5/2.6 Ideation
对每个 anim/game 出 3 个候选方案 + 4 问 (Subtract/Replay/Surprise/Aha)。
**接力时**: 用 sub-agent 并行设计 2 个 animation + 2 个 game。

### Step 3 detailed_description
每个 idea 描述交互/数据结构/视觉。

### Step 4 Debate
确认 6 个 idea 是否都保留 / 拒绝哪个。

### Step 5 实现 (这是最长的)
- 2 个 animation HTML (用 skeleton + runtime, AESTHETIC.md `mech` 主题更适合电路类)
- 2 个 game HTML (类似)
- 1 个 image (复用 Tavily 找的 soldering 图, 或 SparkFun 教程图)
- 1 个 kit JSON (components + steps + total_cost_cny)
- exercises JSON (~10 题)

### Step 5.5 七道闸门
跑 course_factory/validate/verify/{animation,game,learn_page}.mjs

### Step 6 组装 + 写入 workspace
```python
from course_factory import make_course_content, save_knode_to_workspace

course_content = make_course_content(
    plan_markdown=open("/tmp/m08_work/plan.md").read(),
    theories=THEORIES,
    animation_htmls={...},
    game_htmls={...},
    image_urls={...},
    kits=[...],
    exercises=[...],
    research=pickle.load(open("/tmp/m08_research.pkl")),
    labxchange_results=pickle.load(open("/tmp/m08_labxchange.pkl")),
    knode=knode,
)
save_knode_to_workspace(ctx, course_content)
```

### Step 6.5 assignment
```python
from course_factory import generate_assignment
generate_assignment(...)
```

### Step 6.6 audio_scripts
```python
from course_factory import generate_audio_scripts
generate_audio_scripts(...)
```

### Step 7 写盘 + 验证
manifest.json 生成, ls 7 个文件: lesson.md / sections.json / theories.json / assignment.md / audio_scripts.json / media/ / manifest.json

### Step 8 publish
```bash
cd packages/library-app/src && uvicorn library.main:app --port 18821 (要起)
# 然后在 library-admin-ui :3001 import .tar.gz
# 或直接命令行 systemedu-content publish
```

## 设计参考样板

- 文件结构样板: content-workspace/generated/purpleair-airquality-node/knodes/M03-w0-aqi/
  - lesson.md / sections.json / theories.json / assignment.md / audio_scripts.json / media/*.html / manifest.json
- plan_markdown 文风样板: 同上 lesson.md
- AESTHETIC.md (course_factory/AESTHETIC.md): 26 套 theme palette, M08 用 `mech` 主题 (电路/工程)
- SKILL.md 完整规则: .claude/skills/course_factory/SKILL.md (1700+ 行)

## 注意事项 (来自 memory)

- plan_markdown 不能预合并 Tavily 视频 / 延伸阅读 — make_course_content 自动合并
- animation/game 不手写独立 HTML, 用 skeleton + runtime 模板
- 每个 knode 必须逐条 debate 8 类富媒体 (theory/anim/game/kit/image/diagram/yt/lx + 3d_object)
- 3d_object: M08 不适合 (不是物理硬件主题, reject)
- game 不能退化为填数字题, 必须真交互 (拖/滑/拼)
- canvas 父容器必须 display:flex + flex-direction:column
- AI 头像/配色: Industrial Atelier coral (#D97757), 不用 Lumina 紫
