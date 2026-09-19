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
  lab: boolean
  lesson: string
  assignment: string
  resources: LearningResource[]
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
  stages: { stage_id: string; title: string }[]
  modules: GuidedModule[]
  lab_url: string
}
