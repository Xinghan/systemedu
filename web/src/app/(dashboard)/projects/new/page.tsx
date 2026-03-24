"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import {
  FileJson, Eye, Check, AlertCircle, ArrowLeft, ArrowRight,
  Sparkles, Upload, Brain, ImageIcon, Wand2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { TreeFlow } from "@/components/knowledge-tree/tree-flow"
import { gateway } from "@/lib/api"
import type { TreePreviewResponse } from "@/lib/types/api"
import { useT } from "@/lib/hooks/use-t"

type Step = "input" | "preview" | "confirm"

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

  // AI form state
  const [aiTitle, setAiTitle] = useState("")
  const [aiDescription, setAiDescription] = useState("")
  const [aiAge, setAiAge] = useState(12)
  const [aiNodeCount, setAiNodeCount] = useState(20)

  // Cover image state
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [generatingCover, setGeneratingCover] = useState(false)

  const STEPS = [
    { key: "input" as Step, label: t("new_project.step_setup") },
    { key: "preview" as Step, label: t("new_project.step_preview") },
    { key: "confirm" as Step, label: t("new_project.step_confirm") },
  ]

  const handleFile = useCallback((file: File) => {
    setError("")
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      setRawJson(text)
      try {
        setTreeData(JSON.parse(text))
      } catch {
        setError(t("new_project.parse_json") + " failed")
      }
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
    try {
      setTreeData(JSON.parse(rawJson))
    } catch {
      setError(t("new_project.parse_json") + " failed")
    }
  }, [rawJson, t])

  const handlePreview = useCallback(async () => {
    if (!treeData) return
    setLoading(true); setLoadingLabel(t("new_project.generating_label")); setLoadingStep(0); setError("")
    try {
      const result = await gateway.previewTree(treeData)
      setPreview(result)
      if (result.valid) {
        const metaTitle = result.meta?.title as string
        if (metaTitle) setProjectTitle(metaTitle)
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
      setStep("preview")
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI generation failed, please retry")
    } finally {
      clearTimeout(stepTimer1); clearTimeout(stepTimer2)
      setLoading(false)
    }
  }, [aiTitle, aiDescription, aiAge, aiNodeCount, t])

  const handleCreate = useCallback(async () => {
    if (!treeData || !projectName.trim()) return
    setLoading(true); setLoadingLabel(t("new_project.saving")); setLoadingStep(2); setError("")
    try {
      await gateway.createProject(projectName.trim(), projectTitle.trim(), treeData)
      if (coverFile) {
        try { await gateway.uploadProjectCover(projectName.trim(), coverFile) } catch { /* non-fatal */ }
      } else if (coverPreview === "__generate__") {
        try { await gateway.generateProjectCover(projectName.trim()) } catch { /* non-fatal */ }
      }
      router.push(`/projects/${projectName.trim()}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed")
    } finally {
      setLoading(false)
    }
  }, [treeData, projectName, projectTitle, coverFile, coverPreview, router, t])

  // ── Loading screen ──────────────────────────────────────────────────────────
  if (loading) {
    const LOAD_STEPS = [t("new_project.synthesize"), t("new_project.curate"), t("new_project.architect")]
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-10 px-4">
        <div className="text-center">
          <p className="text-[10px] font-[var(--font-manrope)] uppercase tracking-widest text-muted-foreground mb-2">
            SystemEdu Engine
          </p>
          <h1 className="text-3xl font-extrabold text-foreground">{t("new_project.generating_label")}</h1>
        </div>

        <div className="relative w-44 h-44">
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 176 176">
            <circle cx="88" cy="88" r="80" fill="none" stroke="currentColor" strokeWidth="2" className="text-border" />
            <circle
              cx="88" cy="88" r="80"
              fill="none"
              stroke="url(#ring-gradient)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 80}`}
              strokeDashoffset={`${2 * Math.PI * 80 * (1 - (loadingStep + 1) / 3)}`}
              className="transition-all duration-1000"
            />
            <defs>
              <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="oklch(0.488 0.258 302)" />
                <stop offset="100%" stopColor="oklch(0.660 0.220 302)" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-4 rounded-full bg-gradient-to-br from-violet-600 via-purple-600 to-purple-700 flex items-center justify-center shadow-[0_8px_40px_0_oklch(0.488_0.258_302_/_0.40)]">
            <Brain className="h-14 w-14 text-white/90 animate-pulse" />
          </div>
        </div>

        <div className="w-72 space-y-2">
          <div className="h-1 rounded-full bg-border overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-600 to-purple-400 transition-all duration-700"
              style={{ width: `${((loadingStep + 1) / 3) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-[var(--font-manrope)] uppercase tracking-widest text-muted-foreground">
            <span>{t("new_project.synchronizing")}</span>
            <span>{loadingLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {LOAD_STEPS.map((s, i) => (
            <div
              key={s}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-[var(--font-manrope)] uppercase tracking-wider transition-all duration-500 ${
                i < loadingStep
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                  : i === loadingStep
                    ? "bg-primary/15 text-primary font-semibold"
                    : "bg-secondary text-muted-foreground"
              }`}
            >
              {i < loadingStep && <Check className="h-3 w-3" />}
              {i === loadingStep && <div className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />}
              {s}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Preview step ─────────────────────────────────────────────────────────────
  if (step === "preview" && preview) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <div className="flex items-center gap-6 px-6 py-4 glass-surface shadow-[0_1px_0_0_var(--border)] shrink-0">
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex items-center gap-2">
                {i > 0 && <div className="w-5 h-px bg-border" />}
                <span className={`text-xs font-[var(--font-manrope)] px-3 py-1 rounded-full ${
                  step === s.key
                    ? "bg-primary text-primary-foreground"
                    : i < STEPS.findIndex((x) => x.key === step)
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                      : "bg-secondary text-secondary-foreground"
                }`}>
                  {i + 1}. {s.label}
                </span>
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
            <button
              onClick={() => setStep("confirm")}
              className="h-9 px-5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold flex items-center gap-2 shadow-[0_2px_12px_0_oklch(0.488_0.258_302_/_0.25)] hover:shadow-[0_4px_20px_0_oklch(0.488_0.258_302_/_0.35)] transition-all duration-[350ms]"
            >
              {t("new_project.confirm_create")}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <TreeFlow milestones={preview.milestones} progress={[]} />
        </div>
      </div>
    )
  }

  // ── Main layout ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 min-h-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-8 py-5 shadow-[0_1px_0_0_var(--border)] glass-surface">
          <button onClick={() => router.push("/projects")} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("project.back_library")}
          </button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex items-center gap-2">
                {i > 0 && <div className="w-5 h-px bg-border" />}
                <span className={`text-[11px] font-[var(--font-manrope)] px-2.5 py-1 rounded-full ${
                  step === s.key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                }`}>
                  {i + 1}. {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Form content */}
        <div className="flex-1 overflow-y-auto px-8 py-10">
          <div className="max-w-xl">
            <p className="text-[10px] font-[var(--font-manrope)] uppercase tracking-widest text-primary mb-1">
              {t("new_project.configuration")}
            </p>
            <h1 className="text-2xl font-extrabold text-foreground mb-8">{t("new_project.project_details")}</h1>

            {error && (
              <div className="flex items-start gap-3 p-4 mb-6 rounded-xl bg-destructive/8 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Step 1: Input */}
            {step === "input" && (
              <Tabs defaultValue={0}>
                <TabsList className="mb-6 bg-secondary rounded-xl p-1">
                  <TabsTrigger value={0} className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />{t("new_project.ai_generate")}
                  </TabsTrigger>
                  <TabsTrigger value={1} className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
                    <Upload className="h-3.5 w-3.5 mr-1.5" />{t("new_project.upload_json")}
                  </TabsTrigger>
                </TabsList>

                {/* AI Generate */}
                <TabsContent value={0}>
                  <div className="space-y-5">
                    <div>
                      <Label htmlFor="ai-title" className="text-[11px] font-[var(--font-manrope)] uppercase tracking-wider text-muted-foreground">
                        {t("new_project.project_title")}
                      </Label>
                      <Input
                        id="ai-title"
                        placeholder={t("new_project.title_placeholder")}
                        value={aiTitle}
                        onChange={(e) => setAiTitle(e.target.value)}
                        className="mt-2 border-0 bg-secondary/60 focus:bg-card h-12"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="ai-age" className="text-[11px] font-[var(--font-manrope)] uppercase tracking-wider text-muted-foreground">
                          {t("new_project.student_age")}
                        </Label>
                        <select
                          id="ai-age"
                          value={aiAge}
                          onChange={(e) => setAiAge(Number(e.target.value))}
                          className="w-full mt-2 h-12 px-4 rounded-xl bg-secondary/60 text-sm focus:outline-none focus:ring-2 focus:ring-ring border-0 appearance-none"
                        >
                          {[6,7,8,9,10,11,12,13,14,15,16,17,18].map((a) => (
                            <option key={a} value={a}>{t("new_project.age_years", { a })}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label className="text-[11px] font-[var(--font-manrope)] uppercase tracking-wider text-muted-foreground">
                          {t("new_project.complexity")}
                        </Label>
                        <div className="flex items-center gap-2 mt-2">
                          {[
                            { v: 15, key: "Core" as const },
                            { v: 50, key: "Deep" as const },
                            { v: 200, key: "Expert" as const },
                          ].map((opt) => (
                            <button
                              key={opt.key}
                              onClick={() => setAiNodeCount(opt.v)}
                              className={`flex-1 h-12 rounded-xl text-xs font-[var(--font-manrope)] font-semibold uppercase tracking-wider transition-all duration-[350ms] ${
                                (opt.key === "Core" && aiNodeCount <= 25)
                                  ? "bg-secondary text-secondary-foreground"
                                  : (opt.key === "Deep" && aiNodeCount > 25 && aiNodeCount <= 100)
                                    ? "bg-primary text-primary-foreground shadow-[0_2px_12px_0_oklch(0.488_0.258_302_/_0.25)]"
                                    : (opt.key === "Expert" && aiNodeCount > 100)
                                      ? "bg-primary text-primary-foreground shadow-[0_2px_12px_0_oklch(0.488_0.258_302_/_0.25)]"
                                      : "bg-secondary text-muted-foreground"
                              }`}
                            >
                              {t(`new_project.${opt.key.toLowerCase()}` as Parameters<typeof t>[0])}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="ai-desc" className="text-[11px] font-[var(--font-manrope)] uppercase tracking-wider text-muted-foreground">
                        {t("new_project.desc_objectives")}
                      </Label>
                      <textarea
                        id="ai-desc"
                        className="w-full h-28 px-4 py-3 rounded-xl bg-secondary/60 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring mt-2 border-0"
                        placeholder={t("new_project.desc_placeholder")}
                        value={aiDescription}
                        onChange={(e) => setAiDescription(e.target.value)}
                      />
                    </div>

                    {/* Cover image */}
                    <div>
                      <Label className="text-[11px] font-[var(--font-manrope)] uppercase tracking-wider text-muted-foreground">
                        {t("new_project.cover_image")}
                      </Label>
                      <div className="mt-2 flex items-center gap-4">
                        <div className="w-28 h-20 rounded-xl overflow-hidden bg-secondary/60 shrink-0 flex items-center justify-center border border-border/40">
                          {coverPreview && coverPreview !== "__generate__" ? (
                            <img src={coverPreview} alt="cover" className="w-full h-full object-cover" />
                          ) : coverPreview === "__generate__" ? (
                            <div className="flex flex-col items-center gap-1.5 text-primary">
                              <Wand2 className="h-5 w-5" />
                              <span className="text-[9px] font-[var(--font-manrope)] uppercase tracking-wider">AI</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                              <ImageIcon className="h-5 w-5" />
                              <span className="text-[9px] font-[var(--font-manrope)] uppercase tracking-wider">{t("new_project.cover_default")}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            disabled={generatingCover || !aiTitle.trim()}
                            onClick={async () => {
                              if (!aiTitle.trim()) return
                              setGeneratingCover(true)
                              try {
                                setCoverPreview("__generate__")
                              } finally {
                                setGeneratingCover(false)
                              }
                            }}
                            className="inline-flex h-9 px-4 items-center gap-2 rounded-xl bg-primary/10 hover:bg-primary/15 text-primary text-xs font-medium transition-colors w-fit disabled:opacity-50"
                          >
                            <Wand2 className="h-3.5 w-3.5" />
                            {coverPreview === "__generate__" ? t("new_project.will_generate") : t("new_project.ai_generate_cover")}
                          </button>
                          <div className="flex items-center gap-2">
                            <input type="file" accept="image/*" className="hidden" id="new-cover-input"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (!file) return
                                setCoverFile(file)
                                setCoverPreview(URL.createObjectURL(file))
                              }}
                            />
                            <label htmlFor="new-cover-input" className="cursor-pointer inline-flex h-9 px-4 items-center gap-2 rounded-xl bg-secondary hover:bg-secondary/80 text-xs font-medium transition-colors w-fit">
                              <Upload className="h-3.5 w-3.5" />
                              {coverFile ? t("new_project.change_image") : t("new_project.upload_image")}
                            </label>
                            {(coverFile || coverPreview) && (
                              <button type="button" onClick={() => { setCoverFile(null); setCoverPreview(null) }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                                {t("new_project.reset")}
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {coverPreview === "__generate__"
                              ? t("new_project.cover_will_generate")
                              : coverFile
                                ? t("new_project.cover_uploaded")
                                : t("new_project.cover_default_hint")}
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleAiGenerate}
                      disabled={!aiTitle.trim() || !aiDescription.trim()}
                      className="w-full h-14 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-[0_2px_20px_0_oklch(0.488_0.258_302_/_0.30)] hover:shadow-[0_4px_28px_0_oklch(0.488_0.258_302_/_0.40)] transition-all duration-[350ms] [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Sparkles className="h-4 w-4" />
                      {t("new_project.generate")}
                    </button>
                    <p className="text-xs text-center text-muted-foreground">
                      {t("new_project.ai_hint")}
                    </p>
                  </div>
                </TabsContent>

                {/* Upload JSON */}
                <TabsContent value={1}>
                  <div className="space-y-4">
                    <div
                      className={`rounded-xl p-8 text-center transition-all duration-[350ms] cursor-pointer ${
                        dragOver ? "bg-primary/8 ring-2 ring-primary" : "bg-secondary/60 hover:bg-secondary"
                      }`}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                    >
                      <FileJson className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mb-3">
                        {t("new_project.drag_json")}
                      </p>
                      <input
                        type="file" accept=".json" className="hidden" id="file-input"
                        onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file) }}
                      />
                      <label htmlFor="file-input" className="cursor-pointer inline-flex h-10 px-5 items-center justify-center rounded-xl bg-card text-sm font-medium shadow-card hover:shadow-card-hover transition-all duration-[350ms]">
                        {t("new_project.select_file")}
                      </label>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground mb-2">{t("new_project.or_paste")}</p>
                      <textarea
                        className="w-full h-36 px-4 py-3 rounded-xl bg-secondary/60 font-mono text-xs resize-none focus:outline-none focus:ring-2 focus:ring-ring border-0"
                        placeholder='{"milestones": [...]}'
                        value={rawJson}
                        onChange={(e) => setRawJson(e.target.value)}
                      />
                      <Button variant="outline" size="sm" className="mt-2" onClick={handlePaste}>
                        {t("new_project.parse_json")}
                      </Button>
                    </div>

                    {treeData && (
                      <div className="flex items-center justify-between pt-2">
                        <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                          <Check className="h-3.5 w-3.5" />{t("new_project.json_parsed")}
                        </span>
                        <button
                          onClick={handlePreview}
                          className="h-9 px-5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-xs font-semibold flex items-center gap-2 shadow-[0_2px_12px_0_oklch(0.488_0.258_302_/_0.25)] hover:shadow-[0_4px_20px_0_oklch(0.488_0.258_302_/_0.35)] transition-all duration-[350ms]"
                        >
                          <Eye className="h-3.5 w-3.5" />{t("new_project.preview_tree")}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            )}

            {/* Step 3: Confirm */}
            {step === "confirm" && (
              <div className="space-y-5">
                {(coverPreview || coverFile) && coverPreview !== "__generate__" && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
                    <img src={coverPreview!} alt="cover" className="w-16 h-12 rounded-lg object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{coverFile?.name}</p>
                      <button onClick={() => { setCoverFile(null); setCoverPreview(null) }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                        {t("new_project.remove")}
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="proj-name" className="text-[11px] font-[var(--font-manrope)] uppercase tracking-wider text-muted-foreground">
                    {t("new_project.slug_label")}
                  </Label>
                  <Input
                    id="proj-name"
                    placeholder={t("new_project.slug_placeholder")}
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value.replace(/[^a-z0-9-]/g, ""))}
                    className="mt-2 border-0 bg-secondary/60 focus:bg-card h-12"
                  />
                </div>
                <div>
                  <Label htmlFor="proj-title" className="text-[11px] font-[var(--font-manrope)] uppercase tracking-wider text-muted-foreground">
                    {t("new_project.project_title")}
                  </Label>
                  <Input
                    id="proj-title"
                    value={projectTitle}
                    onChange={(e) => setProjectTitle(e.target.value)}
                    className="mt-2 border-0 bg-secondary/60 focus:bg-card h-12"
                  />
                </div>
                {preview && (
                  <p className="text-xs text-muted-foreground">
                    {t("new_project.confirm_desc", { m: preview.stats.milestone_count, n: preview.stats.node_count })}
                  </p>
                )}
                <div className="flex justify-between pt-2">
                  <Button variant="outline" onClick={() => setStep("preview")}>
                    <ArrowLeft className="h-4 w-4 mr-1.5" />{t("new_project.back")}
                  </Button>
                  <button
                    onClick={handleCreate}
                    disabled={!projectName.trim()}
                    className="h-11 px-6 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold flex items-center gap-2 shadow-[0_2px_16px_0_oklch(0.488_0.258_302_/_0.30)] hover:shadow-[0_4px_24px_0_oklch(0.488_0.258_302_/_0.40)] transition-all duration-[350ms] disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />{t("new_project.create")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
    </div>
  )
}
