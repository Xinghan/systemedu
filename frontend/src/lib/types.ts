// Types matching backend serializer output

export interface Project {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  cover_image: string | null;
  category: string;
  min_age: number;
  max_age: number;
  estimated_hours: number;
  is_published: boolean;
  milestone_count: number;
  created_at: string;
}

export interface KnowledgeNode {
  id: number;
  title: string;
  summary: string;
  difficulty_level: string;
  content_type: string;
  acceptance_type: string;
  estimated_minutes: number;
  xp_reward: number;
  order: number;
  prerequisites: number[] | null;
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

export interface ProjectDetail extends Project {
  milestones: Milestone[];
  updated_at: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  age: number | null;
  grade_level: string | null;
  total_xp: number;
  level: number;
  streak_days: number;
  last_active_at: string | null;
  date_joined: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
  password2: string;
  display_name?: string;
  age?: number;
  grade_level?: string;
  parent_email?: string;
}

export interface LoginInput {
  username: string;
  password: string;
}
