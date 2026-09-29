import { createHash } from "node:crypto"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { LightkurveCoursePreview } from "@/components/learning/lightkurve-course-preview"
import { lightkurveView, type LightkurveRecordConfig } from "@/lib/lightkurve-preview"
import { normalizeSlides } from "@/lib/normalize-slides"
import { allowsLightkurvePreview, lightkurveMediaUrl, readLightkurveJson, readLightkurveManifest, readLightkurveText, validateLightkurveRecord } from "@/lib/server/lightkurve-local-preview"
import type { CourseContent, TheoryEntry } from "@/lib/types/api"

export const dynamic = "force-dynamic"
type CourseTree = { modules: { module_id: string; title: string; stage_id: string }[]; stages: { stage_id: string; title: string }[] }

export default async function Page({ params, searchParams }: { params: Promise<{ moduleId: string }>; searchParams: Promise<{ view?: string; mode?: string }> }) {
  if (!allowsLightkurvePreview((await headers()).get("host"))) notFound()
  const { moduleId } = await params
  if (!/^M\d{2,3}$/.test(moduleId)) notFound()
  const [manifest, search] = await Promise.all([readLightkurveManifest(), searchParams])
  const entry = manifest.knodes.find(item => item.module_id === moduleId)
  if (!entry) notFound()
  const dir = entry.knode_dir
  const [rawSlides, sections, rawTheories, plan, assignment, tree, rawRecord] = await Promise.all([
    readLightkurveJson<unknown>(`${dir}/slides.json`), readLightkurveJson<CourseContent>(`${dir}/sections.json`),
    readLightkurveJson<TheoryEntry[] | { theories: TheoryEntry[] }>(`${dir}/theories.json`), readLightkurveText(`${dir}/lesson.md`),
    readLightkurveText(`${dir}/assignment.md`), readLightkurveJson<CourseTree>("tree/knowledge_tree.json"), readLightkurveJson<LightkurveRecordConfig>(`${dir}/learning-record.json`),
  ])
  const recordConfig = validateLightkurveRecord(rawRecord)
  const slides = normalizeSlides(Array.isArray(rawSlides) ? rawSlides : (rawSlides as { slides?: unknown })?.slides, moduleId)
  const images: Record<string, string> = {}, audio: Record<string, string> = {}
  const media = (src: string) => lightkurveMediaUrl(src.startsWith("knodes/") || src.startsWith("downloads/") ? src : `${dir}/${src}`)
  for (const slide of slides) {
    for (const image of slide.payload.images || []) if (!/^(https?:|data:|\/)/.test(image.src)) images[image.src] = media(image.src)
    if (slide.audio_path && !/^(https?:|data:|\/)/.test(slide.audio_path)) audio[slide.audio_path] = media(slide.audio_path)
  }
  recordConfig.resources = recordConfig.resources?.map(resource => ({ ...resource,
    media_url: resource.media_url && !/^(https?:|data:|\/)/.test(resource.media_url) ? media(resource.media_url) : resource.media_url,
    poster_url: resource.poster_url && !/^(https?:|data:|\/)/.test(resource.poster_url) ? media(resource.poster_url) : resource.poster_url,
  }))
  const content: CourseContent = { ...sections, theories: Array.isArray(rawTheories) ? rawTheories : rawTheories.theories, plan_markdown: plan }
  const modules = manifest.knodes.map(item => {
    const node = tree.modules.find(node => node.module_id === item.module_id)
    return { id: item.module_id, title: node?.title || item.title || item.module_id, stage: node?.stage_id || item.stage_id || "course" }
  })
  const stages = tree.stages.map(stage => ({ id: stage.stage_id, title: stage.title }))
  for (const node of modules) if (!stages.some(stage => stage.id === node.stage)) stages.push({ id: node.stage, title: node.stage === "course" ? "课程节点" : node.stage })
  const contentVersion = createHash("sha256").update(JSON.stringify({ record: rawRecord, assignment })).digest("hex").slice(0, 32)
  return <LightkurveCoursePreview key={moduleId} moduleId={moduleId} courseTitle={manifest.title || "Lightkurve · 寻找系外行星凌星"} modules={modules} stages={stages} knodeDir={dir} content={content} slides={slides} images={images} audio={audio} assignment={assignment} recordConfig={recordConfig} contentVersion={contentVersion} initialView={lightkurveView(search.view)} initialLabMode={search.mode === "animation" ? "animation" : "game"} />
}
