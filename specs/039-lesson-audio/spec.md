# Spec 039: 教案讲稿语音 (Lesson Audio)

Status: shipped molecule (2026-06-27)

验收结果 (molecule-monster-hunter): 47 knode × ~9 slide = 437 段, 全部合成成功
0 失败, 均有效 WAV。源是 slides.json 每张 slide 的 audio_script (前端教案播放器
翻的就是 slides), 不是 audio_scripts.json。音频 532MB 不进 git (gitignore),
随 publish tarball 上线。生产验证: /v1 取音频 200 (audio/x-wav), knode 接口
slides 带 audio_path, student-app file 代理透传 content-type, 前端 <audio> 播放器
已部署。其余 5 项目用同脚本批量推 (后续)。

## WHAT

把每个 knode 已生成的语音讲稿 (audio_scripts.json, 每段 {section_title, audio_script})
用 DashScope qwen3-tts (Cherry 音色) 合成为音频文件, 随内容包上线生产, 前端在教案
讲稿区给每段加播放按钮。

先做 molecule-monster-hunter (第一个部署的项目) 跑通全链路, 再批量推其余 5 个。

## WHY

- 6 个生产项目的讲稿文字都有了, 但从未生成音频。面向 6-18 岁儿童, 语音讲课比纯文字
  讲稿更适合低龄/伴随式学习。
- TTS 链路 (core/education/tts.py, DashScope qwen_tts) 已验证可调通 (2026-06-27 实测
  108 字 → 1MB WAV)。只缺批量生成 + 上线 + 前端播放。

## 范围 (已确认决策)

| 决策 | 选定 |
|---|---|
| 先做哪个 | molecule-monster-hunter 跑通全链路, 再推其余 5 个 |
| 音频粒度 | 每段讲稿一个音频文件 (按 audio_scripts list 索引) |
| 音色 | Cherry (现 config) |
| molecule 规模 | 47 knode × 各段 = 259 段, 全量一次跑完 |

## 数据/文件约定

- 音频落: `knodes/<knode_dir>/audio/seg-<i>.wav` (i = audio_scripts list 索引, 稳定)
- audio_scripts.json 每段加字段 `audio_path: "knodes/<dir>/audio/seg-<i>.wav"`
  (相对项目根, 前端经 /files 代理取)
- regenerate_manifest 重算 manifest.files[] (含音频 sha256/size)
- library importer 已扫 knode 目录文件; /v1/projects/<slug>/files/<path> 已有端点取音频
- library get_knode 已返回 audio_scripts → 前端拿 audio_scripts[i].audio_path 播放

## 实现

1. 批量合成脚本 (内容仓): 遍历 knode audio_scripts.json 每段 → synthesize_speech →
   落 audio/seg-i.wav → 写回 audio_path。并发 + 断点续跑 (已存在且有效则跳过) + 失败重试。
2. manifest 重算 + publish.sh 上架 (内容仓自包含)
3. 前端 teacher-scene-view.tsx: 每 section 若有 audio_path, 显示播放按钮, 经 myProjects
   file 代理取音频
4. 部署前端 + 上线 molecule

## 验收

1. molecule 47 knode 每段都有有效 wav (RIFF 头, > 1KB)
2. audio_scripts.json 每段含 audio_path
3. manifest.files[] 含全部音频, sha256 校验通过
4. 生产 /v1/projects/molecule-monster-hunter/files/knodes/M01-w0-module/audio/seg-0.wav → 200 音频
5. 前端教案页每段讲稿有播放按钮, 点击能播
6. 其余 5 项目用同一脚本批量推 (本 spec 先交付 molecule, 其余作为后续)
