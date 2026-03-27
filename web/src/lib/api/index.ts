/** Typed API functions for all gateway endpoints. */

import type {
  AgentInfo,
  ChatRequest,
  ChatResponse,
  ConfigResponse,
  CourseAssignmentData,
  CourseContentData,
  CreateProjectResponse,
  EnrollmentInfo,
  FactoryQueueResponse,
  ObjectRegistryResponse,
  HighlightInfo,
  MCPServer,
  MilestoneInfo,
  NodeContext,
  NodeProgress,
  NoteInfo,
  PracticeSubmissionResult,
  PracticeSubmissionSummary,
  ProjectNotesResponse,
  ProjectResourcesResponse,
  ResourceItem,
  ResourceSearchResponse,
  UpdateProgressResponse,
  ProjectDetail,
  ProjectSummary,
  SessionDetail,
  SessionSummary,
  SkillInfo,
  StatusResponse,
  TreePreviewResponse,
} from "@/lib/types/api"
import { api, GATEWAY_URL } from "./client"
import { setToken, clearToken, getToken } from "@/lib/auth"

export const auth = {
  login: async (username: string, password: string): Promise<{ token: string; username: string }> => {
    const res = await fetch(`${GATEWAY_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || "Login failed")
    }
    const data = await res.json()
    setToken(data.token)
    return data
  },
  logout: async (): Promise<void> => {
    const token = getToken()
    if (token) {
      await fetch(`${GATEWAY_URL}/api/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      }).catch(() => {})
    }
    clearToken()
  },
  me: () => api.get<{ username: string; valid: boolean }>("/api/auth/me"),
}

export interface FullSession {
  id: string
  agent: string
  project: string | null
  created_at: string
  messages: { role: string; content: string; timestamp: string }[]
}

export const gateway = {
  status: () => api.get<StatusResponse>("/api/status"),
  config: () => api.get<ConfigResponse>("/api/config"),
  updateConfig: (body: Record<string, unknown>) =>
    api.put<{ status: string }>("/api/config", body),
  sessions: () => api.get<SessionSummary[]>("/api/sessions"),
  sessionsFull: () => api.get<FullSession[]>("/api/sessions/full"),
  session: (id: string) => api.get<SessionDetail>(`/api/sessions/${id}`),
  chat: (req: ChatRequest) => api.post<ChatResponse>("/api/chat", req),
  projects: () => api.get<ProjectSummary[]>("/api/projects"),
  project: (name: string) => api.get<ProjectDetail>(`/api/projects/${name}`),
  updateProject: (name: string, body: { title?: string; description?: string; category?: string; age_range?: number[]; estimated_hours?: number; tags?: string[] }) =>
    api.patch<{ name: string; updated: boolean }>(`/api/projects/${name}`, body),
  agents: () => api.get<AgentInfo[]>("/api/agents"),
  skills: () => api.get<SkillInfo[]>("/api/skills"),
  mcpServers: () => api.get<MCPServer[]>("/api/mcp/servers"),
  addMCPServer: (body: { name: string; command: string; args?: string[] }) =>
    api.post<{ status: string; name: string }>("/api/mcp/servers", body),
  removeMCPServer: (name: string) =>
    api.delete<{ status: string; name: string }>(`/api/mcp/servers/${name}`),
  nodeContext: (projectName: string, nodeId: number) =>
    api.get<NodeContext>(`/api/projects/${projectName}/nodes/${nodeId}/context`),
  generateCourseV2: (projectName: string, nodeId: number, regenerate = false) =>
    api.post<{ status: string; project_name: string; knode_id: number }>(
      `/api/projects/${projectName}/nodes/${nodeId}/course/v2/generate`,
      { regenerate }
    ),
  getCourseV2: (projectName: string, nodeId: number) =>
    api.get<CourseContentData>(`/api/projects/${projectName}/nodes/${nodeId}/course/v2`),
  getCourseV2Assignment: (projectName: string, nodeId: number) =>
    api.get<CourseAssignmentData>(`/api/projects/${projectName}/nodes/${nodeId}/course/v2/assignment`),
  streamCourseV2: async (projectName: string, nodeId: number, regenerate = false): Promise<Response> => {
    // Returns a fetch Response with SSE stream. Use body.getReader() to consume.
    // Auth is passed via ?token= query param so no CORS preflight issues.
    const token = getToken()
    const qs = new URLSearchParams()
    if (token) qs.set("token", token)
    if (regenerate) qs.set("regenerate", "1")
    const url = `${GATEWAY_URL}/api/projects/${encodeURIComponent(projectName)}/nodes/${nodeId}/course/v2/stream?${qs.toString()}`
    return fetch(url)
  },
  updateNodeProgress: (projectName: string, nodeId: number, status: string, userId = "default") =>
    api.patch<UpdateProgressResponse>(`/api/projects/${projectName}/nodes/${nodeId}/progress`, { status, user_id: userId }),
  previewTree: (treeData: Record<string, unknown>) =>
    api.post<TreePreviewResponse>("/api/projects/preview-tree", { tree_data: treeData }),
  generateDescription: (body: { title: string; age?: number; node_count?: number }) =>
    api.post<{ description: string; tags?: string[] }>("/api/projects/generate-description", body),
  generateTree: (body: { title: string; description: string; age?: number; node_count?: number }) =>
    api.post<TreePreviewResponse>("/api/projects/generate-tree", body),
  createProject: (name: string, title: string, treeData: Record<string, unknown>, meta?: { description?: string; tags?: string[]; category?: string; age_range?: number[] }) =>
    api.post<CreateProjectResponse>("/api/projects", { name, title, tree_data: treeData, ...meta }),
  deleteProject: (name: string) =>
    api.delete<{ status: string; name: string }>(`/api/projects/${name}`),
  uploadProjectCover: async (name: string, file: File): Promise<{ url: string }> => {
    const formData = new FormData()
    formData.append("file", file)
    const token = getToken()
    const res = await fetch(`${GATEWAY_URL}/api/projects/${encodeURIComponent(name)}/cover`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || "Upload failed")
    }
    return res.json()
  },

  enroll: (projectName: string, userId = "default") =>
    api.post<EnrollmentInfo>(`/api/projects/${projectName}/enroll`, { user_id: userId }),
  enrollment: (projectName: string, userId = "default") =>
    api.get<EnrollmentInfo | null>(`/api/projects/${projectName}/enrollment?user_id=${userId}`),
  updateEnrollment: (projectName: string, body: { add_time_seconds?: number; status?: string; user_id?: string }) =>
    api.patch<EnrollmentInfo>(`/api/projects/${projectName}/enrollment`, body),
  getHighlights: (projectName: string, nodeId: number, userId = "default") =>
    api.get<HighlightInfo[]>(`/api/projects/${projectName}/nodes/${nodeId}/highlights?user_id=${userId}`),
  createHighlight: (projectName: string, nodeId: number, data: {
    tab: string; page_index: number; text: string; start_offset: number; end_offset: number;
    note?: string; color?: string; user_id?: string;
  }) =>
    api.post<HighlightInfo>(`/api/projects/${projectName}/nodes/${nodeId}/highlights`, data),
  deleteHighlight: (projectName: string, nodeId: number, highlightId: number) =>
    api.delete<{ status: string; id: number }>(`/api/projects/${projectName}/nodes/${nodeId}/highlights/${highlightId}`),
  submitPractice: (projectName: string, nodeId: number, answers: { exercise_idx: number; user_answer: string }[], userId = "default") =>
    api.post<PracticeSubmissionResult>(`/api/projects/${projectName}/nodes/${nodeId}/practice/submit`, { answers, user_id: userId }),
  practiceSubmissions: (projectName: string, nodeId: number, userId = "default") =>
    api.get<PracticeSubmissionSummary[]>(`/api/projects/${projectName}/nodes/${nodeId}/practice/submissions?user_id=${userId}`),
  getResources: (projectName: string, nodeId: number) =>
    api.get<ResourceSearchResponse>(`/api/projects/${projectName}/nodes/${nodeId}/resources`),
  addResource: (projectName: string, nodeId: number, url: string, title: string, snippet?: string) =>
    api.post<ResourceItem>(`/api/projects/${projectName}/nodes/${nodeId}/resources`, { url, title, snippet: snippet ?? "" }),
  getAllResources: (projectName: string) =>
    api.get<ProjectResourcesResponse>(`/api/projects/${projectName}/resources`),
  triggerResourceSearch: (projectName: string, nodeId: number) =>
    api.post<{ status: string }>(`/api/projects/${projectName}/nodes/${nodeId}/resources/search`, {}),
  toggleResourceSaved: (projectName: string, nodeId: number, resourceId: number, saved: boolean) =>
    api.patch<{ id: number; saved: boolean }>(`/api/projects/${projectName}/nodes/${nodeId}/resources/${resourceId}`, { saved }),
  getNote: (projectName: string, nodeId: number, userId = "default") =>
    api.get<NoteInfo>(`/api/projects/${projectName}/nodes/${nodeId}/note?user_id=${userId}`),
  upsertNote: (projectName: string, nodeId: number, content: string, userId = "default") =>
    api.put<NoteInfo>(`/api/projects/${projectName}/nodes/${nodeId}/note`, { content, user_id: userId }),
  getAllNotes: (projectName: string) =>
    api.get<ProjectNotesResponse>(`/api/projects/${projectName}/notes`),
  updateTree: (projectName: string, milestones: MilestoneInfo[]) =>
    api.put<{ ok: boolean; milestones: MilestoneInfo[] }>(
      `/api/projects/${projectName}/tree`, { milestones }
    ),
  objectRegistry: () => api.get<ObjectRegistryResponse>("/api/objects/registry"),
  objectQueue: (projectName?: string) => {
    const url = projectName
      ? `/api/objects/queue?project=${encodeURIComponent(projectName)}`
      : "/api/objects/queue"
    return api.get<FactoryQueueResponse>(url)
  },
  objectQueueAdd: (objectKey: string, description?: string, projectName?: string) =>
    api.post<{ object_key: string; added: boolean }>("/api/objects/queue/add", {
      object_key: objectKey,
      description: description ?? "",
      project_name: projectName ?? "",
    }),
  objectQueueTrigger: (projectName?: string, retryFailed = true) => {
    const params = new URLSearchParams()
    if (projectName) params.set("project", projectName)
    if (retryFailed) params.set("retry_failed", "1")
    const qs = params.toString()
    return api.post<{ triggered: number; object_keys?: string[] }>(
      `/api/objects/queue/trigger${qs ? `?${qs}` : ""}`, {}
    )
  },
}
