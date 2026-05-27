# 036 Tasks

## T1 DB schema + migration (1.5h)
- [ ] T1.1 db.py 加 `UserKnodeComplete` model (UniqueConstraint user_id+slug+knode_id, 2 索引)
- [ ] T1.2 alembic migration `<rev>_036_add_user_knode_complete.py` (upgrade/downgrade)
- [ ] T1.3 tests/test_user_knode_complete.py (insert / unique / delete / 索引)
- [ ] T1.4 跑测试 PASS

## T2 toggle + status API (1.5h)
- [ ] T2.1 catalog/user_lit_routes.py 新模块 (4 route 集中)
- [ ] T2.2 POST /api/my/knodes/{slug}/{knode_id}/complete (action=toggle/complete/incomplete)
- [ ] T2.3 GET /api/my/knodes/{slug}/complete-status
- [ ] T2.4 server.py 挂 ROUTES
- [ ] T2.5 测试 (toggle / status / 多用户隔离)

## T3 user-knowledge-tree 聚合 API (2h)
- [ ] T3.1 catalog/user_lit.py 新模块: `compute_user_lit_nodes(user_id)` 聚合函数
- [ ] T3.2 GET /api/user/knowledge-tree route
- [ ] T3.3 tests/test_user_lit_aggregate.py (mock library client, 多项目多 knode 聚合)

## T4 recommendations API (1.5h)
- [ ] T4.1 catalog/user_lit.py: `recommend_next_projects(user_id, limit)`
- [ ] T4.2 GET /api/user/recommendations route
- [ ] T4.3 tests/test_user_recommendations.py (排除已做项目 / 按新点亮数排序 / subject 分组)

## T5 KnowledgeTreeView 加 mode prop (035 改造, 1h)
- [ ] T5.1 `mode?: "project" | "user"` prop (default "project")
- [ ] T5.2 user mode: tooltip 显示多项目来源 (循环 lit_by_projects)
- [ ] T5.3 LitNodeEntry type 兼容 lit_by (project) + lit_by_projects (user)

## T6 KnodeCompleteButton + knode 学习页 (1.5h)
- [ ] T6.1 components/learning/KnodeCompleteButton.tsx (toggle, ✓/○ 状态)
- [ ] T6.2 lib/api/index.ts 加 myKnodes namespace
- [ ] T6.3 集成到 `/library/[slug]/[knodeId]/page.tsx` 右上

## T7 Curriculum 完成状态 icon (1h)
- [ ] T7.1 /library/[slug]/page.tsx Curriculum 加载时调 getCompleteStatus
- [ ] T7.2 已完成节点 + 灰勾 icon

## T8 UserKnowledgeTreeView + RecommendNextProjects (2h)
- [ ] T8.1 components/learning/UserKnowledgeTreeView.tsx (summary card + 复用 KnowledgeTreeView mode=user)
- [ ] T8.2 components/learning/RecommendNextProjects.tsx (3 张卡片)
- [ ] T8.3 lib/api/index.ts 加 userKnowledgeTree namespace + types

## T9 /memory 页 tab 集成 (1h)
- [ ] T9.1 /memory/page.tsx 加 tab bar (Memory | 知识图谱)
- [ ] T9.2 默认选 Memory (跟现有)
- [ ] T9.3 切换到 知识图谱 → 内嵌 UserKnowledgeTreeView

## T10 实战 + 文档 (1.5h)
- [ ] T10.1 手动: 登录, 完成 purpleair M01-M05 → /memory 验证 5 节点 + 推荐项目
- [ ] T10.2 docs/prd.md + SKILL.md 必要更新
- [ ] T10.3 spec.md Status → shipped
- [ ] T10.4 commit + push

## Definition of Done
所有 [ ] 勾完 + 测试全过 + 手动验证 + commit pushed.
