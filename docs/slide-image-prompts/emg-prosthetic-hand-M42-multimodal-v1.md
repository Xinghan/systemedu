# M42 多模态教学验证 · v1

项目：肌电仿生机械手 `emg-prosthetic-hand`。节点：`M42-w0-module`，12 页。
状态：12 页本地样例已完成并验证，未部署。源：本节点原 slides.json、lesson.md、assignment.md；前置 M41 行程标定，后续 M43 欠驱动整手联动。

预览：http://127.0.0.1:4173/slide-preview/emg-m42 。渲染经过实际 SlideBody；课程图片使用相同相对路径，开发预览通过仅 development 生效的白名单镜像读取。正式授权文件接口没有放开。

草稿：`course_factory/fixtures/emg-prosthetic-hand/M42-multimodal-v1.json`；逐页注册表：同目录 `M42-multimodal-v1.registry.json`。原 slides.json 与旧音频没有覆盖。图片存于课程 M42/images/finger-states-v1.webp，44,508 字节，1672×941；工作区镜像为 student-web/public/slide-demo/emg-m42-v1/finger-states.webp。

## 路由与知识校正

- 图片：S03 用同一绳驱手指伸直/弯曲两状态，解释材料、关节、屈曲绳与回弹件。生成媒体是结构示意，不是实测照片。
- Three.js：S04 可旋转的舵机/摇臂装配，俯视、侧视、分解，显示半径与拉力方向的空间关系。程序几何为教学理想化，无真实产品尺寸保证。
- KaTeX：S04/S06/S08 精确公式、单位换算与代入。
- 虚拟实验：S08 只改变摇臂半径，固定绳张力 10 N 与垂直夹角；记录计算值、比较翻倍关系。解析模型，不是实物试验。
- 其余页：标定证据、力的区别、预算表、规格判断、可下载成果与下一阶段衔接。

原文需校正：指尖力不等于绳张力；力臂是垂直距离，τ=Fr 只用于垂直拉力；kg·cm 规范写作 kgf·cm；堵转扭矩不能证明持续运行能力。10 N 为教学假定的绳张力，五指相同、同半径同步受力、忽略传动损耗，仅作第一版预算。

## 图片语义简报 / 最终 prompt

Method decision: hybrid raster plus deterministic HTML labels. Physical materials and paired posture comparison benefit from a clear technical render; exact mechanics and quantities remain in HTML, not in generated marks.
Runtime and renderer: raster WebP in course image mapping, DOM captions; separate Three.js model for spatial inspection.
Use case: scientific-educational.
Asset type: 16:9 classroom slide raster.
Teaching claim: a tendon on the palmar side flexes a segmented printed finger against an elastic return element; extension and flexion are two states of the same assembly.
Required entities: two matched views of one simplified three-link 3D-printed mechanical finger, three gray hinge pins, matte ivory printed links with subtle layer texture, orange flexor tendon passing through small palmar guides and anchored at the distal link, blue elastic return strip on the opposite dorsal side.
Required relationship/state change: left view extended, right view gently flexed at the same three joints, identical parts and colors in both. The orange cable runs continuously along the inside of the bend to the fingertip; the blue return strip follows the outside and is visibly stretched in the flexed state. No actuator, spool, hands or people are needed.
Composition: equal side-by-side views at the same scale, shallow three-quarter side view making tendon routing and hinge pins visible, fingertip to the right in both views. Fill the frame with the instructional comparison; no decorative items.
Style: precise engineering textbook product illustration, physically plausible simplified assembly, warm white background, soft diffuse lighting, restrained navy/gray details, orange and blue carry consistent component identity. Not a cinematic hero shot, not a toy cartoon.
Text: none; exact Chinese labels are rendered separately in HTML. No letters, numbers, arrows, equations, logos or watermarks.
Constraints: no extra joints, no disconnected cable, no ambiguous floating strings, no flesh or human scene, no dark background. The relationship should be understandable without a caption. This is an illustrative mechanism, not a measured manufactured specimen.

## 验证记录

内置 image_gen 生成一张位图；没有把手写 SVG 冒充图片。检查后仅批准为定性结构/姿态对照，不将关节数量、路径或尺寸作为工程精确证据。精确力臂由独立程序模型承担。

| 页 | 教学关系 / 选择 | 为什么不用最接近的其他方法 |
|---|---|---|
| S01 | M41 位置证据 → M42 负载预算 → M43 联动，HTML 证据链 | 无需生成整手气氛图；阶段产物本身就是教学关系 |
| S02 | 位置标定与力预算的区别，具体输入/输出表 | 没有实测点，不编造动画标定曲线 |
| S03 | 打印指节、腱线、回弹件与伸直/弯曲对照，生成图片 + DOM 图例 | 单纯线框不能充分表现材质和部件辨认；图片不能替代准确计算 |
| S04 | 转轴/摇臂装配与拉力作用线，Three.js 旋转/俯视/侧视/分解 + KaTeX | 静态图片不能改变视角检查遮挡和装配；二维备用图保留力臂关系 |
| S05 | 固定张力/夹角下半径翻倍，KaTeX + 条件对照 | 不需要重复 3D；行程依赖布线，不能乱加通用卷线动画 |
| S06 | 单指 → 五指求和 → 余量，KaTeX + 四步预算表 | 数字、下标、单位不能烘焙进图片；运算顺序已静态可复核 |
| S07 | kgf·cm 换算，堵转与持续能力区分，精确公式 + 规格表 | 没有具体型号数据，不生成虚构产品铭牌 |
| S08 | 操控半径 → 公式、力臂、扭矩柱同步 → 记录，解析虚拟实验 | 时间积分或通用刚体引擎不比此准静态解析关系更合适 |
| S09 | 已知值 → 缺失规格 → 有条件判断，带错因反馈的练习 | 不用单纯绿勾红叉；结论必须由证据的含义支撑 |
| S10 | 参数 → 预算 → 不确定性 → 可下载 PNG | DOM 保持精度与可操作；PNG 是确定性导出成果，不是 AI 生成公式 |
| S11 | 设计改变 → 收益 → 代价/复核项，工程取舍表 | 缺乏工况模型，不虚构欠驱动一定减少负载的动画 |
| S12 | 两份阶段成果支撑下一步，具体交付与待补证据 | 不用孤立完成勾或无信息量产品海报 |

验证：7 个单元/映射/TeX 测试通过；本次文件与受影响渲染器 ESLint 通过。全仓 tsc 仍有原有 slide-demo、assignment-view、capstone、course-content 错误，本次新增文件没有 TS 诊断，不宣称全仓检查通过。

实际浏览器：逐页遍历 12 页，当前窗口无页面横向溢出、无公式容器溢出、无 KaTeX 错误，图片 naturalWidth=1672 且加载完成；console error 列表为空。预算页在窄桌面窗口改为上下布局，公式拆成三行。

交互验证：3D 实际拖动改变视角；俯视/侧视/分解可见；φ=0° 得 0，r=2cm/φ=90° 得 0.2N·m；手动触发二维备用图仍有参数与读数。实验播放到 2cm 自动停止并记录 0.2；重置后单步 1.1cm 记录 0.11。判断题未选项禁用、错误反馈、正确反馈通过。PNG 生成按钮回调成功并触发下载；未确认浏览器最终保存目录，不把回调成功等同于用户已保存文件。移动手机尺寸未专门实测。

## Skill 判断审查

总体路由合理：知识目标优先、图片信息密度门槛、3D 空间检查门槛、公式精确性、模型与渲染分离，都能在本节点产生不同且有必要的手段，不需要增加图片/3D 配额。

这次没有继续扩大工具名单，也没有修改全局 skill。已有“候选工具 → 依赖可用 → 渲染器集成 → 页面验证”的区分必须严格执行：现有 `molecule-3d` 分支仍返回 null，不能声称分子 3D 已完成；本次新增 `tendon-torque` 的工程 Three.js 路由已经实际集成并验证。不同学科的全套实验/模拟仍是候选能力，不能从这个机械例子推定都已验证。

执行侧改进：先校正文义再选择媒体；公式必须测试插值后的最终显示，不仅测试静态 TeX；生成图片不能因视觉逼真就被视为精确模型；发布前同步阅读材料/作业/理论与讲稿。本 M42 是预览草稿，批准后发布前还须同步这些配套内容，重建正式 manifest，再做 scoped deploy。

## 知识与 API 依据

- [OpenStax 力矩与垂直力臂](https://openstax.org/books/university-physics-volume-1/pages/10-6-torque)
- [NIST 力与力矩单位换算](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9)
- [Pololu 舵机电气特性](https://www.pololu.com/blog/16/electrical-characteristics-of-servos-and-introduction-to-the-servo-control-interface)
- [Three.js OrbitControls](https://threejs.org/docs/pages/OrbitControls.html)、[WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html)
