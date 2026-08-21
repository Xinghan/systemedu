import assert from "node:assert/strict"
import test from "node:test"

import { parseCapstoneBlocks } from "./capstone-assignment.mjs"

const stageCapstone = `# 我的空气侦探任务

## 阶段作品

我的第一张空气观察卡

## 交付物

- **观察卡照片**：拍下你完成的观察卡。
- **一句发现**：写下你发现的空气变化。

## 自检清单

- [ ] 我写清了观察的地点和时间。
- [ ] 我画出了一个空气变化。
- [ ] 我请同伴或家长看过我的观察卡。

## 下一关会用到它

S2 会用这张观察卡来决定要收集哪一种空气数据。`

test("parses the four child-readable stage-capstone sections", () => {
  const blocks = parseCapstoneBlocks(stageCapstone)

  assert.equal(blocks.find((block) => block.title === "阶段作品")?.type, "stage_product")

  const artifacts = blocks.find((block) => block.title === "交付物")
  assert.equal(artifacts?.type, "artifacts")
  assert.deepEqual(artifacts?.cards.map((card) => card.heading), ["观察卡照片", "一句发现"])

  const selfCheck = blocks.find((block) => block.title === "自检清单")
  assert.equal(selfCheck?.type, "self_check")
  assert.equal(selfCheck?.cards.length, 3)
  assert.match(selfCheck?.cards[0].heading ?? "", /地点和时间/)

  const handoff = blocks.find((block) => block.title === "下一关会用到它")
  assert.equal(handoff?.type, "handoff")
  assert.match(handoff?.body ?? "", /S2/)
})
