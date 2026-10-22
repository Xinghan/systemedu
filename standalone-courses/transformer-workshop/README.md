# 单头因果注意力：课后实现项目

本项目对应 /standalone/transformer-lab 三维模型中的 Attention 部件。目标是实现并解释单头因果注意力，不要求训练语言模型。CPU 即可，不需要 GPU、模型权重或 API key。

## 环境与运行

- Python 3.12.x（浏览器固定 Pyodide 0.27.7 / Python 3.12.7）
- NumPy 2.0.2；测试使用 Python 标准库 unittest
- macOS、Linux 或 Windows；初次安装依赖需要网络

~~~bash
python3.12 -m venv .venv
source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1
python -m pip install -r requirements.lock
python -m unittest discover -s tests -v
~~~

初始骨架会报告 NotImplementedError，这是需要你完成的作业。编辑 src/attention.py，或把网页编辑器中的函数复制到该文件，再运行测试。函数必须返回 (weights, output)，不接受仅打印结果。

## 任务与验收

1. 写出 Q/K/V 和每个中间矩阵的形状，解释 Q @ K.T 的两个序列轴。
2. 实现任意合法 T、dₖ、dᵥ 的因果注意力；每行至少允许对角线，输入矩阵为有限浮点数。
3. 通过所有测试，并自己增加一个能揭示错误实现的反例。不要把测试固定输入硬编码到函数。
4. 在 reports/reflection.md 中解释：为什么要缩放、为什么按行归一化、为什么先 softmax 再直接清零不等价，以及未来扰动不应改变哪些输出。
5. 保留一个错误版本和修复版本的 Git 提交，说明测试怎样帮助定位原因。

测试包括 T=1、不等的 dₖ/dᵥ、随机矩阵、极端得分、行和、未来权重、前缀不变性与独立标量参考。容差允许正常的浮点误差。全部被遮住的行不属于本项目输入契约。

## 代码管理

~~~bash
git init
git add README.md requirements.lock pyproject.toml .gitignore src tests reports
git commit -m "chore: initialize causal attention exercise"
# 每次形成可检查结果后，只暂存相关文件，再提交。
git add src/attention.py tests/test_attention.py reports/reflection.md
git commit -m "feat: implement causal attention with invariance tests"
~~~

提交源代码、测试、环境文件和反思。不要提交虚拟环境、模型权重、密钥或包含私人信息的完整学习日志。此项目不需要任何密钥。

## 对照实现

solutions/attention.py 是课后对照实现。建议先完成自己的版本，再对照数学定义。核对发行包时可运行：

~~~bash
ATTENTION_IMPLEMENTATION=solutions/attention.py python -m unittest discover -s tests -v
# PowerShell: $env:ATTENTION_IMPLEMENTATION="solutions/attention.py"
~~~

## 资料索引

- [原论文 §3.2.1](https://arxiv.org/html/1706.03762v7#S3.SS2.SSS1)：缩放点积定义；§3.2.3：decoder 遮罩。
- [3Blue1Brown 官方配套讲义](https://www.3blue1brown.com/lessons/attention/)：几何解释与视频入口。
- [Karpathy: Let's build GPT](https://www.youtube.com/watch?v=kCc8FmEb1nY)：查找 self-attention 实现主题。本版不提供未经核验的片段时间。
- [Harvard NLP 官方仓库](https://github.com/harvardnlp/annotated-transformer)：带注释的实现参考。

本包提供原创教学实现，不包含第三方整篇材料或字幕。
