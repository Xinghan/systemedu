# 026-3d-object-media

**Status**: shipped (2026-05-13)
**Owner**: xinghan
**Created**: 2026-05-13

## 背景 / 问题

course_factory 现支持 8 类富媒体（theory / animation / game / hands_on_kit / image / diagram / youtube / labxchange）。在 purpleair-airquality-node 项目的过程中，我们做了一个独立 3D demo（PMS5003 传感器的可交互 cutaway + 子部件下钻），通过了美学闸门并被用户判定"非常成功"。

3D 物体解剖对"项目核心硬件"类节点的学习价值很高（建立空间结构理解），但不是每个节点都适合：抽象概念、过程动作、公式、软件、UI 设计等节点强行做 3D 反而稀释注意力。

因此把 3D object 提升为正式的第 9 类富媒体，并要 course_factory 在每个 knode 上自动判断是否启用。

## 目标（WHAT）

1. 在 SKILL.md 富媒体表加 9 个 mode = `3d_object`，与 animation/game 等并列
2. 自动判定：`should_generate_3d_object(knode)` 命中核心硬件物体且学习内容含"内部结构/原理/解剖/接线"时 → True；其他情况 → False
3. 用户不需要手动标记 — course_factory 完全决定
4. 生成的 3D HTML 走统一闸门：5.5g 美学（flipbook 米黄手册风 toon shading + EdgesGeometry 黑描边）+ L0/L1/L2 三层下钻铁律
5. 与 animation/game 一样走 `make_course_content` + `save_knode_to_workspace` 写出 `media/3d_object-*.html`

## 非目标（不做什么）

- 不允许用户在 knode JSON 里手动写 `force_3d_object: true` 来强制开启 — 全部交由 factory 判断
- 不做 3D 物体的纹理贴图（用 toon shading + EdgesGeometry 表达即可，避免重型素材）
- 不做 VR / AR 模式（保持 Three.js 内嵌 iframe，不额外引入 WebXR）
- 不做实时多人协作（learn page 仍是单人会话）
- 不为已生成的 30 个 module 回填 3D — 后续按需补

## 用户故事 / 场景

- 学生学到 M11 "接好 PMS5003" 时，learn 页除了 plan_markdown / animation / game / exercise 外，还有"PMS5003 内部结构"卡片：点击主图可拖拽旋转，点击激光器 → 弹出 L1 子场景看激光器特写 + 工作原理，再点 PN 结 → 弹出 L2 物理本质（晶格电子-空穴对）
- 学生学到 M01 "什么是颗粒物" 时，没有 3D 卡片 — 因为颗粒物是抽象概念不是硬件物体
- 学生学到 M30 "项目终展" 时也没有 3D — 因为 capstone 节点应该综合之前的产物

## 触发判定规则

`course_factory.factory.should_generate_3d_object(knode)` 返回 `dict`：

```python
{
    "should_generate": bool,
    "reason": str,                  # 一句话理由
    "object_name_hint": str,        # 推荐 L0 object 名 (优先具体型号含数字)
    "matched_keywords": list[str],  # 命中的硬件关键词
}
```

判定逻辑（必须全部满足才 True）：

1. `module_role` ∉ {capstone, synthesis}（这些节点应综合, 不重画）
2. knode 文本字段（title / summary / core_question / hands_on_components / rough_learning_topics）命中至少一个**硬件型号或物体关键词**（PMS5003 / Pi Zero / BME280 / Arduino / sensor / 传感器 / 模块 / 摄像头 / 引擎 / 火箭 / 卫星 / 反应器 等）
3. knode 文本字段命中至少一个**解剖/原理类话题词**（内部结构 / 解剖 / 原理 / 接线 / cutaway / structure / how it works / 内部 / 构造 / 部件）

详细判定 + 默认 reject 倾向见 `course_factory/AESTHETIC.md §5b` 和 `course_factory/3d_template/README.md`。

## 美学规范（5.5g 闸门）

参考实现 `course_factory/3d_template/object_template.html`（spec-022/M01 PMS5003 demo, 通过 5.5g 49/50 分）：

- flipbook 米黄手册风：`#f3ecdc` paper + `#2a2620` ink + 8 学科 accent
- Three.js MeshToonMaterial + EdgesGeometry 黑描边
- 5 件套灯光（Ambient / Directional 主 / Directional 填 / Directional rim / Hemisphere）
- L0 主场景：完整物体 isometric, 4-5 个 raycaster 可点击, 240px 左 sidebar
- L1 子场景（3-5 个）：单零件放大, 工作原理动画
- L2 深度场景（0-2 个, 选做）：物理本质动画
- 反模式 10 条硬规则（深色背景 / 无描边 / 无 toon / overlay 浮 canvas / 等）

## 验收标准

- [x] `should_generate_3d_object(M11 PMS5003 knode)` 返回 `should_generate=True, object_name_hint='pms5003'`
- [x] `should_generate_3d_object(M01 抽象颗粒物 knode)` 返回 False
- [x] `should_generate_3d_object(M30 capstone knode)` 返回 False
- [x] `make_course_content(threed_object_html=...)` 注入 `mode='3d_object'` idea + rendered_section
- [x] `save_knode_to_workspace` 自动拆出 `media/3d_object-<slug>.html` 并改写 idea 上为 `3d_object_path`
- [x] 9 个 pytest 单元测试通过（命中 / 拒绝 / 写盘）
- [x] M11 端到端集成测试通过（载入真实 knode → 判定 → 写盘 → sections.json）
- [x] SKILL.md 富媒体表第 9 行 + Step 2 "9 类 debate" + Step 6 产物 checklist 同步
- [x] AESTHETIC.md §5b 写规范 + §7 反模式硬规则
- [x] `course_factory/3d_template/` 含参考实现 + README

## 实施 Phase

- **Step A**（spec / 规范）：AESTHETIC.md §5b、SKILL.md row #9、3d_template/README.md、object_template.html 拷贝
- **Step B**（factory helper）：`should_generate_3d_object` + `make_course_content(threed_object_html=...)` + 9 个测试
- **Step C**（端到端）：M11 PMS5003 集成测试

均已完成 2026-05-13。

## 影响面

| 文件 | 改动 |
|------|------|
| `course_factory/factory.py` | +166 行（新加 `should_generate_3d_object` + `make_course_content` 加 `threed_object_html` 参数 + 关键词常量） |
| `course_factory/workspace_bridge.py` | 无需改 — `_split_html_assets` 通过通用 `{mode}_html` 自动支持 |
| `course_factory/SKILL.md` | +~100 行（富媒体表行 #9、Step 2 改 9 类、Step 5.5g 闸门交叉引用、Step 6 checklist） |
| `course_factory/AESTHETIC.md` | 新文件，§5b 专项规范 |
| `course_factory/3d_template/object_template.html` | 新文件，参考实现 (拷贝自 M01 PMS5003 demo) |
| `course_factory/3d_template/README.md` | 新文件，触发规则 + L0/L1/L2 + 模板参数化 |
| `course_factory/aesthetic_reviewer_prompt.md` | 新文件，5.5g 美学审查 agent prompt |
| `tests/test_course_factory_3d_object.py` | 新文件，9 个测试 |

## 未来扩展

- M11 / M14 / M22 等真实节点中按需补 3D 物体（不在本 spec 范围）
- L2 深度场景的物理本质动画库（晶格 / 电磁波 / 光路）— 当多个 knode 复用同一物理本质时复用
- 3D 物体的中英文 i18n 表自动生成（当前由 sub-agent 自己写）
