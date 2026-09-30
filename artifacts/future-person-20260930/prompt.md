# 「未来的我」人物示例

使用内置 image_gen 生成，不使用 CLI/API fallback。示例方向：AI 药物发现。

设计意图：人物代表可想象的未来自己，面部表情与正在做的事情同时可读；用可获得的计算工具表达分子研究，与既有课程封面一起使用。人物为虚构形象，不是导师、学员证言或真实研究人员肖像。

构图：年轻创造者的侧脸与前景分子研究屏幕；自然光、真实材质、温暖工作空间。画面无文字。不使用白大褂、湿实验或昂贵仪器营造不符合课程的门槛。

完整生成提示词见 `generation-prompt.txt`。原图为 `molecular-creator-source.png`（1536×1024）；网页使用 `packages/student-web/public/library/futures/` 下的 480 / 800 / 1280px WebP，约 27 / 55 / 102 KiB，尺寸和字节数见 `image-variants.json`。

仅在「未来的我 → AI 药物发现」中使用。原课程封面与其他四个职业方向保持原资源，人物场景在网页中标注为示意。中英文、桌面与手机验收由 `verify.mjs` 执行，结果见 `verification.json`。本批供本地比较，未部署生产。
