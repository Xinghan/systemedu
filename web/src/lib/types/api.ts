/** Gateway API type definitions. */

export interface StatusResponse {
  version: string
  running: boolean
  uptime: string
  uptime_seconds: number
  llm: {
    default: string
    providers: string[]
  }
  sessions: number
  port: number
}

export interface LLMProviderInfo {
  base_url: string
  model: string
  api_key: string
  temperature: number
}

export interface ConfigResponse {
  llm: {
    default: string
    providers: Record<string, LLMProviderInfo>
  }
  gateway: { port: number; host: string }
  sandbox: { enabled: boolean }
  memory: { enabled: boolean; backend: string }
}

export interface SessionSummary {
  id: string
  agent: string
  project: string | null
  messages: number
  created_at: string
}

export interface SessionMessage {
  role: "user" | "assistant" | "system" | "tool"
  content: string
  timestamp: string
}

export interface SessionDetail {
  id: string
  agent: string
  project: string | null
  created_at: string
  messages: SessionMessage[]
}

export interface ProjectSummary {
  name: string
  title: string
  description: string
  category: string
  age_range: number[]
  estimated_hours: number
  tags: string[]
  path: string
}

export interface KnodeInfo {
  id: number
  title: string
  summary: string
  difficulty_level: number
  content_type: string
  acceptance_type: string
  estimated_minutes: number
  xp_reward: number
  prerequisite_indices: number[]
}

export interface MilestoneInfo {
  title: string
  description: string
  order: number
  xp_reward: number
  knodes: KnodeInfo[]
}

export interface NodeProgress {
  knode_id: number
  status: "locked" | "available" | "in_progress" | "submitted" | "passed" | "failed"
  attempts: number
  best_score: number
  passed_at: string | null
}

export interface UpdateProgressResponse {
  knode_id: number
  status: string
  attempts: number
  best_score: number
  unlocked: number[]
  progress: NodeProgress[]
}

export interface EnrollmentInfo {
  status: "active" | "paused" | "completed"
  started_at: string | null
  last_activity_at: string | null
  total_time_seconds: number
  nodes_passed: number
  total_nodes: number
}

export interface ProjectDetail {
  project: Omit<ProjectSummary, "path">
  milestones: MilestoneInfo[]
  progress: NodeProgress[]
  enrollment: EnrollmentInfo | null
}

export interface AgentInfo {
  name: string
  type: string
  description: string
  display_name?: string
  role?: "tutor" | "teacher" | "student" | "system"
}

export interface SkillInfo {
  name: string
  description: string
  user_invocable: boolean
  source: string
}

export interface MCPServer {
  name: string
  command: string
  args: string[]
  env: Record<string, string>
  status: string
}

export interface ChatRequest {
  message: string
  session_id?: string
  user_id?: string
  project?: string
  agent?: string
}

export interface ChatResponse {
  session_id: string
  response: string
}

export interface NodeContext {
  knode_id: number
  prerequisites_trace: string
  learning_suggestions: string
  related_extensions: string
}

export type LessonStatus = "pending" | "generating" | "ready" | "failed"

export interface LessonContent {
  project_name: string
  knode_id: number
  status: LessonStatus
  concept: string
  examples: string
  code_samples: string
  practice: string
  key_takeaways: string
  quiz_data: string
  interactive_lab: string
  teacher_script: string
  teacher_audio_url: string
  teacher_timestamps: string
  concept_audio_url: string
  practice_audio_url: string
  lab_audio_url: string
  key_takeaways_audio_url: string
  project_assignment: string
  content_type: string
  generated_at: string | null
}

export interface TreePreviewResponse {
  valid: boolean
  milestones: MilestoneInfo[]
  stats: {
    milestone_count: number
    node_count: number
    total_minutes: number
    estimated_hours: number
  }
  meta: Record<string, unknown>
  errors: string[]
}

export interface CreateProjectResponse {
  name: string
  created: boolean
  path: string
}

export interface HighlightInfo {
  id: number
  tab: string
  page_index: number
  text: string
  start_offset: number
  end_offset: number
  note: string
  color: string
  created_at: string | null
}

export interface LessonGenerationStep {
  step_name: string
  step_label: string
  status: "pending" | "in_progress" | "completed" | "failed"
  agent_name: string
  started_at: string | null
  completed_at: string | null
  output_preview: string
}

export interface LessonProgressResponse {
  lesson_status: LessonStatus
  steps: LessonGenerationStep[]
}

export interface PracticeExercise {
  type: "choice" | "fill_blank" | "short_answer"
  question: string
  options?: string[]
  correct?: number
  answer?: string
  hint?: string
  explanation?: string
  difficulty: "easy" | "medium" | "hard"
  points: number
}

export interface PracticeData {
  exercises: PracticeExercise[]
  total_points: number
  pass_score: number
}

export interface PracticeFeedbackItem {
  exercise_idx: number
  correct: boolean
  points_earned: number
  feedback: string
  correct_answer?: string
}

export interface PracticeSubmissionResult {
  submission_id: number
  attempt: number
  score: number
  total_points: number
  passed: boolean
  feedback: PracticeFeedbackItem[]
}

export interface PracticeSubmissionSummary {
  submission_id: number
  attempt: number
  score: number
  total_points: number
  status: string
  submitted_at: string | null
  graded_at: string | null
  feedback: PracticeFeedbackItem[]
}

export type ResourceSearchStatus = "idle" | "searching" | "done" | "failed"

export interface ResourceItem {
  id: number
  source_type: "web" | "youtube"
  title: string
  url: string
  snippet: string
  score: number
  saved: boolean
  saved_at: string | null
}

export interface ResourceSearchResponse {
  status: ResourceSearchStatus
  searched_at: string | null
  error: string
  resources: ResourceItem[]
}

export interface NodeResourceGroup {
  status: ResourceSearchStatus
  searched_at: string | null
  resources: ResourceItem[]
}

// knode_id (as string) -> NodeResourceGroup
export type ProjectResourcesResponse = Record<string, NodeResourceGroup>

export interface NoteInfo {
  id: number | null
  content: string
  updated_at: string | null
}

// knode_id (as string) -> NoteInfo
export type ProjectNotesResponse = Record<string, NoteInfo>

export interface WSMessage {
  type: "chunk" | "done" | "error" | "tool_call" | "tool_result"
  content?: string
  session_id?: string
  message?: string
  name?: string
  args?: Record<string, unknown>
  result?: string
}

export interface ObjectRegistryItem {
  object_key: string
  family: string
  variant: string
  views: string[]
  must_have: string[]
  optional: string[]
  labelable: string[]
  source: "registry"
}

export interface ObjectStagingItem {
  object_key: string
  family: string
  variant: string
  status: "pending" | "in_progress" | "done" | "failed"
  source: "factory_queue"
  project_name: string
  created_at: string
  error: string
}

export interface ObjectRegistryResponse {
  registry: ObjectRegistryItem[]
  staging: ObjectStagingItem[]
  total_registry: number
  total_staging: number
}

export interface LessonQueueItem {
  id: number
  project_name: string
  knode_id: number
  knode_title: string
  batch_id: number
  status: "pending" | "generating" | "done" | "failed" | "skipped"
  created_at: string
  started_at: string | null
  completed_at: string | null
  error: string
}

export interface LessonQueueResponse {
  items: LessonQueueItem[]
  running: boolean
  batch_id: number
}

export interface BatchGenerateResponse {
  queued_knode_ids: number[]
  total: number
  batch_id: number
}

export interface FactoryQueueItem {
  object_key: string
  description: string
  source: "auto_project" | "miss_queue" | "manual"
  project_name: string
  status: "pending" | "in_progress" | "done" | "failed"
  created_at: string
  error: string
}

export interface FactoryQueueResponse {
  items: FactoryQueueItem[]
  stats: {
    pending: number
    in_progress: number
    done: number
    failed: number
  }
}
