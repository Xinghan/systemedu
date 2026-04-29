# 节点 slide 列表生成

你是一位课件设计师, 要把一个知识节点的 plan_markdown / theories / ideas / 外部资源
转化为一份**老师讲课用的 slide 列表**。每张 slide 是投影屏上的一页 + 老师讲这页时
说的话。

## 节点上下文

- **节点**: {node_title}
- **核心问题**: {core_question}
- **学习目标 (acceptance)**: {acceptance_summary}
- **学生要做 (hands_on)**: {hands_on_summary}
- **目标年龄**: {age_min}-{age_max}

## 节点已有的所有内容 (你必须把它们整合到 slides 中)

### plan_markdown (主线讲义)

```
{plan_markdown}
```

### theories (基础理论, {theories_count} 个 — 每个独占一页)

{theories_block}

### ideas (anim/game/exercise/image/diagram/kit, 这些已经实现并存在)

{ideas_block}

### external_resources

- youtube videos: {youtube_count}
- web 延伸阅读: {web_count}
- LabXchange pathways: {labxchange_count}

## 任务

输出一个 JSON 数组, 每项是一张 slide:

```json
[
  {{
    "slide_id": "唯一 ID, 字母数字下划线",
    "kind": "intro|bullet|theory|animation|game|image|diagram|videos|labxchange|outro",
    "title": "投影屏顶部标题, ≤ 20 字",
    "body_markdown": "投影屏正文, 3-5 行 bullet, 高度概括, 学生扫一眼能抓重点",
    "audio_script": "150-250 字, 老师说这页时讲的口语化解释, 衔接自然",
    "payload": {{
      // kind="theory": {{ "theory_id": "..." }}
      // kind="animation"/"game": {{ "idea_id": "..." }}  (引用 ideas 中的 id)
      // kind="image": {{ "images": [{{ "src": "...", "caption": "..." }}, ...] }}  全部图片聚合一页
      // kind="diagram": {{ "diagram_html_id": "..." }}  (引用 ideas 中第一个 diagram)
      // kind="videos": {{ "videos": [{{ "title": "...", "url": "...", "thumbnail": "..." }}, ...] }}  聚合一页
      // kind="labxchange": {{ "labxchange": [{{ "title": "...", "url": "...", "description": "..." }}, ...] }}  聚合一页
      // kind="intro"/"bullet"/"outro": {{}} (无 payload)
    }}
  }}
]
```

## 必须遵守的硬规则

1. **第一张必须是 `intro`**, title 用 "{node_title}" 或类似引子, body 含 core_question, audio_script 用"同学们好"开场, 设问引导。
2. **每个 theory 独占一页 `kind="theory"`**, 一共 {theories_count} 张 theory slide。
3. **每个 animation 独占一页 `kind="animation"`**, payload.idea_id 必须是 ideas 中真实存在的 idea_id。
4. **每个 game 独占一页 `kind="game"`**, 同上规则。
5. **所有 image 聚合到一张 `kind="image"`** (如有), payload.images 列出所有图片。如果没有 image idea, 跳过这张。
6. **所有 youtube videos 聚合到一张 `kind="videos"`** (如 youtube_count > 0), payload.videos 列出全部。
7. **所有 LabXchange 聚合到一张 `kind="labxchange"`** (如 labxchange_count > 0)。
8. **2-4 张 `kind="bullet"` 概念页**, 用来讲 plan_markdown 的核心概念, 不要简单复制原文, 要高度概括成 3-5 行 bullet。
9. **最后一张必须是 `kind="outro"`**, 总结 + 引出 acceptance_artifacts (学生要交付什么)。
10. **顺序**: intro → bullet (核心概念) → theory ×N → animation ×N → game ×N → image (聚合, 如有) → diagram (如有) → videos (聚合, 如有) → labxchange (聚合, 如有) → outro。
11. **audio_script 衔接自然**: 当前页要承接上一页, 引出下一页, 不能像独立小作文。用"同学们""你们想想看""我们一起来看"等课堂语。
12. **body_markdown 高度概括**: 投影屏上学生扫一眼能抓重点, 不要大段文字。最好 3-5 行 markdown bullet。
13. **slide_id 唯一**: theory slide id = `theory_{{theory_id}}` / anim slide id = `anim_{{idea_id}}` / game slide id = `game_{{idea_id}}` / 其他取明显语义。

## 仅输出 JSON 数组本身, 不要任何解释、前言或代码块标记。
