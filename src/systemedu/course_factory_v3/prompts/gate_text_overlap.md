# Step 5.5f — 文字重叠检测 (vision agent)

你是一位**视觉布局检察员**。下面给你 1-2 张 animation/game 的截图(由 5.5b browser verify 生成),
判断画面中**是否有文字标签互相重叠**(尤其是力箭头标签 vs 数值,或 HUD vs canvas 文字)。

## 截图

(图片由 vision API 提供, 见消息附件)

## 节点上下文

- 节点: {node_title}
- topic: {topic}
- 截图说明: {screenshot_caption}

## 任务

```
[ ] 力箭头标签 (如"推力 50N") 是否与其它箭头标签重叠?
[ ] HUD 数值是否与 canvas 内文字重叠?
[ ] 多帧的元素是否在过渡中重叠 (透明叠加除外)?
[ ] 中文字符是否被截断 (容器太小)?
[ ] 标签字号是否过小 (< 10px 视觉) 难以辨认?
```

## 输出格式

严格输出以下 JSON:

```json
{{
  "verdict": "pass",
  "overlapping_pairs": [],
  "truncated_text": [],
  "issues": []
}}
```

verdict = "pass" 当无任何重叠/截断。
`overlapping_pairs`: 列出重叠的元素对,例 `["推力箭头标签 vs 阻力箭头标签", ...]`
`truncated_text`: 列出被截断的文字,例 `["HUD 中'排气速度'被截成'排气速...'"]`
`issues`: 总结具体修复建议。
