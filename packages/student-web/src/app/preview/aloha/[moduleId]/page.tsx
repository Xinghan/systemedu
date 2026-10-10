import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { normalizeSlides } from "@/lib/normalize-slides"
import { allowsLocalCoursePreview, readAlohaPreviewJson, readAlohaPreviewText } from "@/lib/server/aloha-local-preview"
import { AlohaCoursePreview } from "@/components/learning/aloha-course-preview"
import type { CourseContent } from "@/lib/types/api"

export const dynamic = "force-dynamic"

export default async function Page({ params, searchParams }: { params: Promise<{ moduleId: string }>; searchParams: Promise<{ view?: string; mode?: string }> }) {
  if (!allowsLocalCoursePreview((await headers()).get("host"))) notFound()
  const { moduleId } = await params
  const search = await searchParams
  const initialTab = search.view === "lab" ? "lab" : "reading"
  const initialLabMode = search.mode === "animation" ? "animation" : "game"
  if (!/^M\d{2}$/.test(moduleId)) notFound()
  const manifest = await readAlohaPreviewJson("manifest.json")
  const entry = manifest.knodes.find((item: { module_id: string }) => item.module_id === moduleId)
  if (!entry) notFound()
  const dir = entry.knode_dir
  const [rawSlides, sections, theories, plan, assignment, tree] = await Promise.all([
    readAlohaPreviewJson(`${dir}/slides.json`), readAlohaPreviewJson(`${dir}/sections.json`),
    readAlohaPreviewJson(`${dir}/theories.json`), readAlohaPreviewText(`${dir}/lesson.md`),
    readAlohaPreviewText(`${dir}/assignment.md`), readAlohaPreviewJson("tree/knowledge_tree.json"),
  ])
  const slides = normalizeSlides(Array.isArray(rawSlides) ? rawSlides : rawSlides.slides, moduleId)
  const images: Record<string, string> = {}, audio: Record<string, string> = {}
  const mediaUrl = (relative: string) => `/preview/aloha/media?path=${encodeURIComponent(relative)}`
  for (const slide of slides) {
    for (const image of slide.payload.images || []) {
      if (!/^(https?:|data:|\/)/.test(image.src)) images[image.src] = mediaUrl(image.src.startsWith("knodes/") ? image.src : `${dir}/${image.src}`)
    }
    if (slide.audio_path) audio[slide.audio_path] = mediaUrl(slide.audio_path.startsWith("knodes/") ? slide.audio_path : `${dir}/${slide.audio_path}`)
  }
  const content: CourseContent = { ...sections, theories, plan_markdown: plan }
  const modules = tree.modules.map((m: { module_id: string; title: string; stage_id: string }) => ({ id: m.module_id, title: m.title, stage: m.stage_id }))
  const stages = tree.stages.map((s: { stage_id: string; title: string }) => ({ id: s.stage_id, title: s.title }))
  return <AlohaCoursePreview key={moduleId} moduleId={moduleId} modules={modules} stages={stages} knodeDir={dir} content={content} slides={slides} images={images} audio={audio} assignment={assignment} initialTab={initialTab} initialLabMode={initialLabMode} />
}
