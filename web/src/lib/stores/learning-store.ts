"use client"

import { create } from "zustand"
import type { MilestoneInfo, NodeProgress, ProjectSummary } from "@/lib/types/api"

interface LearningState {
  project: Omit<ProjectSummary, "path"> | null
  milestones: MilestoneInfo[]
  progress: NodeProgress[]
  activeNodeId: number | null
  setProject: (project: Omit<ProjectSummary, "path"> | null) => void
  setMilestones: (milestones: MilestoneInfo[]) => void
  setProgress: (progress: NodeProgress[]) => void
  setActiveNodeId: (id: number | null) => void
}

export const useLearningStore = create<LearningState>((set) => ({
  project: null,
  milestones: [],
  progress: [],
  activeNodeId: null,
  setProject: (project) => set({ project }),
  setMilestones: (milestones) => set({ milestones }),
  setProgress: (progress) => set({ progress }),
  setActiveNodeId: (id) => set({ activeNodeId: id }),
}))
