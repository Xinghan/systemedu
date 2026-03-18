/** Typed API functions for all gateway endpoints. */

import type {
  AgentInfo,
  ChatRequest,
  ChatResponse,
  ConfigResponse,
  CreateProjectResponse,
  EnrollmentInfo,
  HighlightInfo,
  LessonContent,
  LessonProgressResponse,
  MCPServer,
  NodeContext,
  NodeProgress,
  PracticeSubmissionResult,
  PracticeSubmissionSummary,
  UpdateProgressResponse,
  ProjectDetail,
  ProjectSummary,
  SessionDetail,
  SessionSummary,
  SkillInfo,
  StatusResponse,
  TreePreviewResponse,
} from "@/lib/types/api"
import { api } from "./client"

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
  agents: () => api.get<AgentInfo[]>("/api/agents"),
  skills: () => api.get<SkillInfo[]>("/api/skills"),
  mcpServers: () => api.get<MCPServer[]>("/api/mcp/servers"),
  addMCPServer: (body: { name: string; command: string; args?: string[] }) =>
    api.post<{ status: string; name: string }>("/api/mcp/servers", body),
  removeMCPServer: (name: string) =>
    api.delete<{ status: string; name: string }>(`/api/mcp/servers/${name}`),
  nodeContext: (projectName: string, nodeId: number) =>
    api.get<NodeContext>(`/api/projects/${projectName}/nodes/${nodeId}/context`),
  lesson: (projectName: string, nodeId: number) =>
    api.get<LessonContent>(`/api/projects/${projectName}/nodes/${nodeId}/lesson`),
  generateLesson: (projectName: string, nodeId: number, regenerate = false) =>
    api.post<{ status: string; project_name: string; knode_id: number }>(`/api/projects/${projectName}/nodes/${nodeId}/lesson/generate`, { regenerate }),
  lessonProgress: (projectName: string, nodeId: number) =>
    api.get<LessonProgressResponse>(`/api/projects/${projectName}/nodes/${nodeId}/lesson/progress`),
  updateNodeProgress: (projectName: string, nodeId: number, status: string, userId = "default") =>
    api.patch<UpdateProgressResponse>(`/api/projects/${projectName}/nodes/${nodeId}/progress`, { status, user_id: userId }),
  previewTree: (treeData: Record<string, unknown>) =>
    api.post<TreePreviewResponse>("/api/projects/preview-tree", { tree_data: treeData }),
  generateTree: (body: { title: string; description: string; age?: number; node_count?: number }) =>
    api.post<TreePreviewResponse>("/api/projects/generate-tree", body),
  createProject: (name: string, title: string, treeData: Record<string, unknown>) =>
    api.post<CreateProjectResponse>("/api/projects", { name, title, tree_data: treeData }),
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
}
