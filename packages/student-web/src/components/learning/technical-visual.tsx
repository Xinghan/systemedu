"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import katex from "katex"
import "katex/contrib/mhchem"
import "katex/dist/katex.min.css"
// JSXGraph 1.12.2 exports only its JS entry; its CSS subpath is not exported.
// Keep the exact upstream stylesheet vendored so production bundlers can load it.
import "@/styles/vendor/jsxgraph.css"

import type { SlideTechnicalVisual } from "@/lib/types/api"
import { drawSmilesSvg } from "@/lib/rdkit"
import { ClassificationEvidenceVisual } from "./classification-evidence-visual"
import { RegressionEvidenceVisual } from "./regression-evidence-visual"
import { TendonTorqueVisual } from "./tendon-torque-visual"
import { RocEvidenceVisual } from "./roc-evidence-visual"
import { LipinskiEvidenceVisual } from "./lipinski-evidence-visual"
import { MoleculeSkeletonVisual } from "./molecule-skeleton-visual"
import { SkeletonReadonly } from "./skeleton-readonly"
import { FunnelEvidenceVisual } from "./funnel-evidence-visual"
import { RankingEvidenceVisual } from "./ranking-evidence-visual"
import { DiversityVisual, RejectionVisual } from "./diversity-rejection-visual"
import { LogpLabVisual } from "./logp-lab-visual"
import { WorkbenchEvidenceVisual } from "./workbench-evidence-visual"
import { DiscoveryBriefReadonly } from "./discovery-brief-readonly"
import { RdkitRuntimeReadonly } from "./rdkit-runtime-readonly"
import { FunctionalGroupReadonly } from "./functional-group-readonly"
import { SmilesReadingReadonly } from "./smiles-reading-readonly"
import { MoleculeReadingVisual } from "./molecule-reading-visual"
import { PubchemRetrievalVisual } from "./pubchem-retrieval-visual"
import { PythonVariableVisual } from "./python-variable-visual"

type FormulaVisualProps = {
  latex: string
  ariaLabel?: string
  className?: string
}

/**
 * Removes common Markdown math delimiters before passing a formula to KaTeX.
 * Slide payloads predate the technical renderer, so this keeps both `$…$`
 * and direct TeX inputs compatible without changing old course data.
 */
function formulaSource(value: string) {
  const trimmed = value.trim()
  if (trimmed.startsWith("$$") && trimmed.endsWith("$$")) return trimmed.slice(2, -2).trim()
  if (trimmed.startsWith("$") && trimmed.endsWith("$")) return trimmed.slice(1, -1).trim()
  return trimmed
}

/**
 * Exact notation belongs in the DOM, not in an image or freehand SVG. KaTeX
 * emits both visual HTML and MathML, keeping formulas selectable and readable
 * by assistive technologies. A malformed legacy field degrades to plain text
 * instead of leaving the slide blank.
 */
export function FormulaVisual({ latex, ariaLabel, className = "" }: FormulaVisualProps) {
  const source = formulaSource(latex)
  const html = useMemo(() => {
    if (!source) return null
    try {
      return katex.renderToString(source, {
        displayMode: true,
        output: "htmlAndMathml",
        throwOnError: true,
        strict: "ignore",
        trust: false,
      })
    } catch {
      return null
    }
  }, [source])

  if (!html) {
    return (
      <pre className={`mb-3 overflow-x-auto rounded-lg bg-[var(--paper-2)] p-3 text-sm text-[var(--ink)] ${className}`}>
        {latex}
      </pre>
    )
  }

  return (
    <div
      role="math"
      aria-label={ariaLabel || source}
      className={`technical-formula mb-3 overflow-x-auto rounded-lg border border-[#D7E1E8] bg-[#F8FBFC] px-4 py-3 text-[#17324D] [&_.katex-display]:my-0 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

/**
 * The slide payload explicitly selects a renderer. This avoids accepting
 * arbitrary generated HTML while leaving room for exact domain renderers.
 */
export function TechnicalVisual({ visual }: { visual?: SlideTechnicalVisual }) {
  if (!visual) return null

  switch (visual.renderer) {
    case "pubchem-retrieval":
      return <PubchemRetrievalVisual key={visual.scene} visual={visual} />
    case "molecule-reading":
      return <MoleculeReadingVisual key={visual.scene} visual={visual} />
    case "smiles-reading":
      return <SmilesReadingReadonly key={visual.scene} visual={visual} />
    case "functional-group":
      return <FunctionalGroupReadonly key={visual.scene} visual={visual} />
    case "rdkit-runtime":
      return <RdkitRuntimeReadonly key={visual.scene} visual={visual} />
    case "discovery-brief":
      return <DiscoveryBriefReadonly key={visual.scene} visual={visual} />
    case "logp-lab":
      return <LogpLabVisual key={visual.scene} visual={visual} />
    case "workbench-evidence":
      return <WorkbenchEvidenceVisual key={visual.scene} visual={visual} />
    case "diversity-evidence":
      return <DiversityVisual key={visual.scene} visual={visual} />
    case "rejection-evidence":
      return <RejectionVisual key={visual.scene} visual={visual} />
    case "ranking-evidence":
      return <RankingEvidenceVisual visual={visual} />
    case "molecule-skeleton":
      return <MoleculeSkeletonVisual visual={visual} />
    case "molecule-skeleton-evidence":
      return <SkeletonReadonly key={visual.scene} visual={visual} />
    case "funnel-evidence":
      return <FunnelEvidenceVisual visual={visual} />
    case "roc-evidence":
      return <RocEvidenceVisual visual={visual} />
    case "lipinski-evidence":
      return <LipinskiEvidenceVisual visual={visual} />
    case "tendon-torque":
      return <TendonTorqueVisual visual={visual} />
    case "regression-evidence":
      return <RegressionEvidenceVisual visual={visual} />
    case "classification-evidence":
      return <ClassificationEvidenceVisual visual={visual} />
    case "katex":
      return <FormulaVisual latex={visual.latex} ariaLabel={visual.aria_label} />
    case "rdkit-2d":
      return <RDKitMoleculeVisual key={visual.molecules.map(({ smiles }) => smiles).join("|")} visual={visual} />
    case "matrix-explorer":
      return <CovarianceMatrixVisual visual={visual} />
    case "jsxgraph":
      return <PidRecoveryVisual visual={visual} />
    case "code-trace":
      if (visual.aria_label?.startsWith("M08 ·")) return <PythonVariableVisual key={visual.aria_label} visual={visual} />
      return <CodeTraceVisual visual={visual} />
    case "formula-sequence":
      return <FormulaSequenceVisual visual={visual} />
    case "pipeline-contract":
      return <PipelineContractVisual visual={visual} />
    case "molecule-3d":
      return null
  }
}

function FormulaSequenceVisual({ visual }: {
  visual: Extract<SlideTechnicalVisual, { renderer: "formula-sequence" }>
}) {
  const [stepIndex, setStepIndex] = useState(0)
  const step = visual.steps[stepIndex]
  if (!step) return null

  return (
    <section aria-label={visual.aria_label || visual.topic} className="my-4 overflow-hidden rounded-xl border border-[#C8D8E4] bg-[#F8FBFC]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D9E4EB] bg-white px-4 py-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-[#315F7A]">{visual.topic}</p>
          <p className="mt-1 text-sm font-semibold text-[#17324D]">{step.title}</p>
        </div>
        <button
          type="button"
          onClick={() => setStepIndex((current) => (current + 1) % visual.steps.length)}
          className="rounded-md bg-[#17324D] px-3 py-2 text-xs font-semibold text-white"
        >
          下一步推导 · {stepIndex + 1}/{visual.steps.length}
        </button>
      </header>
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(210px,.62fr)] lg:items-center">
        <FormulaVisual latex={step.latex} className="mb-0 min-h-20 content-center text-center" />
        <aside className="space-y-3" aria-live="polite">
          <p className="rounded-lg border border-[#D9E4EB] bg-white p-3 text-sm leading-6 text-[#466275]">{step.detail}</p>
          {(step.evidence || []).length > 0 && (
            <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {step.evidence?.map((item) => (
                <div key={`${item.label}-${item.value}`} className="rounded-lg border border-[#D9E4EB] bg-white px-3 py-2">
                  <dt className="text-xs font-semibold text-[#607287]">{item.label}</dt>
                  <dd className="mt-1 font-mono text-sm font-semibold text-[#17324D]">{item.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </aside>
      </div>
    </section>
  )
}

function CodeTraceVisual({ visual }: {
  visual: Extract<SlideTechnicalVisual, { renderer: "code-trace" }>
}) {
  const [stepIndex, setStepIndex] = useState(0)
  const lines = visual.code.split("\n")
  const step = visual.steps[stepIndex]
  if (!step) return null

  return (
    <section aria-label={visual.aria_label || "Python 代码执行轨迹"} className="my-4 overflow-hidden rounded-xl border border-[#C8D8E4] bg-[#F8FBFC]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D9E4EB] bg-white px-4 py-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-[#315F7A]">Python · 可观察的执行轨迹</p>
          <p className="mt-1 text-sm font-semibold text-[#17324D]">{step.title}</p>
        </div>
        <button
          type="button"
          onClick={() => setStepIndex((current) => (current + 1) % visual.steps.length)}
          className="rounded-md bg-[#17324D] px-3 py-2 text-xs font-semibold text-white"
        >
          下一状态 · {stepIndex + 1}/{visual.steps.length}
        </button>
      </header>
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,.72fr)]">
        <ol className="overflow-x-auto rounded-lg bg-[#172635] py-3 font-mono text-sm leading-7 text-[#E7F0F6]" aria-label="Python 源码">
          {lines.map((line, index) => {
            const lineNumber = index + 1
            const active = step.active_lines.includes(lineNumber)
            return (
              <li key={`${lineNumber}-${line}`} className={`flex min-w-max gap-3 px-4 ${active ? "bg-[#2F607B] text-white" : "text-[#C7D7E3]"}`}>
                <span className="w-6 select-none text-right text-[#86A7BB]">{lineNumber}</span>
                <code className="bg-transparent p-0 text-inherit">{line || " "}</code>
              </li>
            )
          })}
        </ol>
        <aside className="space-y-3" aria-live="polite">
          <p className="rounded-lg border border-[#D9E4EB] bg-white p-3 text-sm leading-6 text-[#466275]">{step.detail}</p>
          {(step.variables || []).length > 0 && (
            <dl className="grid gap-2">
              {step.variables?.map((variable) => (
                <div key={`${variable.name}-${variable.value}`} className="rounded-lg border border-[#D9E4EB] bg-white px-3 py-2">
                  <dt className="font-mono text-xs font-semibold text-[#315F7A]">{variable.name}</dt>
                  <dd className="mt-1 break-all font-mono text-sm text-[#17324D]">{variable.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {step.output && (
            <div className="rounded-lg border border-[#D9E4EB] bg-[#F1F7FA] p-3">
              <p className="text-xs font-semibold text-[#607287]">终端输出</p>
              <pre className="mt-2 overflow-x-auto font-mono text-sm text-[#17324D]">{step.output}</pre>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}

/**
 * Makes an interface contract visible instead of flattening a pipeline into
 * decorative arrows. The three states are a real learning sequence: inspect
 * an upstream output, align it with the trained-model contract, then observe
 * the silent semantic failure caused by a reordered feature row.
 */
function PipelineContractVisual({ visual }: {
  visual: Extract<SlideTechnicalVisual, { renderer: "pipeline-contract" }>
}) {
  const [stateIndex, setStateIndex] = useState(0)
  const states = [
    {
      title: "先看接口交出了什么",
      detail: "描述符步骤已经产出一行特征；模型还不知道这一行是否仍与训练时的列和顺序一致。",
      supplied: visual.expected_features,
      status: "待核对",
      statusClass: "border-[#D7B75C] bg-[#FFF8E6] text-[#785A13]",
    },
    {
      title: "同一列、同一顺序，才能正确解释",
      detail: "推理时的特征行与训练时的特征契约逐项相同，模型才能把每个位置当作它原本学过的量。",
      supplied: visual.expected_features,
      status: "接口对齐 · 可以预测",
      statusClass: "border-[#8BCDBA] bg-[#ECFAF5] text-[#17664F]",
    },
    {
      title: "乱序并不会报错，却会把含义读反",
      detail: "这一行仍然能送进模型，但位置已变：课程强调模型会把油水性当作分子量，预测全错而程序不报警。",
      supplied: visual.misordered_features,
      status: "静默错配 · 不可信",
      statusClass: "border-[#E9A89A] bg-[#FFF1EE] text-[#A43E2E]",
    },
  ] as const
  const state = states[stateIndex]

  return (
    <section aria-label={visual.aria_label || "流水线接口与特征顺序契约"} className="my-4 overflow-hidden rounded-xl border border-[#C8D8E4] bg-[#F8FBFC]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D9E4EB] bg-white px-4 py-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-[#315F7A]">工作台总装 · 可核查的接口契约</p>
          <p className="mt-1 text-sm font-semibold text-[#17324D]">{state.title}</p>
        </div>
        <button
          type="button"
          onClick={() => setStateIndex((current) => (current + 1) % states.length)}
          className="rounded-md bg-[#17324D] px-3 py-2 text-xs font-semibold text-white"
        >
          下一接口状态 · {stateIndex + 1}/{states.length}
        </button>
      </header>
      <div className="space-y-4 p-4">
        <ol className="flex gap-2 overflow-x-auto pb-1" aria-label="工作台的数据流水线">
          {visual.stages.map((stage, index) => (
            <li key={`${stage.name}-${stage.output}`} className="min-w-48 flex-1 rounded-lg border border-[#D9E4EB] bg-white p-3">
              <p className="text-xs font-semibold text-[#315F7A]">{index + 1} · {stage.name}</p>
              <p className="mt-2 font-mono text-xs text-[#607287]">in&nbsp; {stage.input}</p>
              <p className="mt-1 font-mono text-xs font-semibold text-[#17324D]">out {stage.output}</p>
            </li>
          ))}
        </ol>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(180px,.6fr)] lg:items-stretch">
          <FeatureContractCard title="训练时模型期待" features={visual.expected_features} tone="expected" />
          <FeatureContractCard title="这次送进模型" features={state.supplied} tone={stateIndex === 2 ? "mismatched" : "supplied"} />
          <aside className={`rounded-lg border p-3 ${state.statusClass}`} aria-live="polite">
            <p className="text-xs font-semibold">{state.status}</p>
            <p className="mt-2 text-sm leading-6">{state.detail}</p>
          </aside>
        </div>
      </div>
    </section>
  )
}

function FeatureContractCard({
  title,
  features,
  tone,
}: {
  title: string
  features: string[]
  tone: "expected" | "supplied" | "mismatched"
}) {
  const colors = tone === "mismatched"
    ? "border-[#E9A89A] bg-[#FFF7F4] text-[#A43E2E]"
    : tone === "expected"
      ? "border-[#A7C9DE] bg-[#F2F8FC] text-[#255C7B]"
      : "border-[#8BCDBA] bg-[#F0FBF6] text-[#17664F]"
  return (
    <section className="rounded-lg border border-[#D9E4EB] bg-white p-3">
      <p className="text-xs font-semibold text-[#466275]">{title}</p>
      <ol className="mt-2 grid gap-2 sm:grid-cols-2" aria-label={title}>
        {features.map((feature, index) => (
          <li key={`${index}-${feature}`} className={`rounded-md border px-2 py-1.5 font-mono text-xs font-semibold ${colors}`}>
            <span className="mr-2 opacity-70">{index + 1}</span>{feature}
          </li>
        ))}
      </ol>
    </section>
  )
}

function CovarianceMatrixVisual({ visual }: {
  visual: Extract<SlideTechnicalVisual, { renderer: "matrix-explorer" }>
}) {
  const [visibleGroups, setVisibleGroups] = useState(10)
  const [isPlaying, setIsPlaying] = useState(false)
  const electrodes = visual.electrodes.slice(0, 4)
  const groupForCell = (row: number, column: number) => {
    const [low, high] = row <= column ? [row, column] : [column, row]
    if (low === high) return low
    let group = electrodes.length
    for (let currentHigh = 1; currentHigh < electrodes.length; currentHigh += 1) {
      for (let currentLow = 0; currentLow < currentHigh; currentLow += 1) {
        if (currentLow === low && currentHigh === high) return group
        group += 1
      }
    }
    return group
  }

  useEffect(() => {
    if (!isPlaying) return
    let frame = 0
    const interval = window.setInterval(() => {
      frame += 1
      setVisibleGroups(frame)
      if (frame >= 10) {
        window.clearInterval(interval)
        setIsPlaying(false)
      }
    }, 460)
    return () => window.clearInterval(interval)
  }, [isPlaying])

  if (electrodes.length < 2) return null

  return (
    <section aria-label={visual.aria_label || "协方差矩阵的对称填表过程"} className="my-4 overflow-hidden rounded-xl border border-[#C8D8E4] bg-[#F8FBFC]">
      <header className="border-b border-[#D9E4EB] bg-white px-4 py-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-[#315F7A]">数学 · 协方差矩阵的精确结构</p>
          <p className="mt-1 text-sm text-[#466275]">每出现一个上三角元素，它的镜像位置会同时填入相同的协方差。</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setVisibleGroups(0)
            setIsPlaying(true)
          }}
          disabled={isPlaying}
          className="mt-3 rounded-md bg-[#17324D] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 sm:mt-0"
        >
          {isPlaying ? "正在逐格建表…" : "播放对称填表"}
        </button>
      </header>
      <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[470px] border-separate border-spacing-1 text-center text-xs text-[#17324D]">
            <caption className="sr-only">四个 EEG 电极的协方差矩阵。对角线是方差，矩阵关于对角线对称。</caption>
            <thead>
              <tr>
                <th scope="col" className="w-20" />
                {electrodes.map((label) => <th key={label} scope="col" className="pb-1 font-semibold text-[#466275]">{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {electrodes.map((rowLabel, row) => (
                <tr key={rowLabel}>
                  <th scope="row" className="pr-2 text-right font-semibold text-[#466275]">{rowLabel}</th>
                  {electrodes.map((columnLabel, column) => {
                    const diagonal = row === column
                    const visible = groupForCell(row, column) < visibleGroups
                    return (
                      <td key={`${rowLabel}-${columnLabel}`} className="p-0.5">
                        <span
                          className={`flex h-11 items-center justify-center rounded-md border px-1 font-mono transition-all duration-300 ${visible ? "opacity-100" : "opacity-15"} ${diagonal ? "border-[#F1C75B] bg-[#FFF7DF] text-[#785A13]" : "border-[#B7DCE0] bg-[#EAF8F8] text-[#1F6670]"}`}
                        >
                          {diagonal ? `Var(${rowLabel})` : `Cov(${rowLabel},${columnLabel})`}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <aside className="space-y-3 rounded-lg border border-[#D9E4EB] bg-white p-4 text-sm text-[#466275]">
          <FormulaVisual latex="\\Sigma_{ij}=\\Sigma_{ji}" className="mb-0 text-center" />
          <p><b className="text-[#785A13]">黄色对角线：</b>每个电极自己的方差。</p>
          <p><b className="text-[#1F6670]">蓝绿色镜像格：</b>任意两路电极的协方差，互换行列不改变数值。</p>
          <p className="border-t border-[#E4ECF1] pt-3 font-medium text-[#17324D]">4 路电极：16 格；独立值只有 4×(4+1)/2 = 10 个。</p>
        </aside>
      </div>
    </section>
  )
}

type JSXGraphBoard = {
  create: (type: string, parents: unknown[], attributes?: Record<string, unknown>) => unknown
  update: () => void
}

type JSXGraphRuntime = {
  JSXGraph: {
    initBoard: (element: HTMLElement, attributes: Record<string, unknown>) => JSXGraphBoard
    freeBoard: (board: JSXGraphBoard) => void
  }
}

function PidRecoveryVisual({ visual }: {
  visual: Extract<SlideTechnicalVisual, { renderer: "jsxgraph" }>
}) {
  const graphRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState("正在建立坐标系…")

  useEffect(() => {
    const element = graphRef.current
    if (!element) return
    let board: JSXGraphBoard | null = null
    let animationFrame = 0
    let cancelled = false
    const samples = [
      [0, visual.setpoint], [3.8, visual.setpoint], [4.5, 0.47], [5.1, visual.disturbance_value],
      [6.0, 0.448], [7.1, 0.478], [8.2, 0.497], [9.2, 0.503], [10.4, visual.setpoint], [14, visual.setpoint],
    ] as const
    const powerAt = (time: number) => {
      const rightIndex = samples.findIndex(([sampleTime]) => sampleTime >= time)
      if (rightIndex <= 0) return samples[0][1]
      if (rightIndex === -1) return samples[samples.length - 1][1]
      const [leftTime, leftPower] = samples[rightIndex - 1]
      const [rightTime, rightPower] = samples[rightIndex]
      const ratio = (time - leftTime) / (rightTime - leftTime)
      return leftPower + (rightPower - leftPower) * ratio
    }

    void import("jsxgraph")
      .then((module) => {
        if (cancelled) return
        const runtime = ((module as unknown as { default?: JSXGraphRuntime }).default ?? module) as unknown as JSXGraphRuntime
        board = runtime.JSXGraph.initBoard(element, {
          boundingbox: [-0.7, 0.575, 14.7, 0.38],
          axis: false,
          showCopyright: false,
          showNavigation: false,
          pan: { enabled: false },
          zoom: { enabled: false },
          keepAspectRatio: false,
        })
        const style = { fixed: true, highlight: false }
        board.create("segment", [[0, 0.4], [14, 0.4]], { ...style, strokeColor: "#9FB1C0", strokeWidth: 1 })
        board.create("segment", [[0, 0.4], [0, 0.565]], { ...style, strokeColor: "#9FB1C0", strokeWidth: 1 })
        board.create("segment", [[0, visual.setpoint], [14, visual.setpoint]], { ...style, strokeColor: "#E0A81C", strokeWidth: 2, dash: 2 })
        board.create("segment", [[4, 0.4], [4, 0.565]], { ...style, strokeColor: "#E16B51", strokeWidth: 1.5, dash: 2 })
        board.create("curve", [samples.map(([time]) => time), samples.map(([, power]) => power)], { ...style, strokeColor: "#1876A8", strokeWidth: 3 })
        board.create("point", [5.1, visual.disturbance_value], { ...style, name: "", size: 3, fillColor: "#E16B51", strokeColor: "#E16B51" })
        board.create("point", [10.4, visual.setpoint], { ...style, name: "", size: 3, fillColor: "#38A481", strokeColor: "#38A481" })
        let elapsed = 0
        board.create("point", [() => elapsed, () => powerAt(elapsed)], { ...style, name: "", size: 4, fillColor: "#17324D", strokeColor: "#FFFFFF", strokeWidth: 2 })
        board.create("text", [0.15, 0.568, "功率 (W)"], { ...style, fontSize: 12, strokeColor: "#466275" })
        board.create("text", [10.9, visual.setpoint + 0.009, "目标 0.50 W"], { ...style, fontSize: 12, strokeColor: "#8A640E" })
        board.create("text", [3.7, 0.563, "扰动"], { ...style, fontSize: 12, strokeColor: "#B84F3A" })
        board.create("text", [4.55, visual.disturbance_value - 0.014, "最低 0.42 W"], { ...style, fontSize: 12, strokeColor: "#B84F3A" })
        board.create("text", [9.0, 0.414, "恢复到 0.50 W"], { ...style, fontSize: 12, strokeColor: "#19765B" })
        setStatus("播放头正在沿实测状态序列移动")

        const startedAt = performance.now()
        const animate = (now: number) => {
          if (!board || cancelled) return
          elapsed = ((now - startedAt) / 700) % 14
          board.update()
          animationFrame = window.requestAnimationFrame(animate)
        }
        animationFrame = window.requestAnimationFrame(animate)
      })
      .catch(() => setStatus("物理曲线暂时无法绘制。"))

    return () => {
      cancelled = true
      window.cancelAnimationFrame(animationFrame)
      if (board) {
        void import("jsxgraph").then((module) => {
          const runtime = ((module as unknown as { default?: JSXGraphRuntime }).default ?? module) as unknown as JSXGraphRuntime
          runtime.JSXGraph.freeBoard(board as JSXGraphBoard)
        })
      }
    }
  }, [visual.disturbance_value, visual.recovery_seconds, visual.setpoint])

  return (
    <section aria-label={visual.aria_label || "PID 抗扰恢复曲线"} className="my-4 overflow-hidden rounded-xl border border-[#C8D8E4] bg-[#F8FBFC]">
      <header className="border-b border-[#D9E4EB] bg-white px-4 py-3">
        <p className="text-xs font-semibold tracking-wide text-[#315F7A]">物理控制 · JSXGraph 动态状态曲线</p>
        <p className="mt-1 text-sm text-[#466275]">不是一条装饰线：播放头依次经过“稳态 → 受扰下陷 → PID 恢复 → 新稳态”。</p>
      </header>
      <div className="p-4">
        <div ref={graphRef} className="h-60 w-full rounded-lg border border-[#D9E4EB] bg-white" aria-live="polite" />
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <p className="rounded-md bg-white p-3 text-[#466275]"><b className="text-[#17324D]">① 0–4 s</b><br />稳定在目标 0.50 W</p>
          <p className="rounded-md bg-white p-3 text-[#466275]"><b className="text-[#B84F3A]">② 约 5 s</b><br />扰动使功率掉至 {visual.disturbance_value.toFixed(2)} W</p>
          <p className="rounded-md bg-white p-3 text-[#466275]"><b className="text-[#19765B]">③ {visual.recovery_seconds} s 内</b><br />PID 把功率拉回 0.50 W</p>
        </div>
        <p className="mt-3 text-xs text-[#607287]" aria-live="polite">{status}</p>
      </div>
    </section>
  )
}

function RDKitMoleculeVisual({ visual }: {
  visual: Extract<SlideTechnicalVisual, { renderer: "rdkit-2d" }>
}) {
  const moleculeKey = visual.molecules
    .map(({ smiles, highlight_atoms = [] }) => `${smiles}:${highlight_atoms.join(",")}`)
    .join("|")
  const [svgs, setSvgs] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void Promise.all(
      visual.molecules.map(({ smiles, highlight_atoms }) => drawSmilesSvg(smiles, {
        highlightAtoms: highlight_atoms,
      })),
    )
      .then((nextSvgs) => {
        if (!cancelled) setSvgs(nextSvgs)
      })
      .catch(() => {
        if (!cancelled) setError("分子结构暂时无法绘制；下面保留可核查的 SMILES。")
      })
    return () => { cancelled = true }
  // The component receives a stable key when its molecule data changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moleculeKey])

  return (
    <section
      aria-label={visual.aria_label || "RDKit 精确分子结构"}
      className="my-4 overflow-hidden rounded-xl border border-[#C8D8E4] bg-[#F8FBFC]"
    >
      <header className="border-b border-[#D9E4EB] bg-white px-4 py-3">
        <p className="text-xs font-semibold tracking-wide text-[#315F7A]">RDKit · 精确二维结构</p>
        {visual.comparison_note && <p className="mt-1 text-sm text-[#466275]">{visual.comparison_note}</p>}
      </header>
      <div className={`grid gap-px bg-[#D9E4EB] ${visual.molecules.length > 1 ? "sm:grid-cols-2" : ""}`}>
        {visual.molecules.map((molecule, index) => (
          <figure key={`${molecule.smiles}-${index}`} className="min-w-0 bg-[#FDFDFC] p-4">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <figcaption className="font-semibold text-[#17324D]">{molecule.label}</figcaption>
              <code className="rounded bg-[#EDF3F7] px-2 py-1 text-xs font-medium text-[#315F7A]">{molecule.smiles}</code>
            </div>
            {svgs?.[index] ? (
              <div
                className="flex min-h-48 items-center justify-center [&_svg]:h-auto [&_svg]:max-h-56 [&_svg]:w-full"
                aria-label={`${molecule.label}，SMILES 为 ${molecule.smiles}`}
                dangerouslySetInnerHTML={{ __html: svgs[index] }}
              />
            ) : error ? (
              <p className="flex min-h-48 items-center rounded-lg border border-dashed border-[#C8D8E4] px-4 text-sm text-[#607287]">{error}</p>
            ) : (
              <div className="flex min-h-48 items-center justify-center text-sm text-[#607287]" aria-live="polite">正在用 RDKit 绘制结构…</div>
            )}
          </figure>
        ))}
      </div>
      {(visual.evidence || []).length > 0 && (
        <dl className="grid gap-px border-t border-[#D9E4EB] bg-[#D9E4EB] sm:grid-cols-3">
          {visual.evidence?.map((item) => (
            <div key={`${item.label}-${item.value}`} className="bg-white px-4 py-3">
              <dt className="text-xs font-medium text-[#607287]">{item.label}</dt>
              <dd className="mt-1 font-mono text-lg font-bold text-[#17324D]">{item.value}</dd>
              {item.detail && <p className="mt-1 text-xs leading-5 text-[#466275]">{item.detail}</p>}
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
