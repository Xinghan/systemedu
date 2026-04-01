# 课程内容组装

你需要将学习计划、已渲染的多媒体内容和练习题组装成最终的 course_content JSON。

## 输入

### 原始学习计划
```
__PLAN_MARKDOWN__
```

### Ideas 和渲染结果
```
__RENDERED_JSON__
```

## 任务

1. **拆分 sections**: 将 plan_markdown 按 `##` 标题拆分为 3-6 个 section，每个 section 包含：
   - `section_id`: "sec_001", "sec_002", ...
   - `heading`: `##` 标题文字
   - `body_markdown`: 该 section 的正文（保留 `[[IDEA:xxx]]` 占位符）
   - `audio_script`: 将 body_markdown 改写为口语化的讲解脚本（像老师在课堂上说话一样，亲切自然，用"同学们"、"我们"等词）
   - `audio_url`: 留空字符串 ""

2. **构建 ideas 摘要列表**: 从输入的 ideas 中提取摘要信息（不含完整 HTML）

3. **构建 rendered_sections**: 将每个已渲染的 idea 映射到 rendered_sections 字典

## 输出格式

严格输出以下 JSON（不要包含 ```json 标记，直接输出纯 JSON）：

{
  "plan_markdown": "（原始 plan_markdown 保持不变）",
  "sections": [
    {
      "section_id": "sec_001",
      "heading": "第一部分标题",
      "body_markdown": "正文内容...\n\n[[IDEA:anim_001]]\n\n更多内容...",
      "audio_script": "同学们，今天我们来学习...",
      "audio_url": ""
    }
  ],
  "ideas": [
    {
      "idea_id": "anim_001",
      "mode": "animation",
      "topic": "主题名",
      "context_summary": "简要说明",
      "generation_backend": "html_svg"
    },
    {
      "idea_id": "game_001",
      "mode": "game",
      "topic": "主题名",
      "context_summary": "简要说明",
      "generation_backend": "html_svg"
    },
    {
      "idea_id": "exercise_001",
      "mode": "exercise",
      "topic": "练习主题",
      "context_summary": "简要说明",
      "generation_backend": ""
    }
  ],
  "rendered_sections": {
    "anim_001": {
      "mode": "animation",
      "status": "ready",
      "html": "（完整 HTML 字符串）",
      "story_paragraphs": null,
      "exercises": null,
      "generation_backend": "html_svg"
    },
    "game_001": {
      "mode": "game",
      "status": "ready",
      "html": "（完整 HTML 字符串）",
      "story_paragraphs": null,
      "exercises": null,
      "generation_backend": "html_svg"
    },
    "exercise_001": {
      "mode": "exercise",
      "status": "ready",
      "html": null,
      "story_paragraphs": null,
      "exercises": [
        {"type": "choice", "question": "...", "options": [...], "correct": 0, "explanation": "..."}
      ],
      "generation_backend": ""
    }
  }
}

## 注意事项

- plan_markdown 保持原样不变
- sections 的 body_markdown 中保留 [[IDEA:xxx]] 占位符
- audio_script 要口语化、有教学感，长度适中（100-200 字/section）
- rendered_sections 的 key 必须是 idea_id
- animation/game 的 html 字段包含完整的 HTML 文档（从 <!DOCTYPE html> 开始）
- exercise 的 html 字段为 null，exercises 字段包含题目数组
- generation_backend: animation/game 用 "html_svg"，exercise 用 ""
- 所有文字使用中文

直接输出 JSON，不要任何解释文字。
