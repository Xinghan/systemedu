/** student-app typed API. 只暴露学生端用到的接口。 */

import { api, STUDENT_API_URL } from "./client"
import { setToken, clearToken, clearUsername } from "@/lib/auth"

// ---------------------------------------------------------------------------
// auth (spec sms-auth: 手机号 + 短信验证码登录)
// ---------------------------------------------------------------------------

export interface MeResponse {
  user_id: string
  phone: string
  display_name: string | null
  student_age: number | null
  gender: "male" | "female" | "other" | null
  profile_completed: boolean
  created_at?: string
  last_login_at?: string
}

export const auth = {
  sendCode: async (phone: string): Promise<{ ok: boolean; cooldown_sec: number }> => {
    return api.post("/api/auth/send-code", { phone })
  },
  verify: async (
    phone: string,
    code: string,
  ): Promise<{ token: string; user_id: string; profile_completed: boolean }> => {
    const data = await api.post<{ token: string; user_id: string; profile_completed: boolean }>(
      "/api/auth/verify",
      { phone, code },
    )
    setToken(data.token)
    return data
  },
  updateProfile: async (p: {
    display_name: string
    student_age: number
    gender: string
  }): Promise<void> => {
    await api.patch("/api/auth/profile", p)
  },
  logout: async (): Promise<void> => {
    try {
      await api.post("/api/auth/logout")
    } catch {
      // ignore
    }
    clearToken()
    clearUsername()
  },
  me: () => api.get<MeResponse>("/api/auth/me"),
}

// ---------------------------------------------------------------------------
// library
// ---------------------------------------------------------------------------

// spec 030: 项目级最终产出物
export type FinalOutcomeKind = "capability" | "artifact" | "service" | "publication"

export interface FinalOutcome {
  title: string
  kind: FinalOutcomeKind
  description: string
  evidence?: string | null
  related_stage_id?: string | null
}

// spec 040: 项目开篇连环画的一帧 (图 + 双语文案叠加)
export interface StoryFrame {
  image: string // 相对项目包路径, 例 "story/story-1.png"
  title_zh?: string
  title_en?: string
  caption_zh?: string
  caption_en?: string
}

export interface LibraryProjectSummary {
  slug: string
  title: string
  title_zh?: string | null
  description?: string
  status?: "published" | "draft"
  version?: string
  knode_count?: number
  stage_count?: number
  duration_weeks?: number | null
  domain?: string | null
  age_band?: string | null
  difficulty?: number | null
  tags?: string[]
  cover_image_path?: string | null
  published_at?: string | null
  knowledge_tree?: Record<string, unknown> | null
  final_outcomes?: FinalOutcome[] | null
  story?: StoryFrame[] | null // spec 040: 开篇连环画 (空/缺 = 不显示)
}

export interface LibraryKnodeContent {
  project_slug: string
  knode_id: string
  title: string
  summary?: string
  week?: number | null
  stage?: string | null
  duration_minutes?: number | null
  knode_dir?: string
  plan_markdown?: string
  rendered_sections?: { ideas?: Array<Record<string, unknown>>; [k: string]: unknown }
  audio_scripts?: unknown
  assignment_md?: string
  theories?: unknown
  files?: Array<{ path: string; size: number; sha256: string }>
  version?: string
  slides?: import("../types/api").SlideEntry[]
}

// spec 035: 平台知识树
export type DepthLevel = "K1" | "K3" | "K5" | "K7" | "K9" | "K11" | "K13"

export interface PlatformTreeNode {
  id: string
  name_zh: string
  name_en: string
  depth_level: DepthLevel
  prerequisites: string[]
  description: string
}

export interface PlatformSubject {
  id: string
  name_zh: string
  name_en: string
  color: string
  nodes: PlatformTreeNode[]
}

export interface PlatformTree {
  schema_version: string
  subjects: PlatformSubject[]
}

export interface LitNodeEntry {
  node_id: string
  lit_by: string[]
  reason: string
}

export interface MissingConceptEntry {
  concept: string
  first_seen: string
  suggested_subject?: string | null
  note?: string
}

export interface ProjectKnowledgeTree {
  slug: string
  lit_nodes: LitNodeEntry[]
  subjects_used: string[]
  missing_concepts: MissingConceptEntry[]
}

// spec 036: 用户级聚合 (多项目来源)
export interface UserLitNodeEntry {
  node_id: string
  lit_by_projects: Array<{ slug: string; lit_by_knodes: string[] }>
}

export interface SubjectSummary {
  subject_id: string
  subject_name_zh: string
  color: string
  lit_count: number
  total_count: number
  percent: number
}

/** spec 039: 用户个人树生长节点 (平台树第三层之下的动态深层节点) */
export interface GrownNodeEntry {
  node_id: string
  parent_id: string
  name_zh: string
  depth: number
  lit: boolean
}

export interface UserKnowledgeTreeResponse {
  user_id: string
  lit_nodes: UserLitNodeEntry[]
  subjects_summary: SubjectSummary[]
  total_lit: number
  total_platform_nodes: number
  grown_nodes?: GrownNodeEntry[]
}

export interface ProjectRecommendation {
  slug: string
  title_zh: string
  cover_image_path: string | null
  difficulty: number | null
  new_nodes_count: number
  new_nodes_subjects: Record<string, number>
}

export interface RecommendationsResponse {
  recommendations: ProjectRecommendation[]
}

export const library = {
  listProjects: () => api.get<LibraryProjectSummary[]>("/api/library/projects"),
  getProject: (slug: string) =>
    api.get<LibraryProjectSummary>(`/api/library/projects/${encodeURIComponent(slug)}`),
  getTree: (slug: string) =>
    api.get<Record<string, unknown>>(`/api/library/projects/${encodeURIComponent(slug)}/tree`),
  getBlueprint: (slug: string, lang = "zh-CN") =>
    api.get<{ content: string; lang_returned: string }>(
      `/api/library/projects/${encodeURIComponent(slug)}/blueprint?lang=${lang}`,
    ),
  getKnode: (slug: string, knodeId: string) =>
    api.get<LibraryKnodeContent>(
      `/api/library/projects/${encodeURIComponent(slug)}/knodes/${encodeURIComponent(knodeId)}`,
    ),
  // spec 035: 项目知识树点亮 + 全平台树
  getProjectKnowledgeTree: (slug: string) =>
    api.get<ProjectKnowledgeTree>(
      `/api/library/projects/${encodeURIComponent(slug)}/knowledge-tree`,
    ),
  getPlatformKnowledgeTree: () =>
    api.get<PlatformTree>(`/api/library/platform/knowledge-tree`),
  fileUrl: (slug: string, path: string) =>
    `${STUDENT_API_URL}/api/library/projects/${encodeURIComponent(slug)}/files/${path}`,
  // 公开封面图 (无需登录/pull); 后端从 manifest.cover_image_path 透传
  coverUrl: (slug: string) =>
    `${STUDENT_API_URL}/api/library/projects/${encodeURIComponent(slug)}/cover`,
}

// ---------------------------------------------------------------------------
// spec 036: knode 完成 + 用户级知识树 + 推荐
// ---------------------------------------------------------------------------

export const myKnodes = {
  toggleComplete: (slug: string, knodeId: string,
                   action: "toggle" | "complete" | "incomplete" = "toggle",
                   libraryVersion?: string) =>
    api.post<{ slug: string; knode_id: string; completed: boolean }>(
      `/api/my/knodes/${encodeURIComponent(slug)}/${encodeURIComponent(knodeId)}/complete`,
      { action, library_version: libraryVersion },
    ),
  getCompleteStatus: (slug: string) =>
    api.get<{ slug: string; completed_knode_ids: string[] }>(
      `/api/my/knodes/${encodeURIComponent(slug)}/complete-status`,
    ),
}

export const userKnowledgeTree = {
  get: () => api.get<UserKnowledgeTreeResponse>(`/api/user/knowledge-tree`),
  recommendations: (limit = 3) =>
    api.get<RecommendationsResponse>(`/api/user/recommendations?limit=${limit}`),
}

// ---------------------------------------------------------------------------
// my projects (我的书架)
// ---------------------------------------------------------------------------

export interface MyProjectItem {
  slug: string
  title: string
  title_zh?: string | null
  description?: string
  cover_image_path?: string | null
  knode_count?: number
  stage_count?: number
  domain?: string | null
  age_band?: string | null
  difficulty?: number | null
  tags?: string[]
  library_version?: string
  pulled_at?: string | null
  removed_at?: string | null
  last_module_id?: string | null
  unavailable?: boolean
  upgrade_available?: boolean
  created?: boolean
}

export const myProjects = {
  list: () => api.get<MyProjectItem[]>("/api/my/projects"),
  pull: (slug: string) => api.post<MyProjectItem>(`/api/my/projects/${encodeURIComponent(slug)}`),
  remove: (slug: string) =>
    api.delete<{ removed: boolean }>(`/api/my/projects/${encodeURIComponent(slug)}`),
  getProgress: (slug: string) =>
    api.get<{ last_module_id: string | null; last_visited_at: string | null }>(
      `/api/my/progress/${encodeURIComponent(slug)}`,
    ),
  setProgress: (slug: string, moduleId: string) =>
    api.put<{ last_module_id: string; last_visited_at: string }>(
      `/api/my/progress/${encodeURIComponent(slug)}/${encodeURIComponent(moduleId)}`,
      {},
    ),
  // spec 033: 从本地 clone 读 knode + 流出 media 文件
  getKnode: (slug: string, knodeId: string) =>
    api.get<LibraryKnodeContent>(
      `/api/my/projects/${encodeURIComponent(slug)}/knodes/${encodeURIComponent(knodeId)}`,
    ),
  fileUrl: (slug: string, path: string) =>
    `${STUDENT_API_URL}/api/my/projects/${encodeURIComponent(slug)}/files/${path}`,
}

// spec 027 P2.4-redo: gateway shim 给老 web 学习页用
export { gateway, setCurrentModuleId } from "./gateway"

// ---------------------------------------------------------------------------
// spec 028: AI 助教 chat sessions
// ---------------------------------------------------------------------------

export interface ChatSessionDTO {
  id: string
  user_id: string
  library_slug: string
  module_id: string | null
  title: string
  active_skill: string | null
  created_at: string
  updated_at: string
}

export interface ChatMessageDTO {
  id: string
  session_id: string
  user_id: string
  library_slug: string
  module_id: string
  role: "user" | "assistant" | "tool" | "system"
  content: string
  tool_calls: Record<string, unknown> | null
  skill: string | null
  created_at: string
}

export const chatSessions = {
  list: (params?: { library_slug?: string; module_id?: string }) => {
    const qs = new URLSearchParams()
    if (params?.library_slug) qs.set("library_slug", params.library_slug)
    if (params?.module_id) qs.set("module_id", params.module_id)
    const q = qs.toString()
    return api.get<ChatSessionDTO[]>(`/api/chat/sessions${q ? `?${q}` : ""}`)
  },
  get: (id: string) =>
    api.get<{ session: ChatSessionDTO; messages: ChatMessageDTO[] }>(
      `/api/chat/sessions/${encodeURIComponent(id)}`,
    ),
  create: (body: { library_slug?: string; module_id?: string; title?: string }) =>
    api.post<ChatSessionDTO>("/api/chat/sessions", body),
  delete: (id: string) =>
    api.delete<{ deleted: boolean }>(`/api/chat/sessions/${encodeURIComponent(id)}`),
}

// ---------------------------------------------------------------------------
// spec 031 P2 / 032: memory facts (用户记忆 — 由 fact_extractor worker 抽出)
// ---------------------------------------------------------------------------

export interface MemoryFact {
  id: string
  user_id: string
  scope: "global" | "project" | "knode"
  library_slug?: string | null
  module_id?: string | null
  category: string
  key: string
  value: string
  source_session?: string | null
  confidence: number
  valid_from: string
  created_at: string
}

export const memory = {
  listFacts: () =>
    api.get<{ total: number; by_category: Record<string, MemoryFact[]> }>(
      "/api/memory/facts",
    ),
  retireFact: (id: string) =>
    api.delete<{ retired: boolean; id: string }>(
      `/api/memory/facts/${encodeURIComponent(id)}`,
    ),
}

// ---------------------------------------------------------------------------
// spec 031 P5: exercise attempt POST (学生答题 → L3 history)
// ---------------------------------------------------------------------------

export interface ExerciseAttemptBody {
  library_slug: string
  module_id: string
  correct: boolean
  idea_id?: string
  exercise_index?: number
  question?: string
  student_answer?: string
}

export const exercise = {
  postAttempt: (body: ExerciseAttemptBody) =>
    api.post<{ ok: boolean; id: string }>("/api/exercise/attempt", body),
}

// ---------------------------------------------------------------------------
// 知识钻取 (spec 2026-06-09): 高亮课文 → 结构化下钻知识
// ---------------------------------------------------------------------------

export interface DrillContent {
  simple_explanation: string
  why_matters: string
  analogy: string
  key_points: string[]
  go_deeper: string
}

export interface DrillRecord {
  id: string
  highlight_text: string
  content: DrillContent
  created_at: string | null
}

export const knowledgeDrill = {
  create: (librarySlug: string, moduleId: string, highlightText: string) =>
    api.post<DrillRecord>("/api/knowledge/drill", {
      library_slug: librarySlug, module_id: moduleId, highlight_text: highlightText,
    }),
  list: (librarySlug: string, moduleId: string) =>
    api.get<{ drills: DrillRecord[] }>(
      `/api/knowledge/drill?library_slug=${encodeURIComponent(librarySlug)}&module_id=${encodeURIComponent(moduleId)}`,
    ),
}

export { STUDENT_API_URL }
