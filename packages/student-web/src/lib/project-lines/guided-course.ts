export type LearningResource = {
  kind: "reference" | "video"
  title: string
  publisher: string
  url: string
  language: string
  checked_at: string
  purpose: string
  prompt: string
  fallback: string
  youtube_id?: string
  media_url?: string
  poster_url?: string
}

export type ResponseField = {
  id: string
  label: string
  type: "choice" | "short" | "text"
  placeholder?: string
  options?: string[]
}

export type ResponsePrompt = {
  title: string
  hint: string
  example: string
  layout?: "sequence" | "comparison" | "brief"
  fields: ResponseField[]
}

export type GuidedModule = {
  module_id: string
  title: string
  stage_id: string
  estimated_minutes: number
  depends_on: string[]
  core_question: string
  objective: string
  output: string
  questions: string[]
  response_prompts?: ResponsePrompt[]
  lab: boolean
  lesson: string
  assignment: string
  resources: LearningResource[]
  video_note?: string
}

export type GuidedCourse = {
  schema_version: string
  id: string
  version: string
  title: string
  subtitle: string
  estimated_minutes: number
  audience: string
  outcome: string
  final_deliverable?: {
    title: string
    module_id: string
    parts: string[]
    acceptance: string[]
  }
  stages: { stage_id: string; title: string }[]
  modules: GuidedModule[]
  lab_url: string
  legacy_edition?: boolean
}
