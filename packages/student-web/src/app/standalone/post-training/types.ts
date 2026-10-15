import type { SlideEntry } from "@/lib/types/api"
import type { ModuleId } from "./record"
export type CourseModule = {
  id: ModuleId; title: string; short: string; eyebrow: string; description: string
  duration: string; deliverable: string; tags: string[]; checklist: string[]; slides: SlideEntry[]
  videos: { embed?: boolean; title: string; author: string; url: string; type: string; focus: string; question: string }[]
  reading: { title: string; url: string; detail: string }[]
}
