# M01 · 从筛选证据到立项卡（生成前判断）

Source: `M01-w0-module`，8 页 s1–s8；读取课文、作业、原 slide/讲稿、两块理论及活动目标。课程 manifest 年龄 14–17，沿用项目浅色纸张 / 暖棕 / 语义绿，不低龄化，不画怪兽人物。

## 内容校正与依据

“靶点”是研究问题，不等于天生邪恶的蛋白；形状相似不能直接判断安全/有效。将“AI 不创造新分子”的全称断言限定为“本课做候选筛选，不生成已获证实的新药”；不把任意模型分数解释为治疗成功概率。候选报告先于进一步实验，不沿用旧 s1 的“实验后才 Top10”顺序。FDA [Discovery and Development](https://www.fda.gov/patients/drug-development-process/step-1-discovery-and-development) 描述从大量候选到进一步研究并实验收集机制与安全等证据；本页只介绍早期研究，不把一次验证画成批准上市。

## 逐页决策卡（先于素材和组件）

|页 / 来源|学生要回答 / 易错点|可见证据|主要手段、分工与替代判断|数据 / 操作 / fallback|验收|
|---|---|---|---|---|---|
|1 s1 引入|电脑筛选和真实验证各负责什么？|虚拟候选记录在电脑中缩成短名单，再交实验；明确今天产物只是立项卡|生成浅色教学图提供电脑→实验的物理场景；DOM 给精确阶段/边界。单一图标缺少工作环境对比；3D 无新增空间问题|生成图是示意，不是真实实验。无数值和分子拓扑；图失效仍有分工清单|图中无人物、药丸与成功暗示；候选报告位于实验之前|
|2 s2 三角色|研究问题、候选与模型如何对齐？|同一研究问题下，候选 ID→字段→预测；模型不自动回答所有医学问题|可切换 DOM 接口和 RDKit 精确结构（乙醇为表示示例，不配伪造性质分）；对比泛化角色卡信息更具体；不构造靶点 3D|固定 CCO，经 RDKit 验证；点击角色查看输入/交付/局限，默认可读，SMILES fallback|模型界面明确任务范围；图为结构不是预测|
|3 s3 theory what_is_ai_drug_discovery|从立项卡到作品，哪一步产出给下一步？|干净分子库→特征表→模型→候选报告→可跑工作台，实际字段/文件|DOM 可选择五个里程碑，逐步显示依赖；图片可辅助但不能替代字段，3D/物理模拟不适合软件链|来自原文五交付物；选择一步显示前置输入和交付，重置到首步|模型需评估，报告带局限；不把原“90节”当实际节点数|
|4 s4 theory narrow_the_search_honesty|高分是否等于验证通过？|同一候选分数不变，揭晓后结果可失败；低分也可能被漏掉|精确构造表 + 单步揭晓对比；静态图片无法揭示认知差异；无需复杂分子模型|12 条教学 ID，分数和验证结果均构造，不对应真实分子。按钮查看教学结果/重置|A 92 分失败；C 84 分通过；分数不是百分比|
|5 s5 idea anim_1781593352281_qnil|筛掉哪些、还有多少、下一步是什么？|12条→条件筛选→风险筛选→Top3→构造验证；每个ID和计数真变化|HTML 状态机 + 播放/暂停/单步；无漏斗图标假动画；KaTeX呈现实际计数关系|固定公开表；不宣称真实模型；reset/完整表fallback|12→8→5→3，最终2通过1失败且非药效结论|
|6 s6 idea game_1781593352281_bjjh|五次预算怎样花，没测能否下结论？|可调保留数，五次预算，逐个候选揭晓，保留已付出的结果|受控教学实验台：选择→预算减少→结果/日志增加。非物理仿真；3D不帮助这一决策|同一12条固定数据；重复检测不扣钱；改变保留范围不返还预算；重置清空；无真实实验/训练|最高分失败；最多5次；未测保持未知；不以命中数强行通关|
|7 s7 立项卡|如何交出我的第一件成果？|三项输入+诚实声明即时进入可下载JSON|实际表单与预览，文本是工作成果；不生成静态表单图片。无场景/3D必要性|只在当前浏览器本地保存，经明确操作下载；不收集手机号/健康信息；空字段拒绝完成|改字段后JSON确实变化；不勾声明不完成；下载后下一页可核对|
|8 s8 交接M02|下一节点需要这张卡中的哪些信息？|本地已保存卡片字段→M02工具验证→以后结构/特征任务|DOM读取本地卡片+清单，复制保存状态需准确；不把装工具当自动完成|本机无卡时显示未保存；M02版本号是待完成，不伪造执行记录|保存卡片后页8可见同值；刷新后可恢复；显示下载备份提示|

## 数据与仿真边界

十二个 ID 只是教学记录，不给它们编造化学结构或真实毒性。属性合格/风险合格是人为布置的布尔测试字段；分数是 0–100 的排序值，不是概率。构造验证结果仅用于学习预测/证据的区别，不是实际实验。局部已测集合在保留数调整时不消失，确保预算守恒。项目立项卡仅 localStorage / JSON 下载，不写生产数据库。

## Raster prompt (scientific-educational, built-in image_gen)

Wide 16:9 educational scientific illustration for a 14–17-year-old course. Light warm ivory background with restrained charcoal, muted teal and ochre, no people. Show a clear left-to-right handoff from computer-based virtual screening to physical laboratory testing. Left: a realistic desktop monitor seen at a slight angle, its screen has a dense orderly grid of plain small neutral record tiles, with only a small subset highlighted muted teal; no chemical bond drawings, letters, numbers or charts. In the middle a short, simple arrow leads to a smaller monitor panel displaying only the highlighted subset as a short list of the same plain tiles. A second simple arrow leads to the right: a close, precise rendering of an adjustable laboratory micropipette positioned above a transparent multiwell plate, accompanied by a small rack of closed plain sample tubes. The contrast should visibly teach digital records being narrowed into a shortlist before a distinct physical verification step, not a computer magically producing medicine. Balanced compact composition, clean publication-quality material rendering, all three stages clear, no dark background, no haze, no scattered props. No text, numbers, logos, ticks, pills, syringe, molecules, invented chemical formulas, glow, floating icons, mascots or humans. Exact stage labels and limitations will be HTML outside the image. This is an explanatory illustration, not a claim that an experiment was performed.

## 实际完成与 QA

状态：本地实现并验收，待用户审阅；未部署。8 页 s1–s8 与理论/活动锚点全部保留；六个 canonical 源文件未改。新讲稿未配音，旧音频未沿用。

- 1 张真实生成 raster，1600×900 WebP，65,846 bytes，使用内置 image_gen；项目文件 `packages/student-web/public/slide-assets/molecule-monster-hunter/M01/virtual-to-experiment-v1.webp`。已目视检查浅底、无人物、电脑缩小候选→后续实验的关系；图中数量只示意，精确标签在 HTML 中。
- 0 页 3D：本节没有可依据来源建模的空间检查问题。不是配额判断；M38 的两页真实 Three.js 已部署。
- 第 2 页实际 RDKit 乙醇 SVG `viewBox=0 0 440 160`，9 条 path；不是给构造 ID 伪造结构。
- 第 5 页自动播放到 12→8→5→3→3，单步与暂停保持通过；实际结果 A 失败、B/C 通过；KaTeX MathML 实际加载。
- 第 6 页实际花完五次预算，改变保留数到 1 后预算仍 0、已测日志仍 5 条；后续按钮禁用，7 个未测记录保持未知。
- 第 7 页空表单被四项检查拦住；填写 QA 测试字段保存，切换第 8 页读取同值，回到第 7 页恢复同值，实际触发 JSON 下载入口；测试卡片已通过二次确认清除，不留下伪用户成果。
- 480/720/960/1152 四宽 × 8 页 = 32 个组合无横向溢出；1280×720 放大浮窗 8 页无内部滚动或裁切。调整图片最大高度和正文大小后重新目视检查首图/动态页。
- 7 项新增测试 + M38/M90 17 项 = 24 项通过；新增文件 ESLint 通过；全仓类型检查仍为 20 项原有诊断，新增文件无诊断。初次发现的 JSX 闭合错误已在浏览器交付前修正；LCP 图片警告通过 `loading="eager"` 修正。浏览器无运行异常。

预览：http://127.0.0.1:4173/slide-preview/m01-discovery 。下一推荐节点 M02。UI 使用原项目主题变量；按 skill 的逐页判断选择媒体，而非一律 HTML 或机械增加 3D。
