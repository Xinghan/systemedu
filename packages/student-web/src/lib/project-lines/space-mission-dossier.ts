import type { LearningBody, LearningScope } from "../api/learning-records"
import { JOURNEY_DELIVERIES } from "./space-journey"

export const MISSION_DOSSIER_SCOPE: LearningScope = { library_slug: "space-exploration", module_id: "JOURNEY", activity_id: "mission-dossier", kind: "assignment", content_version: "1.0" }
export type MissionEvidence = { scope: LearningScope; submissionId: string; createdAt: string; digest: string; summary: string; owner: string }
export type EvidenceCheck = { state: "current" | "changed" | "unknown"; checkedAt: string; message: string }
export type MissionDossier = { checks?: Record<string, EvidenceCheck>; schema: "space-mission-dossier/1"; links: MissionEvidence[]; vehicleVersion: string; modelVersion: string; archiveLocation: string }
export const EMPTY_DOSSIER: MissionDossier = { schema: "space-mission-dossier/1", links: [], vehicleVersion: "", modelVersion: "", archiveLocation: "" }
export const INITIAL_MISSION_BODY: LearningBody = { answers: [
  { question_id: "goal", question: "这次远征要观察什么？", answer: "" },
  { question_id: "site", question: "在哪里测试，场地有什么边界？", answer: "" },
  { question_id: "check", question: "留下哪些证据来判断结果？", answer: "" },
], artifact: { ...EMPTY_DOSSIER } }
export function dossierFrom(body: LearningBody): MissionDossier | null {
  const a = body.artifact
  if (!a) return { ...EMPTY_DOSSIER, links: [] }
  if (a.schema !== EMPTY_DOSSIER.schema || !Array.isArray(a.links) || a.links.length > 70 || ![a.vehicleVersion, a.modelVersion, a.archiveLocation].every(v => typeof v === "string")) return null
  if (!a.links.every((e: MissionEvidence) => e && typeof e.owner === "string" && typeof e.submissionId === "string" && typeof e.digest === "string" && /^[a-f0-9]{64}$/.test(e.digest) && typeof e.createdAt === "string" && typeof e.summary === "string" && validEvidenceScope(e.scope))) return null
  if (a.checks && (typeof a.checks !== "object" || Array.isArray(a.checks) || !Object.values(a.checks).every(c => c && typeof c === "object" && ["current", "changed", "unknown"].includes(c.state) && typeof c.message === "string" && typeof c.checkedAt === "string"))) return null
  return a as MissionDossier
}
export function validEvidenceScope(scope: LearningScope) {
  const expected = scope && JOURNEY_DELIVERIES[scope.library_slug]
  return !!expected && scope.module_id === expected.module && scope.content_version === expected.version && scope.activity_id === "final-deliverable" && scope.kind === "assignment"
}
export function deliveryScope(project: string): LearningScope {
  const delivery = JOURNEY_DELIVERIES[project]
  if (!delivery) throw new Error("Unknown delivery")
  return { library_slug: project, module_id: delivery.module, activity_id: "final-deliverable", kind: "assignment", content_version: delivery.version }
}
export async function evidenceDigest(body: LearningBody) {
  const stable = (v: unknown): unknown => Array.isArray(v) ? v.map(stable) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, value]) => [k, stable(value)])) : v
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(stable(body))))
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("")
}
export function addMissionEvidence(dossier: MissionDossier, evidence: MissionEvidence): MissionDossier {
  if (!validEvidenceScope(evidence.scope)) throw new Error("作品版本不兼容")
  if (dossier.links.some(e => e.scope.library_slug === evidence.scope.library_slug && e.submissionId === evidence.submissionId && e.digest === evidence.digest)) return dossier
  if (dossier.links.length >= 70) throw new Error("当前档案已保留 70 个作品版本，请先导出备份。原关联未删除。")
  return { ...dossier, links: [...dossier.links, evidence] }
}
