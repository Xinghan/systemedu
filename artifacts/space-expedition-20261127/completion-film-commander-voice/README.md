# 林岚指挥官配音 + Firmament Active

本版替换「星光为什么变暗了」完成样片的声音和人物讲话动画。用户反馈初版声音过于柔软，随后选定 PeriTune 的 Firmament_Active 作为配乐。对白保持不变，方便比较声音；其他章节及全局课堂 TTS 设置未改变。

## 预览

- `linlan-completion-preview.mp4`：带中文字幕的完整审阅影片，含新版声音、重新生成的讲话动画、背景音乐及片尾署名。
- `dialogue.mp3`：独立新版配音；`commander-voice.wav` 为语音服务原始输出。
- App 继续引用稳定标识 `research-P1-complete`，对应公共目录中的 MP4、VTT 和 poster 三个文件。初版预览仍在相邻的 `completion-film` 文件夹。

## 声音与混音

通过已有语音服务为林岚创建原创女性指挥官音色（qwen-audio-3.1-tts-plus）：中低音区、稳定气息、清楚有力的吐字、干脆的句尾。语音自然时长约 11.98 秒，没有人为变调或加速。完整声音描述、可复用音色 ID 和生成请求留存在 `voice-design.json`；不包含密钥。服务参考：[音色设计](https://help.aliyun.com/zh/model-studio/voice-design-user-guide)。

使用新版音轨重新生成约 15 秒的动态人物讲话镜头；最终合成直接使用设计音色的原音轨，避免视频生成服务改变配音。讲话片段之后切到无人科研实验室成果镜头。

配乐使用原曲开头片段。人声响度目标 -18 LUFS；音乐在讲话期间约 -32 LUFS，末句结束后用 0.8 秒平滑升至约 -24 LUFS，片尾 1.1 秒淡出。参数与时长见 `mix.json`。音乐已与视频合轨，原有暂停、退出、重播和音量行为保持一致。

## 配乐署名

**Firmament_Active — PeriTune (Sei Mutsuki)**

- 原曲及试听：[PeriTune，2017-07-30](https://peritune.com/blog/2017/07/30/firmament/)
- 许可：[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- 改动：节选、响度调整、配音期间压低音量、淡入淡出、人声混音。
- 原曲页与当前使用条款均保留 2026 年 3 月以前发布曲目的 CC BY 4.0 许可。`MUSIC-LICENSE.txt` 随原音源保存。
- 影片片尾显示署名，MP4 元数据保留完整来源与许可链接；App 原有字幕面板提供可点击的来源、许可链接和改动说明，没有新增顶部操作入口。

## 复现与验收

`generate.py` 复用初版合成逻辑，依次支持 `voice`、`music`、`submit`、`fetch`、`compose`。音色和视频任务均保留请求结果，已有任务不自动重复提交。正式接入只同步三个媒体文件和完成影片的配乐署名配置。

视觉抽帧：`contact-sheet.jpg`。自动验收结果及资源哈希见 `verification.json`。测试使用独立的合成用户记录，不修改真实用户进度。
