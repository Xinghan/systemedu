# 林岚开场：真实动态视频样片

本地验收：http://localhost:4000/mission/rover/video

## 交付

最终视频：`packages/student-web/public/mission/rover/video/lin-lan-welcome-v1.mp4`。

- 8.6 秒，1918 × 1080，30fps，H.264 / AAC，约 4.58 MB（十进制），faststart。
- 原始生成：wan2.6-i2v，提交 10 秒、1080P，一个连续镜头，一次生成成功，无重复提交。
- 使用原有虚构中国工程师林岚的图片与 Cherry 合成中文配音，视频中包含口型、眨眼、头部和手部动作。
- 动作以面对观众讲话为主，没有实现明显的整个人转身；相机移动也较克制。当前样片用于验收人物表演，不代表完整开场已经视频化。
- 抽帧检查发现源视频约 9 秒后在静音段仍有额外张嘴动作，因此最终裁至 8.6 秒；保留全部对白和短暂停顿。
- 中文字幕作为可选 VTT 字幕轨，没有烧录进图像。字幕为整段显示，不宣称逐字强制对齐。

`source.mp4` 保留服务生成的原始 10 秒视频；`contact-sheet.jpg` 是原始视频每秒抽帧，`ending-frames.jpg` 用于确定裁切点。`prompt.txt` 保存实际提示词，`task.json` 保存不带密钥/签名链接的任务状态。`task.json.bytes` 是原始下载大小，最终文件大小与编码见 `web-probe.json`。

## 工作流

`generate-video.py submit` 只允许创建一个任务，之后用 `fetch` 查询相同 task_id。复用项目现有百炼配置，只上传本批生成的人物图与合成音频，不涉及学生数据。

配音在前面增加 0.9 秒静音，总长度补齐至 10 秒。视频按以下参数剪辑并生成 Web 版本：

```sh
ffmpeg -y -hide_banner -i source.mp4 -t 8.6 \
  -c:v libx264 -preset medium -crf 21 -pix_fmt yuv420p \
  -c:a aac -b:a 128k -movflags +faststart lin-lan-welcome-v1.mp4
```

没有替换原来的互动任务、改变原有课程结构或部署生产。

## 验证

- FFprobe：原始视频及最终 Web 视频均含有效视频/音频流。
- 音频检查：源 10 秒视频的音轨与提交配音在同一时间轴的波形相关度约 0.99946，说明提交的配音被保留。此检查不能证明视觉口型逐字准确；自然度和口型仍需观看验收。
- 人工抽帧：可见嘴型、眼睛、头部和手势变化；背景及角色身份整体连续。末尾多余动作已裁掉。
- Playwright：1080P 元数据、主动开启声音、内联播放、暂停、结束/重播、390px 手机布局、下载失败提示与重试均通过，无 pageerror。详见 `verification.json`。
- 新增 TS/TSX 的 ESLint 通过。全仓 TypeScript 仍有先前的 6 个错误（slide-demo 两处、course-content-view 四处），新增文件没有诊断。不宣称全仓构建通过。

官方依据：
- [万相图生视频：首帧、指定音频、异步任务](https://help.aliyun.com/zh/model-studio/legacy-image-to-video-api-reference/)
- [本地文件上传到模型临时存储](https://help.aliyun.com/zh/model-studio/get-temporary-file-url/)

实际调用沿用仍可用的 `dashscope.aliyuncs.com` 域名。授权头只用于模型请求，下载生成视频时不转发凭据。
