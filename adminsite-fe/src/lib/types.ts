export interface AdminProject {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  cover_image: string;
  category: string;
  min_age: number;
  max_age: number;
  estimated_hours: number;
  is_published: boolean;
  is_template: boolean;
  milestone_count: number;
  created_at: string;
}

export interface KnowledgeNode {
  id: number;
  title: string;
  summary: string;
  difficulty_level: number;
  content_type: string;
  acceptance_type: string;
  estimated_minutes: number;
  xp_reward: number;
  order: number;
  prerequisites: number[];
}

export interface Milestone {
  id: number;
  title: string;
  description: string;
  order: number;
  acceptance_criteria: string;
  xp_reward: number;
  knodes: KnowledgeNode[];
}

export interface AdminProjectDetail {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  cover_image: string;
  category: string;
  min_age: number;
  max_age: number;
  estimated_hours: number;
  is_published: boolean;
  is_template: boolean;
  milestones: Milestone[];
  created_at: string;
  updated_at: string;
}

export interface ProjectFormData {
  title: string;
  subtitle: string;
  description: string;
  cover_image: string;
  category: string;
  min_age: number;
  max_age: number;
  estimated_hours: number;
  is_published: boolean;
  is_template: boolean;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface TreeGraphNode {
  id: number;
  title: string;
  milestone_id: number;
  milestone_title: string;
  difficulty_level: number;
  content_type: string;
  acceptance_type: string;
  estimated_minutes: number;
  xp_reward: number;
  order: number;
}

export interface TreeGraphEdge {
  source: number;
  target: number;
}

export interface TreeGraph {
  nodes: TreeGraphNode[];
  edges: TreeGraphEdge[];
}

export interface ImportResult {
  project_id: number;
  milestones_created: number;
  knodes_created: number;
}

export type TreeGranularity = "coarse" | "medium" | "fine";

export interface GenerateTreeInput {
  granularity: TreeGranularity;
  instructions: string;
}

export interface GenerateTreeResult {
  tree_data: Record<string, unknown>;
}

export interface GenerateTreeKickoff {
  task_id: string;
  status: string;
}

export interface GenerationTaskStatus {
  task_id: string;
  status: "pending" | "running" | "completed" | "failed";
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  tree_data?: Record<string, unknown>;
  milestones_created?: number;
  knodes_created?: number;
  error?: string;
}

export interface ActiveTask {
  task_id: string;
  status: "pending" | "running";
  project_id: number;
  project_title: string;
  granularity: string;
  created_at: string | null;
  started_at: string | null;
}

export const CATEGORY_OPTIONS = [
  { value: "ai", label: "AI & Machine Learning" },
  { value: "biotech", label: "Biotechnology" },
  { value: "aerospace", label: "Aerospace" },
  { value: "music", label: "Music & Audio" },
  { value: "climate", label: "Climate & Environment" },
  { value: "robotics", label: "Robotics" },
  { value: "chemistry", label: "Chemistry" },
  { value: "math", label: "Mathematics" },
  { value: "cs", label: "Computer Science" },
  { value: "other", label: "Other" },
] as const;
