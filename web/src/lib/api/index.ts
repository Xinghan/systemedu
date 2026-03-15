/** Typed API functions for all gateway endpoints. */

import type {
  AgentInfo,
  ChatRequest,
  ChatResponse,
  ConfigResponse,
  MCPServer,
  ProjectDetail,
  ProjectSummary,
  SessionDetail,
  SessionSummary,
  SkillInfo,
  StatusResponse,
} from "@/lib/types/api"
import { api } from "./client"

export const gateway = {
  status: () => api.get<StatusResponse>("/api/status"),
  config: () => api.get<ConfigResponse>("/api/config"),
  updateConfig: (body: Record<string, unknown>) =>
    api.put<{ status: string }>("/api/config", body),
  sessions: () => api.get<SessionSummary[]>("/api/sessions"),
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
}
