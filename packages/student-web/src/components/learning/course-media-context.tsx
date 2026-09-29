"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { CourseIdeaSummary } from "@/lib/types/api"

/** Course-specific persistence can wrap the standard reader's media surface. */
export const CourseMediaContext = createContext<{
  initialIdeaId?: string
  renderFrame?: (idea: CourseIdeaSummary, html: string) => ReactNode
} | null>(null)

export const useCourseMedia = () => useContext(CourseMediaContext)
