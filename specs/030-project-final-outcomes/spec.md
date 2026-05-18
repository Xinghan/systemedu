# 030-project-final-outcomes

**Status**: draft
**Owner**: xinghan
**Created**: 2026-05-18

## 背景 / 问题

PurpleAir 项目 (purpleair-airquality-node) 的 blueprint README.md
**人写好了**完整的产出物描述:

```
## Learning Outcomes
- 项目结束时,孩子能讲清 PM2.5 / PM10 是什么...
- 项目结束时,孩子能用 UART 读 PMS5003...
- ...

## Syllabus
- W1: 成果 — ... 产出物: 一页总结
- W2: 成果 — 装好 Pi Zero。产出物: SSH 访问
- ...
```

但**这些信息没被结构化**到 JSON 数据流:

| 数据源 | 现状 |
|---|---|
| blueprint README.md | ✅ 文字完整 (5 项 Learning Outcomes + 25 周产出物) |
| `knowledge_tree.json` 顶层 `project_identity` | ❌ 只有 slug/title/age/domain/weeks/hours/budget/difficulty |
| Module 级 `acceptance_artifacts` | ⚠️ 字段存在 (`models.py` L73), PurpleAir 部分填了 (M01 有 "对比照"), 大部分空 |
| Stage 级 `stage_output` / `deliverables` | ⚠️ 字段存在 (`models.py` L101, L214), tree 没填 |
| Module 级 `outputs_produced` | ⚠️ 字段存在 (`models.py` L76, L187), PurpleAir 全空 |
| library-app `/v1/projects/{slug}` API ProjectMeta | ❌ 不暴露 outcomes / deliverables |
| student-web `/library/[slug]` ProjectHome §02 "What you'll ship" | ❌ 用 stub (`${modules.length} 个章节走完` 等假数据) |

**学生看不到项目的具体最终产物**, 只能从 §01 About 文字里自己读。
这违反了教育产品的核心承诺: 学生 Pull 一个项目前应该清楚知道
"我学完了能交付什么"。

## 目标 / WHAT

在 v5 knowledge_tree schema 加 **`final_outcomes`** (项目级结构化产出物列表),
让 library-app API 暴露, student-web ProjectHome 显示真数据。

同时打通已有的:
- Stage 级 `stage_output` (现有字段, tree 没填)
- Module 级 `outputs_produced` (现有字段, tree 没填)
- Module 级 `acceptance_artifacts` (现有字段, 部分填)

让 ProjectHome 一页清楚展示"项目结束你交付什么 / 每个阶段交付什么 /
每个 module 产出什么 artifact"。

### 数据模型

```python
# tree 顶层 project_identity 同级新增字段
final_outcomes: list[FinalOutcome]

class FinalOutcome(BaseModel):
    """学生在项目结束时能交付的一项具体能力或制品."""
    title: str               # 例: "经过校准的 PM2.5 节点"
    kind: Literal[
        "capability",        # 能力 (能讲清 / 能算 / 能 debug)
        "artifact",          # 物理或数字制品 (sensor box / dashboard / dataset)
        "service",           # 上线运行的服务 (OpenAQ 注册节点 / 公开 API)
        "publication",       # 文档/写作 (field report / DOI 数据集)
    ]
    description: str         # 一句话描述
    evidence: str | None     # 可选, 如何证明 (验收方式)
    related_stage_id: str | None  # 关联到 stage
```

例 (PurpleAir):

```json
"final_outcomes": [
  {
    "title": "经过 EPA 校正的 PM2.5 节点",
    "kind": "artifact",
    "description": "Raspberry Pi + PMS5003 + BME280, 户外防水安装",
    "evidence": "照片 + 7 天稳定数据 + 校正前后对比图",
    "related_stage_id": "S3"
  },
  {
    "title": "注册到 PurpleAir + OpenAQ 的公开节点",
    "kind": "service",
    "description": "在两个公共 API 上可查询的传感器",
    "evidence": "PurpleAir 地图链接 + OpenAQ 数据点",
    "related_stage_id": "S5"
  },
  {
    "title": "30 天数据集 + 与 EPA AirNow 交叉验证报告",
    "kind": "publication",
    "description": "GitHub dataset + 相关性/MAE/偏差分析",
    "evidence": "dataset.csv + validation-report.pdf",
    "related_stage_id": "S6"
  },
  {
    "title": "Zenodo DOI 数据集",
    "kind": "publication",
    "description": "可被科研引用的开放数据",
    "evidence": "Zenodo DOI 链接",
    "related_stage_id": "S6"
  },
  {
    "title": "能讲清空气质量科学的能力",
    "kind": "capability",
    "description": "PM2.5/PM10 是什么、AQI 怎么算、湿度校正为什么需要",
    "evidence": "5 分钟 demo 视频解释",
    "related_stage_id": "S1"
  }
]
```

## 非目标

- ❌ **不重写 course_factory 生成 pipeline** — 已有的 v5 tree 生成器
  (Claude Code 通过 SKILL.md 手动生成) 不动, 只在 schema 加字段, 通过手动
  填充 PurpleAir 反向回填
- ❌ **不强制要求所有现有项目重生成** — 字段是 optional, 老项目 = `[]`
  时 UI 显示 stub
- ❌ **不做"自动从 blueprint markdown 抽取 outcomes"的 LLM 提取流水线** —
  本 spec 只手动反向回填 PurpleAir, 抽取流水线留给 spec 031 (如果将来有
  10+ 老项目要批量补)
- ❌ **不做 stage / module 验收追踪 UI** — `acceptance_artifacts` 已有字段
  + UI 显示, 但学生交付 artifact 的提交在 spec 029 (notes & assignment) 做

## 用户故事 / 场景

### 学生在 Library 查看 PurpleAir 项目页

1. 学生进入 `/library/purpleair-airquality-node`
2. §02 "What you'll ship" 区显示 5 张卡:
   - 🛠 经过 EPA 校正的 PM2.5 节点 — 关联 §S3
   - 🌐 注册到 PurpleAir + OpenAQ 的公开节点 — 关联 §S5
   - 📄 30 天数据集 + 交叉验证报告 — 关联 §S6
   - 📊 Zenodo DOI 数据集 — 关联 §S6
   - 🎓 讲清空气质量科学的能力 — 关联 §S1
3. 每张卡的 evidence 字段是 hover 显示 (toolitp) 或下方 mono 小字
4. 学生点击卡片可定位到对应 stage (滚到 §03 Curriculum)

### 学生在学习页看到当前 stage 的产出

可选 (本 spec 不一定做): /learn 页 sticky header 加 "本 stage 终点:
经过校准的 PM2.5 节点" 提示卡, 让学生知道为什么学这个。

## API 设计

### library-app

`/v1/projects/{slug}` 返回的 ProjectMeta 加字段:

```json
{
  "slug": "purpleair-airquality-node",
  ...existing fields...,
  "final_outcomes": [
    { "title": "...", "kind": "...", "description": "...", "evidence": "...", "related_stage_id": "S3" }
  ]
}
```

### student-app library_proxy

透传不变 (`AsyncLibraryClient.get_project` 已经把 dict 原样转发,
新字段自动跟着出去)。

### student-web

`LibraryProjectSummary` 类型加 `final_outcomes?: FinalOutcome[]` 字段。
ProjectHome §02 从 stub 换真数据渲染。

## Schema 兼容

`final_outcomes` 是 optional, 默认 `[]`。

- 老项目 (没填) → student-web §02 退回 stub 显示
- 新项目 (有填) → §02 显示真数据
- library-app 现有 SQL schema 用 JSON column (`tree_json` 已是 JSONB-like
  text) 存整个 tree, 不需要 migrate

## 影响面

| 文件 / 目录 | 改动 |
|------------|------|
| `packages/core/src/systemedu/core/education/models.py` | 加 `FinalOutcome` model + `KnowledgeTreeV5.final_outcomes` 字段 |
| `packages/core/src/systemedu/core/education/services.py` validate_v5_tree | 接受 final_outcomes (optional, 不强校验) |
| `packages/library-app/src/library/models.py` Project | (如果用 JSON column) 不动; 否则加 |
| `packages/library-app/src/library/api.py` `/v1/projects/{slug}` handler | 返回时把 tree.final_outcomes 加到 response |
| `packages/core/src/systemedu/core/library_client/client.py` ProjectMeta | 加 final_outcomes 字段 |
| `packages/student-web/src/lib/api/index.ts` LibraryProjectSummary | 加 final_outcomes 类型 |
| `packages/student-web/src/app/(home)/library/[slug]/page.tsx` §02 | 从 stub 改真数据渲染, 加 kind icon + evidence |
| `content-workspace/generated/purpleair-airquality-node/tree/knowledge_tree.json` | 手动加 5 条 final_outcomes (从 blueprint Learning Outcomes 抽) |
| `content-workspace/generated/purpleair-airquality-node/manifest.json` | 重新生成 (含新 tree) |
| 重新 import + publish 到 library | 必须 |

## Phase 实施计划

### Phase 1: schema + 后端
1. core/education/models.py 加 `FinalOutcome` + `KnowledgeTreeV5.final_outcomes`
2. core/education/services.py validate_v5_tree 允许字段
3. library-app 把 final_outcomes 透传出 `/v1/projects/{slug}` response
4. core/library_client/client.py ProjectMeta 加字段
5. pytest: tree 加字段后 validate 通过 + library API 测试

### Phase 2: PurpleAir 反向回填 + import
1. 手动编辑 PurpleAir tree.json 加 5 条 final_outcomes (从 blueprint 抽)
2. 重新 build tarball (重新算 sha256)
3. 重新 import + publish 到 library-app
4. curl 确认 `/v1/projects/purpleair-airquality-node` 返新字段

### Phase 3: student-web UI
1. lib/api LibraryProjectSummary 加 final_outcomes 字段
2. ProjectHome §02 用真数据渲染 + kind icon (Wrench/Globe/FileText/Award/GraduationCap)
3. 卡片 hover 显示 evidence
4. 老项目 fallback stub
5. 浏览器手测 PurpleAir 项目页确认显示 5 条

## 验收

- [ ] v5 tree schema 加 `final_outcomes` 字段 + Pydantic model
- [ ] PurpleAir tree.json 含 5 条 final_outcomes
- [ ] `curl http://127.0.0.1:18821/v1/projects/purpleair-airquality-node`
      返回 final_outcomes 字段非空
- [ ] /library/purpleair-airquality-node 页 §02 显示 5 张产出卡 (不再是 stub)
- [ ] 每张卡显示 kind icon + title + description + evidence
- [ ] 老项目 (无 final_outcomes) 页面退回 stub 占位
- [ ] pytest 全过
- [ ] 老 cloud-app 回归 OK

## 关键约束

1. **不重启 course_factory pipeline** — Claude Code 通过 SKILL.md 手动
   生成新 tree 时, **要遵循新 schema 加 final_outcomes 段**, 但这是
   course_factory 文档层改动, 不强制
2. **手动反向回填只做 PurpleAir** — 其它老项目 (ai-ant-ethologist)
   暂不动, 学生看老项目时 §02 退回 stub
3. **library-app schema 不 migrate** — 假设 tree 用 JSON column 存, 加
   字段透传; 如果 DB 是结构化列, 需要小迁移

## 未来 spec

- **031 - blueprint -> tree LLM 抽取流水线**: 自动把 blueprint Learning
  Outcomes / 每周产出物 抽到 tree 结构化字段
- **032 - 学生提交 artifact 验收**: 关联 module.acceptance_artifacts,
  学生上传图片/dataset, AI 助教比对

## TODO (plan 阶段细化)

- evidence 字段是否要支持 markdown (含链接/图片)?
- kind 4 类是否够? 要不要加 "experience" (亲身体验过 X)?
- related_stage_id 必填还是可选? (优先弱关联, 不强校验)
- ProjectHome 卡片 hover 还是常驻显示 evidence?
- 当 final_outcomes 多 (>8 条) 时是否分页 / 折叠?
