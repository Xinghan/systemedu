# 机械手外形修订 02

用户反馈：掌部像一块正方形板，缺少真实机械手的外形和装配关系。本批直接修改 Blender 网格；不是更换网页皮肤或渲染一张替代图片。

预览：`http://127.0.0.1:4000/standalone/mechanical-hand?revision=2`。页面右上角显示“外形修订 02”。现有资产 ID `tendon-hand-v1` 保留，manifest 的 `appearance_revision` 为 2。未部署、未替换课程或学习记录。

## 实际修改

- 用闭合曲面网格替代方形掌板：腕部收腰、拇指侧隆起、小指侧弧线、错落的指根轮廓、独立掌面与手背面。
- 重新制作分区接触垫、拇指连接座、指根支座与掌内骨架。
- 用沿长度变化的圆角截面制作渐缩指节，替代矩形指壳和接触块。
- 将五个外露卷线轮移到腕部外壳内，分两排错位布置。掌内牵引绳改为从前壳下面通过。
- 外观默认隐藏牵引绳；勾选“隐藏外壳，看内部”时自动显示绳路。保留独立开关、五指控制、对掌、参考球限位与现有姿态计算。
- 重新导出 Blender 源文件、GLB、静态结构图和资产哈希；网页模型地址带版本参数以刷新缓存。

## 参考资料

- [Shadow Dexterous Hand 官方技术规格（June 2024）](https://www.shadowrobot.com/wp-content/uploads/2024/06/20240610-UPDATED-shadow_dexterous_hand_e_technical_specification.pdf)：查看 PDF 第 4 页的正面与侧面外形，重点观察指根错位、拇指根部和腕部收窄。
- [Open Bionics Hero Arm 官方图片](https://openbionics.com/en/prosthetic-hands-that-move/)：参考外壳分段与指节轮廓。

模型仍为原创教学结构，并非上述产品的 CAD 或经过加工验证的设计。本批改善外形与装配表达，运动学、近似接触和理想收绳公式的边界保持不变，没有增加真实抓力仿真。

## 验证

- `before-desktop.png` 为上版实际画面；`desktop.png`、`inside.png`、`closed.png`、`ball.png`、`mobile.png` 等为本版实际浏览器截图，已核对。
- `model-check.json` 通过：210 个关节端点对比、456 个源动画绳路端点、58 个接触场景，以及 89,628 个指节网格顶点的接触包络检查。
- `browser-check.json` 通过：五指指令、对掌、收绳量、外壳与绳路显隐、演示暂停/复位、参考球、相机、静态图/恢复、上下文丢失、390px 布局与下载。页面异常和控制台错误为空。
- 相关组件 ESLint 通过。全项目类型检查仍是既有六处错误，新文件无类型错误；见 `typescript-baseline.txt`。未执行生产构建或部署。

在仓库根目录复现：

```sh
blender --background --factory-startup -t 6 --python scripts/mechanical-hand/build_hand.py -- --render
HAND_ARTIFACT_DIR=artifacts/mechanical-hand-form-v2-20261110 node scripts/tests/mechanical-hand.cjs
HAND_ARTIFACT_DIR=artifacts/mechanical-hand-form-v2-20261110 node scripts/tests/mechanical-hand-browser.cjs
```

Blender 版本 4.5.4 LTS；Three.js 沿用项目版本。上一版验收资料仍保存在 `artifacts/mechanical-hand-20261110/`。
