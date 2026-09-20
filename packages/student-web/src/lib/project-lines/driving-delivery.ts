import type { LearningBody, LearningScope } from "@/lib/api/learning-records"
import type { GuidedCourse, GuidedModule } from "./guided-course"
import { verifiedDrivingArtifact } from "./guided-progress"
import { responseComplete, responseState } from "./guided-response"
import { runRules, validRules } from "../../../public/project-lines/space-exploration/_shared/models.mjs"

export const TERRAIN_LABELS: Record<string, string> = { clear: "平地", sand: "软沙", rock: "岩石", unknown: "看不清地面" }
export const ACTION_LABELS: Record<string, string> = { forward: "正常前进", slow: "慢行", detour: "沿已知侧道绕行", stop: "停下确认" }
export const ROUTE_LABELS: Record<string, string> = { training: "训练路线", transfer: "换路测试" }

export type DrivingArtifact = {
  program: { rules: Parameters<typeof runRules>[0] }
  evidence: { runs: ReturnType<typeof runRules>[] }
  created_at?: string
}

export function inspectedDrivingArtifact(value: unknown): DrivingArtifact | null {
  return verifiedDrivingArtifact(value) ? value as DrivingArtifact : null
}

export function deliveryChecks(body: LearningBody, node: GuidedModule) {
  const artifact = inspectedDrivingArtifact(body.artifact)
  const rules = (body.artifact?.program as { rules?: Record<string, string> } | undefined)?.rules
  const explanation = responseState(body, 0, node.response_prompts?.[0])
  const contradictory = explanation.mode === "guided" && !!explanation.values.unknown_action && explanation.values.unknown_action !== ACTION_LABELS.stop
  return [
    { id: "rules", title: "四种输入都有规则，遇到未知时停止", passed: !!validRules(rules) && rules?.unknown === "stop", hint: "在实验中修改规则、通过两条路线并保存，再关联实验作品。" },
    { id: "evidence", title: "同一版本通过训练路线和换路测试", passed: !!artifact, hint: "必须保留两次实际运行的完整步骤；只有成功标记不算证据。" },
    { id: "explanation", title: "写清未知处理、自己的贡献和测试边界", passed: !contradictory && node.questions.every((_, i) => responseComplete(body, i, node.response_prompts?.[i])), hint: contradictory ? "说明里选择的动作与停止规则不一致，请回到第一步核对。" : "完成上方两步作品说明。这里只检查填写完整，解释是否充分仍需自评或老师评阅。" },
  ]
}

export function deliveryScope(course: GuidedCourse, node: GuidedModule): LearningScope {
  return { library_slug: course.id, module_id: node.module_id, activity_id: "final-deliverable", kind: "assignment", content_version: course.version }
}

export function deliverySnapshot(course: GuidedCourse, node: GuidedModule, body: LearningBody): LearningBody {
  if (!deliveryChecks(body, node).every(check => check.passed)) throw new Error("作品或说明尚不完整")
  return JSON.parse(JSON.stringify({
    answers: body.answers,
    artifact: body.artifact,
    client_context: {
      ...body.client_context,
      delivery: { schema_version: "project-delivery/1", title: course.final_deliverable?.title ?? course.outcome, verifier: "driving-evidence/1", scope: "two-simulated-routes", assessment: "ungraded" },
    },
  }))
}
