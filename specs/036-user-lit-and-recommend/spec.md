# 036-user-lit-and-recommend

**Status**: shipped (2026-05-27) — user_knode_complete 表 + 4 API + KnodeCompleteButton + UserKnowledgeTreeView + RecommendNextProjects 全部上线. /memory 页加 "知识图谱" tab. 16/16 测试 PASS. 待实战: 跑 alembic upgrade + 登录手动验证 (PG 跑 + library v0.13.1 已上 OK).
**Owner**: Xinghan Cui
**Created**: 2026-05-27

## 背景 / 问题

spec 035 已经搭好"项目级知识点亮"的底座: 每个项目跑 lit_tree CLI 算出 manifest.lit_nodes (本项目教过的平台树节点列表), 在项目详情页 §04 用 SVG 渲染. 但这是**静态的项目数据**, 跟用户无关 — 任何人打开 purpleair 详情页都看到一样的 30 个点亮节点.

学生 (以及家长) 真正想知道的是 **"我"** 学到哪了:
- 我做了 purpleair + ai-ant 两个项目, 现在掌握了多少 platform 节点?
- 在 math 学科我点亮了多少 / 总共多少?
- 我下一个该做哪个项目, 才能继续覆盖更多新概念?

这些都是**用户维度**的, 需要 per-user 持久化:
- 哪个 knode 做完了 (用户的"完成"动作)
- 累计点亮了哪些 platform 节点 (= ∪ 完成的 knodes 各自项目教过的 lit_nodes 中**该 knode 教的部分**)
- 跨项目聚合统计

spec 035 钉死的边界: **036 做用户级 + 跨项目个人聚合 + 下一项目推荐**. 035 已经把项目级数据存 library, 036 在 student-app 加 per-user 表 + API + 前端聚合视图.

## 这次要做什么 (WHAT)

引入 3 个能力:

### 1. knode 完成状态 (per-user, 可 toggle)

学生在 knode 学习页加一个 **"标记完成"** 按钮:
- 点击 → 该 knode 标 complete, 后端写 `user_knode_complete` 表
- 再点 → toggle 回 incomplete (撤销学习记录)
- 学习页右上显示一个 ✓/○ 状态指示
- 完成的 knode 在项目详情页 Curriculum 列表里加视觉标记 (灰色 + 勾)

### 2. 用户级知识点亮 (跨项目自动聚合)

后端按 user 算出 **该用户点亮的 platform 节点列表**:

```
user_lit_nodes(user_id) = ⋃ {
  lit_node ∈ project.manifest.lit_nodes
  | project = knode 所属项目, 且 lit_node.lit_by 包含该 knode_id
  | (user_id, project_slug, knode_id) ∈ user_knode_complete
}
```

(用 SQL view 或 query-time aggregation, 不存第二张表 — 因为可 toggle, 派生数据存了就会跟不上)

API: `GET /api/user/knowledge-tree` 返回:
```json
{
  "lit_nodes": [
    {"node_id": "math.algebra.piecewise_func",
     "lit_by_projects": [
       {"slug": "purpleair-airquality-node", "lit_by_knodes": ["M05"]}
     ]
    }
  ],
  "subjects_summary": [
    {"subject_id": "math", "lit_count": 12, "total_count": 60, "percent": 20}
  ]
}
```

### 3. /memory 页加 "知识图谱" tab

`/memory` 页现有结构: 五层 memory inject 展示 (project_fact / chat_history / ... — spec 031). 加新 tab "知识图谱":

- **顶部 summary**: 你已点亮 X / 425 节点 (X% 平台覆盖)
- **学科 chip**: 11 学科横排, 每个显示 "math (12/60, 20%)" — 跟 spec 035 项目详情页同款 chip 但是**跨项目聚合**
- **主区 SVG**: 选定学科子树, 点亮节点 coral (复用 spec 035 KnowledgeTreeView 组件, 加 `mode="user"` prop 让 tooltip 显示 "在 purpleair M05 / ai-ant M12 学的" 多项目来源)
- **底部推荐区**: "你下一个该做的 3 个项目", 每张卡片说明"能让你新点亮 N 个节点 (主要在 chem / bio)"

### 4. 下一项目推荐 (简单版)

算法 (036 第一版, 守质版留给 spec 037):
```python
def recommend_next_projects(user_id, top_n=3):
    user_lit = set(get_user_lit_node_ids(user_id))
    all_projects = list_published_projects()  # 排除用户做过的
    scored = []
    for p in all_projects:
        p_lit = set(n.node_id for n in p.manifest.lit_nodes)
        new_nodes = p_lit - user_lit          # 该项目能新点亮的节点
        scored.append((p, len(new_nodes), new_nodes))
    return sorted(scored, key=lambda x: -x[1])[:top_n]
```

输出: 每项目"能让你新点亮 N 个节点" + 新节点分布 (例 "主要在 chem 5 + bio 3"). 简单粗暴但有效.

## 不做什么 (NON-GOALS)

- 不做 "信念分级" (例 "你完成 M05 但只点亮 piecewise_func 50%, 因为没做 exercise"). 完成 = 全部点亮该 knode 教的节点, 不分 50/100%. spec 037 可加 mastery level.
- 不做 "守质版推荐" (考虑项目难度 / 用户能力 / prereq 链). 那是 spec 037.
- 不做 "学习路径规划" (给出"你要点亮 math.calc.derivative 需做这 3 个项目的顺序"). spec 038.
- 不做 user_knode_complete 的进度可视化 (例 "你完成 18/30 节, 67%"). 037 可加.
- 不做家长面板 / 班级聚合. spec 040+.
- knode 完成动作**不**反向影响 mastery / streak / xp 之类 gamification. 那是 spec 050+.

## 验收 (Acceptance)

### knode 完成 + toggle
- [ ] knode 学习页有"标记完成 / 撤销完成"按钮, click 写后端
- [ ] 项目详情页 Curriculum 列表完成节点显示勾标记
- [ ] DB 表 `user_knode_complete (user_id, project_slug, knode_id, completed_at)` 唯一约束 + 索引

### 用户级点亮 API
- [ ] `GET /api/user/knowledge-tree` 返回 lit_nodes (跨项目聚合) + subjects_summary (每学科覆盖率)
- [ ] toggle complete 后, 该 API 实时反映变化 (查询时计算)
- [ ] 老 user (无任何完成) 返回空 lit_nodes + 11 学科全 0/N

### /memory 页 "知识图谱" tab
- [ ] /memory 页加新 tab, 默认显示 SVG 树 (复用 KnowledgeTreeView, mode="user")
- [ ] 学科 chip 显示 lit/total 比例 + click 切换子树
- [ ] hover 节点 tooltip 显示多项目来源 ("在 purpleair M05 / ai-ant M12 学的")
- [ ] 底部 "推荐下 3 项目" 区, 每张卡含 项目封面 + "能新点亮 N 节点" + click 跳项目详情

### 推荐 API
- [ ] `GET /api/user/recommendations?limit=3` 返回 3 个项目 (排除已做过的, 按"新点亮节点数"降序)
- [ ] 每项目附 `new_nodes_count` + `new_nodes_subjects` (例 `{"chem": 5, "bio": 3}`)

### 测试
- [ ] pytest 跑通: `tests/test_user_lit_nodes.py` + `tests/test_recommend.py`
- [ ] 集成测试: 模拟用户完成 purpleair 全 18 节, 验证 user_lit_nodes ≥ 30 + ai-ant 推荐能新点亮 X 个

## 风险

- **R1: query-time 聚合性能** — 每次调 user/knowledge-tree 都要查 user_knode_complete + 所有相关 project.manifest.lit_nodes. 缓解: 简单 SQL JOIN (用户做过 100 节 × 每节 10 个 lit_nodes = 1000 行扫描, 不慢). 如有性能问题, spec 037 可加 redis 缓存.
- **R2: 用户撤销 complete 时, 用户级点亮也应该跟着减** — query-time 聚合天然支持. 不会出现"撤销后还显示点亮"bug.
- **R3: 推荐质量低 (036 简单版)** — 接受第一版"差集最大"算法可能推荐难度过高的项目. spec 037 加 difficulty + prereq 校验.
- **R4: 跨项目 lit_node 重复** — 如果 purpleair 和 ai-ant 都教了 math.linear_func, 用户做完两项目 → 该节点 lit_by_projects 应是 2 个 entry. 不是 bug, 是 feature (显示"你在两个项目都接触过, 强化了").

## 相关
- spec 035: 项目级 lit_nodes + 平台知识树 baseline
- spec 037 (未来): 推荐守质版 + mastery level + 学习路径
- spec 040+ (未来): 家长面板 / 班级聚合
