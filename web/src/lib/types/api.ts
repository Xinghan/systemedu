/** Gateway API type definitions. */

/** Knowledge level identifiers, ordered from easiest to hardest. */
export type KnowledgeLevel = "K1" | "K2" | "K3" | "K4" | "K5"

export const KNOWLEDGE_LEVEL_LABELS: Record<KnowledgeLevel, string> = {
  K1: "小学低年级",
  K2: "小学高年级",
  K3: "初中",
  K4: "高中",
  K5: "大学",
}

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
  cover_image_url?: string | null
  icon_svg?: string | null
  knowledge_level?: KnowledgeLevel
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
  // v4.1 optional metadata
  module_id?: string
  module_role?: string
  core_question?: string
  acceptance_artifacts?: Array<{ type: string; format: string }>
  acceptance_standard?: string[]
  hands_on_components?: string[]
  outputs_produced?: string[]
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

export interface SubProjectInfo {
  id: string              // "P0"
  title: string
  description: string
  stage_id: string        // "S0"
  milestone_indices: number[]
  prerequisite_sub_project_ids: string[]
  difficulty: number
  estimated_hours: number
  deliverables: string[]
  display_order?: number
  nodes_passed: number
  nodes_total: number
  status?: "locked" | "available" | "in_progress" | "submitted" | "passed" | "failed"
  brief?: string
  task?: string
  core_problem?: string
  inputs?: string[]
  data_usage?: string[]
  demo_unit?: string
  why_separate?: string
  handover?: { outputs: string[]; method: string }
  acceptance_criteria?: string[]
}

export interface DataSourceInfo {
  name: string
  role: string
  source: string
  why: string
  stages: string[]
}

export interface ProjectBrief {
  one_liner: string
  real_problem: string
  what_we_do: string[]
  what_we_dont: string[]
  data_sources: DataSourceInfo[]
  min_success: string
  recommended_success: string
  final_deliverables: string[]
  final_demo: string
  industry_relation: string
}

export interface ProjectDetail {
  project: Omit<ProjectSummary, "path">
  milestones: MilestoneInfo[]
  progress: NodeProgress[]
  enrollment: EnrollmentInfo | null
  sub_projects?: SubProjectInfo[]
  project_brief?: ProjectBrief | null
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

export interface LessonStatusesResponse {
  statuses: Record<string, LessonStatus>
}


// --- Course v2 types (multi-agent pipeline) ---

export type CourseIdeaMode =
  | "animation"
  | "game"
  | "story"
  | "exercise"
  | "image"
  | "diagram"
export type CourseGenerationBackend = "manim" | "html_svg" | "html_static" | ""

export interface CourseIdeaSummary {
  idea_id: string
  mode: CourseIdeaMode
  topic: string
  context_summary: string
  generation_backend?: CourseGenerationBackend
  style_key?: string
  mode_reason?: string
  user_guide?: string
}

export interface StoryParagraph {
  text: string
  image_url: string
}

export interface InlineExercise {
  type: "choice" | "short_answer"
  question: string
  // choice fields
  options?: string[]
  correct?: number
  explanation?: string
  // short_answer fields
  hint?: string
  sample_answer?: string
}

export interface RenderedSection {
  mode: CourseIdeaMode
  status: "ready" | "failed"
  html: string | null
  story_paragraphs: StoryParagraph[] | null
  exercises: InlineExercise[] | null
  generation_backend?: CourseGenerationBackend
  user_guide?: string
  // image mode (静态图片)
  src?: string
  alt?: string
  caption?: string
  source_url?: string
  license?: string
}

export interface CourseSection {
  section_id: string
  heading: string
  body_markdown: string
  audio_script: string
  audio_url: string
}

/** A single level-specific body for a theory entry. */
export interface TheoryLevelBody {
  level: KnowledgeLevel
  body_markdown: string
}

export interface TheoryEntry {
  theory_id: string
  title: string
  subject: string
  /** Default body (shown when no level-specific body matches). */
  body_markdown: string
  related_paragraph?: string
  animation_html?: string
  /** Level-specific bodies. Front-end picks the one matching project level. */
  level_bodies?: TheoryLevelBody[]
}

export interface CourseContent {
  plan_markdown: string
  sections?: CourseSection[]
  ideas: CourseIdeaSummary[]
  rendered_sections: Record<string, RenderedSection>
  theories?: TheoryEntry[]
}

export interface CourseContentData {
  project_name?: string
  knode_id?: number
  status: "pending" | "generating" | "ready" | "failed"
  course_content: CourseContent | Record<string, never>
}

export interface CourseAssignmentData {
  status: "pending" | "generating" | "ready" | "failed"
  assignment: string
}

export type CourseStepType =
  | "concept"
  | "story"
  | "animation"
  | "game"
  | "code"
  | "practice"
  | "summary"

export interface CourseStepSpec {
  prompt_hint?: string
  game_mechanic?: string
  game_concept?: string
  exercise_count?: number
}

export interface CourseManifestStep {
  step_index: number
  type: CourseStepType
  title: string
  duration_minutes: number
  spec: CourseStepSpec
}

export interface CourseManifest {
  node_title: string
  total_steps: number
  learning_goal: string
  steps: CourseManifestStep[]
}

export interface CourseStep {
  step_index: number
  type: CourseStepType
  title: string
  status: "ready" | "pending" | "failed"
  content: string
  html: string
  practice_data: string
  audio_url: string
}

export interface CourseData {
  project_name?: string
  knode_id?: number
  status: LessonStatus
  manifest: CourseManifest | Record<string, never>
  steps: CourseStep[]
}
