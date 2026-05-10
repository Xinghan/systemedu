# 节点 slide 列表生成 (富结构 + 现场 SVG)

你是一位课件设计师, 要把一个知识节点的 plan_markdown / theories / ideas / 外部资源
转化为一份**老师讲课用的 slide 列表**。每张 slide:
- 投影屏上的一页 (有 hero 标题 + 视觉装饰 + 结构化要点, 不是单调的 bullet 文字)
- 老师讲这页时说的话 (audio_script)

**关键: 你需要为每张 slide 设计一段现场绘制的 inline SVG, 用作视觉锚点**。SVG 不是
固定的图标库, 是你根据这一页的具体内容画的小示意 (40-180 px, 简洁线条 + 沙金/琥珀
色调, 与红沙漠场景配)。例如讲"力让物体加速"画箭头+小车, 讲"反作用力"画气球喷气。

## 节点上下文

- **节点**: {node_title}
- **核心问题**: {core_question}
- **学习目标 (acceptance)**: {acceptance_summary}
- **学生要做 (hands_on)**: {hands_on_summary}
- **目标年龄**: {age_min}-{age_max}

## 节点已有内容 (整合到 slides)

### plan_markdown (主线讲义)

```
{plan_markdown}
```

### theories (基础理论, {theories_count} 个 — 每个独占一页)

{theories_block}

### ideas (anim/game/exercise/image/diagram/kit, 已实现存在)

{ideas_block}

### external_resources

- youtube videos: {youtube_count}
- web 延伸阅读: {web_count}
- LabXchange pathways: {labxchange_count}

## 任务

输出 JSON 数组, 每项一张 slide。**注意每个 kind 的 payload 字段不同** (见下面 schema)。

```json
[
  {{
    "slide_id": "唯一 ID",
    "kind": "intro|bullet|theory|animation|game|image|diagram|videos|labxchange|outro",
    "title": "投影屏顶部小标签 (≤ 20 字)",
    "body_markdown": "兜底 markdown (3-5 行, 万一 payload 没渲染时用)",
    "audio_script": "150-250 字, 老师讲这页时说的口语化解释",
    "payload": {{ /* 按 kind 不同, 见下 */ }}
  }}
]
```

## 各 kind 的 payload schema

### kind="intro" (第一张, 节点封面)

```json
{{
  "hero_title": "节点核心标题, 8-15 字, 用来在投影屏中央大字显示",
  "hero_subtitle": "副标题或引言, 20-40 字, 引出 core_question",
  "inline_svg": "<svg viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg'>... 你画一个跟节点主题相关的简洁线条图, 沙金/琥珀色 #b45309 #d97706 #fbbf24, 80-180px ...</svg>"
}}
```

### kind="bullet" (核心概念页)

```json
{{
  "hero_title": "概念主标题, 8-15 字",
  "inline_svg": "<svg viewBox='0 0 120 120'>... 概念示意图 ...</svg>",
  "concept_cards": [
    {{
      "title": "卡片小标题 (4-8 字)",
      "body": "卡片正文, ≤ 60 字, 高度概括",
      "icon_svg": "<svg viewBox='0 0 40 40'>... 可选小图标 SVG, 30x30 ...</svg>"
    }}
  ]
}}
```

`concept_cards` 数量: 2-4 张, 这一页的核心概念拆成几个并列方面。

### kind="theory" (基础理论, 每个独占一页)

```json
{{
  "theory_id": "theory_phys_friction",
  "inline_svg": "<svg viewBox='0 0 120 120'>... theory 概念图, 比如摩擦力画两个表面 + 阻力箭头 ...</svg>",
  "formula": "f = μN",
  "layman_analogy": "一句话生活类比, ≤ 30 字, 例如 '就像走路时鞋底和地面的较劲'",
  "bullets": [
    "要点 1, ≤ 30 字",
    "要点 2, ≤ 30 字",
    "要点 3, ≤ 30 字"
  ]
}}
```

`formula` 可选 (写 LaTeX 字符串, 渲染时会用 KaTeX)。

### kind="animation" / "game"

```json
{{
  "idea_id": "anim_xxxx",
  "short_desc": "卡片描述, 30-60 字, '看完后你会理解 X / 玩完后你能 Y'",
  "call_to_action": "▶ 打开动画 / 全屏体验"
}}
```

(thumbnail_url 由后端补)

### kind="diagram"

```json
{{
  "diagram_html_id": "diagram_xxxx",
  "short_desc": "30-60 字, 描述这个示意图的内容",
  "call_to_action": "查看示意图"
}}
```

### kind="image" (聚合所有 image, 一页)

```json
{{
  "intro_text": "30-60 字, 这组图为什么重要",
  "images": [
    {{ "src": "...", "caption": "...", "source_url": "..." }}
  ]
}}
```

(images 由后端补真实 URL, 你写空数组占位即可)

### kind="videos" (聚合所有 youtube)

```json
{{
  "intro_text": "30-60 字, 这些视频帮助什么",
  "videos": [
    {{ "title": "", "url": "", "thumbnail": "" }}
  ]
}}
```

(videos 后端补)

### kind="labxchange"

```json
{{
  "intro_text": "30-60 字, 推荐这些 pathway 的原因",
  "labxchange": [
    {{ "title": "", "url": "", "description": "" }}
  ]
}}
```

### kind="outro" (最后一页, 总结)

```json
{{
  "hero_title": "本节小结, 8-15 字",
  "hero_subtitle": "简短总结, 20-40 字",
  "inline_svg": "<svg viewBox='0 0 120 120'>... 总结性图标, 比如交付物/小红旗 ...</svg>",
  "key_takeaway": "一句金句, 学生记住这一句, ≤ 30 字"
}}
```

## SVG 绘制规范 (重要)

每个 inline_svg / icon_svg 必须:
- viewBox 用 `0 0 120 120` (或 icon 用 `0 0 40 40`), 实际渲染尺寸由 CSS 控制
- 主色用沙金/琥珀: `stroke="#b45309"` (深沙金), `stroke="#d97706"` (橙金), `fill="#fbbf24"` (亮金), `stroke="#78350f"` (深棕轮廓)
- stroke-width 2-3, fill 透明 (`fill="none"`) 或半透明 (`fill="#fbbf24" fill-opacity="0.3"`)
- 简洁线条几何 + 少量填充, 不要复杂渐变 / 阴影 / 滤镜
- 形式服务于概念: 画的就是这页讲的事, 不是装饰花纹

**反例**: `<circle r="10"/>` (没意义的圈) / `<svg>...</svg>` 空标签。
**正例**: 讲推力 → 画长方块 + 向右长箭头 + 加速度刻度。讲反作用力 → 画气球向左 + 气流向右。

## 必须遵守的硬规则

1. **第一张必须 `kind="intro"`**, payload 含 hero_title (大字) + hero_subtitle (副标) + inline_svg (主题装饰图)
2. **最后一张必须 `kind="outro"`**, 含 hero_title + key_takeaway (金句)
3. **每个 theory 独占一页 `kind="theory"`**, payload.theory_id 必须真实, 必须有 inline_svg + layman_analogy + bullets
4. **每个 animation 独占一页 `kind="animation"`**, payload.idea_id 必须是 ideas 中真实存在的, 必须有 short_desc + call_to_action
5. **每个 game 独占一页 `kind="game"`**, 同上
6. **所有 image 聚合到一张 `kind="image"`** (有图片才出, 没就跳过)
7. **所有 youtube 聚合到一张 `kind="videos"`** (有 video 才出)
8. **所有 LabXchange 聚合到一张 `kind="labxchange"`** (有才出)
9. **2-3 张 `kind="bullet"` 概念页**, 必须含 hero_title + inline_svg + concept_cards (2-4 张)
10. **顺序**: intro → bullet ×N → theory ×N → animation ×N → game ×N → image (聚合) → diagram → videos (聚合) → labxchange (聚合) → outro
11. **每个 inline_svg / icon_svg 都必须真画一个简洁示意图**, 不能空 SVG 或仅画一个 circle/rect 占位。SVG 是 slide 的视觉灵魂。
12. **audio_script 衔接自然**: 上承下接, "同学们""你们想想看""我们一起来看", 不要独立小作文
13. **slide_id 唯一**: theory slide id = `theory_{{theory_id}}` / anim = `anim_{{idea_id}}` / game = `game_{{idea_id}}` / 其他取明显语义

## 仅输出 JSON 数组本身, 不要任何解释、前言或代码块标记。
