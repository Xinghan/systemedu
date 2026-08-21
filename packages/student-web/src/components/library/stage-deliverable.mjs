const REQUIRED_STAGE_FIELDS = [
  "stage_output",
  "closing_capstone_module_id",
  "capstone_scope",
  "capstone_hands_on_expectation",
]

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0
}

/**
 * Derive the learner-facing stage-product card from one V5 stage and its
 * designated capstone module. Keeping this mapping pure lets content gaps be
 * surfaced without silently hiding a stage from the child.
 */
export function getStageDeliverable(stage, modules, stages) {
  const capstoneModuleId = stage?.closing_capstone_module_id ?? ""
  const capstone = (modules ?? []).find((module) => module?.module_id === capstoneModuleId)
  const index = (stages ?? []).findIndex((item) => item?.stage_id === stage?.stage_id)
  const isFinalStage = index >= 0 && index === (stages?.length ?? 0) - 1
  const missing = REQUIRED_STAGE_FIELDS.filter((field) => !nonEmpty(stage?.[field]))

  if (!Array.isArray(stage?.capstone_reuses_outputs_from_stages)) {
    missing.push("capstone_reuses_outputs_from_stages")
  } else if (index > 0 && stage.capstone_reuses_outputs_from_stages.length === 0) {
    missing.push("capstone_reuses_outputs_from_stages")
  }

  if (!capstone || capstone.stage_id !== stage?.stage_id) {
    missing.push("closing_capstone_module")
  } else {
    if (!Array.isArray(capstone.acceptance_artifacts) || capstone.acceptance_artifacts.length === 0) {
      missing.push("acceptance_artifacts")
    }
    if (!Array.isArray(capstone.acceptance_standard) || capstone.acceptance_standard.length === 0) {
      missing.push("acceptance_standard")
    }
    if (!isFinalStage && !nonEmpty(capstone.what_it_passes_forward)) {
      missing.push("what_it_passes_forward")
    }
  }

  return {
    status: missing.length === 0 ? "complete" : "incomplete",
    missing,
    stageOutput: stage?.stage_output ?? "",
    scope: stage?.capstone_scope ?? "",
    handsOnExpectation: stage?.capstone_hands_on_expectation ?? "",
    reuseStageIds: stage?.capstone_reuses_outputs_from_stages ?? [],
    capstoneModuleId,
    artifacts: capstone?.acceptance_artifacts ?? [],
    checks: capstone?.acceptance_standard ?? [],
    handoff: capstone?.what_it_passes_forward ?? "",
  }
}
