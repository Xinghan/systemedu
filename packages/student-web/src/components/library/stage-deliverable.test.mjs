import assert from "node:assert/strict"
import test from "node:test"

import { getStageDeliverable } from "./stage-deliverable.mjs"

const stages = [
  {
    stage_id: "S1",
    stage_output: "我的观察卡",
    closing_capstone_module_id: "M01",
    capstone_scope: "整理观察结果",
    capstone_reuses_outputs_from_stages: [],
    capstone_hands_on_expectation: "画图并拍照",
  },
  {
    stage_id: "S2",
    stage_output: "我的实验工具包",
    closing_capstone_module_id: "M02",
    capstone_scope: "用观察卡完成实验",
    capstone_reuses_outputs_from_stages: ["S1"],
    capstone_hands_on_expectation: "完成实验并保存结果",
  },
]

const modules = [
  {
    module_id: "M01",
    stage_id: "S1",
    acceptance_artifacts: [{ title: "观察卡照片", kind: "image" }],
    acceptance_standard: ["写清对象", "画出发现", "拍照保存"],
    what_it_passes_forward: "S2 会用观察卡选择实验条件。",
  },
  {
    module_id: "M02",
    stage_id: "S2",
    acceptance_artifacts: [{ title: "实验结果页", kind: "document" }],
    acceptance_standard: ["用了观察卡", "记录结果", "写出发现"],
    what_it_passes_forward: "",
  },
]

test("maps a complete stage into the child-visible product card", () => {
  const result = getStageDeliverable(stages[1], modules, stages)

  assert.equal(result.status, "complete")
  assert.equal(result.stageOutput, "我的实验工具包")
  assert.deepEqual(result.reuseStageIds, ["S1"])
  assert.equal(result.capstoneModuleId, "M02")
  assert.deepEqual(result.artifacts.map((artifact) => artifact.title), ["实验结果页"])
  assert.equal(result.checks.length, 3)
})

test("reports incomplete source data instead of hiding the stage", () => {
  const incompleteStage = { ...stages[1], stage_output: "", capstone_reuses_outputs_from_stages: [] }
  const result = getStageDeliverable(incompleteStage, modules, stages)

  assert.equal(result.status, "incomplete")
  assert.ok(result.missing.includes("stage_output"))
  assert.ok(result.missing.includes("capstone_reuses_outputs_from_stages"))
})
