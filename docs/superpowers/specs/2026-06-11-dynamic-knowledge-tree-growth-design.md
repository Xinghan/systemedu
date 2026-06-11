# 动态知识树生长 设计文档 (spec 039)

- Status: draft (2026-06-11)
- Owner: Xinghan Cui
- 关联: spec 035 (平台知识树 425 节点), spec 036 (用户级点亮聚合), 学习大脑/三视图

## 背景 / 问题

现有知识树深度**固定三层**(学科 → 子域 → 概念叶), 全部来自静态 `platform_tree.json`
的 425 个节点 id (三段路径 `cs.ai.cnn`)。概念叶 (如"卷积神经网络") 是最细颗粒,
**往下点不开** —— 第三层对很多深入学习的场景仍太宏观。

需求: 让知识树能**动态往深处生长**。学完一个节点 / 问完一个问题 / 下钻一个问题时,
LLM 动态评估涉及的知识点, 若识别出比第三层更深的知识点 (第四层、第五层…), 就
**生长出新枝**; 缺失的中间层先补成灰色, 真学到的最深层点亮。这是用户个人知识树的
自然延伸 (呼应"灰树 + 点亮"理念, 只是树本身可生长)。

## 决策 (已与用户确认)

1. **归属: per-user**。生长节点是用户个人的, 存 student-app 新表; 每个学生树长得不同。
   **不动全局 platform_tree.json** (它是审定的公共骨架, 不被 LLM 随意改)。
2. **触发: 异步后台批量**。学完/提问/下钻产生的内容入队, 复用 fact_extractor worker
   模式 (5min tick), 后台 LLM 批量评估。不阻塞用户, 成本可控。
3. **定位: 给定父节点 + LLM 补路径**。评估时把该学科现有树路径 + 该用户已生长节点
   给 LLM 作上下文; LLM 必须把新节点挂在**已有节点下**, 并返回缺失的中间层逐级路径。
   不凭空挂。
4. **去重: LLM 语义对齐**。生长前把该用户已生长节点一并给 LLM, 已有同/近义节点则
   复用 (返回已有 id), 不新建。

## 数据模型 (student-app 新表, alembic 039)

```python
class GrownNode(Base):
    """用户个人知识树生长节点 (平台树第三层概念叶之下的动态深层节点)."""
    __tablename__ = "grown_nodes"
    id          = Column(String(36), primary_key=True)       # uuid
    user_id     = Column(String(36), ForeignKey(users.id), index=True)
    node_id     = Column(String(128))   # 生长路径 id, 如 cs.ai.cnn.kernel
    parent_id   = Column(String(128))   # 父: 平台树叶 (cs.ai.cnn) 或另一 GrownNode 的 node_id
    name_zh     = Column(String(128))   # LLM 生成中文名
    depth       = Column(Integer)       # 4 / 5 / ...
    lit         = Column(Boolean)       # 灰=补出的中间层(false) / 亮=真学到(true)
    source      = Column(String(32))    # complete_knode | question | drill
    created_at  = Column(DateTime)
    # 唯一: (user_id, node_id) — 同用户同路径不重建
```

```python
class PendingGrowth(Base):
    """生长评估队列 (仿 PendingExtraction)."""
    __tablename__ = "pending_growth"
    id          = Column(String(36), primary_key=True)
    user_id     = Column(String(36), index=True)
    source      = Column(String(32))    # complete_knode | question | drill
    content     = Column(Text)          # 触发内容 (knode 标题/lesson 摘要, 或 问题文本, 或 drill 高亮)
    subject_hint= Column(String(32), nullable=True)  # 可选: 已知学科 (完成 knode 时知道)
    status      = Column(String(16))    # pending | processing | done | failed
    created_at  = Column(DateTime)
```

## 生长管线 (异步 worker)

```
[触发入队]
  - 完成 knode (user_lit_routes toggle complete) → 入队 (source=complete_knode, content=knode标题+概念)
  - chat 提问 / drill 下钻 → 入队 (source=question/drill, content=问题/高亮文本)
       (挂在现有 chat session done / drill 创建处, 仿 pending_extraction 入队)

[grown worker] (复用 fact_extractor_worker 进程或新增, 5min tick)
  claim pending_growth → LLM 评估 → 写 GrownNode → mark done

[LLM 评估] (一次调用)
  输入:
    - 触发内容 (content)
    - 相关学科现有树路径 (platform_tree 该学科 + 该用户已生长节点)
    - 该用户已生长节点列表 (去重对齐用)
  输出 JSON: [
    {
      "concept": "卷积核",
      "parent": "cs.ai.cnn",          # 必须是已有节点 (平台树或已生长)
      "path": ["cs.ai.cnn.kernel"],   # 从 parent 到目标的逐级路径 (含缺失中间层)
      "lit": true,                     # 真学到=true; 仅作为中间层补出=false
      "reuse_id": null                 # 若复用已有生长节点, 给其 node_id
    }
  ]
  规则: 缺失的中间层在 path 里逐级列出, 写 GrownNode 时中间层 lit=false (灰),
        最深目标 lit=true (亮)。已有则 reuse, 不新建。
```

**关键: "学了第五层、第四层没有"的处理** — LLM 返回的 path 会含完整逐级 (parent →
第四层 → 第五层); worker 逐级 upsert GrownNode, 中间层 (第四层) 自动以 lit=false 补出
(灰), 第五层 lit=true (亮)。

## 知识树 API (合并生长节点)

`compute_user_lit_nodes` / 平台树返回时, 把该用户 GrownNode **merge 进平台树**:
用户树 = 平台树 (静态三层) + 该用户生长枝 (第四层+)。返回结构里生长节点跟平台节点
同构 (id/name_zh/lit/parent), 前端无需区分。

## 前端 (三视图已支持任意深度)

- 树形 (d3-hierarchy)、分层 (递归子域)、3D (星系) 三视图都按层/递归渲染,
  **数据多几层自然显示**, 基本不用改。
- 生长节点视觉同平台节点: 灰=未点亮中间层, 学科色/珊瑚=点亮。
- (可选) 生长节点加一个细微标记 (如虚线描边) 区分"个人生长 vs 平台审定", 首版可不做。

## 非目标

- 不做全局平台树扩展 (生长只 per-user)。
- 不做"个人生长 → 沉淀入公共平台树"的审定流程 (将来可选)。
- 首版不做实时同步生长 (只异步)。
- 前端不做生长节点的特殊视觉区分 (首版同构显示)。

## 验收

- 测试账号完成/提问触发 → 后台 worker 跑 → GrownNode 写入 (含灰中间层 + 亮深层)
- 知识树 API 返回含生长枝; 三视图能展开到第四层+
- 去重: 同概念二次触发不新建 (复用)
- 中间层缺失场景: 学第五层 → 第四层自动灰色补出
