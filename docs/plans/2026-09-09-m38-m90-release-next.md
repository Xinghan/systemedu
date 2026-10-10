# M38 / M90 发布与下一节点 Implementation Plan

**Goal:** 发布已经审阅的 M38、M90 共 20 页，然后继续 M01 的来源审查和制作，未经预览确认的新节点不混入本次发布。

**Architecture:** 基于生产当前 `ea4FB-hqZCwxNKu7J5oIs` 隔离构建，新增两个渲染器、关联计算模型、Three.js 场景和一张 WebP；仅定向修改 renderer/types 集成。不覆盖本地整份前端。课程 12 个文件对齐，保留 ID、锚点，解绑过时音频。

**Tech Stack:** 现有 Next.js / React / Three.js / RDKit / KaTeX；现有 sshpass 和 deploy.env；现有 library import/publish。

## Tasks

1. 校验 reviewed fixture、六文件来源哈希、素材哈希，生成课程伴随正文和前端白名单。
2. 在服务器保存基线；隔离复制生产源、叠加白名单、定向插入 renderer/types。构建成功前不切换。
3. 4001 smoke；课程备份、源哈希检查、manifest 与包自检。服务健康、构建/内容基线不变才切换前端。
4. import/publish；验证 library API 的 20 页、所有非目标节点哈希、生成图片公网哈希、前端/后端健康。保留服务器回滚资料，不下载生产源码或数据库。
5. 仅在成功后将 12 个本地课程源文件与已发布稿对齐，并更新 registry / ledger / 发布记录。
6. 读取 M01 课文、理论、活动、作业、原 slide 和讲稿。按 course-slide-visuals 先保存逐页判断卡，选择知识信息量最有效的方式，再生成和测试；本地展示，不纳入前一步的上线包。

## Verification

运行 `node --test packages/student-web/scripts/test-logp-lab.cjs packages/student-web/scripts/test-workbench-evidence.cjs`；新增渲染器已有逐页多宽度和 Three.js/公式/RDKit 的真实浏览器 QA。发布过程额外检查服务器依赖、生产构建、资源与 API。旧音频不复用，明确未合成新语音。
