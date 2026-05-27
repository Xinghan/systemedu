# 036 Plan — 用户级知识点亮 + 个人聚合 + 推荐项目

## 总体架构

```
┌───────────────────────────────────────────────────────────────────┐
│ student-app (port 18820, PG + Redis)                              │
│                                                                   │
│ DB 加 1 表:                                                      │
│   user_knode_complete (user_id, project_slug, knode_id,           │
│                        completed_at, library_version)             │
│   唯一约束 (user_id, project_slug, knode_id) + 索引 user_id       │
│                                                                   │
│ 新增 API:                                                         │
│   POST /api/my/knodes/{slug}/{knode_id}/complete   — toggle 完成  │
│   GET  /api/my/knodes/{slug}/complete-status       — 该项目已完成 │
│   GET  /api/user/knowledge-tree                    — 跨项目聚合   │
│   GET  /api/user/recommendations?limit=3           — 推荐下项目   │
│                                                                   │
│ 聚合算法 (query-time, 不存派生表):                                │
│   1. 查 user_knode_complete WHERE user_id=X                       │
│   2. for 每个 (slug, knode_id), fetch library /v1/projects/{slug}/│
│      knowledge-tree → lit_nodes (含 lit_by 字段)                  │
│   3. 取 lit_by 含该 knode_id 的 lit_node, 累加到 user_lit_nodes   │
│   4. 按 platform_tree 的 subject 分组, 算覆盖率                   │
└───────────────────────────────────────────────────────────────────┘
                                  ↓
┌───────────────────────────────────────────────────────────────────┐
│ student-web                                                       │
│                                                                   │
│ knode 学习页加 "标记完成" toggle 按钮 (右上 ✓/○)                  │
│ 项目详情页 Curriculum 列表完成节点 + 灰勾                         │
│ /memory 页加 "知识图谱" tab:                                      │
│   - 顶部 summary: X / 425 节点                                    │
│   - 学科 chip                                                     │
│   - SVG 子树 (复用 KnowledgeTreeView, mode="user")                │
│   - 底部推荐 3 项目卡                                             │
└───────────────────────────────────────────────────────────────────┘
```

## 技术方案

### 1. DB schema

新增表 `user_knode_complete` (`packages/student-app/src/systemedu/student/db.py`):

```python
class UserKnodeComplete(Base):
    """spec 036: 用户 knode 完成状态. 可 toggle (delete row = 撤销).

    无 ON_DELETE CASCADE 跟 library_version — 跨版本保留学习记录.
    """
    __tablename__ = "user_knode_complete"
    __table_args__ = (
        UniqueConstraint("user_id", "project_slug", "knode_id",
                         name="uq_user_knode_complete"),
        Index("ix_user_knode_complete_user", "user_id"),
        Index("ix_user_knode_complete_slug", "user_id", "project_slug"),
    )

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    project_slug = Column(String(128), nullable=False)
    knode_id = Column(String(64), nullable=False)        # M01 / M02 / ...
    library_version = Column(String(64), nullable=True)  # 完成时项目版本 (审计用)
    completed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
```

Migration: `alembic/versions/<rev>_036_add_user_knode_complete.py`
- upgrade: create_table + indexes
- downgrade: drop_table

### 2. API 端点

#### 2.1 POST `/api/my/knodes/{slug}/{knode_id}/complete` — toggle

```python
@require_login
async def api_knode_toggle_complete(request: Request) -> JSONResponse:
    user_id = request.state.user_id
    slug = request.path_params["slug"]
    knode_id = request.path_params["knode_id"]

    body = await request.json()
    action = body.get("action", "toggle")  # "complete" / "incomplete" / "toggle"

    with get_pg_session() as db:
        existing = db.query(UserKnodeComplete).filter_by(
            user_id=user_id, project_slug=slug, knode_id=knode_id).first()

        if action == "incomplete" or (action == "toggle" and existing):
            if existing:
                db.delete(existing)
            db.commit()
            return JSONResponse({"completed": False})
        else:
            if not existing:
                # 取当前 library_version (调 library_proxy)
                meta = await get_library_client().get_project(slug)
                row = UserKnodeComplete(
                    user_id=user_id, project_slug=slug, knode_id=knode_id,
                    library_version=meta.version,
                )
                db.add(row)
                db.commit()
            return JSONResponse({"completed": True})
```

#### 2.2 GET `/api/my/knodes/{slug}/complete-status` — 该项目所有完成节点

```python
async def api_knode_complete_status(request: Request) -> JSONResponse:
    user_id = request.state.user_id
    slug = request.path_params["slug"]
    with get_pg_session() as db:
        rows = db.query(UserKnodeComplete).filter_by(
            user_id=user_id, project_slug=slug).all()
    return JSONResponse({
        "slug": slug,
        "completed_knode_ids": [r.knode_id for r in rows],
    })
```

#### 2.3 GET `/api/user/knowledge-tree` — 跨项目聚合 (核心)

```python
async def api_user_knowledge_tree(request: Request) -> JSONResponse:
    user_id = request.state.user_id

    # 1. 查用户所有完成 knode (按 slug 分组)
    with get_pg_session() as db:
        rows = db.query(UserKnodeComplete).filter_by(user_id=user_id).all()
    completed_by_slug: dict[str, set[str]] = defaultdict(set)
    for r in rows:
        completed_by_slug[r.project_slug].add(r.knode_id)

    # 2. 对每个项目, fetch 其 lit_nodes
    user_lit_map: dict[str, dict] = {}  # node_id -> {lit_by_projects: [...]}
    lib = get_library_client()
    for slug, knode_ids in completed_by_slug.items():
        try:
            proj_kt = await lib.get_project_knowledge_tree(slug)
        except Exception:
            continue  # 项目可能下架, 跳过
        for lit in proj_kt.get("lit_nodes", []):
            # lit.lit_by 含哪些 knode 教了这个 node_id
            overlapping = set(lit["lit_by"]) & knode_ids
            if not overlapping:
                continue
            nid = lit["node_id"]
            if nid not in user_lit_map:
                user_lit_map[nid] = {"node_id": nid, "lit_by_projects": []}
            user_lit_map[nid]["lit_by_projects"].append({
                "slug": slug,
                "lit_by_knodes": sorted(overlapping),
            })

    # 3. subjects_summary (按 platform_tree.json 算覆盖率)
    platform_tree = await lib.get_platform_knowledge_tree()
    subjects_summary = []
    for s in platform_tree["subjects"]:
        total = len(s["nodes"])
        lit = sum(1 for n in s["nodes"] if n["id"] in user_lit_map)
        subjects_summary.append({
            "subject_id": s["id"],
            "subject_name_zh": s["name_zh"],
            "color": s["color"],
            "lit_count": lit,
            "total_count": total,
            "percent": round(lit * 100 / total, 1) if total else 0,
        })

    return JSONResponse({
        "user_id": user_id,
        "lit_nodes": list(user_lit_map.values()),
        "subjects_summary": subjects_summary,
        "total_lit": len(user_lit_map),
        "total_platform_nodes": sum(s["total_count"] for s in subjects_summary),
    })
```

#### 2.4 GET `/api/user/recommendations?limit=3` — 推荐 (简单版)

```python
async def api_user_recommendations(request: Request) -> JSONResponse:
    user_id = request.state.user_id
    limit = int(request.query_params.get("limit", 3))

    # 用户当前点亮节点集合
    user_kt = await _compute_user_lit_nodes(user_id)  # 内部复用 #2.3 的部分
    user_lit_ids = {n["node_id"] for n in user_kt["lit_nodes"]}

    # 已做过的项目 (有 UserKnodeComplete 记录) — 排除
    with get_pg_session() as db:
        done_slugs = {r.project_slug for r in db.query(UserKnodeComplete).filter_by(user_id=user_id).all()}

    lib = get_library_client()
    all_projects = await lib.list_projects()

    scored = []
    for p in all_projects:
        if p.slug in done_slugs:
            continue
        try:
            proj_kt = await lib.get_project_knowledge_tree(p.slug)
        except Exception:
            continue
        p_lit_ids = {n["node_id"] for n in proj_kt.get("lit_nodes", [])}
        new_ids = p_lit_ids - user_lit_ids
        if not new_ids:
            continue
        # 按 subject 分组
        new_by_subject = defaultdict(int)
        for nid in new_ids:
            new_by_subject[nid.split(".", 1)[0]] += 1
        scored.append({
            "slug": p.slug,
            "title_zh": p.title_zh,
            "cover_image_path": p.cover_image_path,
            "difficulty": p.difficulty,
            "new_nodes_count": len(new_ids),
            "new_nodes_subjects": dict(new_by_subject),
        })

    scored.sort(key=lambda x: -x["new_nodes_count"])
    return JSONResponse({"recommendations": scored[:limit]})
```

### 3. student-web 前端

#### 3.1 knode 学习页加 "标记完成" 按钮

`packages/student-web/src/app/(home)/library/[slug]/[knodeId]/page.tsx` (现有路由).
右上加 button:
```tsx
<KnodeCompleteButton slug={slug} knodeId={knodeId} />
```
组件状态: ✓ Done (coral) / ○ Mark complete (灰), click toggle 调 POST.

#### 3.2 项目详情页 Curriculum 完成节点视觉

`packages/student-web/src/app/(home)/library/[slug]/page.tsx` Curriculum 列表:
- 每节加完成状态 icon (灰勾 if completed)
- 取自 GET `/api/my/knodes/{slug}/complete-status` (页面加载时调一次)

#### 3.3 /memory 页加 "知识图谱" tab

`packages/student-web/src/app/(home)/memory/page.tsx` 现状: 五层 memory inject 展示.
加 tab bar (现有内容变 "Memory" tab + 新 "知识图谱" tab):

```tsx
<UserKnowledgeTreeView />
```

新组件 `packages/student-web/src/components/learning/UserKnowledgeTreeView.tsx`:
- 顶部 summary card: "你点亮了 X / 425 节点 (Y%)"
- 复用 spec 035 `KnowledgeTreeView` 组件 (传 mode="user" 给 prop, tooltip 显示多项目来源)
- 底部 `<RecommendNextProjects limit={3} />` 卡片

KnowledgeTreeView 改造 (轻量):
- 加 `mode?: "project" | "user"` prop (default "project")
- tooltip 文本: project mode 显示 "本项目 M_X 教了", user mode 显示 "在 purpleair M05 / ai-ant M12 学的" (循环 lit_by_projects)

### 4. API client (student-web)

`packages/student-web/src/lib/api/index.ts` 加 myKnodes namespace:

```typescript
export const myKnodes = {
  toggleComplete: (slug: string, knodeId: string, action: "toggle" | "complete" | "incomplete" = "toggle") =>
    api.post<{completed: boolean}>(`/api/my/knodes/${slug}/${knodeId}/complete`, {action}),
  getCompleteStatus: (slug: string) =>
    api.get<{slug: string; completed_knode_ids: string[]}>(`/api/my/knodes/${slug}/complete-status`),
}

export const userKnowledgeTree = {
  get: () => api.get<UserKnowledgeTreeResponse>(`/api/user/knowledge-tree`),
  recommendations: (limit = 3) =>
    api.get<{recommendations: ProjectRec[]}>(`/api/user/recommendations?limit=${limit}`),
}
```

## 文件清单

### 新增
- `packages/student-app/alembic/versions/<rev>_036_add_user_knode_complete.py`
- `packages/student-app/src/systemedu/student/catalog/user_lit.py` (新模块: 聚合逻辑 + 推荐)
- `packages/student-app/src/systemedu/student/catalog/user_lit_routes.py` (4 个新 route)
- `packages/student-web/src/components/learning/KnodeCompleteButton.tsx`
- `packages/student-web/src/components/learning/UserKnowledgeTreeView.tsx`
- `packages/student-web/src/components/learning/RecommendNextProjects.tsx`
- `tests/test_user_knode_complete.py` (DB + toggle API)
- `tests/test_user_lit_aggregate.py` (聚合算法)
- `tests/test_user_recommendations.py` (推荐算法)

### 修改
- `packages/student-app/src/systemedu/student/db.py` (+UserKnodeComplete model)
- `packages/student-app/src/systemedu/student/server.py` (+ROUTES merge)
- `packages/student-web/src/lib/api/index.ts` (+ myKnodes + userKnowledgeTree)
- `packages/student-web/src/app/(home)/library/[slug]/[knodeId]/page.tsx` (+ KnodeCompleteButton)
- `packages/student-web/src/app/(home)/library/[slug]/page.tsx` (+ 完成状态 icon)
- `packages/student-web/src/app/(home)/memory/page.tsx` (+ tab bar + UserKnowledgeTreeView)
- `packages/student-web/src/components/learning/KnowledgeTreeView.tsx` (+ mode prop)

## 影响面

- **student-app**: 加 1 表 + 4 端点, 不破坏现有 catalog / chat / memory 路由
- **student-web**: 项目详情 / knode 学习 / /memory 加 UI, 不破坏现有 layout
- **library**: 0 改动 (只 consumer 调 035 已有的 API)
- **生产**: 跑 alembic upgrade 头一次需要 schema migration

## 验收 (跟 spec.md 同步)

```bash
# 1. DB migration
cd packages/student-app && alembic upgrade head

# 2. 跑测试
python -m pytest tests/test_user_knode_complete.py tests/test_user_lit_aggregate.py tests/test_user_recommendations.py -v

# 3. 手动验证
# - 登录 student-web, 进 purpleair M01, click "标记完成"
# - 进 /memory → "知识图谱" tab, 看 env.mon.citizen_science 已点亮
# - 完成全 18 节, /memory 显示 30+ 点亮节点
# - 推荐区显示 3 个新项目, 按"新点亮数"排序
```

## 风险 + 缓解 (spec 已列)

- R1 性能: query-time 聚合, 用户做 100 节 × 每节 10 lit = 1000 row scan. 简单 SQL JOIN, < 50ms. 如有问题加 Redis cache.
- R2 toggle 撤销: query-time 天然支持
- R3 推荐 037 优化
- R4 跨项目重复: 是 feature

## 时间预算

- DB schema + migration + model + 测试: 1.5h
- 4 API 端点 + 测试: 3h
- KnodeCompleteButton + Curriculum icon 集成: 2h
- UserKnowledgeTreeView (复用 035 KnowledgeTreeView, +mode prop): 2h
- RecommendNextProjects 卡片组件: 1.5h
- /memory tab 集成: 1h
- 手动调通 + bug fix: 1.5h

**总计 ~12.5 小时**, 分 3-4 个 session.

## 实现顺序 (tasks.md 草拟)

1. DB schema + UserKnodeComplete model + alembic migration + 测试
2. toggle complete + complete-status API + 测试
3. user-knowledge-tree 聚合 API + 测试
4. recommendations 推荐 API + 测试
5. KnowledgeTreeView 加 mode prop (035 组件改造)
6. KnodeCompleteButton 组件 + knode 学习页集成
7. Curriculum 完成状态 icon
8. UserKnowledgeTreeView + RecommendNextProjects 组件
9. /memory 页加 tab + 集成
10. 手动调通 + 文档 + Status shipped
