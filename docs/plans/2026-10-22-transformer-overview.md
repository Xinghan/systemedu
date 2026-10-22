# Transformer 结构总览

状态：已实现并完成本批次浏览器验收。

## 问题与交互

独立模型实验室直接进入 3D 张量细节，缺少对 Transformer 的定义、组成与计算顺序的说明。默认入口改为可访问的 2D HTML 结构图：

1. 简述序列表示、自注意力、前馈变换和 next-token 预测的关系。
2. 展示输入 → 词元与位置嵌入 → 三个 Transformer Block → 最终 LayerNorm → 词表投影 / Softmax，以及追加 token 后重新计算的循环。
3. 展开一个真实模型对应的 Pre-LN Block，分别呈现注意力与 MLP 的残差旁路、三个头、mask、归一化、拼接、输出投影和 GELU。
4. 每个操作用按钮进入已有的八类交互学习面板。保留 Bycroft 3D 引擎、实际权重、WASM 推理、原题目、Python 执行与学习记录。
5. 可选十步结构导览逐步高亮模块，解释该步作用及形状。导览是结构说明，不伪装成实际推理轨迹，也不增加掌握分数。

提供原始 encoder-decoder 与当前 GPT 式 decoder-only 的对照；说明原论文 Post-LN 与当前 Pre-LN 的差别。当前具体模型仍是 minGPT A/B/C 排序任务，三层、三头、隐藏维度 48、每头 16、MLP 中间维度 192、11 个位置容量。

## 生命周期与记录

- 首屏不创建 canvas，不加载 3D 模型。首次进入模块或学习轨迹后才初始化引擎。
- 首次选择通过 ref 留存，异步模型初始化后定位正确算法，避免首击丢失。
- 首次创建后保留 canvas；返回总览暂停动画并隐藏实验区，不重建引擎。
- 总览和详细学习共享原有 notebook；本地存储 key、版本和评分规则不变。代码草稿、答案、检查结果继续可读。
- 总览自身保持挂载，以保留导览步骤和架构选择；键盘进入详情与返回时转移焦点。
- 未就绪时禁用代码运行按钮，避免点击后无响应。

## 验证

浏览器使用独立的 `?practice=1` 记录空间测试；正式记录未用于作答或代码测试。

- 8 类学习模块及最终 LN、第二个 LN、第二次残差加法的入口均打开对应面板。
- 注意力首次进入定位正确，播放按钮推进时间线；浏览器未记录控制台错误。
- 10 步导览各有一个正确高亮；从导览进入实验后返回，步骤保留。
- 代码草稿往返保留，恢复原草稿后刷新仍一致；原有通过状态恢复，学习轨迹可从总览打开。
- 页面刷新默认显示总览，首次进入前 canvas 数为 0。
- 键盘 Enter 可激活模块和导览。390、806、1280 CSS 像素视口均无文档横向溢出；390 下主流程和 Block 子层按阅读顺序纵向排列。
- 两个变更 TSX 文件的 ESLint 通过；`git diff --check` 通过。
- 全仓 `tsc --noEmit` 仍有 6 个既有错误，位于 `slide-demo/page.tsx` 和 `course-content-view.tsx`。本批次文件无类型错误；未宣称全仓检查通过。

截图与 UI 结果：`artifacts/transformer-model/overview-*`。算法数值实现、模型资源和 Python 验收逻辑未改动，本批次不重复数值测试。

## 依据

- [Attention Is All You Need](https://arxiv.org/html/1706.03762v7)：原始结构和注意力定义。
- [minGPT 模型源码](https://github.com/karpathy/minGPT/blob/master/mingpt/model.py)：当前架构顺序。
- [LLM Visualization](https://bbycroft.net/llm)：继续复用的三维模型；具体固定版本、来源和许可见上一批次复用记录。
