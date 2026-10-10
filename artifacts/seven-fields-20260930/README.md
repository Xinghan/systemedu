# 七领域重分类与职业扩展

本批修改规划与完整清单：

- `docs/plans/2026-09-30-seven-fields.md`：七领域、七项目线与十四个职业分支的设计。
- `docs/plans/2026-09-30-project-reclassification.md`：49 个项目 ID 的主要归属、关联领域、线上状态，以及后续 AI 职业蓝图。
- `packages/student-web/src/lib/project-lines/project-taxonomy.json`：展示分类的唯一映射。原始课程 URL 和存储键不变。

## 图片

使用内置 image_gen 生成两幅中国专业人员职业场景，未使用 CLI/API fallback。完整提示词是 `computing-prompt.txt` 和 `neuroscience-prompt.txt`；原图是同名前缀的 `*-source.png`。原始生成路径、网页路径与字节数见 `image-variants.json`。网页文件位于 `packages/student-web/public/library/futures/{computing,neuroscience}-career-v1-{480,800,1280}.webp`。

视觉检查：AI 图同时表现人物、图像姿态标记与模型曲线；脑科学图表现脑电采集、研究人员与志愿者。图片为虚构场景，页面标注 AI 生成。已查看两方向桌面/手机截图和七项目线全页截图，图片未遮挡文字。

## 验证

`verify.mjs` 的 34 组检查覆盖七领域、七项目线、十四职业分支、主归属唯一、跨领域筛选、不重复计数、旧分类检索、中英文、320/390/1440px、旧课堂地址和返回链接、完整课程详情的领域标签、服务失败时不虚假开放。结果见 `verification.json`。对完整课程目录与详情使用 fixture，不提交学生记录。

本地当前有 37 个短/引导/系统项目；其中地球本地课程属于此前未提交内容，本批未混入。生产公开目录在本次读取时返回 9 个已发布课程。分类还预先覆盖 ALOHA、Lightkurve、TeachOpenCADD 的真实课程 ID；没有更改其发布状态。只有目录实际提供可用课程时，职业分支才显示开始链接。

全量 TypeScript 检查未通过：`slide-demo/page.tsx` 有两处类型转换问题，`course-content-view.tsx` 有四处参数数量问题，均在本批未修改文件中；原始输出见 `typecheck.txt`。课程详情页原有 ESLint 的 effect 问题保留，前后诊断对比见 `lint-comparison.json`。本批库页与分类组件的定向 ESLint 通过。

本批只修改分类、导航、职业说明和相关图片，没有生成新课堂，没有部署生产。
