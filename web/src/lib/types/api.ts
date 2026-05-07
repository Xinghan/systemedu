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
  max_tokens?: number | null
}

export interface ConfigResponse {
  llm: {
    default: string
    /** spec 017: UI 只渲染白名单里的 provider */
    user_editable: string[]
    providers: Record<string, LLMProviderInfo>
  }
  gateway: { port: number; host: string }
  sandbox: { enabled: boolean }
  memory: { enabled: boolean; backend: string }
}

export interface TestLLMResponse {
  ok: boolean
  message: string
  latency_ms: number
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

export interface AggregatedTheory {
  theory_id: string
  title: string
  subject: string
  tags: string[]
  levels: { level: string; body_markdown: string }[]
  knode_id: number
  knode_title: string
  stage_title: string
  stage_idx: number
  order_in_stage: number
  sub_project_id: string | null
  sub_project_title: string
  animation_html?: string
  related_paragraph?: string
}

export interface TheoryTagVocabEntry {
  path: string
  aliases: string[]
  count: number
}

export interface ProjectTheoriesResponse {
  project_name: string
  total: number
  subject_counts: Record<string, number>
  tag_counts: Record<string, number>
  tag_vocab: TheoryTagVocabEntry[]
  theories: AggregatedTheory[]
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
  acceptance_artifacts?: Array<{ artifact_id: string; title: string; description: string; format: string }>
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
  source_type: "web" | "youtube" | "labxchange"
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
  | "hands_on_kit"
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
  // hands_on_kit mode (实物动手套件)
  kit_topic?: string
  total_cost_cny?: number
  age_min?: number
  safety_level?: "low" | "medium" | "high"
  components?: HandsOnComponent[]
  tools?: HandsOnTool[]
  steps?: HandsOnStep[]
}

export interface HandsOnComponent {
  name: string
  name_en: string
  spec: string
  qty: number
  price_cny: number
  search_keyword: string
}

export interface HandsOnTool {
  name: string
  name_en: string
  price_cny: number
  included: boolean
}

export interface HandsOnStep {
  step: number
  title: string
  description: string
  safety_warning: string | null
  expected_result: string
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

export interface TheoryExercise {
  question: string
  type: "choice" | "true_false"
  options: string[]
  /** Index of the correct option (0-based). */
  correct: number
  explanation?: string
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
  /** Optional self-test exercises shown in a collapsible section. */
  exercises?: TheoryExercise[]
}

export interface ExternalResourceItem {
  title: string
  url: string
  snippet?: string
  description?: string
  [key: string]: unknown
}

export interface ExternalResources {
  web_query?: string
  youtube_query?: string
  web_results?: ExternalResourceItem[]
  youtube_results?: ExternalResourceItem[]
  labxchange_results?: ExternalResourceItem[]
  researched_at?: string
}

export interface CourseContent {
  plan_markdown: string
  sections?: CourseSection[]
  ideas: CourseIdeaSummary[]
  rendered_sections: Record<string, RenderedSection>
  theories?: TheoryEntry[]
  external_resources?: ExternalResources
}

export interface CourseContentData {
  project_name?: string
  knode_id?: number
  status: "pending" | "generating" | "ready" | "failed"
  course_content: CourseContent | Record<string, never>
  // v3 多版本字段 (v2 endpoint 不返回这些)
  version_label?: string | null
  is_active?: boolean
  generated_at?: string | null
}

export interface CourseV3Version {
  version_label: string
  is_active: boolean
  status: "pending" | "generating" | "ready" | "failed"
  generated_at: string | null
}

export interface CourseV3VersionsData {
  project_name: string
  knode_id: number
  versions: CourseV3Version[]
}

// ─── Slides (老师讲课模式) ─────────────────────────────────────────────

export type SlideKind =
  | "intro"
  | "bullet"
  | "theory"
  | "animation"
  | "game"
  | "image"
  | "diagram"
  | "videos"
  | "labxchange"
  | "outro"

// Per-kind payload shape returned by LLM (slide_gen.md schema). All fields
// optional because LLM may skip some; renderer falls back to body_markdown.
export interface SlideConceptCard {
  title: string
  body: string
  icon_svg?: string
}
export interface SlidePayload {
  // intro / outro
  hero_title?: string
  hero_subtitle?: string
  inline_svg?: string
  key_takeaway?: string
  // bullet
  concept_cards?: SlideConceptCard[]
  // theory
  theory_id?: string
  formula?: string
  layman_analogy?: string
  bullets?: string[]
  // animation / game / diagram
  idea_id?: string
  diagram_html_id?: string
  short_desc?: string
  call_to_action?: string
  thumbnail_url?: string
  // image / videos / labxchange
  intro_text?: string
  images?: { src: string; caption?: string; source_url?: string }[]
  videos?: { title: string; url: string; thumbnail?: string }[]
  labxchange?: { title: string; url: string; description?: string }[]
}

export interface SlideEntry {
  slide_index: number
  slide_id: string
  kind: SlideKind
  title: string
  body_markdown: string
  audio_script: string
  payload: SlidePayload
  generated_at: string | null
}

export interface CourseV3SlidesData {
  project_name: string
  knode_id: number
  version_label: string | null
  slides: SlideEntry[]
}

export interface CourseAssignmentData {
  status: "pending" | "generating" | "ready" | "failed"
  assignment: string
}

// Capstone submission types

export interface CapstoneSubmissionResult {
  submission_id: number
  attempt: number
  status: "submitted" | "grading" | "graded"
  file_url: string
}

export interface CapstoneFeedbackItem {
  criterion_idx: number
  score: number
  max_score: number
  feedback: string
}

export interface CapstoneSubmissionDetail {
  submission_id: number
  attempt: number
  checklist: Array<{ artifact_id: string; checked: boolean }>
  reflections: Array<{ criterion_idx: number; description: string }>
  file_url: string
  file_name: string
  score: number
  max_score: number
  feedback: CapstoneFeedbackItem[]
  status: string
  submitted_at: string | null
  graded_at: string | null
}

export interface CapstoneStatusResponse {
  status: string
  submission_id: number | null
  score?: number
  max_score?: number
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

// --- Exercise attempt tracking (unified for theory/practice/assignment) ---

export interface ExerciseAttemptRecord {
  id: number
  knode_id: number
  quiz_type: "theory" | "practice" | "assignment"
  exercise_id: string
  question: string
  user_answer: string
  correct_answer: string
  is_correct: boolean
  attempt_seq: number
  time_spent_ms: number | null
  error_analysis: string | null
  explanation: string | null
  created_at: string | null
}

export interface ExerciseAttemptPayload {
  knode_id: number
  quiz_type: "theory" | "practice" | "assignment"
  exercise_id: string
  question: string
  user_answer: string
  correct_answer: string
  is_correct: boolean
  attempt_seq: number
  time_spent_ms?: number | null
  error_analysis?: string | null
  explanation?: string | null
}

export interface ExerciseStatsResponse {
  total_attempts: number
  first_try_accuracy: number
  overall_accuracy: number
  avg_time_ms: number
  retry_rate: number
  weak_exercises: {
    knode_id: number
    exercise_id: string
    question: string
    total_attempts: number
    eventually_correct: boolean
    error_analysis: string
  }[]
  per_knode: Record<string, {
    total_attempts: number
    first_try_accuracy: number
    overall_accuracy: number
    retry_count: number
  }>
  per_quiz_type: Record<string, {
    total_attempts: number
    first_try_accuracy: number
    overall_accuracy: number
  }>
}

export interface QaEvaluationRequest {
  user_id?: string
  knode_id: number
  exercise_id: string
  question: string
  user_answer: string
  reference_answer: string
  attempt_seq: number
  time_spent_ms?: number | null
}

export interface QaEvaluationResponse {
  score: number
  max_score: number
  is_correct: boolean
  feedback: string
  error_analysis: string
  attempt_id: number | null
}
