# SystemEdu 视觉规范 (AESTHETIC.md)

> 这份文档定义 SystemEdu 所有 anim / game / 3D / 等距插画的统一视觉语言。
> **不允许任何 anim/game/3D HTML 在生成时随便挑配色**。所有产物必须基于本规范，
> 由 aesthetic-reviewer agent 在 Step 5.5g 闸门强制检查。

---

## 1. 设计血统 (Design Lineage)

SystemEdu 视觉传承借鉴 **科普书插画黄金时代** —— 米黄羊皮纸底 + 浅色填充 + 黑色线稿。

### 借鉴源（按重要度排序）

| # | 来源 | 借鉴什么 |
|---|------|---------|
| 1 | **David Macaulay "The Way Things Work"** (1988) | 等距视角 + 厚黑描边 + 米黄底 + 横切面 |
| 2 | **DK Eyewitness 系列** | 物体悬浮 + 引出线 + 大写标签 |
| 3 | **Scientific American "Working Knowledge"** | 工程截面 + 编号标签 + 浅色填充 + 黑色线稿 |
| 4 | **flipbook.page 产品页** | 等距插画 + 实时下钻 + 厚黑描边 |
| 5 | **Bartholomew Atlas** | 米黄纸张 + 棕黑描边 + 浅色填充 |

### 反例（不要做这些）

- **Cyberpunk neon**: 深空靛 + 荧光绿 + glow（旧 SystemEdu 默认，已废弃）
- **深色背景 + 深色物体**: 任何让 3D 模型"看不见"的配色（最近一次尝试 Blueprint 深蓝失败）
- **Glassmorphism**: 半透模糊 + 渐变光 + 圆角胶囊
- **AI 默认 sparkles**: 紫粉渐变 + emoji 边框

---

## 2. 核心调色板 (Core Palette)

**核心原则：背景米黄 + 所有物体浅色填充 + 1.5px 黑描边**。

### 基底色（不可改）

| 用途 | hex | 说明 |
|---|---|---|
| `--paper` | `#f3ecdc` | 米黄羊皮纸 — 主背景 |
| `--paper-shade` | `#e8dec5` | 阴影面 |
| `--paper-bright` | `#fff8e8` | 卡片亮底 |
| `--ink` | `#2a2520` | **唯一描边色 + 主文字** |
| `--ink-dim` | `#6a625a` | 副文字 |
| `--ink-mute` | `#a39c92` | 提示文字 |

### 物体填充色（**核心** — 所有 3D 模型/SVG 物体只能从这里选）

**铁律：不允许任何物体填充用比 `#888888` 深的颜色**（仅 `--ink` 描边线本身可以是深色）。

| 用途 | hex | 说明 |
|---|---|---|
| `--fill-grey-1` | `#e8e4dc` | 最浅暖灰 (空白部件 / 背板) |
| `--fill-grey-2` | `#d4cebc` | 浅暖灰 (常规外壳) |
| `--fill-grey-3` | `#b8b0a0` | 中性暖灰 (深一档部件，**最深允许值**) |
| `--fill-metal` | `#d0d4d8` | 浅金属银 (金属外壳/散热栅) |
| `--fill-glass` | `#c4d4dc` | 玻璃半透蓝灰 (透明罩) |
| `--fill-pcb` | `#bdd4b8` | 浅薄荷绿 (PCB 板) |
| `--fill-warm` | `#e8d4b8` | 浅奶橙 (温暖部件) |
| `--fill-blue` | `#c8d8e8` | 浅淡蓝 (冷部件 / 标签) |

### 学科 accent（**只这 8 个，不能创新**）

每个 module 按学科主轴选一个，决定**强调色 + 关键发光 + 高亮数据**：

| 学科 id | accent hex | 适用 |
|---|---|---|
| `physics` | `#5d8aa8` | 力学 / 光学 / 电磁 |
| `chemistry` | `#7a9b5e` | 反应 / 物质 |
| `biology` | `#a35a40` | 生物 / 解剖 |
| `space` | `#3d4a6e` | 天文 / 航天 |
| `earth` | `#c97a4e` | 气候 / 环境 / 大气 (M01) |
| `cs` | `#5e6e8c` | 编程 / AI |
| `math` | `#8a5e6e` | 数学 / 统计 |
| `engineering` | `#6a6a5e` | 机械 / 电子 / 机器人 |

### 强调色（共用）

| 用途 | hex | 说明 |
|---|---|---|
| `--alert` | `#d4534c` | 警示红 (PM2.5 / 激光 / 错误) |
| `--success` | `#7a9b5e` | 成功绿 |
| `--warning` | `#d4a050` | 警告橙 |
| `--accent-blue` | `#5d8aa8` | 中性数据蓝 |

---

## 3. 字体栈 (Typography)

只允许 3 种字体，不准换：

| 用途 | 字体 |
|---|---|
| 标题 / 标签 / 数字 / 代码 | **JetBrains Mono** (700) |
| 中文正文 | **Noto Sans SC** (400/700) |
| 西文正文 | **Inter** (400/500/700) |

---

## 4. 边框与卡片 (Lines & Cards)

### 边框（手册风）

- **统一描边粗度**：1.5px
- **统一颜色**：`var(--ink)` 深棕黑（**不用纯黑** #000）
- **角**：直角
- **虚线**：仅用于"假想 / 内部气流 / 散射路径"

### 卡片

- 卡片背景永远是 `var(--paper-bright)`
- 描边 `1.5px solid var(--ink)`
- **使用 offset solid shadow**: `box-shadow: 3px 3px 0 var(--ink)`
- 按钮按下：`box-shadow: 1px 1px 0 var(--ink); transform: translate(2px, 2px)`

---

## 5. 3D 场景规范 — **核心铁律**

### 背景

- **必须米黄** `0xf3ecdc`
- 雾化：`Fog(0xf3ecdc, 90, 220)`

### 灯光

```js
AmbientLight(0xfff5e0, 0.55)              // 暖白环境
DirectionalLight(0xfff8e8, 1.0)           // 主光
DirectionalLight(0xc4d8e8, 0.35)          // 冷副光
DirectionalLight(0xffd89a, 0.25)          // 暖 rim
HemisphereLight(0xffeed0, 0x6a5a4a, 0.4)  // 半球
```

### Grid 地板

- `GridHelper(60, 30, 0x6a625a, 0xb8a890)` 棕色调
- `opacity: 0.35`

### **材质语言 — 铁律**

**所有 3D mesh 必须遵守 "浅色填充 + EdgesGeometry 黑描边" 双层结构**：

```js
// 错: 单 mesh, 没描边
const x = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ color: 0x6a7888 }));

// 对: mesh + 黑色 edges
const fillMat = new THREE.MeshStandardMaterial({ color: MAT.fillGrey2 });  // 浅色填充
const x = new THREE.Mesh(geom, fillMat);
const edges = new THREE.LineSegments(
  new THREE.EdgesGeometry(geom, 30),  // 30° threshold
  new THREE.LineBasicMaterial({ color: MAT.ink, linewidth: 1.5 })
);
x.add(edges);
```

### 物体着色铁律

| 物体类型 | 必须使用 |
|---|---|
| 半透明外壳 | `MAT.fillGlass` 浅蓝灰，opacity 0.4，**加 EdgesGeometry** |
| 金属外壳 / 散热栅 | `MAT.fillMetal` 浅银 |
| 机械部件 (风扇/IC/connector) | `MAT.fillGrey2` 浅暖灰，**禁深灰** |
| 电路板 | `MAT.fillPcb` 浅薄荷绿，**禁深绿** |
| 黑色掩膜环 / 黑色洞 | `MAT.ink` (允许深色，因这是线稿语义) |
| 激光束 | `MAT.alert` 红 |
| 关键发光 | `MAT.accent` (学科色) |
| 标签 sprite | `MAT.paperBright` 底 + `MAT.ink` 字 |

**禁止**：
- `metalDark` / `bpDeep` / 任何亮度 < 0.5 的物体填充色
- `metalness > 0.5`（除金线 bond wire）
- `roughness < 0.4`（太亮反光）
- emissive intensity > 0.3（除"主动发光"如 PM2.5 高亮、激光二极管）

### 5b. 3D Object 富媒体专项规范 (mode='3d_object')

**这是 spec-026 新增的富媒体类型**，专门用于讲解"项目主题核心物体"的可交互 3D 解剖。
参考实现：`course_factory/3d_template/object_template.html`（基于通过 5.5g 审查的 PMS5003 demo 提炼）。

#### 何时生成 (Step 2 强制 debate)

**保留** (在 Step 2 显式 keep) 当且仅当：
1. 节点的 `hands_on_components` 含具体硬件型号（PMS5003 / BME280 / Pi Zero / Arduino / 传感器 / 模块 / 镜头 / 引擎...）
2. 物体可以拆出 **3-5 个互不重复、各自有教学价值的子部件**（如激光器/光电二极管/微风扇/PCB）
3. 节点 `module_role` 不是 capstone / synthesis / pure-writing

**Reject** (在 Step 2 显式 reject + 理由) 当：
- 节点讲抽象概念（如 AQI / 颗粒物分类 / 公民科学）
- 节点讲算法 / 软件 / 公式 / 数学
- 节点讲过程动作（如焊接 / 安装 / 跑数据 / 写报告）
- 物体太简单无法拆 3 个有教学价值的部件（如一个空盒子）
- 物体太抽象无固定形态（如 "气流" / "电流"）

判断时**优先 reject** — "可做可不做"的节点宁可不做，保持每节都有 3D 反而稀释了 3D 应有的视觉冲击。

#### 结构铁律

每个 3D object 产物**必须**有三层结构：

```
L0 (主场景):  完整物体 isometric 视角, 4-5 个子部件可点击
   ↓ 点击子部件
L1 (子场景):  单个子部件放大解剖, 显示内部结构 + 工作原理动画 (光子/气流/电流粒子)
   ↓ 点击关键部位 (如 PN 结 / 透镜 / 线圈)
L2 (深度场景): 物理本质 (如晶格电子-空穴对发光 / 镜片光路 / 磁极相互作用)
```

L0 必做，L1 必做（4-5 个），L2 选做（仅 1-2 个有真正物理本质可讲的子部件配 L2）。

#### 必须包含的交互

1. **拖拽旋转** OrbitControls (damping 0.08)
2. **滚轮缩放** (minDistance / maxDistance 合理)
3. **Raycaster 拾取**：hover 时鼠标变 pointer + 浮出"点击进入子场景"提示
4. **L0/L1 modal 系统**：含面包屑 `PMS5003 / 激光器`、Back / Close 按钮
5. **每个 L1 子场景含 1 个动画 tick**（粒子 / 旋转 / 闪光，让画面活起来）
6. **i18n CN/EN 切换**

#### 必备 sidebar 信息

L0 主场景左侧 240px sidebar:
- lang-btn (CN/EN 切换)
- 物体名 + 副标题
- 使用说明 (≤ 4 步)
- **可点击零件列表**（同步主场景 raycaster — 点列表也能进 L1）
- 原理速览 (3-5 行 ① ② ③)
- Reset View / Auto Orbit 按钮

#### 5.5g 闸门核查项 (除通用反模式外)

- 主场景 `scene.background = MAT.paper`
- L1/L2 子场景同样米黄底
- 所有 mesh **必须**带 EdgesGeometry 黑描边（addEdgesToAllMeshes 在 boot 后调用 + L1 open 后调用）
- 所有 `MeshStandardMaterial` / `MeshPhysicalMaterial` 改 `MeshToonMaterial` (cel-shading)
- 物体填充色全部来自 §2 fill1-3 / fillGlass / fillPcb / fillWarm / fillBlue
- 学科 accent 用于"关键发光部件" emissive

---

## 6. 装饰元素 (Garnish)

- **微型小人**：等距视角 + 主色 accent
- **植物 / 树**：椭圆树冠 + 棕色树干
- **比例尺**：每个技术图必须有，底部一行 mm/μm/m
- **指北针**：户外场景必带
- **手写感注释**：可选 Caveat 字体

---

## 7. 反模式硬规则

任何产物**任一项 fail = 5.5g 不通过**：

| # | 反模式 |
|---|---|
| 1 | 主背景不是米黄 (hex 起始 `#0`/`#1`/`#2` 深色) |
| 2 | 物体填充用深色 (亮度 < 0.5, 例如 `0x6a7888` `0x2a2520` `0x444`) |
| 3 | 3D mesh 没加 EdgesGeometry 黑描边 |
| 4 | 用饱和 web 默认色 `#50ffb0` `#80ffc0` `#22c55e` 等 |
| 5 | `box-shadow` 含 blur |
| 6 | `border-radius` > 4px |
| 7 | emoji 字符 |
| 8 | 没有 JetBrains Mono |
| 9 | `:root` 没有 `--paper / --ink / --accent` 等规范变量 |
| 10 | accent 不在第 2 节 8 学科表 |

---

## 8. 应用到 M01

| 元素 | 必须用 |
|---|---|
| 主背景 | `#f3ecdc` 米黄 |
| 描边 / 文字 | `#2a2520` ink |
| accent | `#c97a4e` earth (橙) |
| 警示 / 激光 | `#d4534c` alert (红) |
| 外壳 | `MAT.fillGlass` 浅蓝灰 + 黑描边 |
| 激光器 | `MAT.fillMetal` 浅银 + 黑描边 |
| 风扇 | `MAT.fillGrey2` 浅暖灰 + 黑描边 |
| PCB | `MAT.fillPcb` 浅薄荷绿 + 黑描边 |
| IC / 电容 | `MAT.fillGrey2` 浅暖灰 + 黑描边 |
| 字体 | JetBrains Mono + Noto Sans SC + Inter |
| 3D 灯光 | 暖白主 + 冷副 + 暖 rim + 半球 |
