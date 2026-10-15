# LLM 后训练工程 · 独立专业课程

五节点：方法体系 → SFT 循环 → LoRA → QLoRA → 可复现项目。直接编写内容与代码，未使用 course_factory。独立网页路径 `/standalone/post-training/M01`，不注册到其他课程目录。

- `nodes/`：课程正文、公式、代码讲解和节点作业。
- `course.json`：YouTube 视频索引、观看问题、大学讲义、5×5 页讲课提纲。
- `project/README.md`：Python 环境、训练/评估命令、代码管理与完整验收标准。CPU测试无需下载模型；正式训练需要 NVIDIA CUDA GPU。
- `package_course.py`：构建下载包，标准库脚本，无课程生成器依赖。
- `verification/`：本轮实际检查证据。GPU训练和远程视频可播放性与本地页面检查分别报告。

网页保留系统已有的正文和讲课组件；学习记录使用独立 course/version 命名空间。15个算法实验采用可点选的空间计算图、连续播放与可拖动时间轴。点选 token、矩阵元素、向量或样例即可追踪其贡献；LoRA 可切换到真实数值的三维投影，旋转查看 B 的列空间。原装饰性矩阵旋转与旧概览小实验已从正文移除。所有小规模计算均标注边界，非实测模型权重。样例合成数据只用于管线测试，不能用于证明泛化。

视频均为原课程或研究作者讲解，链接在编写时通过公开索引核实。完整视频不标注未经核实的片段时间；大学与作者资料用于参考，本站不代表相关机构。

## 空间推演版（2026-10-16.4）

正文约3.5万字符（含公式与代码），补充概率、注意力、链式法则、矩阵秩等背景，以及公式推导、手算、代码对应和反例。

| 节点 | 正文内计算动画 |
|---|---|
| M01 | 自回归概率链；BT奖励模型/DPO；组相对奖励/PPO裁剪/KL |
| M02 | 因果注意力与shift；softmax-CE/SGD；反传与冻结；token加权累积；AdamW与裁剪 |
| M03 | BAx低秩乘法；LoRA初始化与两步梯度 |
| M04 | NF4块量化；double quantization；激活checkpointing重算 |
| M05 | 混淆矩阵与macro F1；配对bootstrap |

`project/numerical_walkthrough.py` 提供可在CPU核对的关键数值与梯度；`verification/check-algorithms.cjs` 校验前端计算、参数边界、正文覆盖与记录恢复。实验不会自动运行真实模型。

内容版本升级与学习记录版本分离：继续读取原 v2 storage key、节点id、5页讲课索引、笔记、自查和3D参数；在兼容的可选 `experiments` 字段中保存15个新实验的参数与步骤，新增可选 view 保存连续时间、固定选中元素和计算图/几何模式。旧导出JSON仍可导入；旧 lab 字段保留以兼容记录，但不再显示旧装饰性实验。


## 可探索计算图

- **LoRA**：追踪 `x → A → u → B → Δh`，与 `W₀x` 冻结路径相加。几何视图将真实的 B 列向量、低秩直线/平面、增量向量投影到屏幕；拖动旋转。几何相机仅用于观察，不代表训练。
- **SFT**：query/score/mask/Value 连线与真实注意力概率关联；softmax 展示指数、分母、目标 loss、反向导数和更新后的分布。冻结与 detach、加权梯度累积、AdamW 分别使用适合该运算的图。
- **QLoRA**：权重在数轴上归一化、移动到最近的 NF4 码点、编码并恢复；double quantization 展示 scale 的第二级编码，checkpoint 展示每个阶段的保存、释放与重算路径。
- 所有实验支持暂停、0.5/1/1.5倍速、连续时间轴、分章跳转、参数调节、元素检查器、缩放和平移；完整公式和适用边界可展开阅读。移动端默认放大局部，可拖动画布或用「适配完整画布」总览。动画仅在主动播放且场景可见时推进。

交互设计参考用户提供的 [Transformer Explainer](https://poloclub.github.io/transformer-explainer/)、[LLM Visualization](https://bbycroft.net/llm) 与 [LLM Visualized](https://www.llm-visualized.com/)，采用逐量追踪、空间关系和连续推演的方法。图形与代码为本课程编写，没有复制参考站点资产；这是可手算的小规模教学场景，并非完整模型的实时执行器。

`verification/check-scenes.cjs` 渲染全部场景及参数边界、过渡时刻，检查可选元素、数值检查器与兼容记录恢复；`check-http.py` 检查正文内的实际图形入口、视频索引与下载包。
