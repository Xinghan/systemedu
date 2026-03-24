"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import {
  FileJson, Eye, Check, AlertCircle, ArrowLeft, ArrowRight,
  Sparkles, Upload, Brain,
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

const STEPS: { key: Step; label: string }[] = [
  { key: "input", label: "Setup" },
  { key: "preview", label: "Preview" },
  { key: "confirm", label: "Confirm" },
]

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

  const handleFile = useCallback((file: File) => {
    setError("")
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      setRawJson(text)
      try {
        setTreeData(JSON.parse(text))
      } catch {
        setError("JSON parse failed, please check file format")
      }
    }
    reader.readAsText(file)
  }, [])

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
      setError("JSON parse failed, please check format")
    }
  }, [rawJson])

  const handlePreview = useCallback(async () => {
    if (!treeData) return
    setLoading(true); setLoadingLabel("Validating knowledge tree..."); setLoadingStep(0); setError("")
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
  }, [treeData])

  const handleAiGenerate = useCallback(async () => {
    if (!aiTitle.trim() || !aiDescription.trim()) return
    setLoading(true); setError("")
    setLoadingLabel("AI is generating your knowledge tree...")
    // Simulate step progression
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
  }, [aiTitle, aiDescription, aiAge, aiNodeCount])

  const handleCreate = useCallback(async () => {
    if (!treeData || !projectName.trim()) return
    setLoading(true); setLoadingLabel("Creating project..."); setLoadingStep(2); setError("")
    try {
      await gateway.createProject(projectName.trim(), projectTitle.trim(), treeData)
      router.push(`/projects/${projectName.trim()}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed")
    } finally {
      setLoading(false)
    }
  }, [treeData, projectName, projectTitle, router])

  // ── Loading screen ──────────────────────────────────────────────────────────
  if (loading) {
    const LOAD_STEPS = [t("new_project.synthesize"), t("new_project.curate"), t("new_project.architect")]
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-10 px-4">
        {/* Header label */}
        <div className="text-center">
          <p className="text-[10px] font-[var(--font-manrope)] uppercase tracking-widest text-muted-foreground mb-2">
            SystemEdu Engine
          </p>
          <h1 className="text-3xl font-extrabold text-foreground">Generating...</h1>
        </div>

        {/* Animated circle */}
        <div className="relative w-44 h-44">
          {/* Outer ring */}
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
          {/* Inner gradient circle */}
          <div className="absolute inset-4 rounded-full bg-gradient-to-br from-violet-600 via-purple-600 to-purple-700 flex items-center justify-center shadow-[0_8px_40px_0_oklch(0.488_0.258_302_/_0.40)]">
            <Brain className="h-14 w-14 text-white/90 animate-pulse" />
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-72 space-y-2">
          <div className="h-1 rounded-full bg-border overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-600 to-purple-400 transition-all duration-700"
              style={{ width: `${((loadingStep + 1) / 3) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-[var(--font-manrope)] uppercase tracking-widest text-muted-foreground">
            <span>Synchronizing</span>
            <span>{loadingLabel}</span>
          </div>
        </div>

        {/* Step indicators */}
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
        {/* Stats bar */}
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
              { v: preview.stats.milestone_count, l: "Modules" },
              { v: preview.stats.node_count, l: "Nodes" },
              { v: preview.stats.total_minutes, l: "Minutes" },
              { v: `~${preview.stats.estimated_hours}h`, l: "Study Time" },
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
              Confirm & Create
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
          {/* Step indicator */}
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
          {/* CONFIGURATION header */}
          <div className="max-w-xl">
            <p className="text-[10px] font-[var(--font-manrope)] uppercase tracking-widest text-primary mb-1">Configuration</p>
            <h1 className="text-2xl font-extrabold text-foreground mb-8">Project Details</h1>

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
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />AI Generate
                  </TabsTrigger>
                  <TabsTrigger value={1} className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
                    <Upload className="h-3.5 w-3.5 mr-1.5" />Upload JSON
                  </TabsTrigger>
                </TabsList>

                {/* AI Generate */}
                <TabsContent value={0}>
                  <div className="space-y-5">
                    <div>
                      <Label htmlFor="ai-title" className="text-[11px] font-[var(--font-manrope)] uppercase tracking-wider text-muted-foreground">
                        Project Title
                      </Label>
                      <Input
                        id="ai-title"
                        placeholder="e.g. Quantum Mechanics for Beginners"
                        value={aiTitle}
                        onChange={(e) => setAiTitle(e.target.value)}
                        className="mt-2 border-0 bg-secondary/60 focus:bg-card h-12"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="ai-age" className="text-[11px] font-[var(--font-manrope)] uppercase tracking-wider text-muted-foreground">
                          Student Age
                        </Label>
                        <select
                          id="ai-age"
                          value={aiAge}
                          onChange={(e) => setAiAge(Number(e.target.value))}
                          className="w-full mt-2 h-12 px-4 rounded-xl bg-secondary/60 text-sm focus:outline-none focus:ring-2 focus:ring-ring border-0 appearance-none"
                        >
                          {[6,7,8,9,10,11,12,13,14,15,16,17,18].map((a) => (
                            <option key={a} value={a}>{a} years</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label className="text-[11px] font-[var(--font-manrope)] uppercase tracking-wider text-muted-foreground">
                          Complexity
                        </Label>
                        <div className="flex items-center gap-2 mt-2">
                          {[
                            { v: 15, l: "Core" },
                            { v: 50, l: "Deep" },
                            { v: 200, l: "Expert" },
                          ].map((opt) => (
                            <button
                              key={opt.l}
                              onClick={() => setAiNodeCount(opt.v)}
                              className={`flex-1 h-12 rounded-xl text-xs font-[var(--font-manrope)] font-semibold uppercase tracking-wider transition-all duration-[350ms] ${
                                (opt.l === "Core" && aiNodeCount <= 25)
                                  ? "bg-secondary text-secondary-foreground"
                                  : (opt.l === "Deep" && aiNodeCount > 25 && aiNodeCount <= 100)
                                    ? "bg-primary text-primary-foreground shadow-[0_2px_12px_0_oklch(0.488_0.258_302_/_0.25)]"
                                    : (opt.l === "Expert" && aiNodeCount > 100)
                                      ? "bg-primary text-primary-foreground shadow-[0_2px_12px_0_oklch(0.488_0.258_302_/_0.25)]"
                                      : "bg-secondary text-muted-foreground"
                              }`}
                            >
                              {opt.l}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="ai-desc" className="text-[11px] font-[var(--font-manrope)] uppercase tracking-wider text-muted-foreground">
                        Description & Objectives
                      </Label>
                      <textarea
                        id="ai-desc"
                        className="w-full h-28 px-4 py-3 rounded-xl bg-secondary/60 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring mt-2 border-0"
                        placeholder="What specific goals should the Knowledge Tree focus on?"
                        value={aiDescription}
                        onChange={(e) => setAiDescription(e.target.value)}
                      />
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
                      AI will synthesize a multi-layered curriculum based on your inputs.
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
                        Drag & drop JSON file here, or click to select
                      </p>
                      <input
                        type="file" accept=".json" className="hidden" id="file-input"
                        onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file) }}
                      />
                      <label htmlFor="file-input" className="cursor-pointer inline-flex h-10 px-5 items-center justify-center rounded-xl bg-card text-sm font-medium shadow-card hover:shadow-card-hover transition-all duration-[350ms]">
                        Select File
                      </label>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Or paste JSON</p>
                      <textarea
                        className="w-full h-36 px-4 py-3 rounded-xl bg-secondary/60 font-mono text-xs resize-none focus:outline-none focus:ring-2 focus:ring-ring border-0"
                        placeholder='{"milestones": [...]}'
                        value={rawJson}
                        onChange={(e) => setRawJson(e.target.value)}
                      />
                      <Button variant="outline" size="sm" className="mt-2" onClick={handlePaste}>
                        Parse JSON
                      </Button>
                    </div>

                    {treeData && (
                      <div className="flex items-center justify-between pt-2">
                        <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                          <Check className="h-3.5 w-3.5" />JSON parsed
                        </span>
                        <button
                          onClick={handlePreview}
                          className="h-9 px-5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-xs font-semibold flex items-center gap-2 shadow-[0_2px_12px_0_oklch(0.488_0.258_302_/_0.25)] hover:shadow-[0_4px_20px_0_oklch(0.488_0.258_302_/_0.35)] transition-all duration-[350ms]"
                        >
                          <Eye className="h-3.5 w-3.5" />Preview Tree
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
                <div>
                  <Label htmlFor="proj-name" className="text-[11px] font-[var(--font-manrope)] uppercase tracking-wider text-muted-foreground">
                    Project Slug (lowercase, hyphens)
                  </Label>
                  <Input
                    id="proj-name"
                    placeholder="e.g. rocket-scientist"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value.replace(/[^a-z0-9-]/g, ""))}
                    className="mt-2 border-0 bg-secondary/60 focus:bg-card h-12"
                  />
                </div>
                <div>
                  <Label htmlFor="proj-title" className="text-[11px] font-[var(--font-manrope)] uppercase tracking-wider text-muted-foreground">
                    Project Title
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
                    This will create a project with {preview.stats.milestone_count} modules and {preview.stats.node_count} knowledge nodes.
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
                    <Check className="h-4 w-4" />Create Project
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
    </div>
  )
}
