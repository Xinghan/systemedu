/** student-app typed API. 只暴露学生端用到的接口。 */

import { api, STUDENT_API_URL } from "./client"
import { setToken, clearToken, setUsername, clearUsername } from "@/lib/auth"

// ---------------------------------------------------------------------------
// auth
// ---------------------------------------------------------------------------

export interface AuthResponse {
  token: string
  username: string
  user_id: string
}

export const auth = {
  register: async (username: string, password: string): Promise<AuthResponse> => {
    const data = await api.post<AuthResponse>("/api/auth/register", { username, password })
    setToken(data.token)
    setUsername(data.username)
    return data
  },
  login: async (username: string, password: string): Promise<AuthResponse> => {
    const data = await api.post<AuthResponse>("/api/auth/login", { username, password })
    setToken(data.token)
    setUsername(data.username)
    return data
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
  me: () =>
    api.get<{ username: string; user_id: string; created_at?: string; last_login_at?: string }>(
      "/api/auth/me",
    ),
}

// ---------------------------------------------------------------------------
// library
// ---------------------------------------------------------------------------

export interface LibraryProjectSummary {
  slug: string
  title: string
  title_zh?: string | null
  description?: string
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
  fileUrl: (slug: string, path: string) =>
    `${STUDENT_API_URL}/api/library/projects/${encodeURIComponent(slug)}/files/${path}`,
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
}

// spec 027 P2.4-redo: gateway shim 给老 web 学习页用
export { gateway, setCurrentModuleId } from "./gateway"

export { STUDENT_API_URL }
