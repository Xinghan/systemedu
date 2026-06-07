# 老师讲课 — 幻灯片播放 全链路 设计文档

- Status: shipped (2026-06-06)
- 验收结果: slides 全链路打通 (library Lesson.slides 列 + importer 读 + knode API 返回 + 反代 KnodeContent 映射 + 前端 TeacherSceneView 翻页播放器)。回填脚本补 143 lessons。端到端验证: eeg M01 10 张 / purpleair M01 9 张 slides 经反代到达前端, 含 title/body/audio_script。音频按设计留占位 (禁用播放按钮"音频生成中")。library slides 测试 3 PASS。
- Date: 2026-06-06
- 关联: spec 027 (student-web stub TeacherSceneView), spec 023 (library), course_factory slides.json 产物

## 1. 背景与问题

学习页"老师讲课"场景当前是空的。根因:`TeacherSceneView` 是 spec 027 留的 stub
(只显示"3D 老师场景 spec 028 启用"),且 **slides 数据在整条链路上缺失**:

- course_factory 已为每个 knode 生成 `slides.json` (eeg 62/62, purpleair 48/48 全有),
  结构: `{"slides":[{slide_id, kind, title, body_markdown, audio_script, payload}]}`。
- 但: library importer 不读 slides.json → Knode 表无 slides 列 → knode API 不返回 →
  反代 KnodeContent 无 slides 字段 → 前端拿到 None → 空。

注: slides 只有讲稿文字 (`audio_script`)，**无音频文件**。音频由用户单独生成，本特性留占位。

## 2. 目标

- G1 接通 slides 全链路: library 读入 → API 返回 → 反代映射 → 前端可取。
- G2 前端"老师讲课"渲染幻灯片翻页播放器 (标题 + 正文 + 讲稿文字常显)，音频占位。
- G3 回填已 import 的 eeg / purpleair (加 slides 列 + 从 media 读 slides.json 写 DB)。

### 非目标

- 不做 TTS / 音频生成 (用户单独处理)。
- 不做 3D 数字人 (stub 注释提到的旧 dighuman, 不在范围)。
- 不改 course_factory 的 slides 生成。

## 3. 数据链路 (4 层补全)

### L1 library 模型 + importer
- `models.py` Lesson 表加列: `slides = Column(JSON, nullable=False, default=list)` (同 theories 模式)。
- `importer.py` knode 读取段加: `lesson.slides = _read_json_safely(knode_dir / "slides.json", default={})`
  (slides.json 顶层是 `{"slides":[...]}` dict; 存整个 dict 或取 .get("slides",[]) — 见 §6 决策)。

### L2 library knode API
- knode 序列化处加 `slides` 字段输出 (跟 audio_scripts/theories 并列)。

### L3 反代 KnodeContent
- `client.py` KnodeContent dataclass 加 `slides: Any = None` + `from_dict` 映射 `d.get("slides")`。
- catalog route `api_my_project_knode` 已用 `copy.deepcopy(k.__dict__)` 返回, slides 自动带出。

### L4 前端
- 前端类型已有 `SlideEntry` / `slides: SlideEntry[]` (api.ts), 但 knode 响应类型可能未含 slides — 核对补上。
- `TeacherSceneView` 从 props 拿到 knode.slides, 渲染播放器。

## 4. 前端播放器 (TeacherSceneView)

输入: knode (含 slides 数组)。渲染:
- **主区**: 当前 slide 的 title (大标题) + body_markdown (渲染 markdown) + payload 视情况展示
  (payload 富内容如 hero/concept_cards 可后续增强，先渲染 title+body 保证不空)。
- **讲稿区 (常显)**: 当前 slide 的 `audio_script` 文字, 标注"讲稿"。
- **音频占位**: 一个禁用的「▶ 播放 (音频生成中)」按钮 (灰色 disabled)。
- **导航**: 「上一张 / 下一张」+ 进度 (如 3 / 9); 到首/尾禁用对应按钮。
- **蜥蜴老师形象**: 复用现有 LizardScene/装饰 (若已存在), 否则简单占位, 不阻塞。
- **空态**: slides 为空时显示"本节暂无讲课幻灯片" (老项目无 slides 时不爆)。

组件保持单一职责: 只负责 slides 展示 + 翻页, 不拉数据 (数据由父组件 course-content-view 传入)。

## 5. 已 import 项目回填

`create_all` 不会给已存在表加列。一次性脚本 `scripts/backfill_slides.py` (或 library 管理命令):
1. `ALTER TABLE lessons ADD COLUMN slides JSON` (SQLite; 若列已存在则跳过)。
2. 遍历 media/projects/<slug>/knodes/*/slides.json, 按 (project_slug, knode_id) UPDATE lessons.slides。
3. 对 eeg-minecraft-bci + purpleair-airquality-node 执行。

新 import 的项目走改后的 importer, 自动有 slides, 无需回填。

## 6. 待定决策 (实现时锁定)

- **slides 存储形态**: 存 `slides.json` 整个 dict (`{"slides":[...]}`) 还是只存 list `[...]`？
  决策: 存 **list** (`d.get("slides", [])`), 与前端 `SlideEntry[]` 类型直接对应, 反代/前端无需再 `.slides`。
- **slide payload 渲染深度**: 先只渲染 title + body_markdown + audio_script (保证不空);
  payload 富类型 (concept_cards/hero/images) 作为后续增强, 本特性不展开。

## 7. 测试

- L1 library: importer 读 slides.json 写 DB (单测, 造含 slides.json 的 knode 目录)。
- L2 API: knode API 返回含 slides 字段。
- L3 反代: KnodeContent.from_dict 映射 slides。
- L4 前端: TeacherSceneView 给定 slides 渲染翻页 + 空态 (组件测试或手动验收)。
- E2E: pull eeg → 取 M01 knode → slides 非空 (回填后)。
- 回填脚本: 跑后 DB lessons.slides 非空。

## 8. 验收

- 启动系统, 进 eeg/purpleair 学习页 → 切"老师讲课" → 看到幻灯片 (标题/正文/讲稿)、能翻页、
  音频按钮灰显"音频生成中"。不再是空的。

## 9. 风险

- create_all 加列对已有 DB 无效 → 回填脚本 ALTER (已纳入 §5)。
- slides.json 顶层结构若个别 knode 不是 `{"slides":[...]}` → _read_json_safely + .get 兜底空 list。
- 前端 markdown 渲染需复用现有 markdown 组件 (course-content-view 已有), 不引新依赖。
