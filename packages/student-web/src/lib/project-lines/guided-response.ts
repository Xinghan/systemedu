import type { LearningBody } from "@/lib/api/learning-records"
import type { ResponsePrompt } from "./guided-course"

type PromptState = { version: 1; mode: "guided" | "free"; values: Record<string, string> }

export function responseText(prompt: ResponsePrompt, values: Record<string, string>) {
  return prompt.fields.filter(f => values[f.id]?.trim()).map(f => `${f.label.replace(/[…。]+$/, "")}：${values[f.id].trim()}`).join("\n")
}

export function responseState(body: LearningBody, index: number, prompt?: ResponsePrompt): PromptState {
  const questionId = body.answers[index]?.question_id ?? `q${index + 1}`
  const entries = body.client_context?.guided_response as Record<string, PromptState> | undefined
  const saved = entries?.[questionId]
  const answer = body.answers[index]?.answer ?? ""
  if (saved?.version === 1 && saved.mode === "free") return { version: 1, mode: "free", values: {} }
  if (prompt && saved?.version === 1 && saved.mode === "guided" && saved.values && typeof saved.values === "object") {
    const values = Object.fromEntries(prompt.fields.map(f => [f.id, typeof saved.values[f.id] === "string" ? saved.values[f.id] : ""]))
    if (responseText(prompt, values) === answer) return { version: 1, mode: "guided", values }
  }
  // 旧文字完整保留；不猜测拆分，也不自动转成新表单中的选择。
  return { version: 1, mode: answer.trim() || !prompt ? "free" : "guided", values: {} }
}

export function responseComplete(body: LearningBody, index: number, prompt?: ResponsePrompt) {
  const state = responseState(body, index, prompt)
  if (state.mode === "free" || !prompt) return !!body.answers[index]?.answer.trim()
  return prompt.fields.every(f => !!state.values[f.id]?.trim() && (f.type !== "choice" || f.options?.includes(state.values[f.id])))
}

export function updateResponse(body: LearningBody, index: number, state: PromptState, answer: string): LearningBody {
  const questionId = body.answers[index].question_id
  return { ...body,
    answers: body.answers.map((a, i) => i === index ? { ...a, answer } : a),
    client_context: { ...body.client_context, guided_response: { ...(body.client_context?.guided_response as Record<string, unknown> ?? {}), [questionId]: state } },
  }
}
