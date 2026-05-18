# spec 031 P7 — Tutor 回答质量 eval

真 LLM 调用 (~10 条 × chat + 10 次 judge = 20 次 API call), 不进 CI。
手跑生成基线报告, 用于:
- prompt 改动前后回归对比
- 5 层 memory 是否真的影响回答 (ablation)
- judge 评分一致性观察

## 怎么跑

```bash
# 1. 起 student-app (端口 18820)
./scripts/restart-student.sh

# 2. 跑 eval
export DASHSCOPE_API_KEY=sk-xxx     # qwen-plus judge
python -m tests.eval.runner

# 3. 看报告
cat tests/eval/reports/eval_$(date +%Y%m%d_%H%M%S).md
```

## 数据集

`dataset.yaml`: 10 条 PurpleAir 项目 Q&A
- 5 条 `learn` page (M01-M05)
- 3 条 `library_detail` page (项目级问题)
- 2 条 `global` page (学生兴趣 / 跨项目)

每条字段:
- `id`: 唯一 ID
- `page_kind`: global / home / library_detail / learn
- `library_slug` / `module_id` (按需)
- `setup_facts`: 跑前预先 upsert 的 fact (模拟学生画像)
- `question`: 学生问题
- `expected_facets`: judge 用 — 一个好答案应覆盖的要点 list
- `bad_facets`: judge 用 — 不应出现的内容

## Judge

`judge.py`: qwen-plus 给 0-100 分 + 命中/漏掉/出错的 facets 详情。
3 轴打分:
- relevance (0-100): 答到问题
- factual (0-100): 内容正确无幻觉
- personalization (0-100): 用了学生 fact / 当前 knode 上下文
