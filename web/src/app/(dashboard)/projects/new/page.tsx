"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import {
  FileJson, Eye, Check, AlertCircle, ArrowLeft, ArrowRight,
  Sparkles, Brain, ChevronDown, X, Plus, Wand2,
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

  const [generatingDesc, setGeneratingDesc] = useState(false)

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
      // Cover is auto-generated server-side after project creation; no upload needed here
      router.push(`/projects/${slug}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed")
    } finally {
      setLoading(false)
    }
  }, [treeData, projectName, projectTitle, aiDescription, tags, aiAge, router, t])
  // Note: projectName is auto-generated (generateSlug) and stored in state; slug variable is derived inside handleCreate

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (loading) {
    const LOAD_STEPS = [t("new_project.synthesize"), t("new_project.curate"), t("new_project.architect")]
    const COGNITIVE_TIPS = [
      t("new_project.tip_interleave"),
      t("new_project.tip_spaced"),
      t("new_project.tip_retrieval"),
    ]
    const tip = COGNITIVE_TIPS[loadingStep % COGNITIVE_TIPS.length]
    return (
      <div
        className="fixed inset-0 overflow-hidden"
        style={{ background: "#f8f5ff", fontFamily: "var(--font-manrope, sans-serif)" }}
      >
        {/* Dot-grid mesh background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle at 2px 2px, rgba(106,28,246,0.04) 1px, transparent 0)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* Ambient glow blobs */}
        <div className="absolute -top-[10%] -right-[5%] w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: "#6a1cf6", filter: "blur(80px)", opacity: 0.12 }} />
        <div className="absolute -bottom-[10%] -left-[5%] w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: "#006859", filter: "blur(80px)", opacity: 0.12 }} />

        <main className="relative z-10 min-h-screen flex flex-col items-center justify-between py-16 px-6">

          {/* Top brand anchor */}
          <header className="flex flex-col items-center">
            <span className="text-[10px] uppercase tracking-[0.3em] mb-3"
              style={{ color: "#4953ac", fontFamily: "var(--font-manrope, sans-serif)", fontWeight: 500 }}>
              {t("new_project.initializing")}
            </span>
            <h2 className="font-extrabold text-xl tracking-tight"
              style={{ color: "#19227d", fontFamily: "var(--font-headline, 'Plus Jakarta Sans', sans-serif)" }}>
              SystemEdu
            </h2>
          </header>

          {/* Centerpiece */}
          <div className="relative w-full max-w-2xl flex flex-col items-center justify-center">
            {/* Tree container with circular grid backdrop */}
            <div className="relative w-full aspect-square flex items-center justify-center">
              {/* Architectural concentric rings */}
              <div className="absolute inset-0 rounded-full flex items-center justify-center"
                style={{ border: "1px solid rgba(158,166,255,0.12)" }}>
                <div className="w-3/4 h-3/4 rounded-full"
                  style={{ border: "1px solid rgba(158,166,255,0.10)" }} />
                {/* Cross hairs */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-full w-px"
                    style={{ background: "linear-gradient(to bottom, transparent, rgba(158,166,255,0.18), transparent)" }} />
                  <div className="w-full h-px"
                    style={{ background: "linear-gradient(to right, transparent, rgba(158,166,255,0.18), transparent)" }} />
                </div>
              </div>

              {/* Circular progress ring */}
              <svg className="absolute pointer-events-none" style={{ width: 450, height: 450, opacity: 0.22, transform: "rotate(-90deg)" }}>
                <defs>
                  <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6a1cf6" />
                    <stop offset="100%" stopColor="#006859" />
                  </linearGradient>
                </defs>
                <circle cx="225" cy="225" r="210" fill="none" stroke="rgba(158,166,255,0.3)" strokeWidth="1" />
                <circle cx="225" cy="225" r="210" fill="none" stroke="url(#ring-grad)" strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray="1319"
                  strokeDashoffset={1319 - (((loadingStep + 1) / 3) * 1319 * 0.85)}
                  style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.2,0.8,0.2,1)" }} />
              </svg>

              {/* The Knowledge Tree */}
              <div className="relative z-20" style={{ width: 320, height: 380 }}>
                <GrowingTreeAnimation step={loadingStep} />
              </div>
            </div>

            {/* Typography & status */}
            <div className="mt-6 text-center w-full">
              <h1 className="font-extrabold tracking-tight leading-tight"
                style={{
                  fontSize: "clamp(2rem, 5vw, 3.25rem)",
                  color: "#19227d",
                  fontFamily: "var(--font-headline, 'Plus Jakarta Sans', sans-serif)",
                }}>
                {t("new_project.loading_title_1")}<br />
                <span style={{ color: "#6a1cf6", fontStyle: "italic" }}>
                  {t("new_project.loading_title_2")}
                </span>
              </h1>

              <div className="mt-8 flex flex-col items-center gap-6">
                {/* Spinning status label */}
                <div className="flex items-center gap-3"
                  style={{ color: "#4953ac", fontFamily: "var(--font-manrope, sans-serif)", fontSize: 14 }}>
                  <div className="w-4 h-4 rounded-full border-2 border-[#6a1cf6] border-t-transparent animate-spin" />
                  <span>{loadingLabel || t("new_project.synthesizing")}</span>
                </div>

                {/* Status chips */}
                <div className="flex flex-wrap justify-center gap-3">
                  {LOAD_STEPS.map((s, i) => {
                    const isDone = i < loadingStep
                    const isActive = i === loadingStep
                    return (
                      <span key={s}
                        className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest backdrop-blur transition-all duration-500"
                        style={{
                          background: isActive ? "rgba(106,28,246,0.08)" : isDone ? "rgba(0,184,153,0.08)" : "rgba(255,255,255,0.6)",
                          color: isActive ? "#6a1cf6" : isDone ? "#006859" : "#4953ac",
                          border: "1px solid rgba(158,166,255,0.25)",
                        }}>
                        {isDone ? "✓ " : ""}{s}
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Cognitive tip card */}
          <div className="w-full max-w-md rounded-xl p-6 backdrop-blur-xl"
            style={{
              background: "rgba(255,255,255,0.45)",
              border: "1px solid rgba(255,255,255,0.55)",
              boxShadow: "0 4px 24px 0 rgba(106,28,246,0.06)",
            }}>
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg shrink-0"
                style={{ background: "rgba(106,28,246,0.08)" }}>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#6a1cf6" strokeWidth={1.5}>
                  <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
                  <line x1="9" y1="21" x2="15" y2="21" /><line x1="9" y1="18" x2="15" y2="18" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] mb-1"
                  style={{ color: "#4953ac", fontFamily: "var(--font-manrope, sans-serif)", fontWeight: 500 }}>
                  {t("new_project.cognitive_tip")}
                </p>
                <p className="text-sm leading-relaxed" style={{ color: "#19227d" }}>
                  {tip}
                </p>
              </div>
            </div>
          </div>

        </main>
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
                    : i < STEPS.findIndex((x) => x.key === step) ? "bg-cyan-100 text-cyan-700"
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

            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground font-[var(--font-manrope)] block">
                {t("new_project.project_title")}
              </label>
              <Input
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                className="text-base"
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
                <span className="flex items-center gap-1.5 text-sm text-cyan-600 font-[var(--font-manrope)] font-semibold">
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
function GrowingTreeAnimation({ step: _step }: { step: number }) {
  // Organic knowledge tree with bezier curves, 4 levels, root-to-crown growth
  // All paths use cubic bezier for natural branching feel
  const branches: { d: string; delay: number; w: number; opacity?: number }[] = [
    // Root / trunk (thick, grows first)
    { d: "M160,340 C160,310 160,290 160,250", delay: 0.0, w: 6 },
    { d: "M160,250 C160,225 160,210 160,185", delay: 0.35, w: 5 },

    // Level 1 branches
    { d: "M160,220 C140,205 115,195 85,188", delay: 0.7, w: 3.5, opacity: 0.85 },
    { d: "M160,220 C180,205 205,195 235,188", delay: 0.9, w: 3.5, opacity: 0.85 },

    // Level 2 — left subtree
    { d: "M85,188 C72,178 60,165 48,148", delay: 1.2, w: 2.5, opacity: 0.75 },
    { d: "M85,188 C85,172 88,158 92,140", delay: 1.4, w: 2.5, opacity: 0.75 },

    // Level 2 — right subtree
    { d: "M235,188 C235,172 232,158 228,140", delay: 1.5, w: 2.5, opacity: 0.75 },
    { d: "M235,188 C248,178 260,165 272,148", delay: 1.7, w: 2.5, opacity: 0.75 },

    // Level 2 — center (from upper trunk)
    { d: "M160,185 C148,165 138,150 125,130", delay: 1.6, w: 2.5, opacity: 0.75 },
    { d: "M160,185 C172,165 182,150 195,130", delay: 1.8, w: 2.5, opacity: 0.75 },

    // Level 3 — fine tips (left)
    { d: "M48,148 C40,135 35,120 32,104", delay: 2.0, w: 1.8, opacity: 0.6 },
    { d: "M48,148 C52,133 58,120 65,106", delay: 2.15, w: 1.8, opacity: 0.6 },
    { d: "M92,140 C85,125 82,112 82,96", delay: 2.25, w: 1.8, opacity: 0.6 },
    { d: "M92,140 C98,124 105,110 112,96", delay: 2.4, w: 1.8, opacity: 0.6 },

    // Level 3 — center
    { d: "M125,130 C116,114 112,98 110,82", delay: 2.35, w: 1.8, opacity: 0.6 },
    { d: "M125,130 C130,113 138,100 148,86", delay: 2.5, w: 1.8, opacity: 0.6 },
    { d: "M195,130 C192,113 182,100 172,86", delay: 2.55, w: 1.8, opacity: 0.6 },
    { d: "M195,130 C204,113 208,98 210,82", delay: 2.7, w: 1.8, opacity: 0.6 },

    // Level 3 — right
    { d: "M228,140 C218,124 215,110 215,95", delay: 2.45, w: 1.8, opacity: 0.6 },
    { d: "M228,140 C236,124 242,110 248,96", delay: 2.6, w: 1.8, opacity: 0.6 },
    { d: "M272,148 C268,133 265,120 265,105", delay: 2.75, w: 1.8, opacity: 0.6 },
    { d: "M272,148 C278,134 282,120 285,106", delay: 2.9, w: 1.8, opacity: 0.6 },
  ]

  // Knowledge nodes at branch tips — varying size to show hierarchy
  const nodes: { cx: number; cy: number; r: number; delay: number; color: string; pulse: number }[] = [
    // L3 tips — small leaf nodes
    { cx: 32, cy: 104, r: 5, delay: 2.2, color: "#68fadd", pulse: 3.0 },
    { cx: 65, cy: 106, r: 4, delay: 2.35, color: "#ac8eff", pulse: 3.5 },
    { cx: 82, cy: 96, r: 5, delay: 2.45, color: "#68fadd", pulse: 4.0 },
    { cx: 112, cy: 96, r: 4, delay: 2.6, color: "#b8a3ff", pulse: 3.2 },
    { cx: 110, cy: 82, r: 5, delay: 2.55, color: "#ac8eff", pulse: 3.8 },
    { cx: 148, cy: 86, r: 4, delay: 2.7, color: "#68fadd", pulse: 4.2 },
    { cx: 172, cy: 86, r: 4, delay: 2.75, color: "#b8a3ff", pulse: 3.4 },
    { cx: 210, cy: 82, r: 5, delay: 2.9, color: "#ac8eff", pulse: 3.6 },
    { cx: 215, cy: 95, r: 4, delay: 2.65, color: "#68fadd", pulse: 4.4 },
    { cx: 248, cy: 96, r: 5, delay: 2.8, color: "#b8a3ff", pulse: 3.0 },
    { cx: 265, cy: 105, r: 4, delay: 2.95, color: "#ac8eff", pulse: 3.5 },
    { cx: 285, cy: 106, r: 5, delay: 3.1, color: "#68fadd", pulse: 4.0 },
    // Crown apex — main top node
    { cx: 160, cy: 58, r: 8, delay: 3.3, color: "#6a1cf6", pulse: 2.5 },
  ]

  // Extra crown branches reaching to apex
  const crownBranches = [
    { d: "M160,185 C160,150 160,110 160,70", delay: 2.2, w: 3 },
  ]

  return (
    <div className="relative w-full h-full flex items-end justify-center">
      <style>{`
        @keyframes tree-grow {
          from { stroke-dashoffset: 600; opacity: 0; }
          to   { stroke-dashoffset: 0;   opacity: 1; }
        }
        @keyframes node-pop {
          0%   { transform: scale(0); opacity: 0; }
          65%  { transform: scale(1.4); opacity: 1; }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes node-pulse {
          0%, 100% { opacity: 0.7; r: attr(r); }
          50%       { opacity: 1; }
        }
        @keyframes float-particle {
          0%   { transform: translateY(0) scale(1); opacity: 0.6; }
          50%  { transform: translateY(-18px) scale(1.1); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 0.6; }
        }
        .tb {
          stroke-dasharray: 600;
          stroke-dashoffset: 600;
          animation: tree-grow 0.7s cubic-bezier(0.4,0,0.2,1) forwards;
        }
        .tn {
          transform-origin: center;
          transform: scale(0);
          opacity: 0;
          animation: node-pop 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards;
        }
        .tp {
          animation: float-particle 3s ease-in-out infinite;
        }
      `}</style>

      <svg
        viewBox="0 0 320 360"
        className="w-full h-full"
        fill="none"
        style={{ filter: "drop-shadow(0 0 22px rgba(106,28,246,0.22))" }}
      >
        <defs>
          <linearGradient id="tb-grad" x1="0%" y1="100%" x2="30%" y2="0%">
            <stop offset="0%" stopColor="#6a1cf6" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#8b4ff8" />
            <stop offset="100%" stopColor="#ac8eff" stopOpacity="0.7" />
          </linearGradient>
          <radialGradient id="apex-grad" cx="50%" cy="40%">
            <stop offset="0%" stopColor="#b8a3ff" />
            <stop offset="100%" stopColor="#6a1cf6" />
          </radialGradient>
          <radialGradient id="teal-grad" cx="50%" cy="40%">
            <stop offset="0%" stopColor="#a8fff2" />
            <stop offset="100%" stopColor="#006859" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Ground shadow */}
        <ellipse cx="160" cy="348" rx="52" ry="7" fill="#6a1cf6" opacity="0.10" />

        {/* Root anchor dots */}
        <circle cx="148" cy="342" r="2.5" fill="#6a1cf6" opacity="0.25" />
        <circle cx="160" cy="344" r="3" fill="#6a1cf6" opacity="0.30" />
        <circle cx="172" cy="342" r="2.5" fill="#6a1cf6" opacity="0.25" />

        {/* Crown branches (central spine to apex) */}
        {crownBranches.map((b, i) => (
          <path key={`c${i}`} d={b.d} className="tb" stroke="url(#tb-grad)"
            strokeWidth={b.w} strokeLinecap="round"
            style={{ animationDelay: `${b.delay}s` }} />
        ))}

        {/* All branches */}
        {branches.map((b, i) => (
          <path key={i} d={b.d} className="tb" stroke="url(#tb-grad)"
            strokeWidth={b.w} strokeLinecap="round"
            style={{ animationDelay: `${b.delay}s`, opacity: b.opacity ?? 1 }} />
        ))}

        {/* Leaf nodes */}
        {nodes.map((n, i) => (
          <circle key={i} cx={n.cx} cy={n.cy} r={n.r}
            fill={n.color === "#6a1cf6" ? "url(#apex-grad)" : n.color.startsWith("#68") ? "url(#teal-grad)" : "url(#apex-grad)"}
            className="tn"
            filter={n.r >= 7 ? "url(#glow)" : undefined}
            style={{
              animationDelay: `${n.delay}s`,
              transformOrigin: `${n.cx}px ${n.cy}px`,
            }} />
        ))}

        {/* Floating micro-particles around crown */}
        {[
          { cx: 128, cy: 68, r: 2, delay: 3.4, d: 3.2 },
          { cx: 192, cy: 62, r: 1.5, delay: 3.6, d: 4.0 },
          { cx: 145, cy: 44, r: 2.5, delay: 3.8, d: 2.8 },
          { cx: 176, cy: 46, r: 1.8, delay: 4.0, d: 3.6 },
        ].map((p, i) => (
          <circle key={`p${i}`} cx={p.cx} cy={p.cy} r={p.r}
            fill="#ac8eff" opacity="0"
            className="tn tp"
            style={{
              animationDelay: `${p.delay}s`,
              transformOrigin: `${p.cx}px ${p.cy}px`,
              ["--tp-d" as string]: `${p.d}s`,
            }} />
        ))}
      </svg>

      {/* Radial glow beneath tree */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-40 h-10 rounded-full pointer-events-none"
        style={{ background: "rgba(106,28,246,0.12)", filter: "blur(20px)" }} />
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
              isActive ? "bg-primary text-white" : isDone ? "bg-cyan-500 text-white" : "bg-[#e0e0ff] text-[#4953ac]"
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
