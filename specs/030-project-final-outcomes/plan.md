# 030-project-final-outcomes Implementation Plan

**Status**: draft
**Date**: 2026-05-18
**Owner**: xinghan

## 实施策略

按 spec 的 3 阶段顺序: schema -> 数据 -> UI。

**关键判断**: 验证下假设, 减小不必要工作:
1. `library-app` 把 tree 存在 JSON 字段 -> 加字段不需要 DB migrate
2. `AsyncLibraryClient.get_project` 用 dict spread -> 透传自动带新字段
3. `library.getProject` API 已在 student-web ProjectHome 用 -> 只需类型 + 渲染

每阶段完成 commit, 不等三阶段全完。

## 现状盘点

### 数据 model

```python
# packages/core/src/systemedu/core/education/models.py
# 现有:
class KnodeInfo(BaseModel):       # Module 级
    acceptance_artifacts: list[dict]  # 已有, PurpleAir M01 填了 1 条
    outputs_produced: list[str]       # 已有, PurpleAir 全空
    hands_on_components: list[str]    # 已有

class StagePlanV2(BaseModel):     # Stage 级 (内部)
    deliverables: list[str]           # 已有, 但 v5 tree 用不上

class KnowledgeTreeV5(BaseModel): # 顶层
    schema_version: str
    title: str
    project_identity: dict            # ❌ 这里要加 final_outcomes
    target_learner: dict
    stages: list[StageV5]
    modules: list[KnodeInfo]
    edges: list
```

### library-app schema

```python
# packages/library-app/src/library/models.py
class Project:
    tree_json = Column(Text)   # 存整个 v5 tree JSON 字符串
    manifest_json = ...        # 存 manifest
    # 不结构化拆字段, 加 final_outcomes 不需要 ALTER TABLE
```

### API 链路

```
v5 tree.json
  └ project_identity: {slug, title, age_band, domain, ...}
  └ final_outcomes: [FinalOutcome]    ← 新增
  └ stages: [...]
  └ modules: [...]

library importer (importer.py)
  └ 读 tree.json 整个塞 tree_json column
  └ 生成 Project.title/slug/domain/... 等 indexed 字段

library API /v1/projects/{slug}
  └ 当前返 Project model 字段 + tree
  └ 需确认 response 是否含 final_outcomes (tree 内有就有)

systemedu.core.library_client.ProjectMeta dataclass
  └ from_dict 解析 library response
  └ 加 final_outcomes 字段

student-app /api/library/projects/{slug}
  └ 透传 library_client.get_project (dict)
  └ 自动带新字段

student-web lib/api LibraryProjectSummary
  └ TypeScript 类型加字段
  └ ProjectHome §02 用真数据
```

### ProjectHome §02 当前 stub

```tsx
// packages/student-web/src/app/(home)/library/[slug]/page.tsx L? 
<Outcome t={modules.length > 0 ? `${modules.length} 个章节走完` : "全部章节走完"} sub="按知识树顺序完成"/>
<Outcome t="AI 助教共学记录" sub="苏格拉底式问答陪伴整个项目"/>
<Outcome t={`${duration_weeks} 周完整学习路径`} sub="按节奏 weekly 推进"/>
<Outcome t="项目成果交付" sub="动手输出 + 作业提交"/>
```

要换成真数据 + kind icon + evidence 显示。

## Phase 1: schema + 后端 (~ 1.5h)

### Step 1.1: 加 FinalOutcome model
- `packages/core/src/systemedu/core/education/models.py` 顶部加:
  ```python
  class FinalOutcome(BaseModel):
      title: str
      kind: Literal["capability", "artifact", "service", "publication"]
      description: str
      evidence: str | None = None
      related_stage_id: str | None = None
  ```
- 加到 `KnowledgeTreeV5`:
  ```python
  final_outcomes: list[FinalOutcome] = Field(default_factory=list)
  ```

### Step 1.2: validate_v5_tree 兼容

`packages/core/src/systemedu/core/education/services.py` `validate_v5_tree`
是 dict-level validator, 不强校验 FinalOutcome 结构 (optional 字段),
确认现有 validation 跑过 PurpleAir tree (有/没有 final_outcomes 都过)。

### Step 1.3: library-app 透传 final_outcomes

- 看 `packages/library-app/src/library/api.py` `/v1/projects/{slug}`
  实现, 现在返回什么?
- 如果 response 是 `Project.to_dict()` + tree merge, 检查
  `final_outcomes` 是否含在 tree 内、合并后透传
- 如果 response 用结构化 fields, 加 `final_outcomes` 显式 pass

### Step 1.4: ProjectMeta dataclass 加字段

`packages/core/src/systemedu/core/library_client/client.py`:
```python
@dataclass
class ProjectMeta:
    ...existing...
    final_outcomes: list[dict] = field(default_factory=list)  # dict 而非 FinalOutcome,
                                                              # 避免跨包 import
```

`from_dict` 加:
```python
final_outcomes=d.get("final_outcomes") or [],
```

### Step 1.5: pytest

- `tests/test_library_client.py`: getProject 返新字段 (mock library response)
- `tests/student/test_library_proxy.py`: /api/library/projects/{slug} 透传含 final_outcomes
- 可选: schema validate test (PurpleAir tree 加假 final_outcomes 不报错)

### P1 收尾
- `feat(030-P1): final_outcomes schema + library API 透传`

## Phase 2: PurpleAir 反向回填 + 重新 import (~ 1h)

### Step 2.1: 手动编辑 tree.json

`content-workspace/generated/purpleair-airquality-node/tree/knowledge_tree.json`:
顶层加 final_outcomes (从 blueprint Learning Outcomes 抽 5 条):

```json
{
  "schema_version": "5.0",
  ...,
  "project_identity": { ... },
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
      "title": "讲清空气质量科学的能力",
      "kind": "capability",
      "description": "PM2.5/PM10 是什么、AQI 怎么算、湿度校正为什么需要",
      "evidence": "5 分钟 demo 视频解释",
      "related_stage_id": "S1"
    }
  ],
  "stages": [...],
  ...
}
```

### Step 2.2: 重新 build tarball

`tools/content-pipeline/compile.py` 或手动重做:
1. 重新算 manifest 里所有 file sha256
2. 重新 tar.gz
3. 输出 `content-workspace/dist/purpleair-airquality-node-0.3.1.tar.gz` (bump 版本)

### Step 2.3: 重新 import + publish

```bash
ADMIN_TOKEN=$(curl ... admin/auth/login ...)
# 删老的或 import overwrite (看 importer 支持哪个)
curl -X POST :18821/admin/projects/import \
  -F "file=@purpleair-airquality-node-0.3.1.tar.gz"
curl -X POST :18821/admin/projects/purpleair-airquality-node/publish
```

### Step 2.4: 验证 API 返新字段

```bash
curl :18820/api/library/projects/purpleair-airquality-node | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('final_outcomes'))"
```
期望返回 5 条 FinalOutcome dict。

### P2 收尾
- `feat(030-P2): PurpleAir 反向回填 5 条 final_outcomes`

## Phase 3: student-web ProjectHome §02 真数据 (~ 1h)

### Step 3.1: TypeScript 类型

`packages/student-web/src/lib/api/index.ts`:
```ts
export type FinalOutcomeKind = "capability" | "artifact" | "service" | "publication"

export interface FinalOutcome {
  title: string
  kind: FinalOutcomeKind
  description: string
  evidence?: string | null
  related_stage_id?: string | null
}

export interface LibraryProjectSummary {
  ...existing...
  final_outcomes?: FinalOutcome[] | null
}
```

### Step 3.2: ProjectHome §02 渲染

`packages/student-web/src/app/(home)/library/[slug]/page.tsx`:
- 加 KIND_ICON 映射:
  - capability → GraduationCap
  - artifact → Wrench
  - service → Globe
  - publication → FileText
- 加 KIND_LABEL 映射 (中文)
- §02 替换 Outcome stub 为 FinalOutcomeCard
- 卡片: icon (round soft bg) + title + description + evidence (mono 小字)
- related_stage_id 显示成 chip (例如 `S3`)
- 老项目 (final_outcomes 空) → 退回原 stub 占位
- evidence 显示策略: 默认下方常驻 (你选: 不 hover, 跟设计稿 Outcome 卡风格一致)

### Step 3.3: 浏览器验证

- /library/purpleair-airquality-node 看到 5 张卡, 每张含 evidence
- 老项目 (如无 final_outcomes 的) 看到旧 stub
- 截图留档

### P3 收尾
- `feat(030-P3): ProjectHome §02 真数据渲染 (FinalOutcome 5 类)`

## 影响 / 风险

| 风险 | 缓解 |
|------|------|
| library-app importer 不接受新字段直接报 422 | Step 1.3 前先看 importer pydantic validation; 必要时改 |
| 重新 build tarball 时 sha256 漏算导致 import fail | 走 tools/content-pipeline/compile.py 自动重算, 不手动 |
| 学生缓存了老 ProjectMeta API response 看到老数据 | Pull HMR + 不 cache; 生产 deploy 用 cache-bust |
| 老 cloud-app web 不知道 final_outcomes 字段 | 不动它, 它仍能渲染 (extra 字段被忽略) |
| 改 ProjectMeta dataclass 老 cloud-app code 也要兼容 | dataclass 加 default factory 字段 = 向后兼容 |

## 验收 (从 spec 抄)

- [ ] v5 tree schema 加 `final_outcomes` 字段 + Pydantic FinalOutcome
- [ ] PurpleAir tree.json 含 5 条 final_outcomes
- [ ] `curl :18821/v1/projects/purpleair-airquality-node` 返 final_outcomes 非空
- [ ] /library/purpleair-airquality-node §02 显示 5 张产出卡 (非 stub)
- [ ] 每张卡: kind icon + title + description + evidence
- [ ] 老项目无 final_outcomes 退回 stub
- [ ] pytest 全过
- [ ] 老 cloud-app create_app() 回归 OK

## 实施顺序

| Phase | 估时 | 输出 |
|-------|------|------|
| P1 schema + 后端 | 1.5h | model + library 透传 + pytest |
| P2 PurpleAir 回填 + import | 1h | 新 tarball published, API 返新字段 |
| P3 student-web §02 | 1h | UI 真数据 + 5 类 icon |
| **总计** | **~ 3.5h** | shipped |
