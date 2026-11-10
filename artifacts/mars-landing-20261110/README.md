# 火星车着陆：Blender + Three.js 验收

2026-11-10。资产 ID：`mars2020-descent-v1`。

本批完成一个可编辑、可交互的三维教学示例。本地入口为 `/standalone/mars-landing`，没有部署，也没有替换原来的 `land-a-probe` 游戏或修改其学习记录。

## 交付内容

- `scripts/mars-landing/build_scene.py`：原创程序化建模与关键帧源代码，不依赖第三方网格。
- `packages/student-web/public/mars-landing/`：可编辑 `.blend`、网页使用的 `.glb`、Blender 渲染的 `poster.png`、带文件哈希的 `manifest.json`。
- `packages/student-web/src/components/learning/mars-landing/`：可复用的 React / Three.js 组件。GLTFLoader 加载模型，AnimationMixer 播放和拖动 Blender 导出的单段动画。
- `packages/student-web/src/app/standalone/mars-landing/page.tsx`：独立验收入口。

五个阶段是降落伞减速、抛掉隔热罩、动力下降、缆绳放下火星车、触地后飞离。支持暂停、倍速、时间轴、阶段跳转、旋转和缩放、三种相机视角、部件高亮、隐藏外壳、解释问答、静态图与重新加载。页面初始暂停在天空吊车阶段；不自动播放。离屏或页面隐藏时停止推进动画。

## 可复现构建

使用 Blender 4.5.4 LTS。此次使用官方 Apple Silicon 发行包，下载校验通过后在临时目录只读挂载；没有安装或修改系统应用。

在仓库根目录执行，`blender` 替换为本机可执行文件路径：

```sh
blender --background --factory-startup -t 6 --python scripts/mars-landing/build_scene.py -- --render
node scripts/tests/mars-landing.cjs
node scripts/tests/mars-landing-browser.cjs
```

`--render` 同时生成静态图；省略时只重建模型、动画和清单。`--output DIR` 可以导出到指定目录。浏览器脚本默认使用已启动的 `http://127.0.0.1:4000`，可通过 `MARS_ORIGIN` 修改。使用项目已安装的 Three.js、TypeScript 和 Playwright，无新增 npm 依赖。

## 检查结果

- `model-check.json`：通过。检查实际 GLB 的哈希、单段 42 秒动画、六轮结构、初始外壳闭合范围、分离顺序、缆绳端点、先触地再断缆、下降级飞离时火星车保持接地，以及拖回起点恢复姿态。
- `browser-check.json`：通过。五阶段、播放与暂停、三种相机、语义部件选择、外壳显隐、静态图切换与恢复、WebGL 上下文丢失、模型下载，以及 390px 手机布局。没有页面异常或控制台错误。
- `desktop-skycrane.png`、`phase-*.png`、`mobile*.png`、`shell-hidden.png`、`fallback.png`：实际浏览器截图。逐图复核修正了伞顶裁切、初始外壳未封闭和窄屏三维区域坍缩。
- 新增 TypeScript/TSX 文件的 ESLint 通过。
- 全项目 TypeScript 检查未通过：未修改的 `src/app/(home)/slide-demo/page.tsx` 存在两处类型断言错误，`src/components/learning/course-content-view.tsx` 存在四处参数数量错误。详情见 `typescript-baseline.txt`。新文件没有类型错误。未执行生产构建或线上部署。

## 资料与模型边界

任务顺序参考 NASA / JPL-Caltech：

- [动力下降与天空吊车](https://science.nasa.gov/resource/powered-descent-for-perseverance-illustration/)
- [隔热罩分离](https://science.nasa.gov/resource/perseverance-heat-shield-separation-illustration/)
- [接地、断缆与飞离](https://science.nasa.gov/resource/perseverance-touching-down-on-mars-illustration/)
- [毅力号着陆实拍](https://www.youtube.com/watch?v=4czjS9h4Fpg)

这是结构与动作顺序的教学模型，不是 NASA CAD、遥测回放或飞行动力学计算。伞已经展开后演示才开始；高度、飞行距离、几何比例与时长经过压缩。尾焰为示意几何，不代表真实排气外观。桅杆与机械臂在着陆时保持收起。三根承重缆绳和一根电力/通信连接线分开建模；远离当前场景的弃置部件在网页中隐藏，避免压缩轨迹产生误导性阴影。

几何节点保留 `Rover`、`DescentStage`、`Backshell`、`HeatShield`、`Parachute`、`Bridle_*` 与 `Umbilical` 等名称和 `part` 元数据。后续课堂接入可复用此组件或 GLB；本次没有增加学生课堂 tabs、写入学习记录或更改已有资源标识。
