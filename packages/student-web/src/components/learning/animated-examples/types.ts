/** Type definitions for animated example templates. */

export interface StepByStepData {
  steps: Array<{
    title: string
    content: string
    highlight?: string
  }>
}

export interface ComparisonData {
  left: {
    label: string
    points: string[]
  }
  right: {
    label: string
    points: string[]
  }
  conclusion?: string
}

export interface FlowchartNode {
  id: string
  label: string
  description?: string
}

export interface FlowchartEdge {
  from: string
  to: string
  label?: string
}

export interface FlowchartData {
  nodes: FlowchartNode[]
  edges: FlowchartEdge[]
}

export interface TimelineData {
  events: Array<{
    time: string
    title: string
    description: string
  }>
}

export interface FormulaData {
  expression: string
  parts: Array<{
    text: string
    explanation: string
  }>
  description?: string
}

export interface CauseEffectData {
  chains: Array<{
    cause: string
    effect: string
    explanation?: string
  }>
}

export interface AnatomyData {
  title: string
  parts: Array<{
    name: string
    description: string
    x: number
    y: number
  }>
}

export interface QuizChoiceData {
  questions: Array<{
    question: string
    options: string[]
    correct: number
    explanation: string
    hint?: string
  }>
}

export interface MatchPairsData {
  instruction: string
  pairs: Array<{ left: string; right: string }>
}

export interface SortOrderData {
  instruction: string
  items: string[]
  ordered_labels?: string[]
}

export interface FillBlanksData {
  instruction: string
  segments: Array<{ type: "text" | "blank"; content: string }>
  distractors?: string[]
}

export interface TrueFalseData {
  statements: Array<{
    text: string
    correct: boolean
    explanation: string
  }>
}

export type TemplateType =
  | "step-by-step"
  | "comparison"
  | "flowchart"
  | "timeline"
  | "formula"
  | "cause-effect"
  | "anatomy"
  | "quiz-choice"
  | "match-pairs"
  | "sort-order"
  | "fill-blanks"
  | "true-false"

export type GameDataType = QuizChoiceData | MatchPairsData | SortOrderData | FillBlanksData | TrueFalseData

export interface ExampleItem {
  template: TemplateType
  title: string
  data: StepByStepData | ComparisonData | FlowchartData | TimelineData | FormulaData | CauseEffectData | AnatomyData | GameDataType
  fallback_markdown: string
}

export interface ExamplesPayload {
  examples: ExampleItem[]
}
