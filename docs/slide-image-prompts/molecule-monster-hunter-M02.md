# 分子怪物猎人 · M02 讲课视觉替换记录

## 范围

- 课程项目：`molecule-monster-hunter`
- 节点：`M02-w0-rdkit`
- 原始教学目标：在家长协助下安装 RDKit，理解 `install` 与 `import` 的不同，并以打印版本号作为环境已就绪的证据。
- 视觉规则：本节点是软件工程和代码作用域教学。所有静态图使用可缩放 HTML/SVG；保留原有互动 HTML 来讲解状态变化与报错因果；不生成栅格图片。

## 逐页媒介与映射

| Slide | 原始教学主张 | 最终媒介 | 替换内容 / 映射 | 理由 |
| --- | --- | --- | --- | --- |
| `s1` | RDKit 环境的完成标志 | HTML/SVG 工程流程图 | `payload.inline_svg`：`pip install` → RDKit → `import rdkit` + 版本号 | 使“第一次握手”的可验证条件一目了然。 |
| `s2` | 库、命令行、第一行的关系 | HTML/SVG 系统链路图 | `payload.inline_svg`：工具包 → 命令行 → 版本号验证 | 这是软件系统关系，而不是人物情境。 |
| `s3` | 为什么使用现成库 | HTML/SVG 模块图 | `payload.inline_svg`：RDKit 已封装的读取、绘制、计算能力 → Python 调用 | 让学生看见复用专业组件的工程逻辑。 |
| `s4` | `install` 不等于 `import` | HTML/SVG 作用域对照图 | `payload.inline_svg`：环境范围（一次安装）与当前程序范围（每次导入） | 将容易混淆的时间/作用域区别精确呈现。 |
| `s5` | 装 → import → 用的状态变化 | 既有互动 HTML 动画 | `idea_id=anim_1781595481194_foba`，不替换静态缩略图 | 该页的知识点是状态转移，应由动画呈现。 |
| `s6` | 漏 `import` 的真实报错因果 | 既有互动 HTML 游戏 | `idea_id=game_1781595481194_xwab`，不替换静态缩略图 | 操作、错误和反馈是不可替代的教学内容。 |
| `s7` | 三步命令与版本号截图 | HTML/SVG 运行协议图 | `payload.inline_svg`：`pip install rdkit` → `import rdkit` → `print(rdkit.__version__)` → 截图 | 命令完整保存为可选择、可缩放的 DOM 文本；已检查无裁切。 |
| `s8` | 环境就绪后进入 M03 | HTML/SVG 学习路线图 | `payload.inline_svg`：RDKit 环境 → 分子表示 → 水分子的原子结构 | 将本节产物直接连到下一节的探索对象。 |

## 实现位置与检查

源文件：

`/Users/xinghan/Dev/systemeduidea/projects_data/molecule-monster-hunter/knodes/M02-w0-rdkit/slides.json`

- `slides.json` 已通过 JSON 解析。
- 代表性的环境流程、作用域对照、命令验证与 M03 过渡图已在浅色学生端背景上进行 SVG 渲染检查。
- 命令文本采用 DOM/SVG 文本而非图像生成；没有增加前端包，也没有生成/下载栅格图。
- 本轮尚未部署生产环境。
