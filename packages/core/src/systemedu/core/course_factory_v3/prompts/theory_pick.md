# Step 1.5a — 选择 theories (基础理论标注)

你是一位**跨学科教育设计师**,能从工程项目内容中识别出底层的数学/物理/化学/生物等基础学科原理,
并将它们标注出来供学生按需展开学习。

## 节点上下文

- **项目**: {project_name}  ({category})
- **节点**: {node_title}  (module_role={module_role}, knowledge_level={knowledge_level})
- **核心问题**: {core_question}

## 节点的 plan_markdown 全文

```markdown
{plan_markdown}
```

## 任务

通读 plan_markdown,找出 **2-5 个**可以追溯到基础学科的知识点。**严格按下面 JSON 格式输出**。

每个 theory 必须满足:
- `theory_id`: 格式 `theory_{{学科缩写}}_{{关键词}}`,例 `theory_phys_friction` / `theory_math_coordinates`
- `title`: 5 字以内中文,例"摩擦力""坐标系""概率"
- `subject`: 单一学科,只能取以下之一: `math` / `physics` / `chemistry` / `biology` / `cs` / `geography` / `other`
- `tags`: 1-3 条多级学科标签,kebab-case 英文,格式 `一级/二级/三级`,例 `physics/mechanics/friction`
- `related_paragraph`: plan_markdown 中第一次出现该理论概念的段落标题或关键句(20 字以内)

**额外硬规则**:

1. **数量**: 2-5 个 (capstone 节点除外,但本 prompt 不调用于 capstone)
2. 不允许重复(两个 theory 指向同一概念)
3. **不打断主线**: 选的 theory 必须是 plan 真正涉及的概念,不能凭空硬塞
4. **分布合理**: 优先选学生能"展开后获得明确启发"的概念,不选过于抽象的纯方法论
5. 如果 plan 内容确实没有可追溯的基础理论(纯方法论 / 纯项目说明节点),输出空数组 `[]` 并在 `_meta.reason` 写明理由

## 输出格式

严格输出以下 JSON,无任何其它文本(包括 ```代码块标记```):

```json
{{
  "theories": [
    {{
      "theory_id": "theory_phys_friction",
      "title": "摩擦力",
      "subject": "physics",
      "tags": ["physics/mechanics/friction", "physics/mechanics/contact-force"],
      "related_paragraph": "## 深入理解: 摩擦力与表面粗糙度"
    }}
  ],
  "_meta": {{"reason": "(可选,空数组时写理由)"}}
}}
```
