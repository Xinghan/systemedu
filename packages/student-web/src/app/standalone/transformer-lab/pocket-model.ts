import { dot, softmax } from './math'
import { normalize } from './study-model'

export const words = ['猫', '追', '鱼']
export const embeddings = [[1, 0, -1], [0, 1, -1], [-1, 0, 1]]
const positions = [[0, 0, 0], [0, 0.5, 0], [0, -0.5, 0]]
export type Settings = { tokens: number[]; position: boolean; causal: boolean; scaled: boolean; nonlinear: boolean; fishBias: number }
export const defaults: Settings = { tokens: [0, 1, 2], position: true, causal: true, scaled: true, nonlinear: true, fishBias: 0 }
const plus = (x: number[], y: number[]) => x.map((v, i) => v + y[i])
const norm = (x: number[]) => normalize(x).output

// A one-block Pre-LN decoder. Wq, Wk, Wv, Wo and both FFN maps are
// written as coordinate operations so every coefficient can be read in class.
export function pocketForward(s: Settings) {
  const x = s.tokens.map((id, i) => plus(embeddings[id], s.position ? positions[i] : [0, 0, 0]))
  const n = x.map(norm)
  const q = n.map(([a, b]) => [a, b])
  const k = n.map(([a, b]) => [b, a])
  const v = n.map(([a, , c]) => [a, c])
  const scores = q.map((row, i) => k.map((key, j) => s.causal && j > i ? -Infinity : dot(row, key) / (s.scaled ? Math.sqrt(2) : 1)))
  const weights = scores.map(softmax)
  const context = weights.map(row => [0, 1].map(d => dot(row, v.map(value => value[d]))))
  const u = context.map(([a, b], i) => plus(x[i], [a, 0, b]))
  const hidden = u.map(norm).map(([a, b, c]) => [a - c, b])
  const active = hidden.map(row => row.map(z => s.nonlinear ? Math.max(0, z) : z))
  const y = active.map(([a, b], i) => plus(u[i], [0.5 * a, 0, 0.5 * b]))
  const final = y.map(norm)
  // Untied readout with identity weights and a single trainable demonstration bias.
  const logits = final.map(([a, b, c]) => [a, b, c + s.fishBias])
  const prob = logits.map(softmax)
  return { x, n, q, k, v, scores, weights, context, u, hidden, active, y, final, logits, prob }
}

export const traceStages = [
  ['x', '输入表示'], ['n', '归一化'], ['q', '查询 Q'], ['k', '键 K'], ['v', '值 V'],
  ['scores', '匹配分数'], ['weights', '读取比例'], ['context', '汇总 V'], ['u', '第一条残差'],
  ['hidden', '前馈变换'], ['active', '激活'], ['y', '第二条残差'], ['final', '最终归一化'],
  ['logits', '词表分数'], ['prob', '预测概率'],
] as const
export type Stage = (typeof traceStages)[number][0]
