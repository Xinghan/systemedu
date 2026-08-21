import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { auditStageDeliverables } from "./stage_deliverables.mjs"

const fixtureUrl = (name) => new URL(`./fixtures/${name}`, import.meta.url)

async function readFixture(name) {
  return JSON.parse(await readFile(fixtureUrl(name), "utf8"))
}

function assignment() {
  return [
    "## 阶段作品\n我的作品",
    "## 交付物\n- 一份作品",
    "## 自检清单\n- [ ] 我完成了",
    "## 下一关会用到它\n下一关会拿它继续实验",
  ].join("\n\n")
}

test("accepts a complete child-visible stage chain", async () => {
  const tree = await readFixture("stage_deliverables.valid.json")
  const errors = auditStageDeliverables(tree, { M01: assignment(), M02: assignment() })

  assert.deepEqual(errors, [])
})

test("reports missing work-product, hand-off, assignment, and backward-link errors", async () => {
  const tree = await readFixture("stage_deliverables.invalid.json")
  const errors = auditStageDeliverables(tree, {
    M01: assignment(),
    M02: "## 阶段作品\n缺少后三个标准章节",
  })
  const all = errors.join("\n")

  assert.match(all, /S1.*stage_output/)
  assert.match(all, /S1.*closing_capstone_module_id.*M99/)
  assert.match(all, /S2.*capstone_reuses_outputs_from_stages/)
  assert.match(all, /M02.*missing heading.*下一关会用到它/)
  assert.match(all, /backward cross-stage dependency.*M02.*M01/)
})
