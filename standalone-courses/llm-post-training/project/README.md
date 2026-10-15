# TicketLab · SFT / LoRA / QLoRA

专业课程配套实验仓库。目标：把工单转成严格 JSON `{category, priority}`，通过同一测试集比较任务适配前后效果与成本。基座是已经过指令微调的 Qwen2.5-0.5B-Instruct，本项目训练的是领域任务适配。

## 环境

- 训练参考：Linux x86_64、Python 3.12、单张 NVIDIA CUDA GPU。建议 16 GB 显存、32 GB RAM、10 GB 可用磁盘，max_length=512、microbatch=1；这是起始预算，不是实测峰值或所有 GPU 的保证。更大模型/序列要重新测量。
- 依赖锁：PyTorch 2.8.0；Transformers 4.57.3；PEFT 0.18.0；Accelerate 1.12.0；bitsandbytes 0.48.2（仅 CUDA 路径）。CUDA wheel 和驱动须匹配，按 PyTorch 官方安装说明检查。BF16 用 `torch.cuda.is_bf16_supported()` 探测，不支持则 FP16 + GradScaler。
- macOS/CPU 可运行下面的离线测试；课程未把 macOS 作为此 bitsandbytes QLoRA 路径的验收平台。

```bash
python3.12 -m venv .venv
source .venv/bin/activate
# NVIDIA Linux 参考 wheel；先用 nvidia-smi 检查驱动
pip install torch==2.8.0 --index-url https://download.pytorch.org/whl/cu126
pip install -r requirements-cuda.txt
python -c "import torch; print(torch.__version__, torch.version.cuda, torch.cuda.is_available())"
python -m unittest discover -s tests -v
```

CPU/macOS 验证：用 `pip install torch==2.8.0 -r requirements.txt` 代替两条 GPU 安装命令。测试从配置随机初始化一个极小 Qwen2 模型，无网络、无模型下载；检查掩码、shift、token 加权累积、冻结权重、适配器更新和保存重载。

## 数据与第一轮实验

```bash
python prepare.py --pin
# 检查并提交 configs/*.json 中解析出的真实模型 commit SHA
python train.py --config configs/lora.json
python train.py --config configs/qlora.json
python evaluate.py --config configs/lora.json --output runs/baseline-float.json
python evaluate.py --config configs/qlora.json --output runs/baseline-nf4.json
python evaluate.py --config configs/lora.json --adapter runs/lora --output runs/lora-test.json
python evaluate.py --config configs/qlora.json --adapter runs/qlora --output runs/qlora-test.json
```

首次网络操作会解析模型版本并下载 tokenizer/权重（由 train/evaluate 触发）。不需要 API 推理服务。下载前检查网络、模型许可与存储。`prepare.py` 不覆盖已有数据。

**自带 36/12/12 条合成样例仅用于接通管线**：文本模板跨 split 重复，不能用其分数证明泛化。正式项目要替换为 train≥300、dev≥60、test≥60 条人工审核数据，按真实事件/客户/模板族分组划分，不能通过修改 group 字段伪装隔离。类别和优先级覆盖需报告。无权使用真实数据时，自写完整事件与自然语言改写，并按事件族划分。

每行：`id`、`group`、`text`、`target`。标签定义见 core.SYSTEM。训练前运行检查；`assert_disjoint` 只检查 group、规范化全文和 id 的精确重叠，**不会自动发现近似改写**，需人工抽查和补充近重复审计。

## 读代码的顺序

1. `core.py::encode`：chat template 的 prefix 对齐；仅 assistant continuation 含 EOS 监督；超长样例报错，避免截掉回答；本实现只覆盖单轮。
2. `core.py::collate`：右 padding，按位置 mask padding，EOS 即使与 pad id 相同也保留目标。
3. `core.py::causal_loss_sum`：logits[t] 对 labels[t+1]，只 shift 一次，返回总损失与有效 token 数。
4. `train.py::load_model`：LoRA / NF4 加载，prepare_model_for_kbit_training 在注入 adapter 前，打印并检查可训练参数。
5. `train.py::main`：累计窗口按总有效 token 数归一化；autocast、GradScaler、clip、step；dev NLL 与 CUDA 峰值；epoch 结束保存 checkpoint。
6. `evaluate.py`：同 prompt、贪心、96 输出 token；严格 JSON，不修复输出；无效输出计错；记录逐例预测。

此参考实现使用普通 AdamW，不声称复现 QLoRA 论文的 paged optimizer；量化基座 + LoRA + double quant 是此实验的范围。也不含 packing、分布式训练、学习率调度或自动超参搜索。

## 断点与复现

`adapter/` 只有适配器与 tokenizer；`training.pt` 保存优化器、scaler、随机状态和下一个 epoch。修改配置中的 epochs 后以 `--resume` 继续；**只支持已完成 epoch 边界的恢复**，中途故障重跑当前 epoch。首次 epoch 尚未完成时应使用新输出目录。只加载自己生成且可信的 checkpoint。

`run.json` 含已解析模型 SHA、数据 SHA256、完整配置、设备、dev loss、可训练参数和峰值显存。`environment.txt` 是实际依赖快照；`metrics.jsonl` 是按优化器步记录的 token 加权 NLL。恢复时验证配置与数据指纹。跨 GPU/内核版本不能保证逐位一致；保存软件、驱动和硬件信息，用容差及多随机种子检查稳定性。

## 代码管理与交付

```bash
git init
git switch -c experiment/lora-r8
git add core.py train.py evaluate.py prepare.py tests configs README.md requirements*.txt .gitignore
git commit -m "feat: establish masked SFT baseline"
# 调参前固定数据；独立分支/独立输出目录记录 r=8 与 r=16 消融
# 交付时补上 reports/、合法可公开的数据或数据生成/获取与校验说明
git tag -a submission-v1 -m "Reproducible post-training project"
```

代码、配置、测试、README、数据说明、报告进入 Git；模型权重、cache、.venv、原始私有数据、密钥和大型 checkpoint 不进入 Git。用对象存储或 Git LFS/DVC 管理需保留的大产物，并在报告登记 URI、SHA256、权限和过期时间。适配器也可能包含训练数据特征，发布前检查数据授权。日志中的私有文本要脱敏。

## 验收项目

交付一个可复现实验，而不是截图。提交：仓库 tag/commit、environment.txt、数据卡、四组逐例预测与指标（float 基线、NF4 基线、LoRA、QLoRA）、r=8/16 消融、显存/耗时、≥10 个错误案例、重新加载验证、2–4 页报告。

| 维度 | 分值 | 验收证据 |
|---|---:|---|
| 数据与任务定义 | 20 | 审核后的 300/60/60+ 数据，来源许可、组隔离、近重复抽查、类别分布 |
| SFT 正确性 | 25 | 通过测试；能解释 labels、shift、EOS、累积末窗；dev NLL 按 token 聚合 |
| 参数高效训练 | 20 | 仅 adapter 可训练；两种配置、r 消融、真实显存与日志 |
| 评估 | 20 | 四组同测试集/解码、schema valid/exact match/macro F1、错误分析 |
| 可复现与管理 | 15 | 固定模型 SHA/数据 hash/依赖/seed，适配器重载，Git tag，无秘密或大权重 |

通过条件：总分≥80/100，且数据泄漏、全 mask/双 shift、基座意外更新、无法重载这四类问题全部清零。不预设必须提升 X 个百分点；必须报告效果是否变化、失败模式及证据。若只完成 CPU 测试，应标注“管线验证，GPU 训练未验收”，不能算结课完成。

## 原始资料

- [Stanford CS336 / Assignment 5](https://github.com/stanford-cs336/assignment5-alignment)：训练与评估实验结构参考，本项目任务、实现与评分标准为独立设计。
- [PEFT 0.18.0 quantization](https://huggingface.co/docs/peft/v0.18.0/developer_guides/quantization)
- [Transformers 4.57.3 bitsandbytes](https://huggingface.co/docs/transformers/v4.57.3/en/quantization/bitsandbytes)
- [PyTorch 安装版本表](https://pytorch.org/get-started/previous-versions/)


## 算法推导的 CPU 伴随实验

运行 `python numerical_walkthrough.py`，在不下载模型的情况下验证正文数值：softmax-CE 的解析梯度与中心差分、LoRA 矩阵梯度与两步初始化、token 加权累积、NF4 码字和离群值误差。`tests/test_numerical_walkthrough.py` 将这些推导纳入测试。网页的15个算法实验都可单步播放、修改参数、导出和恢复状态；这些小规模计算不代表 GPU 训练结果。

加深作业：B2 交付 `reports/gradients.md`；C2 交付单层 LoRA 的输出/梯度对照；D2 交付量化前后逐权重表和输出误差。具体要求见对应节点正文。
