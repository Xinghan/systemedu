# LLM 后训练工程 · 独立专业课程

五节点：方法体系 → SFT 循环 → LoRA → QLoRA → 可复现项目。直接编写内容与代码，未使用 course_factory。独立网页路径 `/standalone/post-training/M01`，不注册到其他课程目录。

- `nodes/`：课程正文、公式、代码讲解和节点作业。
- `course.json`：YouTube 视频索引、观看问题、大学讲义、5×5 页讲课提纲。
- `project/README.md`：Python 环境、训练/评估命令、代码管理与完整验收标准。CPU测试无需下载模型；正式训练需要 NVIDIA CUDA GPU。
- `package_course.py`：构建下载包，标准库脚本，无课程生成器依赖。
- `verification/`：本轮实际检查证据。GPU训练和远程视频可播放性与本地页面检查分别报告。

网页保留系统已有的正文和讲课组件；学习记录使用独立 course/version 命名空间。15个新增算法实验提供参数调节、逐步播放、中间数值、矩阵与曲线，以及预测后验证的问题；保留原3D形状与掩码辅助演示。所有小规模计算均标注边界，非实测模型权重。样例合成数据只用于管线测试，不能用于证明泛化。

视频均为原课程或研究作者讲解，链接在编写时通过公开索引核实。完整视频不标注未经核实的片段时间；大学与作者资料用于参考，本站不代表相关机构。

## 详解版（2026-10-16.3）

正文约3.5万字符（含公式与代码），补充概率、注意力、链式法则、矩阵秩等背景，以及公式推导、手算、代码对应和反例。

| 节点 | 正文内计算动画 |
|---|---|
| M01 | 自回归概率链；BT奖励模型/DPO；组相对奖励/PPO裁剪/KL |
| M02 | 因果注意力与shift；softmax-CE/SGD；反传与冻结；token加权累积；AdamW与裁剪 |
| M03 | BAx低秩乘法；LoRA初始化与两步梯度 |
| M04 | NF4块量化；double quantization；激活checkpointing重算 |
| M05 | 混淆矩阵与macro F1；配对bootstrap |

`project/numerical_walkthrough.py` 提供可在CPU核对的关键数值与梯度；`verification/check-algorithms.cjs` 校验前端计算、参数边界、正文覆盖与记录恢复。实验不会自动运行真实模型。

内容版本升级与学习记录版本分离：继续读取原 v2 storage key、节点id、5页讲课索引、笔记、自查和3D参数；在兼容的可选 `experiments` 字段中保存15个新实验的参数与步骤。旧导出JSON仍可导入。
