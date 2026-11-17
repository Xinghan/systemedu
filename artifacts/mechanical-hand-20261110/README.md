# 五指机械手：Blender + Three.js 本地验收

2026-11-10 · 资产 ID `tendon-hand-v1` · 本地入口 `/standalone/mechanical-hand`。

本批重新制作一个完整的五指机械手示例。原来的打印夹爪活动、M42 课程、课堂结构和学习记录保持不变。本批未部署。

## 已完成

- 原创 Blender 几何：掌部框架、可隐藏外壳、十四个屈伸关节、拇指对掌转轴、指节接触垫、金属转轴、导向环、五个独立驱动器与卷线轮。没有使用第三方 CAD 或网格。
- 可编辑 `.blend`，网页模型 `.glb`，Blender 渲染的静态结构图，以及记录来源和哈希的 `manifest.json`。
- Blender 源文件自带 4 秒屈伸动画，关节、卷线轮与分段牵引绳同步运动。网页使用同一关节层级直接计算姿态，不播放固定动画来冒充自由控制。
- 五指独立弯曲、拇指对掌、逐指演示与暂停、张开/合拢/参考球三种预设、旋转缩放、掌面与侧面视角、部件选择、隐藏外壳、牵引绳显隐与复位。
- 联动侧面投影、关节角度、理想收绳量和卷线轮转角。参考球使用近似几何接触限位，表面可能留有小间隙，不预测抓力或物体能否被提起。
- 默认不自动播放；离屏或页面隐藏时停止推进演示。加载失败、主动切换静态图和 WebGL 上下文丢失均有静态图与恢复入口。

## 文件与复现

| 文件 | 用途 |
| --- | --- |
| `scripts/mechanical-hand/build_hand.py` | 原创 Blender 建模、关键帧、源绳路烘焙与导出 |
| `packages/student-web/src/components/learning/mechanical-hand/rig.json` | 共享尺寸、角度范围、传动参数与接触包络 |
| `packages/student-web/src/components/learning/mechanical-hand/kinematics.ts` | 正运动学、理想收绳量与首接触限位 |
| `packages/student-web/src/components/learning/mechanical-hand/scene.ts` | GLB 加载、关节驱动、绳路更新、空间选择与资源释放 |
| `packages/student-web/src/components/learning/mechanical-hand/viewer.tsx` | 中文交互界面与精确读数 |
| `packages/student-web/public/mechanical-hand/` | `.blend`、`.glb`、静态图、资产清单 |

使用 Blender 4.5.4 LTS。在仓库根目录执行，`blender` 替换为本机可执行文件路径：

```sh
blender --background --factory-startup -t 6 --python scripts/mechanical-hand/build_hand.py -- --render
node scripts/tests/mechanical-hand.cjs
node scripts/tests/mechanical-hand-browser.cjs
```

`--render` 生成静态图，省略时重建源文件、GLB 和清单。`--output DIR` 修改导出位置。浏览器测试默认访问已启动的 `http://127.0.0.1:4000`，可设置 `HAND_ORIGIN` 更换地址。本批沿用项目依赖，没有新增 npm 包。

## 验证结果

- `model-check.json`：通过。检查资产哈希、动画时长、五指与十四个屈伸关节、已知直角链和收绳公式、210 个 GLB/解析模型端点对比、456 个源动画绳路端点、58 个接触场景。另检查 93,660 个实际指节网格顶点都包含在接触包络内，避免用过小的碰撞体掩盖穿模。
- `browser-check.json`：通过。实际 GLB、滑杆与角度读数、拇指对掌、外壳/绳路显隐、参考球、相机、演示暂停、复位、静态图、重试、上下文丢失、390px 手机布局与源文件下载。页面异常和控制台错误均为空。
- 桌面、单指、合拢、内部结构、参考球、静态图、手机截图保存在本目录，已检查实际显示。
- 新组件和路由的 ESLint 通过。全项目 TypeScript 仍有六处旧错误：`slide-demo/page.tsx` 两处类型断言，`course-content-view.tsx` 四处参数数量错误。本批未修改这些文件，新文件没有类型错误。完整输出保存在 `typescript-baseline.txt`。未声称生产构建或线上验收通过。

## 模型含义与资料来源

每个模型单位表示 10 mm；长度、活动范围和恒定力臂均是教学设定。一个弯曲指令按固定比例分配给一根手指的多个关节；关节角 θ 用弧度代入 Δl = Σrᵢθᵢ。卷线轮转角为 Δl/R。这里没有对绳索弹性、摩擦、复位弹簧受力、舵机电流或肌电信号进行求解。

参考球检测将指节包在圆头柱体（capsule）内，沿既定动作路径搜索首次接触，并停止整根手指。它不是欠驱动机构中“某节接触后、其余关节继续自适应”的力学求解，也没有判断夹持稳定性。拇指对掌单独改变根部方向。

原理参考：

- [Yale OpenHand](https://www.eng.yale.edu/grablab/openhand/)：绳驱动、欠驱动手指与机构设计。
- [Yale OpenHand Model T](https://www.eng.yale.edu/grablab/openhand/model_t.html)：接触适应与单驱动差动机构的真实设计示例。本模型没有复制其 CAD，也不声称复现其差动机构。

后续可复用该组件与资产接入统一课堂。本次只提供独立验收入口，不新增学生课堂 tabs，不写入学习记录。
