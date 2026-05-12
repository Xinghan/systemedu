# 3D Object Template — course_factory 富媒体类型 #9

> 此目录是 spec-026 新增 `mode='3d_object'` 富媒体类型的参考实现。
> 由 `course_factory.factory.should_generate_3d_object(knode)` 自动判断节点是否生成 3D object。
> **不需要用户手动标记**, course_factory 完全决定。

## 文件

- `object_template.html` — 通过 5.5g 美学审查的参考实现 (M01 PMS5003 demo, 1340 行)
  适配 AESTHETIC.md §5b 全部铁律 (toon + EdgesGeometry + 米黄底 + 5 件套灯光)

## 触发条件 (course_factory 自动判断)

### 必须满足全部 (Step 2 才能 keep)

1. `knode.hands_on_components` 任一条目包含**具体硬件型号关键词**:
   - 传感器型号: `PMS5003 / PMS7003 / BME280 / MQ-135 / DHT22 / SHT31` 等
   - 微控制器: `Pi Zero / Raspberry Pi / Arduino / ESP32 / STM32`
   - 通用元器件: `传感器 / 模块 / 引擎 / 电机 / 镜头 / 摄像头 / 收音机 / sensor / module / camera / lens`
   - 项目特有大型物体: `火箭 / 卫星 / 探测器 / 反应器 / rocket / satellite / reactor`

2. 物体可拆出 **3-5 个互不重复的核心子部件** (Step 5 plan 时验证)

3. `knode.module_role` ≠ `capstone` / `synthesis` (那些节点应该综合多个之前的产物, 不重画 3D)

4. `knode.rough_learning_topics` 含 "内部结构 / 原理 / 解剖 / 接线 / cutaway / structure / how it works" 等关键词

### 必须 reject 当 (Step 2 显式写"reject" 理由)

- 节点讲抽象概念 (AQI / 颗粒物分类 / 公民科学 / 误差 / 算法)
- 节点讲过程动作 (焊接 / 防水 / 安装 / 跑数据 / 写报告)
- 节点讲公式 / 数学 / 软件 / UI 设计
- 物体太抽象无固定形态 (气流 / 电流 / 数据流)
- 物体太简单无法拆 3+ 部件 (一个空盒子 / 一根线)

**默认倾向 reject** — 整个项目 30 个 module 平均 4-6 个有 3D 即可, 太多反而稀释。

## 结构铁律 (L0 / L1 / L2 三层下钻)

```
L0 主场景:
  - 完整物体 isometric 视角
  - 4-5 个 raycaster 可点击子部件 (tagClickable 注册)
  - 240px 左 sidebar (零件列表 + 原理速览)
  - 主图占 96% stage

L1 子场景 (4-5 个, 每个对应 L0 一个零件):
  - 单个零件放大解剖
  - 显示内部结构 + 工作原理动画 (粒子/旋转/闪光)
  - modal 含面包屑 "PMS5003 / 激光器" + Back / Close

L2 深度场景 (选做, 仅 1-2 个真正有物理本质可讲的零件配 L2):
  - 物理本质 (晶格电子-空穴对发光 / 磁极相互作用 / 光路弯折)
  - 单步动画演示
  - modal 面包屑 "PMS5003 / 激光器 / PN 结"
```

L0 必做, L1 必做 (3-5 个), L2 选做。

## 模板参数化 (待实现 Step B)

将由 `factory.make_3d_object_html(knode)` 注入:

| 占位 | 含义 | 示例 |
|---|---|---|
| `{{OBJECT_NAME}}` | 物体名 (中英) | `PMS5003 · Plantower 激光颗粒传感器` |
| `{{L1_PARTS_JSON}}` | L1 部件列表 + builder name | `[{"id":"laser","name_cn":"激光器","builder":"buildLaserSubScene"}]` |
| `{{L0_BUILDER_CODE}}` | L0 主体几何构造 JS | (LLM 生成) |
| `{{L1_BUILDERS_CODE}}` | 4 个 L1 子场景 builder | (LLM 生成) |
| `{{L2_BUILDERS_CODE}}` | 0-2 个 L2 builder | (LLM 生成或为空) |
| `{{I18N_TABLE}}` | 中英双语 strings 表 | (LLM 生成) |

参数化用 `string.replace` 或 Jinja2 都可。

## 在 SKILL.md Step 5 的位置

```
Step 5 实现 HTML
  └─ if should_generate_3d_object(knode):
       1. plan_3d_parts(knode) → [L0 builder + L1 builders + L2 builders]
       2. dispatch sub-agent (worktree isolation) 写 3D HTML
       3. inline three.js CDN + 模板填空 + AESTHETIC.md §5b 全部铁律
       4. 写出到 media/3d-<slug>.html
       5. course_content.ideas.append({mode: '3d_object', topic, ...})
       6. Step 5.5g 美学闸门必须 PASS
```

`save_knode_to_workspace._split_html_assets` 已支持 `mode='3d_object'`
对应 `idea['3d_object_html']` 字段, 自动拆到 `media/3d_object-*.html`。

## 当前实施状态 (spec-026)

- [x] AESTHETIC.md §5b 写好
- [x] SKILL.md 富媒体表加第 9 类
- [x] 参考实现 `object_template.html` 在位 (通过 5.5g)
- [x] `factory.should_generate_3d_object(knode)` 实现 (Step B)
- [x] `make_course_content(threed_object_html=...)` 加 mode='3d_object' idea (Step B)
- [x] `_split_html_assets` 自动通过 `{mode}_html` 拆 `3d_object_html` (Step B)
- [x] tests/test_course_factory_3d_object.py 9 个测试通过 (Step B)
- [ ] 在 M11 (PMS5003) 跑一次端到端集成测试 (Step C)
