# 未来职业人物场景 · v2

用户指定五个方向使用中国人形象；航天呈现发射控制人员，人形机器人呈现科学家，药物呈现新药发现，环境呈现海洋、荒漠等场景的户外科考。本版将人物定义为虚构的成年专业人员，让孩子看到可以向往的职业活动。

五幅图使用内置 image_gen 独立生成，未使用 CLI/API fallback。画内无标题和品牌标志，网页图注标明 AI 生成。场景用于职业愿景，课程里的学生作品封面、器材要求和 3D 打印制造约束不变。

| 方向 | 场景 | 完整提示词 | 原图 | 网页文件前缀 |
| --- | --- | --- | --- | --- |
| 人形机器人 | 科学家向人形机器人示范抓取 | robotics-prompt.txt | robotics-source.png | robotics-career-v2 |
| 航天 | 发射中心监测火箭升空 | space-prompt.txt | space-source.png | space-career-v2 |
| 药物发现 | 实验验证与蛋白质/候选分子可视化 | molecular-prompt.txt | molecular-source.png | molecular-career-v2 |
| 新能源 | 光伏试验场测量，风电背景 | energy-prompt.txt | energy-source.png | energy-career-v2 |
| 环境 | 岩岸潮池水质科考 | earth-prompt.txt | earth-source.png | earth-career-v2 |

源图与提示词在本目录；网页使用 `packages/student-web/public/library/futures/` 中对应前缀的 480、800、1280px WebP。尺寸、字节数和生成来源路径记录在 `image-variants.json`。

验收脚本 `verify.mjs` 检查五个方向、中英文、320/390/1440px、Retina 资源选择、首个项目链接和横向溢出；只对目录请求使用 fixture，不操作学生记录。`verification.json` 和各方向页面截图是本批结果。旧目录中的人物示例与验收文件是 v1 历史记录。

本批用于本地验收，未部署生产。生成图表达职业场景，不是设备接线图、真实机构背书或具体研究结果。

## 本批检查结果

已逐张检查五幅原图，并查看五个方向的页面截图：人物面部、工作动作和关键设备在手机卡片尺寸下可辨认；航天图明确使用发射监控画面，环境图为海岸实地测量。桌面和手机图均没有新增标题覆盖在画面上。

浏览器 35 项检查通过，页面异常为 0；相关 TypeScript 文件 ESLint 与 `git diff --check` 通过。网页 480px 图片约 21–44 KiB，800px 约 42–100 KiB；页面用 srcSet 按屏幕选择，不加载归档原始 PNG。未开展真实用户易用性测试。
