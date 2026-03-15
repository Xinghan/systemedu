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

export interface ProjectDetail {
  project: Omit<ProjectSummary, "path">
  milestones: MilestoneInfo[]
  progress: NodeProgress[]
}

export interface AgentInfo {
  name: string
  type: string
  description: string
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

export interface WSMessage {
  type: "chunk" | "done" | "error"
  content?: string
  session_id?: string
  message?: string
}
