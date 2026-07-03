# 042-badge-system — tasks

## 后端：DB + 核心逻辑

- [x] T1. `packages/student-app/src/systemedu/student/db.py` 新增 `UserBadge` +
      `UserKnodeBadgeDrop` 两个模型（chapter/tier 用连字符字符串，如 `bio-forge`）
- [x] T2. `packages/student-app/alembic/versions/044_add_badge_system.py` migration
      （create_table x2 + index，upgrade/downgrade 都写；已在本地 PG 验证 upgrade/downgrade）
- [x] T3. `packages/student-app/src/systemedu/student/badges/__init__.py` +
      `chapters.py`（`CHAPTER_BY_DOMAIN` / `CHAPTER_DISPLAY_NAME` / `TIER_ORDER` 常量）
- [x] T4. `AsyncLibraryClient.get_tree(slug)` 已存在（调研确认无需新增）
- [x] T5. `packages/student-app/src/systemedu/student/badges/drop.py`：
      `maybe_drop_badges(user_id, project_slug, knode_id)` 核心掉落逻辑
      （domain→chapter 映射、stage 相对位置判定铜/银、milestone 收尾加成、去重表防重复）
- [x] T6. `packages/student-app/src/systemedu/student/badges/synthesis.py`：
      `maybe_synthesize(db, user_id, chapter, tier)` 10 换 1 逻辑，支持连续合成
- [x] T7. 实现改为：路由层调用 `toggle_complete` 前先用 `get_completed_knode_ids` 查一次
      原始状态判断"是否本次新完成"，不改 `toggle_complete` 本身签名/返回值（existing 测试
      对其 bool 返回值有 `is True/False` 严格断言，改动风险大且无必要）
- [x] T8. `user_lit_routes.py::api_knode_toggle_complete` 挂载 `maybe_drop_badges` 调用，
      响应体新增 `new_badges` 字段
- [x] T9. `packages/student-app/src/systemedu/student/badges/routes.py`：
      `GET /api/my/badges` 返回徽章墙数据（八大分会即使 0 枚也要出现）
- [x] T10. 新路由注册进 `server.py` 的 `ROUTES` 汇总

## 后端：测试

- [x] T11. `test_badges_drop.py`：7 个用例全过（stage 前/后半段铜银判定、milestone 收尾
      额外掉落、同一 knode 重复 complete 不重复掉落、domain 映射不到时不掉落、未知 knode
      不掉落、DB 落盘正确性）
- [x] T12. `test_badges_synthesis.py`：5 个用例全过（10 换 1、连续两级合成、master 不可
      再合成、跨分会不互通）
- [x] T13. `test_badges_routes.py`：3 个用例全过（空徽章墙返回全 8 分会 0 计数、真实持有
      数据正确反映、未登录 401）

## 前端

- [x] T14. `packages/student-web/src/lib/types/api.ts` 新增 `BadgeTier` / `BadgeDrop` /
      `BadgeChapterWall` / `BadgeWallData` 类型
- [x] T15. `myBadges.getWall()` + `myKnodes.toggleComplete` 返回类型扩展 `new_badges`
- [x] T16. `BadgeWall.tsx`：按分会分组网格展示，`<img onError>` 兜底切换锁图标占位
- [x] T17. `my-projects/page.tsx` 接入徽章墙入口（Stats strip 下方独立区块）
- [x] T18. `KnodeCompleteButton.tsx` 读取 `r.new_badges` 弹 toast 提示
- [x] T19. i18n 中英文补全：分会显示名、铜银金大师、掉落提示模板

## 静态资源与收尾

- [x] T20. `packages/student-web/public/badges/README.md` 命名约定说明
- [x] T21. `npx tsc --noEmit` 确认无新增类型错误（仍是 pre-existing 18 个历史错误）
- [x] T22. `python -m pytest tests/` 全量跑通（26 failed + 33 error 均为改动前既有的
      deprecated cloud-app 遗留测试问题，已用 git stash 对比确认与本次改动无关；
      本次新增 15 个徽章测试全部通过，既有 259 个 student 测试全部通过不受影响）
- [x] T23. 32 张徽章图片已由用户提供拼版图，裁剪+抠透明+按 chapter 常量命名后放入
      `packages/student-web/public/badges/`，浏览器截图验证 8 分会图片正确加载 +
      锁图标占位态正常。spec.md 状态更新为 shipped。

## 增量 (shipped 后追加)

- [x] T24. 项目详情页展示"完成后可获得的徽章"：新建前端映射常量
      `lib/constants/badges.ts`（CHAPTER_BY_DOMAIN 与后端 chapters.py 一致），在
      `library/[slug]/page.tsx` 的 §02 与 §03 之间插入 `BadgeRewardCard`，按项目 domain
      归属分会横排展示铜/银/金/大师 4 级徽章（映射不到分会则不渲染）。补 3 个 i18n key。
      `BadgeWall.tsx` 复用同一常量去重。浏览器验证渲染 + 图片加载正常。
