# Chapter film pairs — 2026-11-27

Confirmed scope: **14 chapters × one introduction and one closing = 28 films**, plus the separate project introduction. The 120 lesson nodes remain unchanged. This is chapter-level media, not 240 lesson-level clips.

## Content and generation

- Retain the 14 existing animated chapter introductions and project opening, including their original audio. This batch does not replace their voice or soundtrack.
- Retain the approved `research-P1-complete` commander-voice/music sample. `dialogue.json` contains the 13 remaining chapter-specific closings: submitted work, a learning boundary, and the next chapter. They provide encouragement about the process, not an invented score or automatic scientific validation.
- New speaking segments use `wan2.6-i2v`, the same fictional Chinese commander illustration, and the previously designed `qwen-audio-3.1-tts-plus` voice. No student photo, identity or work is submitted to the generator.
- The final soundtrack uses the original synthesized voice, without pitch or speed changes, and **Firmament_Active by PeriTune**, [source](https://peritune.com/blog/2017/07/30/firmament/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Edits: excerpt, loudness normalization, music reduction during speech, fades, voiceover mix. Source license evidence and MP3 are retained in `../completion-film-commander-voice/`.
- Each closing uses actual generated character motion followed by a distinct unmanned chapter laboratory scene with its outcome and successor. Scene artwork is illustrative. It does not represent a student's measured results.

## Playback contract

- Project opening: persistent **项目介绍** button on the project home; also accessible from the lesson video menu. Replay does not change progress.
- Chapter introduction: automatic on first entry, including entry from the task map; **重看本章任务简报** on the chapter home and **本章开场** in the lesson menu. Always closable/skippable.
- Chapter closing: automatically presented only after successful durable submission of the chapter work. Close returns to the receipt; continue names the exact successor. Replaying an archived film never advances progress. Completed chapters expose **本章收尾** in the lesson video menu.
- Persistent native project return, route map and previous-lesson controls remain available while the classroom is immersive. Map selection changes the view, not the student's completion records. Future nodes remain locked.

## Reproduction and verification

`generate.py` reuses accepted task IDs and does not silently submit a second video job. `install.py` requires all 14 closings, verifies formats and copies only the 13 new media triplets plus completion-film manifest entries. It preserves existing introductions, 120 references and all course files. `verify.py` decodes outputs and creates contact sheets for visual review.

Generation completion, file digests and media counts are recorded in `media-verification.json`; decoding in `decode-verification.json`. Simulator outcomes are recorded separately after the final bundle is tested. Earlier navigation verification and the unchanged 120-node destination table are in `../navigation-restored/`.
