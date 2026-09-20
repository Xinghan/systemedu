import { STUDENT_API_URL, ApiError } from "./client"

export type LearningScope = {
  library_slug: string; module_id: string; activity_id: string
  kind: "classroom" | "assignment" | "quiz" | "exam"; content_version: string
}
export type LearningBody = {
  answers: { question_id: string; question: string; answer: string }[]
  artifact?: Record<string, unknown> | null
  client_context?: Record<string, unknown>
}
export type LearningDraft = LearningScope & {
  id: string; body: LearningBody; revision: number; status: "draft" | "submitted"; updated_at: string
}
export type LearningSubmission = LearningScope & {
  id: string; body: LearningBody; revision: number; request_id: string; grading_status: "ungraded"; created_at: string
}
export type LearningHistory = { draft: LearningDraft | null; submissions: LearningSubmission[] }
export type LearningSaved = { draft?: LearningDraft; submission?: LearningSubmission; replayed?: boolean }

// 凭证在开始操作时捕获；排队的旧账号请求不会使用后来登录的账号。
async function request<T>(token: string, path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`${STUDENT_API_URL}/api/learning/${path}`, {
    method, cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(response.status === 401 ? "登录已失效，当前草稿已保留，请重新登录后重试。" : data.message || "记录未能同步，请重试。", { status: response.status, code: data.error })
  return data
}

export const learningRecords = {
  read: (token: string, scope: LearningScope) => request<LearningHistory>(token, `records?${new URLSearchParams(scope)}`),
  save: (token: string, scope: LearningScope, body: LearningBody, revision: number) => request<LearningSaved>(token, "drafts", "PUT", { ...scope, body, expected_revision: revision }),
  submit: (token: string, scope: LearningScope, body: LearningBody, revision: number, requestId: string) => request<LearningSaved>(token, "submissions", "POST", { ...scope, body, expected_revision: revision, request_id: requestId }),
}
