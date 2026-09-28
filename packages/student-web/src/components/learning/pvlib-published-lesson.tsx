"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, type ComponentProps } from "react"
import { library, myProjects } from "@/lib/api"
import { getToken } from "@/lib/auth"
import { useLearningIdentity } from "@/lib/hooks/use-learning-record"
import { normalizeSlides } from "@/lib/normalize-slides"
import { PVLIB_SLUG, type PvlibRecordConfig } from "@/lib/pvlib-preview"
import type { CourseContent, TheoryEntry } from "@/lib/types/api"
import { PvlibCoursePreview } from "./pvlib-course-preview"
import styles from "./pvlib-course-preview.module.css"

type Manifest = { title: string; planned_nodes?: number; knodes: { module_id: string; title: string; knode_dir: string; stage?: string }[] }
type Tree = { modules: { module_id: string; title: string; stage_id: string }[]; stages: { stage_id: string; title: string }[] }
type Lesson = Omit<ComponentProps<typeof PvlibCoursePreview>, "published" | "downloadControl">

class CourseRequestError extends Error {
  constructor(public status: number) { super(`课程请求失败 (${status})`) }
}

// Course bytes use the existing login + enrolled-project authorization boundary.
// No tokens are embedded in image URLs, downloadable files or sandboxed HTML.
async function courseFile(relative: string, token: string, signal?: AbortSignal) {
  if (!relative || relative.startsWith("/") || relative.split("/").some(part => part === ".." || part === ".") || /[\\\u0000-\u001f]/.test(relative)) throw new Error("课程资源路径无效")
  const response = await fetch(library.fileUrl(PVLIB_SLUG, relative.split("/").map(encodeURIComponent).join("/")), {
    headers: { Authorization: `Bearer ${token}` }, signal, cache: "no-store",
  })
  if (!response.ok) throw new CourseRequestError(response.status)
  return response
}

function PracticeDownload({ token }: { token: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  async function download() {
    setBusy(true); setError("")
    try {
      const response = await courseFile("downloads/pvlib-practice-kit.zip", token)
      const url = URL.createObjectURL(await response.blob())
      const anchor = document.createElement("a")
      anchor.href = url; anchor.download = "pvlib-practice-kit.zip"
      document.body.append(anchor); anchor.click(); anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { setError("实践包未能下载，请确认登录状态后重试。") }
    finally { setBusy(false) }
  }
  return <div><button type="button" className={styles.download} disabled={busy} onClick={() => void download()}>{busy ? "正在下载…" : "下载 pvlib 实践包 ↓"}</button>{error && <p role="alert">{error}</p>}</div>
}

export function PvlibPublishedLesson({ moduleId }: { moduleId: string }) {
  const router = useRouter()
  const { token, owner } = useLearningIdentity()
  const [loaded, setLoaded] = useState<{ owner: string; lesson: Lesson } | null>(null)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!getToken()) router.replace(`/login?next=${encodeURIComponent(`/learn/${PVLIB_SLUG}/${moduleId}`)}`)
  }, [router, moduleId, token])
  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    const urls: string[] = []
    const json = async <T,>(relative: string): Promise<T> => (await courseFile(relative, token, controller.signal)).json()
    const text = async (relative: string) => (await courseFile(relative, token, controller.signal)).text()
    async function load() {
      const [manifest, tree] = await Promise.all([json<Manifest>("manifest.json"), json<Tree>("tree/knowledge_tree.json")])
      const entry = manifest.knodes.find(node => node.module_id === moduleId)
      if (!entry) throw new Error("课程节点不存在")
      const dir = entry.knode_dir
      const [rawSlides, sections, rawTheories, plan, assignment, rawRecord] = await Promise.all([
        json<unknown>(`${dir}/slides.json`), json<CourseContent>(`${dir}/sections.json`),
        json<TheoryEntry[] | { theories: TheoryEntry[] }>(`${dir}/theories.json`), text(`${dir}/lesson.md`),
        text(`${dir}/assignment.md`), json<PvlibRecordConfig>(`${dir}/learning-record.json`),
      ])
      // Preserve the local acceptance version so existing saved work can resume.
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({ record: rawRecord, assignment, plan, rawSlides, rawTheories, sections })))
      const contentVersion = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("").slice(0, 32)
      const media = async (src?: string) => {
        if (!src || /^(https?:|data:|\/)/.test(src)) return src
        const response = await courseFile(/^(knodes|downloads|images)\//.test(src) ? src : `${dir}/${src}`, token!, controller.signal)
        const url = URL.createObjectURL(await response.blob())
        if (controller.signal.aborted) { URL.revokeObjectURL(url); throw new DOMException("Aborted", "AbortError") }
        urls.push(url); return url
      }
      const recordConfig = { ...rawRecord, resources: await Promise.all((rawRecord.resources || []).map(async resource => ({ ...resource, media_url: await media(resource.media_url), poster_url: await media(resource.poster_url) }))) }
      const modules = manifest.knodes.map(node => ({ id: node.module_id, title: node.title, stage: tree.modules.find(item => item.module_id === node.module_id)?.stage_id || node.stage || "course" }))
      const lesson: Lesson = {
        moduleId, courseTitle: manifest.title, modules, stages: tree.stages.map(stage => ({ id: stage.stage_id, title: stage.title })), plannedNodes: manifest.planned_nodes,
        knodeDir: dir, content: { ...sections, theories: Array.isArray(rawTheories) ? rawTheories : rawTheories.theories, plan_markdown: plan },
        slides: normalizeSlides(Array.isArray(rawSlides) ? rawSlides : (rawSlides as { slides?: unknown })?.slides, moduleId), images: {}, audio: {}, assignment, recordConfig, contentVersion,
      }
      if (!controller.signal.aborted) {
        setLoaded({ owner, lesson }); setError("")
        void myProjects.setProgress(PVLIB_SLUG, moduleId).catch(() => {})
      }
    }
    void load().catch(reason => {
      if (controller.signal.aborted) return
      if (reason instanceof CourseRequestError && reason.status === 401) router.replace(`/login?next=${encodeURIComponent(`/learn/${PVLIB_SLUG}/${moduleId}`)}`)
      else if (reason instanceof CourseRequestError && reason.status === 403) router.replace(`/library/${PVLIB_SLUG}`)
      else setError("课程未能载入，请重试。")
    })
    return () => { controller.abort(); urls.forEach(url => URL.revokeObjectURL(url)) }
  }, [moduleId, token, owner, retry, router])

  if (error) return <main className={styles.page}><p role="alert">{error}</p><button type="button" onClick={() => { setError(""); setRetry(value => value + 1) }}>重新加载</button><Link href={`/library/${PVLIB_SLUG}`}>返回项目</Link></main>
  if (!token || !loaded || loaded.owner !== owner) return <main className={styles.page}><p role="status">正在载入课程…</p></main>
  return <PvlibCoursePreview {...loaded.lesson} published downloadControl={<PracticeDownload key={owner} token={token} />} />
}
