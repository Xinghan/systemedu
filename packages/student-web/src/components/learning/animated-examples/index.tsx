"use client"

import { useMemo } from "react"
import { ExampleSection } from "./shared-animations"
import { StepByStepTemplate } from "./step-by-step-template"
import { ComparisonTemplate } from "./comparison-template"
import { FlowchartTemplate } from "./flowchart-template"
import { TimelineTemplate } from "./timeline-template"
import { FormulaTemplate } from "./formula-template"
import { CauseEffectTemplate } from "./cause-effect-template"
import { AnatomyTemplate } from "./anatomy-template"
import { QuizChoiceTemplate } from "./quiz-choice-template"
import { MatchPairsTemplate } from "./match-pairs-template"
import { SortOrderTemplate } from "./sort-order-template"
import { FillBlanksTemplate } from "./fill-blanks-template"
import { TrueFalseTemplate } from "./true-false-template"
import { MarkdownFallback } from "./markdown-fallback"
import type {
  ExamplesPayload,
  ExampleItem,
  StepByStepData,
  ComparisonData,
  FlowchartData,
  TimelineData,
  FormulaData,
  CauseEffectData,
  AnatomyData,
  QuizChoiceData,
  MatchPairsData,
  SortOrderData,
  FillBlanksData,
  TrueFalseData,
} from "./types"

function tryParseExamplesJson(content: string): ExamplesPayload | null {
  try {
    let text = content.trim()
    // Strip markdown code fences
    if (text.startsWith("```")) {
      const lines = text.split("\n")
      text = lines.slice(1, lines[lines.length - 1]?.trim() === "```" ? -1 : undefined).join("\n").trim()
    }
    const parsed = JSON.parse(text)
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray(parsed.examples) &&
      parsed.examples.length > 0
    ) {
      return parsed as ExamplesPayload
    }
  } catch {
    // Not JSON — will use markdown fallback
  }
  return null
}

function TemplateRenderer({ item }: { item: ExampleItem }) {
  try {
    switch (item.template) {
      case "step-by-step":
        return <StepByStepTemplate data={item.data as StepByStepData} />
      case "comparison":
        return <ComparisonTemplate data={item.data as ComparisonData} />
      case "flowchart":
        return <FlowchartTemplate data={item.data as FlowchartData} />
      case "timeline":
        return <TimelineTemplate data={item.data as TimelineData} />
      case "formula":
        return <FormulaTemplate data={item.data as FormulaData} />
      case "cause-effect":
        return <CauseEffectTemplate data={item.data as CauseEffectData} />
      case "anatomy":
        return <AnatomyTemplate data={item.data as AnatomyData} />
      case "quiz-choice":
        return <QuizChoiceTemplate data={item.data as QuizChoiceData} />
      case "match-pairs":
        return <MatchPairsTemplate data={item.data as MatchPairsData} />
      case "sort-order":
        return <SortOrderTemplate data={item.data as SortOrderData} />
      case "fill-blanks":
        return <FillBlanksTemplate data={item.data as FillBlanksData} />
      case "true-false":
        return <TrueFalseTemplate data={item.data as TrueFalseData} />
      default:
        // Unknown template — use fallback markdown
        return <MarkdownFallback content={item.fallback_markdown} />
    }
  } catch {
    // Template rendering error — use fallback
    return <MarkdownFallback content={item.fallback_markdown} />
  }
}

/**
 * Main entry point for the animated examples view.
 *
 * Attempts to parse the content as structured JSON.
 * On success, renders animated template components.
 * On failure, gracefully falls back to markdown with fade-in animation.
 */
export function AnimatedExamplesView({ content }: { content: string }) {
  const parsed = useMemo(() => tryParseExamplesJson(content), [content])

  if (!parsed) {
    return <MarkdownFallback content={content} />
  }

  return (
    <div className="space-y-6">
      {parsed.examples.map((item, i) => (
        <ExampleSection key={i} title={item.title} index={i}>
          <TemplateRenderer item={item} />
        </ExampleSection>
      ))}
    </div>
  )
}
