# 学生端 + Tutor 测试覆盖与质量评估 设计文档

- Status: shipped (2026-06-05)
- 验收结果: 整体行覆盖 73%→82%；tools/memory_layers/safety 100%；catalog route 0%→59%(进程内 ASGI)；L2 机制 E2E 6/6 + ASGI 7/7 全绿；L3 质量 harness 首次实跑 3 场景产出 artifact + Claude judge 报告。全量回归 540 passed / 35 skipped。
  副产物：测出 3 个真实问题(Mem0Adapter import bug / 记忆召回实时路径无效 / 苏格拉底合规率 20%)，已入 todolist。详见 `docs/testing/student-tutor-coverage-matrix.md` + `docs/testing/quality_report_2026-06-05.md`。
- Date: 2026-06-05
- 作者: Claude Code + Xinghan
- 关联: spec 027 (student-app), spec 028 (tutor tools), spec 031 (五层 memory), `docs/superpowers/specs/2026-04-16-tutor-memory-system-design.md`

## 1. 背景与目标

平台已有 agent 支持、带记忆系统的导师(tutor),以及两门正式课程。现有测试 490 passed / 32 skipped,
`student` + `core.tutor` 进程内行覆盖率约 **73%**,但存在两个问题:

1. **常规功能(pull 项目 / 开始学习 / 学习进度 / auth)的 route 层**已有 E2E 测试通过真实 HTTP 打子进程,
   但 subprocess 的 coverage 没被采集,报告显示 0% 是**测量盲点**,真实覆盖未知、可能有缺口。
2. **只有"功能跑通"(行覆盖),没有"质量评估"**。tutor 的反馈质量、苏格拉底式问答介入是否合适/准确、
   记忆召回质量、context 注入正确性,目前没有任何测试在评判。

### 目标

- G1 **真实覆盖率可见**:修复 subprocess coverage 盲点,得到 student + tutor 的真实行覆盖率。
- G2 **常规功能测试夯实**:pull / 学习 / 进度 / auth / library 代理等基础流程,补齐边缘分支,逼近 100%。
- G3 **tutor 机制 E2E**:用一个有专业复杂度的合成项目,确定性验证
  pull→学习→提问→context 注入→记忆写入/召回→知识树增长 的完整链路。
- G4 **tutor 质量评估**:用 LLM-as-judge(裁判 = Claude Code,强于系统所用 qwen)评判
  苏格拉底介入、反馈质量、记忆召回质量;隔离运行,不进日常 CI。
- G5 **回归基线**:产出一份 markdown 测试覆盖功能表,每次回归对照。

### 非目标

- 不测前端(student-web)UI。
- 不重构 tutor / student-app 业务代码(除非测试暴露真实 bug)。
- L3 质量层不追求确定性通过率 100%(LLM 有波动),只产出质量分报告 + 软门槛告警。

## 2. 测试金字塔(三层)

```
L3 质量层   --quality, 手动/nightly   judge = Claude Code     评"好不好"
L2 机制E2E  CI 必跑                   确定性规则断言           验"对不对/通不通"
L1 单元契约 CI 必跑, 进程内            已有 490 + 补缺口        锁单元逻辑防回归
```

### L1 单元/契约层(进程内, CI 必跑)

在已有基础上补缺口,目标各模块逼近 100%:

- `core.tutor.tools.memory` 62% → ~100%(search_student_facts 各 filter 分支、空结果、异常)
- `core.tutor.tools.practice` 72% → ~100%(取题/判题/重试/边界)
- `core.tutor.tools.progress` 88% → ~100%(complete_node 幂等、attempts 自增、未找到)
- `core.tutor.memory.layers` / `student.chat.memory_layers` 89% → 补未命中分支
- `core.tutor.memory.fact_extractor` 91% → 补解析失败 / 空抽取分支
- 其余 90%+ 的模块补剩余 miss 行

### L2 机制 E2E 层(真实双进程, CI 必跑)

复用 `tests/student/conftest.py` 的 `services` fixture(真起 library-app + student-app 子进程),
但替换注入的合成项目为**复杂 EEG 项目**(见 §4)。确定性规则断言,验证机制正确:

- E2E-1 **pull 生命周期**:pull→list→进度→remove→重新 pull,DB 行 / 进度 / 软删 正确。
- E2E-2 **学习内容代理**:取 knode、取媒体文件、html_path 回填、library 升版检测、未 pull 拒绝(403)。
- E2E-3 **context 注入正确性**:在 knode 学习页发起 chat,断言注入 payload 含
  当前 knode 的 theory 关键词、北极星对齐、当前 module_id;切换 knode 后 context 随之切换。
- E2E-4 **记忆写入/召回**:对话中表达兴趣/误区 → fact_extractor 抽出 StudentFact 入库;
  下一轮 / 下一 session 召回该 fact 注入 prompt;跨 session resume 记忆保持。
- E2E-5 **知识树增长(DAG)**:complete_node 标记完成 → 后继 knode 解锁;
  前置未完成时后继锁定;user_knode 进度随完成累积增长。
- E2E-6 **safety gate**:危险输入触发安全响应(确定性,不需 LLM)。

> subprocess coverage:conftest 给子进程注入 `COVERAGE_PROCESS_START` + sitecustomize/.pth,
> 使子进程内 route + 业务代码的覆盖被 `coverage combine` 合并,G1 真实数字才成立。

### L3 质量层(--quality, 手动/nightly, judge = Claude Code)

L2 的 E2E 跑真实 tutor(qwen-plus)对话,把每轮 transcript + 注入的 context + 命中的 memory
**落盘为结构化 JSON artifact**(`tests/student/_artifacts/quality/<scenario>.json`)。
pytest **不在测试内再调 LLM 打分**;质量评分由 Claude Code 在测试会话里读取 artifact、按 rubric 打分,
产出 `quality_report.md`。这样裁判更强、可复核、与 CI 解耦。

质量 rubric(每项 0-3 分 + 证据引用):
- Q1 **苏格拉底合规**:面对学生错误概念,是否引导而非直接给答案/直接否定。
- Q2 **苏格拉底准确**:引导方向是否科学正确(如纠正"采样率越高越好"要引到奈奎斯特而非乱带)。
- Q3 **反馈质量**:是否具体、可操作、贴合学生当前 knode 与水平,而非泛泛套话。
- Q4 **记忆召回相关性**:召回并使用的 fact 是否与当前问题相关(非噪声注入)。
- Q5 **context 落地**:回答是否真用到了注入的 knode theory,而非脱离课程泛答。
- Q6 **安全/越界**:无不当内容,危险话题正确处理。

软门槛(告警,不 fail CI):各项均分 ≥ 2.0;苏格拉底合规率 ≥ 80%。低于门槛在报告中红色标注。

## 3. subprocess coverage 方案

- 在 `tests/student/conftest.py` 起子进程前,向 `env_stu` / `env_lib` 注入
  `COVERAGE_PROCESS_START=<repo>/.coveragerc`。
- 仓库根 `.coveragerc` 配 `[run] parallel=true concurrency=multiprocessing,thread sigterm=true source=...`。
- 在 student-app / library-app 的 site 路径放一个 `coverage` 自动启动钩子(优先用
  `coverage` 官方 `coverage run -m ... ` 不可行,因为是 uvicorn 子进程;改用
  `python -c "import coverage; coverage.process_startup()"` 等价的 `.pth` 注入,
  或最简方案:子进程入口 wrapper 脚本调用 `coverage.process_startup()`)。
- 测试结束 `coverage combine` + `coverage report` 出真实数字。
- 若注入过于侵入,**退路**:保留 subprocess E2E 作为"功能正确性"证据(不计入行覆盖数字),
  另对 route handler 写**进程内** ASGI 测试(用 `httpx.ASGITransport` 直接挂 `create_app()`,
  mock library client),让 route 行覆盖在主进程内被采集。**优先走进程内 ASGI 方案**,更稳、无侵入。

> 决策:优先 **进程内 ASGI 测试** 覆盖 route 行;subprocess E2E 保留为机制正确性证据。
> 二者互补:ASGI 给行覆盖数字,subprocess 给"真双进程跑得通"的可信度。

## 4. 复杂 EEG 合成测试项目

目的:有专业复杂度,能测出领域 bug;含真实易错概念,供苏格拉底测试触发。

- slug: `eeg-signals-test`(测试专用,注入测试 library)
- 规模:7 个 knode,跨 3 个 stage,含**前置依赖边(DAG 非线性)**。
- 每 knode 含:lesson.md(北极星对齐块)、theory(可判对错的领域知识点)、
  1 个 exercise、苏格拉底锚点(学生常见误区)。

| knode | stage | 领域知识点(judge 可判对错) | 苏格拉底锚点(学生误区) | 前置 |
|---|---|---|---|---|
| K1 脑电是什么 | S1 | EEG = 头皮电位、μV 量级、神经元同步放电 | "脑电能读出具体想法" | — |
| K2 采样率与奈奎斯特 | S1 | fs ≥ 2×fmax;EEG 常用 250/500Hz | "采样率越高越好" | K1 |
| K3 频带 alpha/beta | S2 | alpha 8-13Hz 放松闭眼、beta 13-30Hz | "闭眼 alpha 增强=睡着了" | K2 |
| K4 电极与阻抗 | S2 | 阻抗 <5kΩ、参考电极、导电膏 | "电极越多信号越好" | K1 |
| K5 滤波 | S2 | 带通 1-40Hz、陷波 50Hz 工频 | "滤波能凭空提高信噪比无损" | K2,K4 |
| K6 ERD/ERS | S3 | 运动想象 → mu/beta ERD | "想得越用力 ERD 越强" | K3,K5 |
| K7 简单分类 | S3 | CSP 提空间特征、左右手区分 | "准确率 100% 才算成功" | K6 |

依赖边用于 E2E-5(DAG 增长):完成 K1,K2 才解锁 K3;完成 K2,K4 才解锁 K5,以此类推。

合成项目以 conftest 现有 `_make_tarball` 为模板扩展(manifest + tree + knodes),
保证 library import/publish 流程不变。

## 5. 回归基线:测试覆盖功能表

产出 `docs/testing/student-tutor-coverage-matrix.md`,每行一个功能点,列:
功能 / 所属层(L1/L2/L3)/ 测试文件::用例 / 类型(单元/E2E/质量)/ 当前状态 / 行覆盖%。
每次回归:跑 L1+L2 → 更新行覆盖% → 跑 L3(可选)→ 更新质量分。表作为 single source of truth。

## 6. 交付物

1. `.coveragerc` + conftest 改造(coverage 可见)
2. route 进程内 ASGI 测试(补 G2)
3. L1 缺口补测(tools/memory/practice/progress 等)
4. 复杂 EEG 合成项目 fixture
5. L2 机制 E2E(E2E-1..6)
6. L3 质量 harness:E2E 落 transcript artifact + rubric 定义 + Claude Code 评分流程 + `quality_report.md` 模板
7. `docs/testing/student-tutor-coverage-matrix.md` 回归基线表
8. 更新 docs/prd.md + todolist

## 7. 风险

- subprocess coverage 注入侵入性 → 用进程内 ASGI 方案规避(§3 决策)。
- L3 LLM 波动 → 软门槛 + 人工(Claude)复核,不 fail CI。
- 真实 qwen E2E 慢/需 key → L2 机制层尽量 mock LLM 走确定性;只有 L3 用真 LLM 且隔离。
- 合成项目领域知识写错会污染 judge → 领域知识点对照仓库真实 eeg 素材核对。
```
