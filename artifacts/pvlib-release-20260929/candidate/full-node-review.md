# 58 节完整遍历记录

候选构建：`KbFMRmd6LHoM43bzsRIEY`。本轮浏览器顺序遍历 M01–M58，所有课程标题、58 节导航、课堂记录入口及内容版本摘要断言完成；随后动画/游戏、幻灯片、M57 实践包下载摘要和 390px 页面断言也完成。

该轮最终“页面异常为零”断言失败，捕获 4 条 sandbox localStorage 拒绝异常。原因是验收脚本的 `context.addInitScript` 将模拟登录注入了子 iframe；这些游戏的课程源码不使用 localStorage。未放宽课程 iframe 的隔离权限。

修复仅涉及验收脚本：模拟登录限于 `window === window.top`。后续复查 M01、M21、M48、M57、M58 及同一组动画/游戏、下载和手机页面，结果见同目录 `verification.json`。课程文件与候选构建未变。该报告不把模拟账号验收描述为真实生产学生账号测试。
