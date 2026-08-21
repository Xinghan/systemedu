#!/usr/bin/env node

import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

const REQUIRED_STAGE_FIELDS = [
  "stage_output",
  "closing_capstone_module_id",
  "capstone_scope",
  "capstone_reuses_outputs_from_stages",
  "capstone_hands_on_expectation",
]

const REQUIRED_ASSIGNMENT_HEADINGS = [
  "阶段作品",
  "交付物",
  "自检清单",
  "下一关会用到它",
]

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0
}

function hasHeading(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`^##\\s+${escaped}(?:\\s|$)`, "m").test(markdown)
}

/**
 * Validate the stage-level work-product contract in a V5 knowledge tree.
 *
 * @param {Record<string, unknown>} tree
 * @param {Record<string, string | undefined>} assignmentByModule
 * @returns {string[]} human-readable validation errors
 */
export function auditStageDeliverables(tree, assignmentByModule = {}) {
  const errors = []
  const stages = Array.isArray(tree?.stages) ? tree.stages : []
  const modules = Array.isArray(tree?.modules) ? tree.modules : []
  const moduleById = new Map(modules.map((module) => [module?.module_id, module]))
  const stagePosition = new Map(stages.map((stage, index) => [stage?.stage_id, index]))
  const stageIds = new Set(stagePosition.keys())

  if (stages.length === 0) {
    return ["stages must be non-empty before auditing stage deliverables"]
  }

  for (const [index, stage] of stages.entries()) {
    const stageId = stage?.stage_id || `stages[${index}]`
    for (const field of REQUIRED_STAGE_FIELDS) {
      const value = stage?.[field]
      const missing = field === "capstone_reuses_outputs_from_stages"
        ? !Array.isArray(value)
        : !isNonEmptyString(value)
      // S2+ reports this field below with a more actionable hand-off error.
      if (missing && !(field === "capstone_reuses_outputs_from_stages" && index > 0)) {
        errors.push(`${stageId} missing ${field}`)
      }
    }

    const reuse = stage?.capstone_reuses_outputs_from_stages
    if (index === 0 && Array.isArray(reuse) && reuse.length > 0) {
      errors.push(`${stageId} must not reuse an earlier stage because it is the first stage`)
    }
    if (index > 0) {
      if (!Array.isArray(reuse) || reuse.length === 0) {
        errors.push(`${stageId} missing capstone_reuses_outputs_from_stages`)
      } else {
        for (const sourceStageId of reuse) {
          const sourceIndex = stagePosition.get(sourceStageId)
          if (sourceIndex === undefined) {
            errors.push(`${stageId} reuses unknown stage ${sourceStageId}`)
          } else if (sourceIndex >= index) {
            errors.push(`${stageId} must reuse an earlier stage, not ${sourceStageId}`)
          }
        }
      }
    }

    const closingModuleId = stage?.closing_capstone_module_id
    const closingModule = moduleById.get(closingModuleId)
    if (!closingModule || closingModule.stage_id !== stage?.stage_id) {
      errors.push(`${stageId} closing_capstone_module_id ${closingModuleId || "(empty)"} not found in stage ${stageId}`)
      continue
    }

    if (closingModule.mission_role !== "capstone") {
      errors.push(`${stageId} closing module ${closingModuleId} must have mission_role capstone`)
    }
    if (!Array.isArray(closingModule.outputs_produced) || closingModule.outputs_produced.length === 0) {
      errors.push(`${stageId} closing module ${closingModuleId} missing outputs_produced`)
    }
    if (!Array.isArray(closingModule.acceptance_artifacts) || closingModule.acceptance_artifacts.length === 0) {
      errors.push(`${stageId} closing module ${closingModuleId} missing acceptance_artifacts`)
    }
    const standards = closingModule.acceptance_standard
    if (!Array.isArray(standards) || standards.length < 3 || standards.length > 5) {
      errors.push(`${stageId} closing module ${closingModuleId} must have 3-5 acceptance_standard checks`)
    }
    if (index < stages.length - 1 && !isNonEmptyString(closingModule.what_it_passes_forward)) {
      errors.push(`${stageId} closing module ${closingModuleId} missing what_it_passes_forward`)
    }

    const assignment = assignmentByModule[closingModuleId]
    if (!isNonEmptyString(assignment)) {
      errors.push(`${stageId} closing module ${closingModuleId} missing assignment.md`)
      continue
    }
    for (const heading of REQUIRED_ASSIGNMENT_HEADINGS) {
      if (!hasHeading(assignment, heading)) {
        errors.push(`${closingModuleId} missing heading ${heading} in stage assignment`)
      }
    }
  }

  const forwardStageEdges = new Set()
  for (const module of modules) {
    const targetId = module?.module_id
    const targetStageId = module?.stage_id
    const targetPosition = stagePosition.get(targetStageId)
    for (const sourceId of module?.depends_on || []) {
      const sourceModule = moduleById.get(sourceId)
      const sourceStageId = sourceModule?.stage_id
      const sourcePosition = stagePosition.get(sourceStageId)
      if (sourcePosition === undefined || targetPosition === undefined || sourceStageId === targetStageId) continue
      if (sourcePosition >= targetPosition) {
        errors.push(`backward cross-stage dependency ${sourceId} (${sourceStageId}) -> ${targetId} (${targetStageId})`)
      } else {
        forwardStageEdges.add(`${sourceStageId}->${targetStageId}`)
      }
    }
  }

  for (let index = 1; index < stages.length; index += 1) {
    const previousStageId = stages[index - 1]?.stage_id
    const stageId = stages[index]?.stage_id
    if (!forwardStageEdges.has(`${previousStageId}->${stageId}`)) {
      errors.push(`${previousStageId} -> ${stageId} missing forward cross-stage dependency`)
    }
  }

  return errors
}

async function readAssignments(projectRoot, manifest, tree) {
  const knodeById = new Map((manifest.knodes || []).map((knode) => [knode.module_id, knode]))
  const assignments = {}
  for (const stage of tree.stages || []) {
    const moduleId = stage.closing_capstone_module_id
    const knode = knodeById.get(moduleId)
    if (!knode?.knode_dir) continue
    try {
      assignments[moduleId] = await readFile(resolve(projectRoot, knode.knode_dir, "assignment.md"), "utf8")
    } catch {
      assignments[moduleId] = ""
    }
  }
  return assignments
}

async function main() {
  const [projectRoot] = process.argv.slice(2)
  if (!projectRoot) {
    console.error("usage: node stage_deliverables.mjs <course-package-root>")
    process.exitCode = 2
    return
  }

  const root = resolve(projectRoot)
  const [treeText, manifestText] = await Promise.all([
    readFile(resolve(root, "tree", "knowledge_tree.json"), "utf8"),
    readFile(resolve(root, "manifest.json"), "utf8"),
  ])
  const tree = JSON.parse(treeText)
  const manifest = JSON.parse(manifestText)
  const errors = auditStageDeliverables(tree, await readAssignments(root, manifest, tree))

  if (errors.length > 0) {
    console.error(`stage deliverable audit failed for ${manifest.slug || root}: ${errors.length} issue(s)`)
    for (const error of errors) console.error(`- ${error}`)
    process.exitCode = 1
    return
  }

  console.log(`${manifest.slug || root}: stage_count=${tree.stages.length} complete=${tree.stages.length} missing=0`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error))
    process.exitCode = 1
  })
}
