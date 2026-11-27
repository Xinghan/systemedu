# iPad 课堂精简与资料下载验收

2026-11-27，iPad Air 11-inch (M4)，本地 Debug 构建。测试使用独立学习记录，不重置用户已有进度或角色。

## 改动范围

- iPad 去掉讲课入口、讲课面板、右上角全局分享/导出及旧磁盘提示图标；保留阅读、笔记、活动、自动保存与失败反馈。
- 正文资料、活动资料列表、新窗口和生成文件由原生资料页承接，完成后回到原课堂。
- CSV、文本、Notebook 支持原生文本预览；PDF 等支持系统预览；ZIP 可保存原文件。
- 「保存到文件」使用系统文档选择器。SystemEdu 文稿目录可在「文件」App 访问；学习数据库保持在 Application Support。
- 原课程节点、正文、媒体、稳定 ID、版本、学习记录结构均未修改。桌面网站讲课方式未变。仅重建本地阅读器，没有重新导出课程内容。

## 验证

| 检查 | 结果 |
| --- | --- |
| learning-runtime TypeScript 检查 | 通过 |
| learning-runtime 自动化检查 | 28 项通过，覆盖状态保存与恢复、完成及重试等 |
| 原生文件处理 | 3 项通过：真实 Notebook/CSV/ZIP/HTML 原件与预览副本字节一致；中文文件名、错误反馈、外链分流、停用桥接、Files 配置与记录目录隔离 |
| 外部 PDF 实际下载 | 通过，原课文引用 `https://archive.stsci.edu/kepler/manuals/archive_manual.pdf`，验证 PDF 文件签名；联网测试按需单独运行 |
| 实际导出 ZIP | 通过系统选择器保存 `lightkurve-practice-kit.zip`，9,509,284 字节；导出 SHA-256 与原件完全一致，详见 JSON |
| 最终文本预览 | Notebook 正文、CSV 字段均在原生文本视图可见；打开、关闭、返回课堂通过 UI 自动化与截图检查 |
| 重复导出 | UI 测试通过系统文件名输入框改用独立名称，再次保存并核对原件哈希；未覆盖第一份下载 |
| 课堂导航回归 | 完成第 2 步进入第 3 步；返回和重启后均保留第 3 步 |

文本预览改用原生 UITextView，避免长文件在双向 SwiftUI ScrollView 中出现空白。CSV 预览显示开头部分并提示保存后查看完整文件，导出不截断。测试进一步核对真实文本值和可见区域，不再仅以「保存」按钮出现判断预览成功。

## 适用范围

- Notebook 可在 App 内阅读说明和代码，执行 Python 仍需要支持 Jupyter 的环境。
- 支持打包的课程文件、课堂生成的文件和 HTTPS 直接文件链接。普通参考网页仍在浏览器窗口打开。远程下载需要网络。
- 当前单文件处理上限 50 MB；生成文件沿用 12 MB 限制。系统文件保存的位置可自行选择，验收 ZIP 位于「我的 iPad → SystemEdu」。
- 图片为模拟器验收；尚未在实体 iPad 或 iCloud Drive 上验证。

## 证据

- `simplified-classroom.png`：没有讲课与全局分享按钮。
- `notebook-preview.png` / `csv-preview.png`：原生资料预览。
- `save-to-files.png`：系统文件保存选择器。
- `saved-file-verification.json`：实际落盘文件大小与哈希。

本轮结果包（本机临时目录）：`/tmp/systemedu-materials-save-and-pdf.xcresult`（实际保存及联网 PDF）、`/tmp/systemedu-materials-readable.xcresult`（最终文本预览与进度回归）、`/tmp/systemedu-materials-export-repeatable.xcresult`（独立命名重复保存）。
