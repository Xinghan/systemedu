# 星际远航 · 科研指挥室视觉升级

## 设计

保留任务中心的五个模块与全部任务/计时/记录逻辑，采用真实空间与仪器面板结合的视觉：

- 从控制席望向探测车试验区的场景，表现空间纵深、设备材料与傍晚暖光。
- 深色控制台、克制的青色状态灯、数字计时、八站选择面板。
- 任务阅读区域使用明亮的电子任务单；正文与输入优先保证可读性。
- 当前任务站来自真实选中任务；进度与用时沿用既有数据，不添加虚构遥测。
- 简短的一次入场动效；减少动态偏好下关闭。没有循环场景动画、自动播放音视频或新的 3D 运行依赖。
- 新样式限定在任务中心；原任务首页和普通课堂工作条没有改动。

## 图片与性能

由 **built-in image_gen** 生成一张无文字的虚构科研场景，完整提示词见 [image-prompt.txt](image-prompt.txt)。不是 NASA 实验现场或实际教学器材的照片；页面标注场景示意与 AI 生成。

使用 sharp 仅做格式与尺寸处理，保留生成构图：

| 网站资源 | 尺寸 | 大小 |
| --- | --- | --- |
| `packages/student-web/public/mission/space/research-control-room-v1-1536.webp` | 1536×1024 | 122,116 B |
| `packages/student-web/public/mission/space/research-control-room-v1-960.webp` | 960×640 | 60,092 B |
| `packages/student-web/public/mission/space/research-control-room-v1-640.webp` | 640×427 | 30,484 B |

`picture/srcset` 根据手机/桌面及像素密度选择资源。宽高预声明，页面背景采用深色降级。原始生成文件留在工具返回的 generated_images 路径；网站只依赖已入库 WebP。元数据见 `image-assets.json`，转换命令见 `prepare-image.cjs`。

## 验证

- `verify-visual.mjs`：1440、390、320 px 的工作台、地图、时间表、日志、档案均无横向溢出；图片成功解码且分别选取桌面/手机资源；减少动态时无入场动画；键盘焦点可见；任务站标签跟随选择；填写的证据可刷新恢复；普通课堂工作条仍为原浅色。
- `verify-behavior.mjs`：复用上一批的实质性浏览器回归，覆盖任务自检、阻碍、日期、计时/后台暂停/跨标签互斥、刷新、版本冲突及恢复、账号隔离、原课堂入口。账号 API 使用模拟后端；这批未改变后端或保存协议。结果见 `behavior-verification.json`。
- 生产构建成功；TypeScript 对比 `f927e62d`：原有 6 个诊断，本批新增 0；改动源文件 ESLint 0 errors。
- 已视觉检查桌面工作台、地图、时间表、工程档案与手机入口/长页。截图保留在本目录。

仅供本地验收，未部署生产。
