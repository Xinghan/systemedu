# 短项目视觉重制验收

日期：2026-09-19。作品视觉版本 mars-expedition/2。全部截图和样例来自本地真实运行与自动操作，不是生成宣传图，也不是儿童试用成果。

## 检查结论

- 模型测试 5 项通过；互动回归 9 组通过，无页面异常。包含失败/柔和着陆、碰撞与绕行、照片及路线下载、回放和刷新、规则项目兼容、存储异常、手机按钮与 WebGL 中断后的继续操作。
- 视觉专项 5 组通过：两种设备近看/环视不改变任务位置；快速连续移动后立即拍摄对齐记录；主观察相机不改变车载照片；减少动态效果可驾驶；矢量降级收起不可用的三维旋转按钮。
- 桌面 1440×1050 与手机 390×844 截图逐张查看。近看可辨认支架/轮毂、线缆、光学头、面板和隔热层；车轮及足垫与地面接触，材质区分金属、涂层、玻璃、土石。仍为概念工程模型，未宣称真实任务设备复刻。
- 修正了重复柱状障碍、碎石离地、手机覆盖物挡轮组/太阳翼、持续上升裁掉着陆器、兼容模式车辆被导航遮挡。观察与任务控制分区，近看收起仪表。
- 导出照片为 960×600，来自当时车载相机；`rover-export.jpg` 是快速输入后的实拍渲染。原格式、本机键和物理模型兼容，记录增加 visual_version。

## 画面索引

- `lander/rover-desktop.png`、`*-detail.png`：初始布局与设备近看。
- `*-mobile.png`、`*-mobile-detail.png`：手机正常和近看画面。
- `lander-braking.png`：持续点火上升，自动保持设备完整取景。
- `*-vector.svg`、`*-fallback.png`、`*-fallback-detail.png`：矢量设备和无 WebGL 的实际画面。
- `interaction/`：成功/失败收尾、驾驶、下载作品和旧规则项目回归。

`interaction/` 是完整行为回归；随后仅调整着陆观察相机和手机兼容画面位置，再由视觉专项检查并保存顶层最终截图。上述变化不修改动作模型和保存条件。

## 性能与未验证范围

自动化 Chromium 使用 `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)`。连续绘制的实测平均 12.3 FPS，中位帧间隔 82.7 ms、P95 108.2 ms。这一软件渲染环境仍不流畅，不作为性能通过或真实平板帧率承诺。`scene.frameMs` 是 CPU 提交耗时，不能当作完整帧耗时；以上数据由 requestAnimationFrame 间隔计算。

采用重复构件实例化、按需绘制、隐藏页暂停、动态像素分档、第二视口降分辨率；停止操作后恢复原生清晰度。未用低质量预制图片替换实际设备或导出。真实 GPU 设备、Safari 和真实平板仍需人工测试；约三分钟也仍是设计目标。

## 复现

在 systemedu 根目录启动学生端后运行：

```sh
node --test scripts/tests/space-project-models.test.mjs
SPACE_VERIFY_DIR=artifacts/space-visual-quality/interaction node scripts/verify-space-projects.mjs
node scripts/verify-space-visual-quality.mjs
```

skill 格式校验与项目线契约校验另行通过，只证明结构合法，不代表视觉或儿童体验通过。
