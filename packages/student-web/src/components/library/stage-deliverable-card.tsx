"use client"

import Link from "next/link"
import { ArrowRight, CheckCircle2, PackageCheck, TriangleAlert } from "lucide-react"

import { getStageDeliverable } from "./stage-deliverable.mjs"
import { useT } from "@/lib/i18n/use-t"

type StageArtifact = { title?: string; kind?: string }

export type StageDeliverableStage = {
  stage_id: string
  title: string
  stage_goal?: string
  stage_output?: string
  closing_capstone_module_id?: string
  capstone_scope?: string
  capstone_reuses_outputs_from_stages?: string[]
  capstone_hands_on_expectation?: string
}

export type StageDeliverableModule = {
  module_id: string
  stage_id?: string
  acceptance_artifacts?: StageArtifact[]
  acceptance_standard?: string[]
  what_it_passes_forward?: string
}

export function StageDeliverableCard({
  stage,
  stages,
  modules,
  slug,
  pulled,
}: {
  stage: StageDeliverableStage
  stages: StageDeliverableStage[]
  modules: StageDeliverableModule[]
  slug: string
  pulled: boolean
}) {
  const t = useT()
  const deliverable = getStageDeliverable(stage, modules, stages)
  const reusedStages = (deliverable.reuseStageIds as string[])
    .map((stageId) => stages.find((item) => item.stage_id === stageId))
    .filter((item: StageDeliverableStage | undefined): item is StageDeliverableStage => !!item)

  if (deliverable.status === "incomplete") {
    if (process.env.NODE_ENV !== "development") return null
    return (
      <div
        role="status"
        style={{
          display: "flex",
          gap: 8,
          margin: "0 18px 14px",
          padding: "10px 12px",
          borderRadius: 8,
          color: "var(--warning, #a16207)",
          background: "color-mix(in srgb, #f59e0b 10%, var(--card))",
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        <TriangleAlert size={15} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          {t("stage_deliverable.incomplete")}：{deliverable.missing.join("、")}
        </span>
      </div>
    )
  }

  const content = (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span
          style={{
            display: "grid",
            placeItems: "center",
            width: 30,
            height: 30,
            flexShrink: 0,
            borderRadius: 8,
            color: "var(--violet)",
            background: "var(--violet-soft)",
          }}
        >
          <PackageCheck size={16} strokeWidth={1.8} />
        </span>
        <div style={{ minWidth: 0 }}>
          <p className="mono" style={{ margin: 0, fontSize: 10.5, color: "var(--violet)", fontWeight: 600 }}>
            {t("stage_deliverable.product")}
          </p>
          <p style={{ margin: "3px 0 0", fontWeight: 650, fontSize: 14, color: "var(--ink)" }}>
            {deliverable.stageOutput}
          </p>
          <p className="body" style={{ margin: "5px 0 0", fontSize: 12.5, lineHeight: 1.5, color: "var(--ink-2)" }}>
            {deliverable.scope}
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 14, marginTop: 14 }}>
        <section>
          <p className="mono" style={{ margin: 0, fontSize: 10.5, color: "var(--sub)", fontWeight: 600 }}>
            {t("stage_deliverable.receive")}
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: "7px 0 0", display: "grid", gap: 5 }}>
            {deliverable.artifacts.slice(0, 3).map((artifact: StageArtifact, index: number) => (
              <li key={`${artifact.title || "artifact"}-${index}`} style={{ display: "flex", gap: 6, fontSize: 12.5, lineHeight: 1.4, color: "var(--ink-2)" }}>
                <CheckCircle2 size={14} style={{ color: "var(--emerald)", flexShrink: 0, marginTop: 1 }} />
                <span>{artifact.title || t("stage_deliverable.artifact")}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <p className="mono" style={{ margin: 0, fontSize: 10.5, color: "var(--sub)", fontWeight: 600 }}>
            {t("stage_deliverable.check")}
          </p>
          <ol style={{ margin: "7px 0 0", paddingLeft: 18, display: "grid", gap: 4, color: "var(--ink-2)", fontSize: 12.5, lineHeight: 1.4 }}>
            {deliverable.checks.slice(0, 5).map((check: string, index: number) => <li key={index}>{check}</li>)}
          </ol>
        </section>
      </div>

      {reusedStages.length > 0 && (
        <p className="body" style={{ margin: "13px 0 0", paddingTop: 11, borderTop: "1px dashed var(--border)", fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>
          <strong style={{ color: "var(--ink)" }}>{t("stage_deliverable.previous")}：</strong>
          {reusedStages.map((item) => `${item.stage_id} · ${item.title}`).join("；")}
        </p>
      )}

      {deliverable.handoff && (
        <p className="body" style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>
          <strong style={{ color: "var(--ink)" }}>{t("stage_deliverable.next")}：</strong>
          {deliverable.handoff}
        </p>
      )}
    </>
  )

  return (
    <div
      style={{
        margin: "0 18px 14px",
        padding: "14px",
        border: "1px solid color-mix(in srgb, var(--violet) 24%, var(--border))",
        borderRadius: 9,
        background: "color-mix(in srgb, var(--violet-soft) 38%, var(--card))",
      }}
    >
      {content}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 14 }}>
        <span className="body" style={{ fontSize: 12, color: "var(--sub)" }}>
          {deliverable.handsOnExpectation}
        </span>
        {pulled ? (
          <Link
            href={`/learn/${encodeURIComponent(slug)}/${encodeURIComponent(deliverable.capstoneModuleId)}`}
            className="mono"
            style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0, fontSize: 11.5, fontWeight: 600, color: "var(--violet)", textDecoration: "none" }}
          >
            {t("stage_deliverable.start")} <ArrowRight size={14} />
          </Link>
        ) : (
          <span className="mono" style={{ fontSize: 11.5, color: "var(--sub-2)" }}>
            {t("stage_deliverable.pull_first")}
          </span>
        )}
      </div>
    </div>
  )
}
