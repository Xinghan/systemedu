# 分子怪兽猎人 · slide 修复生产发布

- 日期：2026-09-08。
- 项目：分子怪兽猎人（AI 药物发现 + 计算化学）。
- Slug：`molecule-monster-hunter`。
- 生产地址：`https://systeme.xin`。
- 最终前端 Build ID：`F0sx1IVmLhMCXEpoRcBc1`。
- 本批范围：32 个节点、64 页视觉修复；其中 29 页有 typed technical visual（RDKit 3、代码状态 12、公式推导 13、接口契约 1）。这不是全部 437 页已经重做的声明。

## 发布内容

1. 发布此前完成的知识密集型 SVG/HTML、M04 图片与结构对照，以及技术渲染批次。
2. 新增 M87 第 4、5 页：原始值 10/30/50 → 0/0.5/1 → 毒性反向；四项得分与权重 → 单项贡献 → 综合得分 0.81。
3. 播放器兼容旧 `payload.title`、`subtitle`、`concept_cards.label/text`；恢复 31 页旧格式标题以及原先遗漏的 bullet/outro 要点。
4. 节点和 slide 切换时重建播放器状态，避免相邻交互页沿用上一页的推导进度；音频绑定当前路径。
5. RDKit JavaScript/WASM 同源部署。JSXGraph 1.12.2 未导出 CSS 子路径，改为原版样式的本地副本，正式构建已验证。

## 隔离与回滚

没有运行全仓库 `pack/code/all`，因为本地还有与 slide 无关的未发布改动。
前端基于线上现有源码建立独立构建目录，只覆盖播放器、技术渲染、类型、锁定依赖和对应资源；首页、后台管理和其他课程代码保持线上版本。

课程以线上内容目录为基础，仅覆盖 32 个 `slides.json` 和 1 个关联图片文件。没有覆盖封面、故事、音频、任务、知识树或项目元数据。重新生成并验证了 730 个线上包文件，通过既有 `_import_courses.sh` 完成单课程 import/publish，发布响应为 200。

服务器发布目录：`/opt/systemedu/releases/slides-20260908`。

- `student-web-before/`：可回滚的旧前端（含原构建）。
- `course-before.tar.gz`：原课程文件完整备份。
- `library-before.sqlite`：发布前 SQLite 一致性备份。
- `build.log`、`npm-ci.log`：构建日志。
- `/tmp/slide-release-inventory-20260908.json`：逐文件哈希和逐页改动清单。

发布中曾发现新构建使用了错误的 API 环境变量名。已恢复旧前端后重建，最终使用与主部署脚本一致的 `NEXT_PUBLIC_STUDENT_API_URL='' NEXT_PUBLIC_GATEWAY_URL=''`，并检查新 JS 不含 `http://localhost:18820`。最终上线的是上述 Build ID，不是失败的中间版本。

## 验证

- 正式 Next.js production build 成功。
- 3 项旧格式归一化回归测试通过，修改文件 ESLint 通过。
- 本地扫描 437 页，页数未变化；恢复 31 页旧标题；39 个公式推导状态通过 KaTeX 解析。
- 逐一读取线上内容接口：47 个节点、437 页均与已发布文件一致，29 个技术渲染映射一致；33 个增量文件哈希一致。
- `systemedu-student-web`、`systemedu-student-backend`、`systemedu-library` 均 active。
- HTTPS 首页、M87 页面、`/api/health` 返回 200，health `ok=true`。
- RDKit JS/WASM 在暂存构建的 HTTP 实际读取检查通过；正式 HTTPS 的 WASM 实际读取返回 200，最终构建无开发 API 地址残留。
- 最终浏览器点击检查未完成：电脑在验收期间锁屏。不能据此宣称生产公式按钮与 RDKit 绘图已经完成端到端人工验收；用户应按下方入口验证。
- 仓库仍有不属于本批的既有 TypeScript 错误；生产遵循既有 `ignoreBuildErrors` 配置。没有把全仓库类型检查标为通过。

## 建议验证入口

进入对应课程页后选择「老师讲课」，再翻到列出的页码（从 1 开始）。

- [M04](https://systeme.xin/learn/molecule-monster-hunter/M04)：第 1 页的 RDKit 精确分子结构与结构对照。
- [M87](https://systeme.xin/learn/molecule-monster-hunter/M87)：第 4、5 页；点击「下一步推导」，检查公式、证据数值一起变化，翻到下一页应从第 1 步开始。
- [M90](https://systeme.xin/learn/molecule-monster-hunter/M90)：第 4 页；点击「下一接口状态」，查看正确特征顺序与 MW/LogP 错位。

已克隆项目无需重新克隆：学习接口实时读取内容库的最新节点内容。刷新页面即可加载新构建。

## 本批修改页码

| 节点目录 | 老师讲课页码（从 1 开始） |
| --- | --- |
| `M01-w0-module` | 1, 2, 3, 4, 7, 8 |
| `M02-w0-rdkit` | 1, 2, 3, 4, 7, 8 |
| `M03-w0-module` | 1, 2, 3, 4, 5, 6, 9, 10 |
| `M04-w0-module` | 1, 2, 3, 4, 5, 8, 9 |
| `M05-w0-module` | 6 |
| `M23-w0-pubchem-smiles` | 4 |
| `M24-w0-smiles` | 4 |
| `M25-w0-module` | 4 |
| `M26-w0-module` | 3 |
| `M27-w0-rdkit-smiles` | 3 |
| `M28-w0-canonical-smiles` | 4 |
| `M32-w0-pandas` | 7 |
| `M33-w0-module` | 4 |
| `M34-w0-module` | 4 |
| `M36-w0-mw` | 3 |
| `M38-w0-rdkit-logp` | 1, 4, 7, 8, 9, 10 |
| `M44-w0-8` | 3 |
| `M50-w0-tanimoto` | 4 |
| `M51-w0-module` | 1, 2, 3 |
| `M52-w0-module` | 3 |
| `M53-w0-module` | 3 |
| `M56-w0-module` | 3 |
| `M57-w0-module` | 3 |
| `M60-w0-module` | 7 |
| `M68-w0-vs-scaffold` | 1 |
| `M71-w0-0-1` | 6 |
| `M74-w0-module` | 7 |
| `M78-w0-roc` | 10 |
| `M81-w0-module` | 6 |
| `M87-w0-top10` | 4, 5 |
| `M89-w0-module` | 4, 10 |
| `M90-w0-workbench-go-no-go` | 4 |
