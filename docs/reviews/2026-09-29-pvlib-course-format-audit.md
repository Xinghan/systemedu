# pvlib 课程生成与课堂展示一致性检查

日期：2026-09-29。范围：检查已发布的 `pvlib-solar-forecast-station` 与 `~/Dev/systemeduidea` 的生成规范、网站既有课堂组件之间的差异。本批次只提交检查记录，未修改课程、前端或生产服务。

## 结论

课程内容确实调用了 `course_factory`，也保存了节点检查记录；但这些证据不足以证明完整遵循了所有 skill 要求。正式课堂接入存在明确偏差：本地验收专用的预览组件被直接用于已发布课程，额外引入了“课程 / 动画与实验 / 幻灯片 / 作业”四个顶层视图。这个产品界面决定并非生成 skill 的要求。

复用正文阅读器和视频等局部组件，没有达到复用既有完整课堂体验的要求。此前用户对动画和游戏质量的认可，也不能视为对整个课程页面格式变更的要求。

## 1. 生成规范与实际课程产物

检查的 skill 来源为 `~/Dev/systemeduidea/course_factory/SKILL.md` 及 `.agents/skills/course_factory`、`.claude/skills/course_factory` 下相关副本。这些副本并非完全一致，但本次检查的正文锚点、富媒体与老师讲课要求一致，没有要求增加上述顶层视图。此检查不等于对整本 skill 的全部执行步骤逐项验收。

规范中的相关依据：

- `course_factory/SKILL.md:1308`：富媒体对应已有前端的富媒体栏，各节点需要逐类考虑。
- `course_factory/SKILL.md:2458`：将 `[[IDEA:{idea_id}]]` 插入正文对应知识点的段落。
- `course_factory/SKILL.md:3674`：slides 服务于“老师讲课模式”，交互页读取 animation/game HTML。
- `.agents/skills/course_factory/references/teacher-slide-image-generation.md:17`：动画、游戏页继续引用真正的交互 HTML。

实际生成脚本为 `~/Dev/systemeduidea/projects_data/pvlib-solar-forecast-station/authoring/assemble_course.py`。它调用 `factory.make_course_content(..., preflight=True)`、`factory.preflight_v41`、`factory.finalize_slides`、`factory.finalize_audio_scripts` 和 `save_knode_to_workspace`。

本次对 58 个节点的文件和标记进行检查，结果如下：

| 项目 | 结果 |
| --- | --- |
| lesson、sections、theories、slides、assignment、audio_scripts、learning-record 文件 | 58 个节点均存在 |
| 动画 / 游戏 | 12 / 11，均保留在正文中的 IDEA 锚点 |
| 理论锚点缺口 | 0 |
| 已保存的 course-assembly 检查记录 | 58 条 preflight pass；slide/audio warning 为空 |
| 独立评审痕迹 | 58 条均记录 science、theory、game-design 评审文件摘要 |

这些检查记录来自已有生成产物，本轮没有重新执行整套生成和科学内容验收。因此不能用“调用了 factory”或“preflight pass”推导出全部教学质量、媒体质量与页面一致性要求都已满足。

## 2. 新格式从哪里产生

`assemble_course.py:144` 自行写入以下策略：

> Student animations and games are accessed via lab tabs; the teacher player uses independent readonly figures.

同一脚本在第 117 行拒绝老师 slides 中的 animation/game 类型。这是生成实现自行添加的限制，不能当作 skill 要求。独立的只读讲解图可以具有教学价值，但它本身不要求创建新的课堂导航结构。

网站侧的调用链是：

1. `packages/student-web/src/app/(learn)/learn/pvlib-solar-forecast-station/[moduleId]/page.tsx`：专用正式路由渲染 `PvlibPublishedLesson`。
2. `packages/student-web/src/components/learning/pvlib-published-lesson.tsx:110`：正式组件直接渲染 `PvlibCoursePreview`。
3. `packages/student-web/src/components/learning/pvlib-course-preview.tsx:23`：硬编码四个顶层视图。

既有普通课程经过动态 `[slug]/[moduleId]` 路由进入 `LearnPage`，再使用完整的 `CourseContentView`。该组件组织正文、IDEA 富媒体、老师讲课入口及 `NodeAssignmentPanel`。pvlib 只使用其中的 `CourseReadingBody` 和其他局部组件，并未沿用完整组织方式。

历史记录也能定位这一过程：

- `96fe3c91`、`a0777849`：Lightkurve、TeachOpenCADD 本地验收预览已出现类似四视图结构；这两门课是否具有相同的正式发布问题，需要另外核查。
- `b569110d`：建立独立的 pvlib 本地预览。
- `17819be5`：发布 pvlib 时继续使用这一预览组件。

根因是本地验收界面被直接提升为正式课堂界面；生成脚本、计划及验证又沿用了这个自行决定的结构，未把“与既有课堂一致”作为独立验收条件。

## 3. 已确认的实际影响

### 学习路径分散，实验保存接入不一致

正文仍然保留所有动画和游戏锚点，因此不能说媒体只能通过独立 tab 访问。实际问题是同一实验同时存在正文入口和独立实验入口。

独立实验视图使用自定义 `ArtifactFrame`，接收实验产物消息并向作业记录传递；共享正文中的 `IdeaIframeBlock` 没有接入相同的 pvlib 产物消息处理。两个入口没有共用同一套保存与恢复接入。此结论来自代码检查，本轮没有据此推断所有正文操作都会丢失。

### 正文资料下载链接在生产不可用

生成脚本第 77 行将 `/preview/pvlib/media?path=downloads%2Fpvlib-practice-kit.zip` 写进正文。58 个节点都含有这一预览路径，正式适配器未重写。

本轮请求对应的 `https://systeme.xin/preview/pvlib/media?path=downloads%2Fpvlib-practice-kit.zip` 返回 HTTP 404。问题限定为正文链接；正式页面另有经过认证的资料下载按钮，不能据此断言全部下载都不可用。

## 4. 生产环境核对与检查边界

在生产服务器上执行只读布尔检查，确认专用正式路由、正式组件复用预览、四视图定义都存在；同时确认共享阅读器保留正文 IDEA、slide carousel、作业组件，但没有 pvlib 实验产物处理器。上述页面结构问题不只是本地未提交文件造成的。

本轮未登录学生账号进行全流程操作，没有重新验收全部动画、游戏、课程科学内容或学生历史记录。

## 5. 后续修正方向

保留现有课程内容及高质量媒体，将其接回统一的正式课堂组件：正文按教学顺序组织，动画和实验挂在相应学习段落，讲课材料沿用老师讲课模式，课堂输入、自测、阶段检验及作业使用一致的保存入口。

接入前需要把实验产物保存/恢复、正式资料下载和课程加载补齐到共享流程，并保持现有记录的课程、节点、活动、类型和内容版本标识，避免因为只删除 tabs 而丢掉已经实现的功能。验收应覆盖旧课程回归、新课程完整学习路径、实验恢复以及正式下载。
