# 3D 视觉与几何踩坑清单 (5 试点实测, 别重犯)

> 铁律先行: **不截图不许说"修好了"**。见 [[3d-visual-verify-by-screenshot]]。
> 定位问题元素: 染红 + 冻结姿态 (`S.phase='frozen'` 让 simStep 不更新) + 多角度截图。
> 盲调欧拉角前先 `getWorldPosition` 投影到屏幕坐标核对物体在不在画面、在哪。

## 相机 / 构图
- **默认相机太近**是最常见的"啥都看不到"—— 主角占满屏、看不到应用环境。先把 rad 拉到能同时框住
  成品 + 环境 + 交互目标。截图确认再收。
- **让关键交互面朝观众**: 若成品有一个"正面动作"(口袋对接 / 抓取 / 扫描), 默认相机方位角要摆到
  那个面的法线方向, 否则动作发生在背面看不见。算法: 取交互面世界法线, 相机沿该法线看回来。
- 投影自检: `v.project(camera)` 后 `sx=(v.x+1)/2*W, sy=(1-v.y)/2*H` 得屏幕坐标, 打印出来确认
  各物体没跑出画面 / 没叠在一起。

## 半透明 / 遮挡 / 发光
- **凹陷口袋、内部特征点会被半透明外壳糊住** → 关键标记点材质设 `depthTest:false` + `renderOrder`
  拉高, 让它们**始终画在最上层** (像 cover 的发光钥匙孔)。
- **AdditiveBlending 会把多个彩色发光点烧成一坨白** (尤其叠加多层 halo)。要保留"4 个可区分的彩色点"
  就别用 additive, 用普通 `transparent + opacity` + 各自颜色。
- 半透明蛋白/外壳用 MeshPhysicalMaterial 的 `transmission`/`clearcoat`/`sheen` 做通透肉感;
  但 transmission 太高会让内部标记也透没, 权衡。

## 定位 / 落点
- **飞入/对接的落点用"目标世界坐标 + 沿目标世界法线外移"精确算**, 不要用局部坐标硬猜
  (成品/靶点带了 scale/rotation 时局部偏移会错位)。
  `pocketW = pocketGroup.getWorldPosition(); nrm = (0,0,1).applyQuaternion(pocketGroup.getWorldQuaternion());
   landing = pocketW + nrm * d;` —— 读世界坐标前先 `scene.updateMatrixWorld(true)`。
- 物体带非 1 scale 时, "呼吸"动画 `scale.setScalar(s)` 会**覆盖**基础 scale → 要 `base*(1+0.02*sin)`。

## 地形 / 底座
- **底座盒/侧裙的顶面若高于地形最低点, 会有一大片灰面吞掉半张图**。底座顶面要压到地形 minimum 之下。
- 地形 heightmap 加大振幅后, 记得同步下压底座、重算相机, 否则地形沉进底座。
- 轮子/物体贴地: 目标高度设"解析地面高度 + 半径 − 0.1"(压进去一点), 因为渲染网格在格点之间比解析
  高度场低, 不压进去会看着悬空。

## 材质 / 纹理
- 自定义 BufferGeometry **必须手动加 UV** 才能吃 normalMap/roughnessMap。
- CanvasTexture 设 `encoding=THREE.sRGBEncoding`, 否则被当线性、发灰/发亮。
- 金属真反射靠 PMREM environment (见 pipeline.md), 不是光照。

## 分子球棍 (molecule 专用, 化学可视化通用)
- CPK 配色: C 深灰 / H 白 / N 蓝 / O 红 / S 黄 / 卤 绿 / P 橙; 原子半径按元素。
- 键 = 细圆柱 (`quaternion.setFromUnitVectors((0,1,0), dir)` 对齐), 双键 = 两根偏移平行圆柱。
- 芳环内放一个半透明浅色盘表意 (法线取环上三点叉积)。
- 隐式 H 一般**不画** (画出来太乱, 标准做法省略), 只画重原子。
- 2D 布局→3D: 环放正多边形, 其余原子 BFS 从已放邻居偏移展开; 芳环原子 z≈0 共面, 其余小 z 抖动。
