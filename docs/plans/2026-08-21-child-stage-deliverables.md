# Child-Visible Stage Deliverables Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make every published project stage end in a child-understandable, independently checkable work product that is visibly reused by the next stage.

**Architecture:** Keep the course package's V5 knowledge tree as the single source of truth. Populate the existing `Stage` completion fields (`stage_output`, `closing_capstone_module_id`, `capstone_scope`, `capstone_reuses_outputs_from_stages`, and `capstone_hands_on_expectation`) and the closing module's acceptance fields. The student project page derives an inline “本关作品” card from those fields, rather than making children correlate a separate project-wide outcome list with an `S1` badge.

**Tech Stack:** V5 course JSON; `content_pipeline` manifest regeneration; Python Pydantic models; Next.js 16/React 19 student web; Node built-in test runner; existing deployment command `scripts/deploy-student.sh course <slug>`.

---

## Product rules and completion definition

This is a visibility-and-completion release. It does **not** introduce a new learner-file storage system or alter lesson-unlocking rules. Existing capstone submission support stays intact; this release makes the expected product, checklist, and hand-off unambiguous before considering new persistence features.

Every stage must expose this same child-facing contract:

1. **本关作品** — a concrete noun phrase that a 10–12-year-old can picture and show, for example “我的第一张脑波地图”, not “理解 EEG”.
2. **完成时会拿到** — one to three named files, physical objects, reports, screenshots, videos, or controlled demos sourced from the closing module’s `acceptance_artifacts`.
3. **自己检查** — three to five observable checks sourced from `acceptance_standard`; no abstract “掌握/理解” checks.
4. **下一关会用到它** — a one-sentence hand-off sourced from the closing module’s `what_it_passes_forward`; it must name the next stage and the part of the product that is reused.
5. **阶段收口任务** — a designated `mission_role: "capstone"` module with a nonempty `assignment.md`, using the headings `## 阶段作品`, `## 交付物`, `## 自检清单`, and `## 下一关会用到它`.

Use the current source locations, not the repository’s sparse `projects_data/` review area:

- Course packages: `/Users/xinghan/Dev/systemeduidea/projects_data/<slug>/`
- Tree: `/Users/xinghan/Dev/systemeduidea/projects_data/<slug>/tree/knowledge_tree.json`
- Stage-closing assignment: `/Users/xinghan/Dev/systemeduidea/projects_data/<slug>/knodes/<knode_dir>/assignment.md`

### Required course-data mapping

For each of the 48 stages, fill these existing V5 fields:

```json
{
  "stage_output": "儿童能说清、能展示的阶段作品名称",
  "closing_capstone_module_id": "Mxx",
  "capstone_scope": "本关把哪些已学内容整合成什么作品",
  "capstone_reuses_outputs_from_stages": ["S上一关"],
  "capstone_hands_on_expectation": "孩子实际完成、拍照/录屏/保存的动作"
}
```

For that closing module, populate or correct:

```json
{
  "module_role": "capstone",
  "outputs_produced": ["与 stage_output 一致的作品"],
  "what_it_passes_forward": "S下一关会拿这份作品的……继续……",
  "acceptance_artifacts": [{"title": "可提交的作品", "kind": "image|document|code|video|artifact"}],
  "acceptance_standard": ["3–5 条儿童可观察、可勾选的标准"]
}
```

`capstone_reuses_outputs_from_stages` is empty only for S1. Every later stage must name at least one earlier stage. Every nonfinal stage must explain its hand-off in `what_it_passes_forward`.

### High-priority content repairs

Repair these first because the production audit found no visible structured outcome in either the project overview or a structured closing assignment:

| Course | Stage | Closing module | Required child-visible product |
| --- | --- | --- | --- |
| `eeg-minecraft-bci` | S1 | M12 | “我的第一张脑波地图”：raw EEG 图、标注和 alpha 观察结论，供 S2 清洁前后对照使用。 |
| `eeg-minecraft-bci` | S2 | M19 | “一键脑波清洁管线”：before/after 图与可重复运行说明，供 S3 提取 CSP 特征使用。 |
| `emg-prosthetic-hand` | S1 | M04 | “我的肌肉电信号观察卡”：放大前后波形和一句解释，供 S2 采集真肌电时对照。 |
| `purpleair-airquality-node` | S1 | M06 | “AQI 演算纸 + 我的节点任务卡”：一次分段插值演算和要测的地点/问题，供 S2 决定节点采集目标。 |
| `purpleair-airquality-node` | S3 | M28b | “可信 AQI 数据管线”：浓度→湿度校正→NowCast→AQI 的样例表和脚本/截图，供 S4 节点上图、S5 验证使用。 |

Also restore and standardize the absent PurpleAir closing assignments for S3/M28b, S4/M36b, and S5/M47b before publishing that course.

## Task 1: Add the course-package stage-deliverable validator

**Files:**

- Create: `course_factory/validate/verify/stage_deliverables.mjs`
- Create: `course_factory/validate/verify/stage_deliverables.test.mjs`
- Create: `course_factory/validate/verify/fixtures/stage_deliverables.valid.json`
- Create: `course_factory/validate/verify/fixtures/stage_deliverables.invalid.json`

**Step 1: Write failing validator tests**

Use Node’s built-in `node:test` and `node:assert/strict`. The valid fixture contains S1 and S2, a capstone in each stage, an S1→S2 module dependency, and the four required assignment headings. The invalid fixture must independently prove these failures are reported:

```js
assert.match(errors.join("\n"), /S1.*stage_output/)
assert.match(errors.join("\n"), /closing_capstone_module_id.*not in stage/)
assert.match(errors.join("\n"), /S2.*capstone_reuses_outputs_from_stages/)
assert.match(errors.join("\n"), /missing heading.*下一关会用到它/)
assert.match(errors.join("\n"), /backward cross-stage dependency/)
```

**Step 2: Run the test to verify it fails**

Run:

```bash
node --test course_factory/validate/verify/stage_deliverables.test.mjs
```

Expected: FAIL because `auditStageDeliverables` has not yet been exported.

**Step 3: Implement the minimal reusable audit function**

Export `auditStageDeliverables(tree, assignmentByModule)` and a CLI wrapper accepting a course root. It must check:

- each stage has the five Stage fields in the contract above;
- `closing_capstone_module_id` resolves to a module in that stage with `module_role: "capstone"`;
- closing modules have at least one artifact, 3–5 standards, an output, and nonempty pass-forward text except in the final stage;
- S2 onward declare reuse of an earlier stage;
- each adjacent stage pair has a forward cross-stage `depends_on` path and no cross-stage dependency points backward;
- the closing assignment exists and contains all four standard headings.

Keep the function pure: callers pass already-read assignment strings. The CLI alone maps `manifest.json` module IDs to `knode_dir` and reads `assignment.md`.

**Step 4: Run the test to verify it passes**

Run:

```bash
node --test course_factory/validate/verify/stage_deliverables.test.mjs
```

Expected: PASS, including each negative-case assertion.

**Step 5: Commit**

```bash
git add course_factory/validate/verify/stage_deliverables.mjs course_factory/validate/verify/stage_deliverables.test.mjs course_factory/validate/verify/fixtures
git commit -m "test: validate child-visible stage deliverables"
```

## Task 2: Make the validator a release gate

**Files:**

- Modify: `course_factory/GENERATION_GUIDE.md`
- Modify: `course_factory/workspace_bridge.py:452-614`
- Modify: `packages/core/src/systemedu/core/education/services.py:154-235`

**Step 1: Write failing integration assertions**

Extend the validator test with a fixture representing a V5 tree accepted by existing generic validation but missing `stage_output`. Assert that the new stage-deliverable validation rejects it while the legacy generic validator alone would not.

**Step 2: Run the test to verify it fails**

```bash
node --test course_factory/validate/verify/stage_deliverables.test.mjs
```

Expected: FAIL until the workspace and service validation paths call the new validation rules.

**Step 3: Add the gate without breaking draft authoring**

Make the strict tree-writing path call the equivalent Stage-contract validation. Preserve a documented non-strict/draft option for an author who is still designing a course, but require the gate before export/import/deployment. Add the exact release command to `GENERATION_GUIDE.md`:

```bash
node course_factory/validate/verify/stage_deliverables.mjs \
  /Users/xinghan/Dev/systemeduidea/projects_data/<slug>
```

**Step 4: Run focused checks**

```bash
node --test course_factory/validate/verify/stage_deliverables.test.mjs
PYTHONPATH=packages/core/src .venv/bin/python -c "from systemedu.core.education.services import validate_v5_tree; print(validate_v5_tree({'stages': [], 'modules': []}))"
```

Expected: Node tests pass; the Python smoke check remains callable and reports its normal generic errors.

**Step 5: Commit**

```bash
git add course_factory/GENERATION_GUIDE.md course_factory/workspace_bridge.py packages/core/src/systemedu/core/education/services.py course_factory/validate/verify
git commit -m "feat: require stage deliverable contracts before export"
```

## Task 3: Render the child-visible stage card in the student project page

**Files:**

- Create: `packages/student-web/src/components/library/stage-deliverable-card.tsx`
- Modify: `packages/student-web/src/app/(home)/library/[slug]/page.tsx:45-55`
- Modify: `packages/student-web/src/app/(home)/library/[slug]/page.tsx:990-1165`
- Modify: `packages/student-web/src/lib/i18n/locales.ts`

**Step 1: Write the card’s pure-data test before rendering code**

Add a small, framework-free TypeScript/Node test for the mapper exported by the new component (or a sibling `stage-deliverable.ts`). Given S2 and its closing capstone module, assert that it returns the product title, artifacts, checks, previous-stage reuse, next-stage hand-off, and closing module ID. Assert missing data returns a `status: "incomplete"` result rather than silently rendering an empty card.

**Step 2: Run the test to verify it fails**

```bash
node --test packages/student-web/src/components/library/stage-deliverable.test.mjs
```

Expected: FAIL because the mapper/component does not exist.

**Step 3: Implement the data mapping and card**

Expand the local `Stage` and `Module` types in the library page to include the existing V5 fields. Do not add a new backend endpoint: `knowledge_tree` already travels through the public project response.

Render the card inside each expanded stage, immediately after the stage header and before its module list. Use plain, child-facing Chinese labels:

```text
本关作品
完成时会拿到
自己检查（0/3）
上一关带来的材料
下一关会用到它
去完成阶段作品
```

The action links to `/learn/<slug>/<closing_capstone_module_id>` only after the project is pulled; otherwise it is a clear disabled “加入项目后开始” state. Retain the existing project-wide “What you’ll ship” block as an overview map, but make the inline stage card the primary path.

Show a visible authoring warning in development for `status: "incomplete"`; production must never have it once Task 2’s gate is active.

**Step 4: Verify the page**

```bash
cd packages/student-web && npm run lint && npm run build
```

Expected: PASS. Then inspect a locally served Stirling course and verify S1 shows its manual, three or more checks, and the S2 hand-off without requiring the learner to scan the separate outcome grid.

**Step 5: Commit**

```bash
git add packages/student-web/src/components/library/stage-deliverable-card.tsx packages/student-web/src/app/'(home)'/library/'[slug]'/page.tsx packages/student-web/src/lib/i18n/locales.ts
git commit -m "feat: show stage deliverables in child course flow"
```

## Task 4: Make capstone assignments use one child-readable template

**Files:**

- Modify: `packages/student-web/src/components/learning/assignment-view.tsx:684-735`
- Modify: `packages/student-web/src/components/learning/assignment-view.tsx:853-946`
- Modify: `packages/core/src/systemedu/core/course_factory_v3/prompts/plan_capstone.md`

**Step 1: Write parser tests**

Add an assignment fixture with the four standard headings. Assert `parseCapstoneBlocks` classifies `交付物` and `自检清单` into cards and preserves `下一关会用到它` as a readable hand-off block.

**Step 2: Run the failing test**

```bash
node --test packages/student-web/src/components/learning/assignment-view.test.mjs
```

Expected: FAIL until the parser’s extracted helper is testable.

**Step 3: Implement the template support**

Export the parser or move it to a small pure helper. Add explicit styles/icons for `阶段作品` and `下一关会用到它`; do not make children interpret generic “动手项目” headings. Update the capstone-generation prompt so new courses generate exactly this structure.

**Step 4: Verify**

```bash
node --test packages/student-web/src/components/learning/assignment-view.test.mjs
cd packages/student-web && npm run lint
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/student-web/src/components/learning/assignment-view.tsx packages/student-web/src/components/learning/assignment-view.test.mjs packages/core/src/systemedu/core/course_factory_v3/prompts/plan_capstone.md
git commit -m "feat: standardize child stage-capstone assignments"
```

## Task 5: Pilot the complete flow on the two strongest courses

### Pilot product chains (content review baseline)

These are the product names and hand-offs that every pilot field and closing
assignment must match. They are deliberately concrete enough for a child to
point to, save, photograph, or show.

```text
Stirling: 《我的热机手册》
  → 会报瓦数的发电站最小版
  → 四项会说话的监测台
  → 双模式可控发电站
  → 我的 PID 稳功率控制器
  → 会自寻优、会自保护的发电站大脑
  → 我的完整火焰 AI 发电站作品包

Mars: 我的可训练火星地形数据集
  → 可在 Pi 上识别地形的分类器交付包
  → 会自己看路的火星类比探测车
  → 我的火星任务证据包
  → 我的火星车成果展

Ant: 我的蚁巢观察起步包
  → 我的 RFID 蚁群观测装置
  → 我的蚂蚁日报助手
  → 我的蚁群应变实验记录包
  → 我的蚂蚁研究成果展

Molecule: 我的真药识读工作台
  → 我的带标签分子图书馆
  → 我的分子特征表和数据字典
  → 我的属性预测模型证据包
  → 我的怪兽猎人 Go/No-Go 报告

Satellite: 我的负责任考古侦察起步包
  → 我的多光谱预处理管线
  → 我的防泄漏遗址标注数据集
  → 我的校准遗址检测模型
  → 我的 top3 考古候选证据档案
  → 我的负责任卫星考古分享包
```

**Files:**

- Modify: `/Users/xinghan/Dev/systemeduidea/projects_data/stirling-thermal-controller/tree/knowledge_tree.json`
- Modify: `/Users/xinghan/Dev/systemeduidea/projects_data/mars-analog-rover/tree/knowledge_tree.json`
- Modify: closing `assignment.md` files selected by each stage’s new `closing_capstone_module_id`
- Modify: each course’s `manifest.json` only through manifest regeneration

**Step 1: Write the expected product chains in a review note**

Before editing JSON, record these chains in the implementation PR/commit description and compare every field against them:

```text
Stirling: 热机手册 → 发电最小版 → 监测台 → 可控发电站 → PID 控制器 → 自寻优/保护大脑 → 完整发电站
Mars: 地形数据集 → 分类器 → 探测车 → 任务产物包 → Demo/研究报告
```

**Step 2: Fill Stage and closing-module contracts**

For every pilot stage, set the required fields from the contract. Ensure each item is physically/digitally showable and each hand-off names the next product’s reused input. Convert vague “能做到” capability titles into a named artifact plus evidence, for example `power-controller.ino + 稳定功率曲线`.

**Step 3: Standardize each closing assignment**

Use the four headings and make the checklists observable. Keep existing valuable exercise content below the stage contract; do not delete instructional questions merely to fit the new structure.

**Step 4: Regenerate and validate each pilot package**

```bash
for slug in stirling-thermal-controller mars-analog-rover; do
  node course_factory/validate/verify/stage_deliverables.mjs "/Users/xinghan/Dev/systemeduidea/projects_data/$slug"
  .venv/bin/python -c "from pathlib import Path; from content_pipeline.manifest import regenerate_manifest; regenerate_manifest(Path('/Users/xinghan/Dev/systemeduidea/projects_data/$slug'))"
done
```

Expected: both validators exit 0; regenerated manifests include every edited file.

**Step 5: Commit source and manifest changes separately from web code**

```bash
git add /Users/xinghan/Dev/systemeduidea/projects_data/stirling-thermal-controller /Users/xinghan/Dev/systemeduidea/projects_data/mars-analog-rover
git commit -m "content: add child stage deliverables to pilot courses"
```

If the course source lives in a separate Git repository, commit there instead; do not accidentally vendor it into `systemedu`.

## Task 6: Repair the five completion-blocking stages and PurpleAir closing nodes

**Files:**

- Modify: `/Users/xinghan/Dev/systemeduidea/projects_data/eeg-minecraft-bci/tree/knowledge_tree.json`
- Modify: `/Users/xinghan/Dev/systemeduidea/projects_data/eeg-minecraft-bci/knodes/<M12,M19,M38b,...>/assignment.md`
- Modify: `/Users/xinghan/Dev/systemeduidea/projects_data/emg-prosthetic-hand/tree/knowledge_tree.json`
- Modify: `/Users/xinghan/Dev/systemeduidea/projects_data/emg-prosthetic-hand/knodes/<M04,M10,...>/assignment.md`
- Modify: `/Users/xinghan/Dev/systemeduidea/projects_data/purpleair-airquality-node/tree/knowledge_tree.json`
- Modify: `/Users/xinghan/Dev/systemeduidea/projects_data/purpleair-airquality-node/knodes/<M06,M17b,M28b,M36b,M47b,M52>/assignment.md`

**Step 1: Write a before/after audit fixture**

Capture the five blocking stages and PurpleAir S3–S5 in a test fixture. The test must fail before content repair with named errors, then pass only after each required Stage field, capstone module, artifacts, standards, and assignment headings are present.

**Step 2: Define the child-size output and hand-off before writing prose**

Use the five product names in the high-priority table. For each, limit the self-check list to five items and name an adult-supervision boundary if hardware, electricity, or body sensors are involved.

**Step 3: Edit tree data and closing assignments**

Set every stage contract in the three courses, not only the five gaps, so that no child enters a later stage without seeing how their prior work is reused. Mark M12, M19, M04, M06, M28b, M36b, and M47b as closing capstones where appropriate; do not fabricate a new module if the existing final module can carry a real deliverable.

**Step 4: Run course validation and manifest regeneration**

```bash
for slug in eeg-minecraft-bci emg-prosthetic-hand purpleair-airquality-node; do
  node course_factory/validate/verify/stage_deliverables.mjs "/Users/xinghan/Dev/systemeduidea/projects_data/$slug"
  .venv/bin/python -c "from pathlib import Path; from content_pipeline.manifest import regenerate_manifest; regenerate_manifest(Path('/Users/xinghan/Dev/systemeduidea/projects_data/$slug'))"
done
```

Expected: all three commands succeed and no stage has a missing deliverable, hand-off, or closing assignment.

**Step 5: Commit**

Commit each course separately so a content regression can be rolled back without touching the others.

## Task 7: Migrate the remaining courses and normalize all 48 stages

**Files:**

- Modify: `/Users/xinghan/Dev/systemeduidea/projects_data/ai-ant-ethologist/tree/knowledge_tree.json`
- Modify: `/Users/xinghan/Dev/systemeduidea/projects_data/molecule-monster-hunter/tree/knowledge_tree.json`
- Modify: `/Users/xinghan/Dev/systemeduidea/projects_data/satellite-archaeology/tree/knowledge_tree.json`
- Modify: the selected closing `assignment.md` files in those three packages
- Modify: any remaining closing assignment files in the five previously migrated packages

**Step 1: Make the validator fail intentionally for one omitted field per course**

Confirm each course is actually tested by temporarily running the validator against its pre-migration source or a copy with an omitted field. Do not bypass errors by setting meaningless placeholders such as “完成本阶段”.

**Step 2: Create one product chain per course**

For every course, write its full S1→Sn chain in review notes before editing. The test for quality is that a child can answer “我现在拿着什么，下一关把它变成什么？” at every boundary.

**Step 3: Populate data and assignments**

Add Stage contracts and capstone assignments across all remaining stages. Use `acceptance_artifacts` to name actual evidence, and convert every `capability`-only closing outcome into a named evidence pair, for example “模型 + 评估图” or “控制器代码 + 运行视频”.

**Step 4: Validate all eight packages in one clean audit**

```bash
for slug in ai-ant-ethologist eeg-minecraft-bci emg-prosthetic-hand mars-analog-rover molecule-monster-hunter purpleair-airquality-node satellite-archaeology stirling-thermal-controller; do
  node course_factory/validate/verify/stage_deliverables.mjs "/Users/xinghan/Dev/systemeduidea/projects_data/$slug" || exit 1
done
```

Expected: 48/48 stages pass. The output should explicitly report `stage_count=48`, `complete=48`, and `missing=0`.

**Step 5: Commit by course**

Use one content commit per course, followed by a single audit report commit if needed.

## Task 8: Validate the real learner experience locally

**Files:**

- Create: `course_factory/validate/verify/stage_deliverables_page.mjs`
- Modify: `course_factory/validate/verify/learn_page.mjs` only if its route assumptions are still correct for the student app

**Step 1: Write the failing Playwright assertions**

For a pulled pilot course, assert the page contains every stage card’s four labels, exact product title, at least one visible artifact, a check count, and a next-stage hand-off. Expand S1 and S2 and assert the S1 hand-off names S2.

**Step 2: Run against the unmodified UI**

```bash
node course_factory/validate/verify/stage_deliverables_page.mjs stirling-thermal-controller
```

Expected: FAIL before Task 3’s UI is available.

**Step 3: Implement bounded browser verification**

Use a local authenticated test account, capture one full-page screenshot and one expanded S1/S2 screenshot, and fail on missing labels or browser console errors. Do not run this command against production by default.

**Step 4: Run the complete local quality gate**

```bash
cd packages/student-web && npm run lint && npm run build
node --test course_factory/validate/verify/stage_deliverables.test.mjs
node course_factory/validate/verify/stage_deliverables_page.mjs stirling-thermal-controller
node course_factory/validate/verify/stage_deliverables_page.mjs purpleair-airquality-node
```

Expected: all commands pass and screenshots show the product-to-next-stage chain.

**Step 5: Commit**

```bash
git add course_factory/validate/verify/stage_deliverables_page.mjs course_factory/validate/verify
git commit -m "test: verify child stage deliverables in learner UI"
```

## Task 9: Publish incrementally and verify production

**Files:**

- No code changes; deploy only previously committed, locally validated work.
- Update: `docs/plans/2026-08-21-child-stage-deliverables.md` with a short deployment record after each successful wave.

**Step 1: Publish the UI once**

Run the normal deployment steps individually, inspecting output after every step; do not use `all`:

```bash
./scripts/deploy-student.sh pack
./scripts/deploy-student.sh code
./scripts/deploy-student.sh student
./scripts/deploy-student.sh web
./scripts/deploy-student.sh verify
```

Expected: backend and web health checks pass. This is authorized only when the user explicitly asks to deploy.

**Step 2: Publish pilot course packages**

```bash
./scripts/deploy-student.sh course stirling-thermal-controller
./scripts/deploy-student.sh course mars-analog-rover
```

**Step 3: Inspect public learner pages**

Verify the public project JSON contains nonempty Stage contract fields and inspect the two live course pages. Confirm each expanded stage exposes its own output, checklist, and hand-off; do not accept only a project-wide outcome card.

**Step 4: Publish the high-risk repair wave**

```bash
./scripts/deploy-student.sh course eeg-minecraft-bci
./scripts/deploy-student.sh course emg-prosthetic-hand
./scripts/deploy-student.sh course purpleair-airquality-node
```

**Step 5: Publish the remaining course packages and record results**

Deploy the other three courses one at a time, run `./scripts/deploy-student.sh verify` after each wave, and append the deployed slug, timestamp, verification result, and manually inspected S1→S2 transition to this plan.

## Completion criteria

- Every one of the 48 published stages has a nonempty child-visible stage product, designated capstone, one or more showable artifacts, 3–5 observable checks, and an explicit hand-off.
- Every stage from S2 onward names a prior stage product that it reuses; the validator rejects backward or missing adjacent-stage dependency links.
- The student course page shows the product, evidence, self-check, and next-stage hand-off inside each stage, without making children cross-reference a separate list.
- Every closing assignment uses the standard four sections and has a real child-completable task.
- The validator passes for all eight source packages; the web lint/build and local learner-page checks pass.
- Production is deployed only in reviewed waves and verified after every step.
