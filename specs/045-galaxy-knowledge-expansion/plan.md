# Plan 045: 知识星图"扩展知识"

## 架构

```
IDEA 仓 (内容管线, 本地跑)                    EDU 仓 (前端)
┌──────────────────────────────┐    ┌──────────────────────────────────┐
│ fetch_neighbors.py           │    │ public/galaxy/                   │
│  读 EDU concept-galaxy.json  │    │   concept-galaxy.json (已有)     │
│  ├ wbgetentities claims 批拉  │───→│   galaxy-neighbors.json (新)     │
│  ├ 7 属性邻居 QID 收集        │    │                                  │
│  ├ 邻居 labels/desc 批拉      │    │ ConceptGalaxy.tsx                │
│  ├ 规则过滤 + 截断            │    │  ├ fetch neighbors JSON (惰性)   │
│  └ 写 neighbors JSON          │    │  ├ 详情卡 [扩展知识] 按钮         │
└──────────────────────────────┘    │  ├ expansion state (center+items)│
                                    │  └ 扩展点详情卡 (ExpCard)         │
                                    │ ConceptGalaxyCanvas3D.tsx        │
                                    │  └ 扩展 group: ring sprite +     │
                                    │     虚线边 + raycast + 标签投影   │
                                    │ Svg2D: 空心圆 + 虚线             │
                                    └──────────────────────────────────┘
```

## 关键决策

- **neighbors keyed by QID** (非前端 n### id): emit 重跑 id 会重排, QID 稳定。
- **7 类教学属性**: P279 是一种 / P31 属于 / P361 是…的一部分 / P527 包含 /
  P737 受影响于 / P2579 所属研究领域 / P1269 是…的一个方面。
- **过滤黑名单**复用 anchor_math 的 BAD_DESC + 追加行政区/年代类; 每概念每属性
  上限 (P527/P279 各 8, 其余 4), 单概念总上限 12。
- **扩展点视觉**: 3D 用 ring texture Sprite (灰 #8A857A, 空心), 虚线 LineDashedMaterial;
  2D 空心 circle (fill=none, stroke 灰) + stroke-dasharray 虚线。
- **惰性加载**: neighbors JSON (~几百 KB) 在首次点击"扩展知识"时 fetch, 不阻塞首屏。
- 无 QID 概念 / 无邻居数据的概念不显示扩展按钮。

## 影响面

- 新增文件 2 (fetch 脚本 + ExpCard 并入 ConceptGalaxy), 改 4 (Canvas3D/Svg2D/css/locales)。
- 现有 504 概念数据零改动; concept-galaxy.json 不变。
- 不动后端、不动 DB。

## 验收

见 spec.md。视觉验证走 preview 工具; 数据验证脚本抽查 10 个概念的邻居合理性。
