# 042-badge-system — plan

**Status**: draft
**Created**: 2026-07-02

## 技术方案总览

新增 student-app 侧的徽章系统：DB 表（分会/掉落记录/合成记录）+ 掉落触发逻辑（挂在
`toggle_complete` 完成事件上）+ API（查询徽章墙）+ 前端展示（我的项目页新增徽章墙卡片）。
美术资源（32 张 PNG，8 分会 × 4 级）由用户后续提供，本期先接入静态资源目录约定，图片就位后
直接生效，不阻塞代码开发。

## 数据模型

### 1. 分会枚举（代码常量，非 DB 表）

`packages/student-app/src/systemedu/student/badges/chapters.py`：

```python
CHAPTER_BY_DOMAIN: dict[str, str] = {
    "Biotech": "bio_forge",
    "Aerospace": "skyward",
    "Climate": "verdant",
    "Robotics": "mecha_core",
    "AI": "mind_forge",
    "CS": "codex",
    "Neuroscience": "neural_spire",
    "Paleontology": "deep_time",
}

CHAPTER_DISPLAY_NAME = {
    "bio_forge": "生物机所",
    "skyward": "穹际分会",
    "verdant": "绿萌盟",
    "mecha_core": "机械之心",
    "mind_forge": "心智工坊",
    "codex": "算境阁",
    "neural_spire": "神经回廊",
    "deep_time": "深时秘境",
}

TIER_ORDER = ["bronze", "silver", "gold", "master"]  # 索引即晋级顺序
```

`domain` 取值来自 library `Project.domain` 字段（已确认贯通到 student-app 的 `ProjectMeta.domain`）。
映射不到 `CHAPTER_BY_DOMAIN` 的项目 → 不掉落徽章（按 spec 非目标，静默跳过，不报错）。

### 2. DB 表（alembic migration `044_add_badge_system.py`）

**`user_badges`** — 学生已获得的徽章记录（一行 = 一次掉落或一次合成产出的一枚徽章实例，
不做数量字段合并存储，便于溯源和展示"获得历史"）：

```python
class UserBadge(Base):
    __tablename__ = "user_badges"
    __table_args__ = (
        Index("ix_user_badges_user_chapter", "user_id", "chapter", "tier"),
    )
    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    chapter = Column(String(32), nullable=False)   # bio_forge / skyward / ...
    tier = Column(String(16), nullable=False)      # bronze / silver / gold / master
    source = Column(String(16), nullable=False)    # "drop"(节点掉落) / "synthesis"(10换1合成)
    project_slug = Column(String(128), nullable=True)   # source=drop 时记录来源项目
    knode_id = Column(String(64), nullable=True)         # source=drop 时记录来源节点
    consumed = Column(Boolean, default=False, nullable=False)  # 被合成消耗后标记, 不物理删除
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
```

**为什么不删除被消耗的徽章而是标记 `consumed`**：spec 验收标准要求"合成记录可追溯"，物理删除
后无法在徽章墙展示"你曾经获得过 10 枚铜、合成时消耗了"这类历史。查询"当前持有数量"时按
`consumed=False` 过滤即可，不影响正常读取性能（有索引）。

**`user_knode_badge_drops`** — 掉落去重表，防止同一 knode 重复触发掉落（比如 toggle
complete→incomplete→complete 反复横跳，或未来接口重放）：

```python
class UserKnodeBadgeDrop(Base):
    __tablename__ = "user_knode_badge_drops"
    __table_args__ = (
        UniqueConstraint("user_id", "project_slug", "knode_id",
                          name="uq_user_knode_badge_drop"),
    )
    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    project_slug = Column(String(128), nullable=False)
    knode_id = Column(String(64), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
```

一个 knode 一辈子只掉落一次徽章（即使后续 incomplete 再 complete，不会重复掉落）——这是
本期采用的简单规则，理由：`user_knode_complete` 本身撤销即删行，没有"完成历史"概念，若不加
去重表，反复 toggle 会无限刷徽章。写入 `UserBadge` 前先插入这张去重表，唯一约束冲突则跳过
掉落（幂等）。

## 掉落触发逻辑

新增 `packages/student-app/src/systemedu/student/badges/drop.py`：

```python
async def maybe_drop_badges(user_id: str, project_slug: str, knode_id: str) -> list[dict]:
    """节点标记完成时调用。返回本次掉落的徽章列表(可能为空)，供 API 返回给前端展示掉落提示。"""
```

内部逻辑：
1. 查 `library_client.get_project(project_slug)` 拿 `domain` → 映射 `chapter`；映射不到直接
   返回空列表。
2. 查 library `/v1/projects/{slug}/tree`（`AsyncLibraryClient` 新增 `get_tree()` 方法，
   `packages/core/src/systemedu/core/library_client/client.py`）拿 `stages` + `modules`。
3. 在 `modules` 里找到 `module_id == knode_id` 的条目，取其 `stage_id`；在 `stages` 列表里
   算出该 `stage_id` 的相对位置（`stage_index / total_stages`），`< 0.5` → tier=bronze，
   否则 tier=silver。
4. 判断收尾：同 `stage_id` 下所有 `modules` 按 `sequence_order` 排序，若当前 knode 是最大
   `sequence_order` → 额外多生成 1 枚同 tier 徽章。
5. 尝试插入 `UserKnodeBadgeDrop`（唯一约束防重复掉落），插入失败（IntegrityError）说明已经
   掉过 → 直接返回空列表。
6. 插入成功 → 按上面算出的数量批量插入 `UserBadge`（source=drop），调用合成检查（见下）。
7. 返回本次新增的徽章列表（含 chapter/tier/count），供路由层拼进响应体。

### 挂载点

`packages/student-app/src/systemedu/student/catalog/user_lit_routes.py` 的
`api_knode_toggle_complete`，在现有 `enqueue_growth` 调用旁边（L58-66），新增：

```python
new_badges = []
if completed and action != "incomplete":
    try:
        from ..badges.drop import maybe_drop_badges
        new_badges = await maybe_drop_badges(user_id, slug, knode_id)
    except Exception:
        logger.warning("maybe_drop_badges failed (non-fatal)", exc_info=True)
```

响应体新增 `"new_badges": new_badges` 字段（前端据此弹出掉落提示，字段为空数组时前端不弹窗）。

**为什么不改 `toggle_complete` 本身返回值语义**：`user_lit.py` 的 `toggle_complete` 被多处
复用（撤销、批量场景），改动其返回值签名影响面大且不必要——徽章掉落只关心"这次调用是否让
状态从 false 变成 true"，用 `action == "complete"` 且 `completed is True` 就能判断，不需要
改动 `toggle_complete` 内部实现。注意：`action="toggle"` 且原本未完成 → 变为完成时也应该
掉落，需要在路由层保留原始 `existing` 判断（或者让 `toggle_complete` 顺带返回
"is_new_completion" 布尔值，本 plan 采用后者，改动集中在一处，见下方任务细化）。

## 晋级兑换逻辑

`packages/student-app/src/systemedu/student/badges/synthesis.py`：

```python
def maybe_synthesize(db: Session, user_id: str, chapter: str, tier: str) -> dict | None:
    """检查 chapter+tier 未消耗徽章数是否 >= 10，若是则消耗 10 枚、产出 1 枚上一级。
    返回合成结果 dict 或 None（未触发）。tier=master 时不检查（无上一级）。"""
```

逻辑：查询 `UserBadge.filter(user_id, chapter, tier, consumed=False).count()`，
`>= 10` 时取最早的 10 条标记 `consumed=True`，插入 1 条新 `UserBadge(tier=next_tier,
source="synthesis")`。用 `while` 循环处理一次掉落 3 枚导致连续两级合成的边界情况（理论上
罕见，但 10 枚银一次性触发合成后产出 1 枚金，若之前已有 9 枚金，则再次触发金→大师合成）。

## API

新增路由 `packages/student-app/src/systemedu/student/badges/routes.py`：

- `GET /api/my/badges` — 返回当前用户徽章墙数据：
  ```json
  {
    "chapters": [
      {
        "chapter": "bio_forge",
        "display_name": "生物机所",
        "counts": {"bronze": 3, "silver": 1, "gold": 0, "master": 0},
        "highest_tier": "silver"
      },
      ...
    ]
  }
  ```
  `counts` 只统计 `consumed=False` 的徽章。八大分会即使 0 枚也要出现在列表里（前端好渲染
  "未解锁"占位）。

`api_knode_toggle_complete` 响应体新增 `new_badges` 字段（见上）。

## 静态资源接入

图片就位后放到 `packages/student-web/public/badges/<chapter>-<tier>.png`（比如
`bio-forge-bronze.png`，注意 chapter 用连字符英文名，跟代码里下划线的 `chapter` 常量做一次
命名映射，或者直接统一成连字符——**本 plan 决定 DB/代码常量也统一用连字符**（`bio-forge`
而非 `bio_forge`），减少一次映射，`CHAPTER_BY_DOMAIN` 和 `TIER_ORDER` 相应调整。图片文件名
与 `chapter`/`tier` 常量值直接拼接即可定位，无需额外的图片路径字段存 DB。

## 前端

- `packages/student-web/src/lib/api/index.ts` 新增 `myBadges.getWall()` 调用 `/api/my/badges`。
- 新增组件 `packages/student-web/src/components/badges/BadgeWall.tsx`：按分会分组网格展示，
  每个分会一张卡片，显示当前最高等级徽章图（`/badges/<chapter>-<highest_tier>.png`，若
  `highest_tier` 为空显示灰度占位/锁图标）+ 铜银金大师四个小计数徽标。
- 接入位置：`packages/student-web/src/app/(home)/my-projects/page.tsx` 新增一个入口卡片或
  独立 tab（复用页面已有的 domain 配色系统）。
- 节点完成时的掉落提示：在触发 `POST /api/my/knodes/{slug}/{knode_id}/complete` 的现有调用
  处（需要 Explore 一下前端具体文件，大概率在 `KnodeCompleteButton.tsx` 附近），读取响应体
  `new_badges` 字段非空时弹一个简单 toast（"获得 1 枚生物机所铜质徽章"），本期不做精细动画。

## 测试

- `test_badges_drop.py`：验证难度分段（stage 相对位置）、milestone 收尾额外掉落、去重表防
  重复掉落
- `test_badges_synthesis.py`：验证 10 换 1、连续合成（比如一次凑够 20 枚触发两级）、master
  不可再合成
- `test_badges_routes.py`：`GET /api/my/badges` 返回结构，未映射 domain 的项目不掉落

## 影响面

- 新 migration，不改动现有表结构
- `user_lit.py::toggle_complete` 需要小改动（返回值增加"是否新完成"信息），影响调用方
  `user_lit_routes.py`（本 plan 范围内一并改）——需要 grep 确认没有其他调用方遗漏
- `AsyncLibraryClient` 新增 `get_tree()` 方法（`packages/core`），影响面小（新增方法不改
  现有签名）
- 前端新增文件为主，改动 `my-projects/page.tsx` 插入入口 + 找到完成节点按钮组件插入掉落
  提示逻辑

## 验收对齐 spec.md

- 掉落规则用 stage 相对位置实现（spec 已按此调整）
- 里程碑收尾用 stage 内最大 sequence_order 判断
- 合成不物理删除，`consumed` 标记 + 可追溯
- 八大分会映射覆盖当前 domain：Biotech/Aerospace/Climate/Robotics + 新增 4 个
- DB + API + 前端三层任务在 tasks.md 中拆分
