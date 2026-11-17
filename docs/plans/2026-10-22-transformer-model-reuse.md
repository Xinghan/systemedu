# Transformer 模型优先交互：现有项目调研与接入

2026-10-22。根据用户最新要求，取代此前任务列表优先的设计。当前入口为 `/standalone/transformer-lab`，独立于 post-training 与正式课程。

## 查到的项目与取舍

| 项目 | 已核实的能力 | 本次处理 |
| --- | --- | --- |
| [Brendan Bycroft / llm-viz](https://github.com/bbycroft/llm-viz) | 3D 张量、格子数值、依赖追踪、逐算法 walkthrough；minGPT A/B/C 排序权重；WebGL + WASM；当前 MIT | **直接复用核心源码、权重和推理资源**，改造本地入口与学习适配层 |
| [Polo Club / Transformer Explainer](https://github.com/poloclub/transformer-explainer) | 浏览器 GPT-2 推理、Sankey 关系、注意力与采样；Svelte + D3 + ONNX；MIT | 参考关系图和参数实验的表达；本批次未复制其源码 |
| [LLM-Visualized](https://www.llm-visualized.com/) | 页面提供 2D/3D、逐层播放、矩阵选择、KV cache、方程叠层 | 参考控制方式；本次未找到并确认其官方源码许可，不复制代码 |
| [AnimatedLLM](https://github.com/kasnerz/animated-llm) | D3 + GSAP 的交互解释项目；MIT | 补充对照，未接入 |

调研依据为官方页面和仓库。远程 Bycroft 页面自动化读取超时；随后通过检出源码、接入本地并实际操作其 3D 场景验证。没有声称已完整体验所有远程项目。

## 复用边界

固定上游 `bbycroft/llm-viz@9da93742382f1bf36c020c38a1ace454e82c4490`。54 个引擎相关 TypeScript 文件保存于 `third_party/llm-viz/src`，构建脚本生成应用内 JavaScript。保留上游 MIT、Roboto Apache 2.0、BaKoMa 字体许可。没有引入个人主页、肖像、CPU 模拟器或其他无关项目。

直接保留：三维布局、WebGL 渲染、射线拾取、逐格依赖显示、Embedding / LayerNorm / Attention / Softmax / Projection / MLP / Transformer / Output 各自的动画、训练权重与 WASM 推理。未重新实现一套替代渲染器。取消原英文侧栏，把它替换成模型部件驱动的中文学习面板；英语数学标签仍保留。

新增：本地资源路径与生命周期适配、模型格子到概念的映射、八个概念解释及问题、八个可执行 Python 填空、当前模型所有层/头的注意力热图、GELU 曲线、温度实验、过程记录与学习路径。Python 在 opaque-origin iframe 内的新 Worker 中运行；首次需要联网下载固定版本 Pyodide。题目和代码检查是本地练习，不是正式能力认证。原讲解断点改为连续播放，暂停后跳转时间线会补绘镜头变更。

## 模型事实与界限

模型为 decoder-only / Pre-LN，3 block × 3 head，隐藏维度 48，每头维度 16，上下文容量 11，词表 A/B/C。任务训练输入为 6 字符排序；界面接受 1–6 字符用于观察，但短输入并不保证任务准确率。生成采用上游 greedy 选择。输出温度与注意力温度是明确标记的独立观察实验，未改变 greedy 规则，也未伪称更改底层参数。

没有把它称作 GPT-2 自然语言模型或 2017 encoder-decoder 的完整复现。未实现 KV cache、训练/反向传播、RoPE 或跨注意力；这些不能从当前演示推断已经覆盖。

## 验证

`node scripts/transformer-workshop/verify-model.cjs`：27 项通过。真实 WASM 模型的 9 个层/头分别对照独立数值实现；最大注意力权重差 4.14e-8。包括真实 embedding 查表、未来输入扰动不影响前缀 logits、输出归一化、7 个非 Attention Python 练习的正确与错误实现。Attention 在浏览器实际 Pyodide 中通过当前模型及 7 项合成/不变性检查。

Scoped ESLint 通过；应用 TypeScript 仍有 6 个此前已有错误，分布在 slide-demo 与 course-content-view，本次代码无新增 TypeScript 错误。未声称全应用构建通过。浏览器 UI 验收记录与截图见 artifacts/transformer-model。

原 workshop 草稿文件仍留在工作区，当前页面不再引用；旧 IndexedDB 学习记录未修改。新记录使用独立 localStorage key，QA 使用 `?practice=1` 独立 key。

浏览器实际验证：八个算法均能进入各自动画；时间线跳转会更新镜头；点击 Input Embed 小格显示索引 [5,17,0] 和实际值 0.012177；输入 BBBBBB 后生成第七个 B；错误 ReLU 被 GELU 检查拒绝，修复后通过；刷新恢复代码、结果与学习路径。最终干净加载的控制台无错误。视口覆盖工具未实际改变 1270px 视口，因此移动端布局未宣称通过实机验收。浏览器下载权限先前被拒，未再次执行下载验证。
