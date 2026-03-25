"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import {
  FileJson, Eye, Check, AlertCircle, ArrowLeft, ArrowRight,
  Sparkles, Upload, Brain, ImageIcon, Wand2, ChevronDown, X, Plus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TreeFlow } from "@/components/knowledge-tree/tree-flow"
import { gateway } from "@/lib/api"
import type { TreePreviewResponse } from "@/lib/types/api"
import { useT } from "@/lib/hooks/use-t"

type Step = "input" | "preview" | "confirm"

/** Generate a URL-safe slug from a title + short random suffix to ensure uniqueness. */
function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    // Keep ASCII letters, digits, spaces; strip everything else
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .slice(0, 32)
    .replace(/^-|-$/g, "") || "project"
  // 4-char base36 suffix: ~1.7M combinations, collision-free in practice
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${base}-${suffix}`
}

export default function NewProjectPage() {
  const router = useRouter()
  const t = useT()
  const [step, setStep] = useState<Step>("input")
  const [rawJson, setRawJson] = useState("")
  const [treeData, setTreeData] = useState<Record<string, unknown> | null>(null)
  const [preview, setPreview] = useState<TreePreviewResponse | null>(null)
  const [projectName, setProjectName] = useState("")
  const [projectTitle, setProjectTitle] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadingLabel, setLoadingLabel] = useState("")
  const [loadingStep, setLoadingStep] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [inputMode, setInputMode] = useState<"ai" | "json">("ai")

  // AI form state
  const [aiTitle, setAiTitle] = useState("")
  const [aiDescription, setAiDescription] = useState("")
  const [aiAge, setAiAge] = useState(9)
  const [aiNodeCount, setAiNodeCount] = useState(25)

  // Cover image state
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [generatingDesc, setGeneratingDesc] = useState(false)
  const [generatingCover, setGeneratingCover] = useState(false)

  // Tags state
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [tagInputVisible, setTagInputVisible] = useState(false)

  const STEPS = [
    { key: "input" as Step, label: t("new_project.step_setup") },
    { key: "preview" as Step, label: t("new_project.step_preview") },
    { key: "confirm" as Step, label: t("new_project.step_confirm") },
  ]

  const stepIndex = STEPS.findIndex((s) => s.key === step)

  const handleFile = useCallback((file: File) => {
    setError("")
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      setRawJson(text)
      try { setTreeData(JSON.parse(text)) }
      catch { setError(t("new_project.parse_json") + " failed") }
    }
    reader.readAsText(file)
  }, [t])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handlePaste = useCallback(() => {
    setError("")
    try { setTreeData(JSON.parse(rawJson)) }
    catch { setError(t("new_project.parse_json") + " failed") }
  }, [rawJson, t])

  const handlePreview = useCallback(async () => {
    if (!treeData) return
    setLoading(true); setLoadingLabel(t("new_project.generating_label")); setLoadingStep(0); setError("")
    try {
      const result = await gateway.previewTree(treeData)
      setPreview(result)
      if (result.valid) {
        const metaTitle = result.meta?.title as string
        if (metaTitle) {
          setProjectTitle(metaTitle)
          setProjectName(generateSlug(metaTitle))
        } else {
          setProjectName(generateSlug("project"))
        }
        setStep("preview")
      } else {
        setError(`Validation failed: ${result.errors.join("; ")}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview request failed")
    } finally {
      setLoading(false)
    }
  }, [treeData, t])

  const handleAiGenerate = useCallback(async () => {
    if (!aiTitle.trim() || !aiDescription.trim()) return
    setLoading(true); setError("")
    setLoadingLabel(t("new_project.generating"))
    setLoadingStep(0)
    const stepTimer1 = setTimeout(() => setLoadingStep(1), 1500)
    const stepTimer2 = setTimeout(() => setLoadingStep(2), 3500)
    try {
      const result = await gateway.generateTree({
        title: aiTitle.trim(),
        description: aiDescription.trim(),
        age: aiAge,
        node_count: aiNodeCount,
      })
      setPreview(result)
      setTreeData({ milestones: result.milestones })
      setProjectTitle(aiTitle.trim())
      setProjectName(generateSlug(aiTitle.trim()))
      setStep("preview")
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI generation failed, please retry")
    } finally {
      clearTimeout(stepTimer1); clearTimeout(stepTimer2)
      setLoading(false)
    }
  }, [aiTitle, aiDescription, aiAge, aiNodeCount, t])

  const handleCreate = useCallback(async () => {
    if (!treeData) return
    const slug = projectName.trim() || generateSlug(projectTitle.trim() || "project")
    setLoading(true); setLoadingLabel(t("new_project.saving")); setLoadingStep(2); setError("")
    try {
      await gateway.createProject(slug, projectTitle.trim(), treeData, {
        description: aiDescription.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        age_range: [aiAge, aiAge + 6],
      })
      if (coverFile) {
        try { await gateway.uploadProjectCover(slug, coverFile) } catch { /* non-fatal */ }
      } else if (coverPreview && coverPreview.includes("/_preview/")) {
        // Preview was generated — fetch the image and re-upload under the project name
        try {
          const imgRes = await fetch(coverPreview)
          if (imgRes.ok) {
            const blob = await imgRes.blob()
            const file = new File([blob], "cover.jpg", { type: "image/jpeg" })
            await gateway.uploadProjectCover(slug, file)
          }
        } catch { /* non-fatal */ }
      }
      router.push(`/projects/${slug}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed")
    } finally {
      setLoading(false)
    }
  }, [treeData, projectName, projectTitle, coverFile, coverPreview, aiDescription, tags, aiAge, router, t])
  // Note: projectName is auto-generated (generateSlug) and stored in state; slug variable is derived inside handleCreate

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (loading) {
    const LOAD_STEPS = [t("new_project.synthesize"), t("new_project.curate"), t("new_project.architect")]
    return (
      <div className="min-h-screen bg-[#f8f5ff] flex flex-col items-center justify-center gap-10 px-4">
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2" style={{ fontFamily: "var(--font-manrope, sans-serif)" }}>SystemEdu Engine</p>
          <h1 className="text-3xl font-extrabold text-foreground" style={{ fontFamily: "var(--font-manrope, sans-serif)" }}>{t("new_project.generating_label")}</h1>
        </div>

        {/* Growing knowledge tree SVG animation */}
        <GrowingTreeAnimation step={loadingStep} />

        <div className="w-72 space-y-2">
          <div className="h-1 rounded-full bg-border overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-purple-400 transition-all duration-700"
              style={{ width: `${((loadingStep + 1) / 3) * 100}%` }} />
          </div>
          <div className="flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground" style={{ fontFamily: "var(--font-manrope, sans-serif)" }}>
            <span>{t("new_project.synchronizing")}</span>
            <span>{loadingLabel}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {LOAD_STEPS.map((s, i) => (
            <div key={s} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs uppercase tracking-wider transition-all duration-500 ${
              i < loadingStep ? "bg-emerald-50 text-emerald-700" : i === loadingStep ? "bg-primary/15 text-primary font-semibold" : "bg-secondary text-muted-foreground"
            }`} style={{ fontFamily: "var(--font-manrope, sans-serif)" }}>
              {i < loadingStep && <Check className="h-3 w-3" />}
              {i === loadingStep && <div className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />}
              {s}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Preview step ────────────────────────────────────────────────────────────
  if (step === "preview" && preview) {
    return (
      <div className="flex flex-col h-screen bg-[#f8f5ff]">
        <div className="flex items-center gap-6 px-6 py-4 bg-white/80 backdrop-blur-xl border-b border-white/50 shrink-0">
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex items-center gap-2">
                {i > 0 && <div className="w-5 h-px bg-border" />}
                <span className={`text-xs font-[var(--font-manrope)] px-3 py-1 rounded-full ${
                  step === s.key ? "bg-primary text-primary-foreground"
                    : i < STEPS.findIndex((x) => x.key === step) ? "bg-emerald-100 text-emerald-700"
                    : "bg-secondary text-secondary-foreground"
                }`}>{i + 1}. {s.label}</span>
              </div>
            ))}
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-5 text-xs">
            {[
              { v: preview.stats.milestone_count, l: t("new_project.modules") },
              { v: preview.stats.node_count, l: t("new_project.nodes") },
              { v: preview.stats.total_minutes, l: t("new_project.minutes") },
              { v: `~${preview.stats.estimated_hours}h`, l: t("new_project.study_time") },
            ].map(({ v, l }) => (
              <span key={l} className="text-muted-foreground">
                <span className="font-bold text-foreground text-sm mr-1">{v}</span>{l}
              </span>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setStep("input")}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />{t("new_project.back")}
            </Button>
            <button onClick={() => setStep("confirm")}
              className="h-9 px-5 rounded-xl bg-primary text-white text-sm font-semibold flex items-center gap-2 shadow-[0_2px_12px_0_rgba(106,28,246,0.25)] hover:shadow-[0_4px_20px_0_rgba(106,28,246,0.35)] transition-all duration-[350ms]">
              {t("new_project.confirm_create")}<ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <TreeFlow milestones={preview.milestones} progress={[]} />
        </div>
      </div>
    )
  }

  // ── Confirm step ────────────────────────────────────────────────────────────
  if (step === "confirm") {
    return (
      <div className="flex-1 overflow-y-auto bg-[#f8f5ff]">
        <div className="max-w-2xl mx-auto px-6 py-12">
          {/* Step indicator */}
          <StepIndicator steps={STEPS} currentIndex={stepIndex} />

          <h1 className="text-2xl font-extrabold text-foreground mt-10 mb-8 font-[var(--font-manrope)]">
            {t("new_project.confirm_title")}
          </h1>

          {error && (
            <div className="flex items-start gap-3 p-4 mb-6 rounded-2xl bg-destructive/8 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /><span>{error}</span>
            </div>
          )}

          <div className="space-y-6">
            {/* Cover preview — square */}
            {(coverPreview || coverFile) && coverPreview !== "__generate__" && (
              <div className="flex items-center gap-5 p-4 rounded-2xl bg-white shadow-sm">
                <img src={coverPreview!} alt="cover" className="w-20 h-20 rounded-2xl object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{projectTitle}</p>
                  <button onClick={() => { setCoverFile(null); setCoverPreview(null) }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-1.5">
                    {t("new_project.remove")}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground font-[var(--font-manrope)] block">
                {t("new_project.project_title")}
              </label>
              <Input
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                className="h-14 text-lg bg-[#f1efff] border-0 border-b-2 border-primary/20 focus:border-primary rounded-none rounded-t-xl px-4 focus:ring-0"
              />
            </div>

            {preview && (
              <p className="text-sm text-muted-foreground">
                {t("new_project.confirm_desc", { m: preview.stats.milestone_count, n: preview.stats.node_count })}
              </p>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep("preview")}>
                <ArrowLeft className="h-4 w-4 mr-1.5" />{t("new_project.back")}
              </Button>
              <button onClick={handleCreate} disabled={!projectTitle.trim()}
                className="group relative px-10 py-4 bg-primary text-white font-extrabold text-base rounded-2xl overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_8px_32px_0_rgba(106,28,246,0.30)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3">
                <div className="absolute inset-0 bg-gradient-to-r from-primary via-[#ac8eff] to-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative flex items-center gap-3">
                  <Check className="h-5 w-5" />{t("new_project.create")}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Input step (main form) ──────────────────────────────────────────────────
  const COMPLEXITY_OPTIONS = [
    {
      v: 25, key: "Core" as const,
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 0 2h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1 0-2h1a7 7 0 0 1 7-7h1V5.73A2 2 0 0 1 10 4a2 2 0 0 1 2-2z" />
        </svg>
      ),
      labelKey: "new_project.core" as const,
      descKey: "new_project.core_desc" as const,
    },
    {
      v: 100, key: "Deep" as const,
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="11" />
        </svg>
      ),
      labelKey: "new_project.deep" as const,
      descKey: "new_project.deep_desc" as const,
    },
    {
      v: 300, key: "Expert" as const,
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-4.14z" />
          <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-4.14z" />
        </svg>
      ),
      labelKey: "new_project.expert" as const,
      descKey: "new_project.expert_desc" as const,
    },
  ]

  return (
    <div className="flex-1 overflow-y-auto bg-[#f8f5ff]">
      <div className="max-w-2xl mx-auto px-6 py-12 space-y-10">

        {/* Back + Step indicator */}
        <div>
          <button onClick={() => router.push("/projects")}
            className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors mb-6" style={{ fontFamily: "var(--font-manrope, sans-serif)" }}>
            <ArrowLeft className="h-4 w-4" />{t("project.back_library")}
          </button>
          <StepIndicator steps={STEPS} currentIndex={stepIndex} />
        </div>

        {/* Project Title — top of form per design */}
        <div className="space-y-3">
          <label className="font-bold text-foreground text-base block" style={{ fontFamily: "var(--font-manrope, sans-serif)" }}>
            {t("new_project.project_title")}
          </label>
          <input
            type="text"
            placeholder={t("new_project.title_placeholder")}
            value={aiTitle}
            onChange={(e) => setAiTitle(e.target.value)}
            className="w-full bg-white border border-border rounded-xl px-4 py-3 text-base focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50"
            style={{ fontFamily: "var(--font-manrope, sans-serif)" }}
          />
        </div>

        {error && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-destructive/8 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /><span>{error}</span>
          </div>
        )}

        {/* Mode toggle */}
        <div className="flex gap-3 w-full">
          <button onClick={() => setInputMode("ai")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
              inputMode === "ai"
                ? "bg-white border-2 border-primary text-primary shadow-sm"
                : "bg-white border-2 border-transparent text-muted-foreground hover:border-border"
            }`} style={{ fontFamily: "var(--font-manrope, sans-serif)" }}>
            <Sparkles className="h-4 w-4" />{t("new_project.ai_generate")}
          </button>
          <button onClick={() => setInputMode("json")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
              inputMode === "json"
                ? "bg-white border-2 border-primary text-primary shadow-sm"
                : "bg-white border-2 border-transparent text-muted-foreground hover:border-border"
            }`} style={{ fontFamily: "var(--font-manrope, sans-serif)" }}>
            <FileJson className="h-4 w-4" />{t("new_project.upload_json")}
          </button>
        </div>

        {/* ── AI mode ── */}
        {inputMode === "ai" && (
          <div className="space-y-10">

            {/* Age Range */}
            <section className="space-y-3">
              <label className="font-bold text-foreground text-base block" style={{ fontFamily: "var(--font-manrope, sans-serif)" }}>
                {t("new_project.student_age")}
              </label>
              <div className="relative">
                <select
                  value={aiAge}
                  onChange={(e) => setAiAge(Number(e.target.value))}
                  className="w-full bg-white border border-border rounded-xl px-4 py-3 text-base focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 appearance-none cursor-pointer transition-all"
                  style={{ fontFamily: "var(--font-manrope, sans-serif)" }}
                >
                  <option value={5}>{t("new_project.age_under6")}</option>
                  <option value={9}>{t("new_project.age_6_12")}</option>
                  <option value={13}>{t("new_project.age_12_15")}</option>
                  <option value={16}>{t("new_project.age_15_18")}</option>
                  <option value={20}>{t("new_project.age_18plus")}</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </section>

            {/* Knowledge Complexity */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="font-bold text-foreground text-base block" style={{ fontFamily: "var(--font-manrope, sans-serif)" }}>
                  {t("new_project.complexity")}
                </label>
                <div className="relative group/tip">
                  <button type="button" className="w-5 h-5 rounded-full bg-[#e0e0ff] text-[#4953ac] text-xs font-bold flex items-center justify-center hover:bg-[#c8c8ff] transition-colors">
                    ?
                  </button>
                  <div className="absolute right-0 top-7 z-20 w-56 p-3 rounded-xl bg-white shadow-lg border border-[#e0e0ff] text-xs text-muted-foreground leading-relaxed opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity duration-150" style={{ fontFamily: "var(--font-manrope, sans-serif)" }}>
                    <p className="font-semibold text-foreground mb-1.5">{t("new_project.complexity_hint_title")}</p>
                    <p><span className="font-semibold text-foreground">{t("new_project.core")}</span> — {t("new_project.core_range")}</p>
                    <p><span className="font-semibold text-foreground">{t("new_project.deep")}</span> — {t("new_project.deep_range")}</p>
                    <p><span className="font-semibold text-foreground">{t("new_project.expert")}</span> — {t("new_project.expert_range")}</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {COMPLEXITY_OPTIONS.map((opt) => {
                  const isSelected = aiNodeCount === opt.v
                  return (
                    <button key={opt.key} onClick={() => setAiNodeCount(opt.v)}
                      className={`flex flex-col p-6 rounded-2xl text-left transition-all duration-300 ${
                        isSelected
                          ? "bg-white border-2 border-primary shadow-[0_4px_20px_0_rgba(106,28,246,0.12)] -translate-y-0.5"
                          : "bg-[#f1efff] border-2 border-transparent hover:bg-[#e6e6ff] hover:-translate-y-0.5"
                      }`}>
                      <span className={`mb-3 ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                        {opt.icon}
                      </span>
                      <span className="font-[var(--font-manrope)] font-bold text-foreground text-sm">
                        {t(opt.labelKey)}
                      </span>
                      <span className="font-[var(--font-manrope)] text-xs text-muted-foreground mt-1 leading-relaxed">
                        {t(opt.descKey)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* Description & Objectives */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="font-bold text-foreground text-base block" style={{ fontFamily: "var(--font-manrope, sans-serif)" }}>
                  {t("new_project.desc_objectives")}
                </label>
                <button type="button" disabled={generatingDesc || !aiTitle.trim()}
                  onClick={async () => {
                    setGeneratingDesc(true)
                    try {
                      const res = await gateway.generateDescription({ title: aiTitle, age: aiAge, node_count: aiNodeCount })
                      setAiDescription(res.description)
                      if (res.tags && res.tags.length > 0) setTags(res.tags)
                    } catch { /* silently ignore */ }
                    finally { setGeneratingDesc(false) }
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-[var(--font-manrope)] font-semibold transition-colors disabled:opacity-40">
                  <Wand2 className={`h-3.5 w-3.5 ${generatingDesc ? "animate-spin" : ""}`} />
                  {generatingDesc ? t("new_project.generating_desc") : t("new_project.ai_fill_desc")}
                </button>
              </div>
              <div className="relative">
                <textarea
                  className={`w-full bg-[#f1efff] border-0 rounded-xl focus:ring-0 outline-none px-4 py-4 text-sm text-foreground leading-relaxed placeholder:text-muted-foreground/50 resize-none transition-opacity duration-200 ${generatingDesc ? "opacity-40" : ""}`}
                  placeholder={t("new_project.desc_placeholder")}
                  rows={6}
                  value={aiDescription}
                  onChange={(e) => setAiDescription(e.target.value)}
                  disabled={generatingDesc}
                />
                {generatingDesc && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl">
                    <div className="flex items-center gap-2 text-primary">
                      <Wand2 className="h-5 w-5 animate-spin" />
                      <span className="text-sm font-semibold" style={{ fontFamily: "var(--font-manrope, sans-serif)" }}>
                        {t("new_project.generating_desc")}
                      </span>
                    </div>
                    <div className="flex gap-1 mt-1">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce"
                          style={{ animationDelay: `${i * 150}ms` }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {/* Tags — editable */}
              <div className="flex flex-wrap items-center gap-2">
                {tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#e6e6ff] text-[#4953ac] text-xs font-semibold" style={{ fontFamily: "var(--font-manrope, sans-serif)" }}>
                    {tag}
                    <button type="button" onClick={() => setTags(tags.filter((t) => t !== tag))}
                      className="ml-0.5 rounded-full hover:bg-[#c8c8ff] p-0.5 transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {tagInputVisible ? (
                  <input
                    autoFocus
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault()
                        const val = tagInput.trim()
                        if (val && !tags.includes(val)) setTags([...tags, val])
                        setTagInput("")
                        setTagInputVisible(false)
                      } else if (e.key === "Escape") {
                        setTagInput("")
                        setTagInputVisible(false)
                      }
                    }}
                    onBlur={() => {
                      const val = tagInput.trim()
                      if (val && !tags.includes(val)) setTags([...tags, val])
                      setTagInput("")
                      setTagInputVisible(false)
                    }}
                    placeholder={t("new_project.tag_placeholder")}
                    className="px-3 py-1 rounded-full bg-[#f1efff] border border-primary/30 focus:border-primary outline-none text-xs w-28 transition-all"
                    style={{ fontFamily: "var(--font-manrope, sans-serif)" }}
                  />
                ) : (
                  <button type="button" onClick={() => setTagInputVisible(true)}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#f1efff] text-muted-foreground text-xs hover:bg-[#e6e6ff] hover:text-foreground transition-colors"
                    style={{ fontFamily: "var(--font-manrope, sans-serif)" }}>
                    <Plus className="h-3 w-3" />{t("new_project.add_tag")}
                  </button>
                )}
              </div>
            </section>

            {/* Cover image */}
            <section className="space-y-3">
              <label className="font-bold text-foreground text-base block" style={{ fontFamily: "var(--font-manrope, sans-serif)" }}>
                {t("new_project.cover_label")}
              </label>
              <div className="flex flex-col items-center gap-3">
                {/* Square cover preview */}
                <div className="relative w-48 h-48 rounded-2xl overflow-hidden bg-[#f1efff]">
                  {coverPreview && coverPreview !== "__generate__" && (
                    <img src={coverPreview} alt="cover" className="absolute inset-0 w-full h-full object-cover" />
                  )}
                  {generatingCover && (
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 to-purple-400/10 flex flex-col items-center justify-center gap-3">
                      <Wand2 className="h-8 w-8 text-primary animate-pulse" />
                      <span className="text-xs font-semibold text-primary" style={{ fontFamily: "var(--font-manrope, sans-serif)" }}>{t("new_project.generating_cover")}</span>
                      <div className="flex gap-1">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce"
                            style={{ animationDelay: `${i * 150}ms` }} />
                        ))}
                      </div>
                    </div>
                  )}
                  {!coverPreview && !generatingCover && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
                      <div className="rounded-2xl bg-muted-foreground/10 p-4">
                        <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                      <span className="text-xs text-muted-foreground/50 leading-relaxed" style={{ fontFamily: "var(--font-manrope, sans-serif)" }}>
                        {t("new_project.cover_hint_short")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Buttons below the square */}
                <div className="flex items-center gap-2">
                  <button type="button"
                    disabled={!aiTitle.trim() || generatingCover}
                    onClick={async () => {
                      setCoverFile(null); setCoverPreview(null)
                      setGeneratingCover(true)
                      try {
                        const res = await gateway.generateCoverPreview({ title: aiTitle, description: aiDescription })
                        const fullUrl = `${process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:18820"}${res.url}`
                        setCoverPreview(fullUrl)
                      } catch { /* ignore */ }
                      finally { setGeneratingCover(false) }
                    }}
                    className="flex items-center gap-1.5 text-xs bg-white border border-border/60 px-4 py-2 rounded-xl text-primary hover:bg-primary/5 transition-colors font-semibold disabled:opacity-40 disabled:cursor-not-allowed" style={{ fontFamily: "var(--font-manrope, sans-serif)" }}>
                    <Wand2 className="h-3.5 w-3.5" />{coverPreview ? t("new_project.regenerate") : t("new_project.ai_generate_cover")}
                  </button>
                  <label htmlFor="new-cover-input"
                    className="flex items-center gap-1.5 text-xs bg-white border border-border/60 px-4 py-2 rounded-xl text-foreground hover:bg-secondary/60 transition-colors font-semibold cursor-pointer" style={{ fontFamily: "var(--font-manrope, sans-serif)" }}>
                    <Upload className="h-3.5 w-3.5" />{t("new_project.upload_image")}
                  </label>
                  <input type="file" accept="image/*" className="hidden" id="new-cover-input"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setCoverFile(file)
                      setCoverPreview(URL.createObjectURL(file))
                    }} />
                  {coverPreview && (
                    <button type="button" onClick={() => { setCoverFile(null); setCoverPreview(null) }}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-2" style={{ fontFamily: "var(--font-manrope, sans-serif)" }}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* CTA */}
            <div className="pt-4">
              <button onClick={handleAiGenerate} disabled={!aiTitle.trim() || !aiDescription.trim()}
                className="group relative w-full py-4 bg-primary text-white font-extrabold text-base rounded-2xl overflow-hidden transition-all hover:opacity-90 active:scale-[0.99] shadow-[0_8px_32px_0_rgba(106,28,246,0.30)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                style={{ fontFamily: "var(--font-manrope, sans-serif)" }}>
                {t("new_project.generate")}
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

          </div>
        )}

        {/* ── JSON mode ── */}
        {inputMode === "json" && (
          <div className="space-y-6">
            <div
              className={`rounded-3xl p-10 text-center transition-all duration-300 cursor-pointer border-2 border-dashed ${
                dragOver ? "border-primary bg-primary/5" : "border-[#d9daff] bg-white/60 hover:bg-white/80"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <FileJson className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-4 font-[var(--font-manrope)]">{t("new_project.drag_json")}</p>
              <input type="file" accept=".json" className="hidden" id="file-input"
                onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file) }} />
              <label htmlFor="file-input"
                className="cursor-pointer inline-flex h-10 px-6 items-center justify-center rounded-full bg-primary/10 hover:bg-primary/15 text-primary text-sm font-semibold font-[var(--font-manrope)] transition-all">
                {t("new_project.select_file")}
              </label>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2 font-[var(--font-manrope)]">{t("new_project.or_paste")}</p>
              <textarea
                className="w-full h-36 px-4 py-3 rounded-2xl bg-white/70 font-mono text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 border border-white/50"
                placeholder='{"milestones": [...]}'
                value={rawJson}
                onChange={(e) => setRawJson(e.target.value)}
              />
              <button onClick={handlePaste}
                className="mt-2 inline-flex h-9 px-4 items-center rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white transition-colors">
                {t("new_project.parse_json")}
              </button>
            </div>

            {treeData && (
              <div className="flex items-center justify-between pt-2">
                <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-[var(--font-manrope)] font-semibold">
                  <Check className="h-4 w-4" />{t("new_project.json_parsed")}
                </span>
                <button onClick={handlePreview}
                  className="h-10 px-6 rounded-full bg-primary text-white text-sm font-semibold font-[var(--font-manrope)] flex items-center gap-2 shadow-[0_2px_12px_0_rgba(106,28,246,0.25)] hover:shadow-[0_4px_20px_0_rgba(106,28,246,0.35)] transition-all">
                  <Eye className="h-4 w-4" />{t("new_project.preview_tree")}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

// ── Step Indicator Component ────────────────────────────────────────────────
// ── Growing Knowledge Tree Animation ────────────────────────────────────────
function GrowingTreeAnimation({ step }: { step: number }) {
  // Tree branches defined as SVG paths with staggered animation delays
  // Root trunk + 3 levels of branches that grow one by one
  const branches = [
    // trunk
    { d: "M120,220 L120,160", delay: 0, width: 4 },
    // level 1
    { d: "M120,160 L80,120", delay: 0.3, width: 3 },
    { d: "M120,160 L160,120", delay: 0.5, width: 3 },
    // level 2 left
    { d: "M80,120 L55,90", delay: 0.8, width: 2.5 },
    { d: "M80,120 L95,85", delay: 1.0, width: 2.5 },
    // level 2 right
    { d: "M160,120 L145,85", delay: 1.2, width: 2.5 },
    { d: "M160,120 L185,90", delay: 1.4, width: 2.5 },
    // level 3
    { d: "M55,90 L40,65", delay: 1.7, width: 2 },
    { d: "M55,90 L65,62", delay: 1.9, width: 2 },
    { d: "M95,85 L85,60", delay: 2.1, width: 2 },
    { d: "M95,85 L108,58", delay: 2.3, width: 2 },
    { d: "M145,85 L132,58", delay: 2.5, width: 2 },
    { d: "M145,85 L155,60", delay: 2.7, width: 2 },
    { d: "M185,90 L175,62", delay: 2.9, width: 2 },
    { d: "M185,90 L200,65", delay: 3.1, width: 2 },
  ]

  // Leaf nodes (circles) at branch tips
  const leaves = [
    { cx: 40, cy: 65, r: 7, delay: 2.0 },
    { cx: 65, cy: 62, r: 6, delay: 2.2 },
    { cx: 85, cy: 60, r: 7, delay: 2.4 },
    { cx: 108, cy: 58, r: 6, delay: 2.6 },
    { cx: 132, cy: 58, r: 7, delay: 2.8 },
    { cx: 155, cy: 60, r: 6, delay: 3.0 },
    { cx: 175, cy: 62, r: 7, delay: 3.2 },
    { cx: 200, cy: 65, r: 6, delay: 3.4 },
  ]

  return (
    <div className="relative w-64 h-56">
      <style>{`
        @keyframes grow-branch {
          from { stroke-dashoffset: 200; opacity: 0; }
          to   { stroke-dashoffset: 0;   opacity: 1; }
        }
        @keyframes pop-leaf {
          0%   { transform: scale(0); opacity: 0; }
          60%  { transform: scale(1.3); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes pulse-leaf {
          0%, 100% { opacity: 0.85; }
          50%       { opacity: 1; }
        }
        .tree-branch {
          stroke-dasharray: 200;
          stroke-dashoffset: 200;
          animation: grow-branch 0.6s ease-out forwards;
        }
        .tree-leaf {
          transform-origin: center;
          transform: scale(0);
          opacity: 0;
          animation: pop-leaf 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards,
                     pulse-leaf 2s ease-in-out 0.4s infinite;
        }
      `}</style>
      <svg viewBox="0 0 240 230" className="w-full h-full" fill="none">
        <defs>
          <linearGradient id="branch-grad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#6a1cf6" />
            <stop offset="100%" stopColor="#ac8eff" />
          </linearGradient>
          <radialGradient id="leaf-grad">
            <stop offset="0%" stopColor="#c4b5fd" />
            <stop offset="100%" stopColor="#6a1cf6" />
          </radialGradient>
        </defs>
        {/* Ground line */}
        <ellipse cx="120" cy="222" rx="40" ry="4" fill="#6a1cf6" opacity="0.12" />
        {/* Branches */}
        {branches.map((b, i) => (
          <path
            key={i}
            d={b.d}
            className="tree-branch"
            stroke="url(#branch-grad)"
            strokeWidth={b.width}
            strokeLinecap="round"
            style={{ animationDelay: `${b.delay}s`, animationIterationCount: step >= 2 ? "infinite" : "1" }}
          />
        ))}
        {/* Leaves */}
        {leaves.map((l, i) => (
          <circle
            key={i}
            cx={l.cx}
            cy={l.cy}
            r={l.r}
            fill="url(#leaf-grad)"
            className="tree-leaf"
            style={{ animationDelay: `${l.delay}s`, transformOrigin: `${l.cx}px ${l.cy}px` }}
          />
        ))}
      </svg>
      {/* Glow under tree */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-24 h-6 rounded-full bg-primary/10 blur-xl" />
    </div>
  )
}

// ── Step Indicator Component ─────────────────────────────────────────────────
function StepIndicator({ steps, currentIndex }: { steps: { key: string; label: string }[]; currentIndex: number }) {
  return (
    <div className="flex items-center justify-between max-w-sm mx-auto relative">
      {/* connector line */}
      <div className="absolute top-5 left-0 w-full h-0.5 bg-[#e6e6ff] -z-0" />
      {steps.map((s, i) => {
        const isDone = i < currentIndex
        const isActive = i === currentIndex
        return (
          <div key={s.key} className="relative z-10 flex flex-col items-center gap-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ring-8 ring-[#f8f5ff] transition-all duration-300 ${
              isActive ? "bg-primary text-white" : isDone ? "bg-emerald-500 text-white" : "bg-[#e0e0ff] text-[#4953ac]"
            }`}>
              {isDone ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-xs font-bold font-[var(--font-manrope)] ${isActive ? "text-primary" : "text-muted-foreground"}`}>
              {s.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
