"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  CheckCircle, Circle, Upload, FileText, Loader2,
  ChevronDown, ChevronUp, AlertCircle, Send, RotateCcw,
  ClipboardCheck, PenLine, Paperclip, Trophy, XCircle,
} from "lucide-react"
import { gateway } from "@/lib/api"
import type {
  KnodeInfo, NodeProgress, CapstoneSubmissionDetail, CapstoneFeedbackItem,
} from "@/lib/types/api"
import { useT } from "@/lib/hooks/use-t"

interface CapstoneSubmissionPanelProps {
  projectName: string
  nodeId: number
  knode: KnodeInfo
  progress: NodeProgress | null
  onStatusChange?: () => void
}

type Phase = "form" | "grading" | "result"

export function CapstoneSubmissionPanel({
  projectName, nodeId, knode, progress, onStatusChange,
}: CapstoneSubmissionPanelProps) {
  const t = useT()

  const artifacts = knode.acceptance_artifacts ?? []
  const standards = knode.acceptance_standard ?? []

  // Form state
  const [checklist, setChecklist] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {}
    for (const a of artifacts) m[a.artifact_id] = false
    return m
  })
  const [reflections, setReflections] = useState<Record<number, string>>(() => {
    const m: Record<number, string> = {}
    for (let i = 0; i < standards.length; i++) m[i] = ""
    return m
  })
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")

  // Result state
  const [latestResult, setLatestResult] = useState<CapstoneSubmissionDetail | null>(null)
  const [phase, setPhase] = useState<Phase>("form")
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<CapstoneSubmissionDetail[]>([])

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // On mount, check existing submission status
  useEffect(() => {
    gateway.capstoneStatus(projectName, nodeId).then((res) => {
      if (res.status === "graded") {
        gateway.capstoneSubmissions(projectName, nodeId).then((subs) => {
          if (subs.length > 0) {
            setLatestResult(subs[0])
            setHistory(subs)
            setPhase("result")
          }
        })
      } else if (res.status === "submitted" || res.status === "grading") {
        setPhase("grading")
        startPolling()
      }
    }).catch(() => {})
    return () => stopPolling()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectName, nodeId])

  const startPolling = useCallback(() => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const res = await gateway.capstoneStatus(projectName, nodeId)
        if (res.status === "graded") {
          stopPolling()
          const subs = await gateway.capstoneSubmissions(projectName, nodeId)
          if (subs.length > 0) {
            setLatestResult(subs[0])
            setHistory(subs)
          }
          setPhase("result")
          onStatusChange?.()
        }
      } catch {}
    }, 3000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectName, nodeId, onStatusChange])

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const allChecked = artifacts.length === 0 || artifacts.every((a) => checklist[a.artifact_id])
  const allReflections = standards.every((_, i) => (reflections[i] ?? "").trim().length >= 10)
  const canSubmit = allReflections && !uploading

  async function handleSubmit() {
    setError("")
    setUploading(true)
    try {
      const checklistArr = artifacts.map((a) => ({
        artifact_id: a.artifact_id,
        title: a.title,
        checked: !!checklist[a.artifact_id],
      }))
      const reflectionsArr = standards.map((_, i) => ({
        criterion_idx: i,
        description: reflections[i] ?? "",
      }))
      await gateway.submitCapstone(projectName, nodeId, file, checklistArr, reflectionsArr)
      setPhase("grading")
      startPolling()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(false)
    }
  }

  function resetForm() {
    const m: Record<string, boolean> = {}
    for (const a of artifacts) m[a.artifact_id] = false
    setChecklist(m)
    const r: Record<number, string> = {}
    for (let i = 0; i < standards.length; i++) r[i] = ""
    setReflections(r)
    setFile(null)
    setError("")
    setPhase("form")
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) setFile(f)
  }

  // =========================================================================
  // PHASE: FORM
  // =========================================================================
  if (phase === "form") {
    return (
      <div className="mt-8 space-y-5">
        {/* Section header */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
            <Send className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold font-[var(--font-manrope)] text-foreground">
              {t("capstone.submit_title")}
            </h3>
          </div>
        </div>

        {/* Deliverable checklist */}
        {artifacts.length > 0 && (
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40 bg-secondary/30">
              <ClipboardCheck className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold font-[var(--font-manrope)] text-foreground">
                {t("capstone.checklist")}
              </span>
              <span className="text-[10px] text-muted-foreground ml-auto">
                {t("capstone.checklist_hint")}
              </span>
            </div>
            <div className="divide-y divide-border/30">
              {artifacts.map((a) => (
                <button
                  key={a.artifact_id}
                  type="button"
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-secondary/30 transition-colors"
                  onClick={() => setChecklist((prev) => ({ ...prev, [a.artifact_id]: !prev[a.artifact_id] }))}
                >
                  {checklist[a.artifact_id]
                    ? <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    : <Circle className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0" />}
                  <div className="min-w-0">
                    <span className={`text-sm font-medium transition-colors ${checklist[a.artifact_id] ? "text-foreground" : "text-foreground/80"}`}>
                      {a.title}
                    </span>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                      {a.description}
                      <span className="inline-block ml-1.5 px-1.5 py-0.5 rounded bg-secondary text-[10px] font-medium text-muted-foreground">
                        {a.format}
                      </span>
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Self-assessment reflections */}
        {standards.length > 0 && (
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40 bg-secondary/30">
              <PenLine className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold font-[var(--font-manrope)] text-foreground">
                {t("capstone.reflection_title")}
              </span>
            </div>
            <div className="px-4 pt-2.5 pb-1">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {t("capstone.reflection_hint")}
              </p>
            </div>
            <div className="px-4 pb-4 space-y-4 mt-2">
              {standards.map((criterion, idx) => {
                const len = (reflections[idx] ?? "").trim().length
                const tooShort = len > 0 && len < 10
                return (
                  <div key={idx} className="space-y-1.5">
                    <label className="flex items-start gap-2 text-sm text-foreground leading-relaxed">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-primary/10 text-primary text-[10px] font-bold font-[var(--font-manrope)] shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{criterion}</span>
                    </label>
                    <textarea
                      className={`w-full px-3 py-2 text-sm rounded-lg border bg-background text-foreground resize-none focus:outline-none focus:ring-1 transition-colors ${
                        tooShort
                          ? "border-amber-400 dark:border-amber-600 focus:ring-amber-400"
                          : "border-border focus:ring-primary/40"
                      }`}
                      rows={3}
                      placeholder={t("capstone.reflection_placeholder")}
                      value={reflections[idx] ?? ""}
                      onChange={(e) => setReflections((prev) => ({ ...prev, [idx]: e.target.value }))}
                    />
                    {tooShort && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 pl-7">
                        {t("capstone.reflection_too_short")}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* File upload */}
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40 bg-secondary/30">
            <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold font-[var(--font-manrope)] text-foreground">
              {t("capstone.upload_title")}
            </span>
          </div>
          <div className="p-4">
            <div
              className={`flex flex-col items-center justify-center gap-2 px-4 py-5 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                file
                  ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20"
                  : "border-border hover:border-primary/40 bg-secondary/20 hover:bg-secondary/40"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
            >
              {file ? (
                <>
                  <FileText className="h-6 w-6 text-emerald-500" />
                  <p className="text-sm font-medium text-foreground">{file.name}</p>
                  <p className="text-[11px] text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
                </>
              ) : (
                <>
                  <Upload className="h-6 w-6 text-muted-foreground/50" />
                  <p className="text-xs text-muted-foreground">{t("capstone.drag_drop")}</p>
                </>
              )}
              <p className="text-[10px] text-muted-foreground/60">{t("capstone.upload_formats")}</p>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".zip,.pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) setFile(f)
                }}
              />
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-destructive/10 border border-destructive/20">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Submit button */}
        <button
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="w-full h-10 rounded-xl text-sm font-bold font-[var(--font-manrope)] text-primary-foreground bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("capstone.submitting")}
            </>
          ) : (
            <>
              <Send className="h-3.5 w-3.5" />
              {t("capstone.submit_btn")}
            </>
          )}
        </button>
      </div>
    )
  }

  // =========================================================================
  // PHASE: GRADING
  // =========================================================================
  if (phase === "grading") {
    return (
      <div className="mt-8">
        <div className="rounded-xl border border-border/60 bg-card p-8 flex flex-col items-center justify-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold font-[var(--font-manrope)] text-foreground">
              {t("capstone.grading")}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">{t("capstone.grading_hint")}</p>
          </div>
          <div className="w-32 h-1 rounded-full bg-secondary overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-purple-500 animate-pulse w-2/3" />
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // PHASE: RESULT
  // =========================================================================
  const passed = latestResult && latestResult.score >= (latestResult.max_score ?? 100) * 0.6
  const pct = latestResult ? Math.round((latestResult.score / Math.max(latestResult.max_score, 1)) * 100) : 0

  return (
    <div className="mt-8 space-y-4">
      {/* Score card */}
      <div className={`rounded-xl border p-4 ${
        passed
          ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
          : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
              passed
                ? "bg-emerald-100 dark:bg-emerald-900/40"
                : "bg-red-100 dark:bg-red-900/40"
            }`}>
              {passed
                ? <Trophy className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                : <XCircle className="h-5 w-5 text-red-500 dark:text-red-400" />}
            </div>
            <div>
              <p className="text-lg font-bold font-[var(--font-manrope)] text-foreground">
                {latestResult?.score ?? 0}<span className="text-sm text-muted-foreground font-normal"> / {latestResult?.max_score ?? 100}</span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                {t("capstone.attempt")}: {latestResult?.attempt ?? 1}
              </p>
            </div>
          </div>
          <span className={`px-3 py-1.5 rounded-lg text-xs font-bold font-[var(--font-manrope)] ${
            passed
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
              : "bg-red-500/15 text-red-700 dark:text-red-400"
          }`}>
            {passed ? t("capstone.passed") : t("capstone.failed")}
          </span>
        </div>
        {/* Score bar */}
        <div className="mt-3 h-1.5 rounded-full bg-secondary/80 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              passed
                ? "bg-gradient-to-r from-emerald-400 to-teal-500"
                : "bg-gradient-to-r from-red-400 to-orange-500"
            }`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>

      {/* Per-criterion feedback */}
      {latestResult?.feedback && latestResult.feedback.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40 bg-secondary/30">
            <ClipboardCheck className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold font-[var(--font-manrope)] text-foreground">
              {t("capstone.feedback_title")}
            </span>
          </div>
          <div className="divide-y divide-border/30">
            {latestResult.feedback.map((fb: CapstoneFeedbackItem) => {
              const fbPassed = fb.score >= fb.max_score * 0.6
              return (
                <div key={fb.criterion_idx} className="px-4 py-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground leading-relaxed flex-1">
                      {standards[fb.criterion_idx] ?? `#${fb.criterion_idx + 1}`}
                    </span>
                    <span className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold font-[var(--font-manrope)] ${
                      fbPassed
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-red-500/10 text-red-600 dark:text-red-400"
                    }`}>
                      {fb.score}/{fb.max_score}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed">{fb.feedback}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* File link */}
      {latestResult?.file_url && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary/30 border border-border/40">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground truncate">
            {latestResult.file_name || t("capstone.uploaded_file")}
          </span>
        </div>
      )}

      {/* Resubmit button */}
      {!passed && (
        <button
          onClick={resetForm}
          className="w-full h-9 rounded-xl text-sm font-semibold font-[var(--font-manrope)] border border-primary/30 text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t("capstone.resubmit")}
        </button>
      )}

      {/* History */}
      {history.length > 1 && (
        <div className="rounded-xl border border-border/40 overflow-hidden">
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-muted-foreground hover:bg-secondary/30 transition-colors"
          >
            <span className="font-medium font-[var(--font-manrope)]">{t("capstone.history")} ({history.length})</span>
            {historyOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {historyOpen && (
            <div className="border-t border-border/30 divide-y divide-border/20">
              {history.map((sub) => {
                const subPassed = sub.score >= (sub.max_score ?? 100) * 0.6
                return (
                  <div key={sub.submission_id} className="flex items-center justify-between px-4 py-2 text-xs">
                    <span className="text-muted-foreground">
                      #{sub.attempt} - {sub.submitted_at?.slice(0, 16).replace("T", " ") ?? "--"}
                    </span>
                    <span className={`font-bold font-[var(--font-manrope)] ${
                      subPassed ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                    }`}>
                      {sub.score}/{sub.max_score}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
