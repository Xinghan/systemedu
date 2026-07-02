# 先驱者协会徽章图片 (spec 042)

命名约定: `<chapter>-<tier>.png`，均为连字符英文名，与
`packages/student-app/src/systemedu/student/badges/chapters.py` 的常量值一致。

## 分会 (chapter)

bio-forge / skyward / verdant / mecha-core / mind-forge / codex / neural-spire / deep-time

## 等级 (tier)

bronze / silver / gold / master

## 示例

`bio-forge-bronze.png`、`mind-forge-master.png`

共 8 分会 x 4 级 = 32 张图，生图 prompt 见 `resources/badges/badge_prompts.md`。
图片放入本目录后前端 `BadgeWall.tsx` 自动生效，无需改代码。
