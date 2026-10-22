export type Matrix = number[][]
export type AttentionInput = { Q: Matrix; K: Matrix; V: Matrix }
export type AttentionOutput = { weights: Matrix; output: Matrix }
export type TestCase = AttentionInput & { id: string; title: string; pairedWith?: string; prefix?: number }
export type Check = { id: string; label: string; pass: boolean; detail: string }
export const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0)
export const causalMask = (n: number) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => j <= i))
export function softmax(row: number[]) {
  const max = Math.max(...row)
  if (!Number.isFinite(max)) return row.map(() => 0)
  const exps = row.map(x => Math.exp(x - max)), sum = exps.reduce((a, b) => a + b, 0)
  return exps.map(x => x / sum)
}
export function attention({ Q, K, V }: AttentionInput, mask = causalMask(Q.length)): AttentionOutput {
  const weights = Q.map((q, i) => softmax(K.map((k, j) => mask[i][j] ? dot(q, k) / Math.sqrt(q.length) : -Infinity)))
  const output = weights.map(row => V[0].map((_, d) => row.reduce((s, w, j) => s + w * V[j][d], 0)))
  return { weights, output }
}
export const DEMO: AttentionInput = {
  Q: [[1, 0], [1, 1], [-1, 1], [0, 1]], K: [[1, 0], [0, 1], [-1, 0], [1, 1]],
  V: [[1, 0], [0, 2], [-1, 1], [2, -1]],
}
function rng(seed: number) {
  let x = seed >>> 0
  return () => { x = (Math.imul(1664525, x) + 1013904223) >>> 0; return x / 4294967296 }
}
export function fixtures(seed: number): TestCase[] {
  const random = rng(seed)
  const matrix = (rows: number, cols: number, scale = 1) => Array.from({ length: rows }, () => Array.from({ length: cols }, () => (random() * 2 - 1) * scale))
  const base: TestCase[] = [{ id: "demo", title: "4 token 教学输入", ...DEMO }]
  for (const [i, [t, dk, dv, scale]] of [[1, 3, 2, 1], [5, 3, 2, 1], [7, 4, 3, 1], [4, 2, 2, 80]].entries()) {
    base.push({ id: "case-" + i, title: "T=" + t + " · dₖ=" + dk + " · dᵥ=" + dv + (scale > 1 ? " · 大数值" : ""), Q: matrix(t, dk, scale), K: matrix(t, dk, scale), V: matrix(t, dv) })
  }
  const original = base[2]
  base.push({ ...original, id: "future", title: "只改变第 3–5 个 token", pairedWith: original.id, prefix: 2,
    Q: original.Q.map((r, i) => i < 2 ? [...r] : r.map(x => x + 8)),
    K: original.K.map((r, i) => i < 2 ? [...r] : r.map(x => x - 7)),
    V: original.V.map((r, i) => i < 2 ? [...r] : r.map(x => x + 10)) })
  return base
}
export function isMatrix(value: unknown, rows: number, cols: number): value is Matrix {
  return Array.isArray(value) && value.length === rows && value.every(row => Array.isArray(row) && row.length === cols && row.every(x => typeof x === "number" && Number.isFinite(x) && Math.abs(x) < 1e12))
}
const close = (a: number, b: number) => Math.abs(a - b) <= 1e-6 + 1e-5 * Math.abs(b)
const equal = (a: Matrix, b: Matrix) => a.every((r, i) => r.every((x, j) => close(x, b[i][j])))
export function gradeRun(cases: TestCase[], raw: unknown): { checks: Check[]; trace?: AttentionOutput } {
  const results = Array.isArray(raw) ? raw : []
  const checks: Check[] = [], valid = new Map<string, AttentionOutput>()
  for (const [i, c] of cases.entries()) {
    const value = results[i] as Partial<AttentionOutput> | undefined
    const shape = !!value && isMatrix(value.weights, c.Q.length, c.Q.length) && isMatrix(value.output, c.Q.length, c.V[0].length)
    if (!shape) {
      checks.push({ id: c.id + "-shape", label: c.title, pass: false, detail: "需要返回 weights(T,T) 和 output(T,dᵥ)，所有结果必须为有限数。" }); continue
    }
    const result = value as AttentionOutput, expected = attention(c)
    valid.set(c.id, result)
    const rowSum = result.weights.every(r => close(r.reduce((a, b) => a + b, 0), 1))
    const mask = result.weights.every((r, row) => r.every((x, col) => col > row ? Math.abs(x) < 1e-7 : x >= 0))
    const numeric = equal(result.weights, expected.weights) && equal(result.output, expected.output)
    checks.push({ id: c.id + "-numeric", label: c.title, pass: rowSum && mask && numeric,
      detail: !rowSum ? "行和不是 1：检查 softmax 的轴，以及 mask 的应用位置。" : !mask ? "未来位置仍有权重，或出现负权重：检查可见性。" : !numeric ? "数值与定义不一致：检查缩放、QKᵀ 和 weights @ V。" : "形状、行和、因果遮罩与数值一致。" })
    if (c.pairedWith) {
      const original = valid.get(c.pairedWith)
      const pass = !!original && equal(result.output.slice(0, c.prefix), original.output.slice(0, c.prefix))
      checks.push({ id: "invariance", label: "未来扰动：前两个位置不变", pass, detail: pass ? "改变未来的 Q/K/V，前缀输出保持不变。" : "未来信息泄漏到了前缀输出。" })
    }
  }
  return { checks, trace: valid.get("demo") }
}
export const GRAPH_BLOCKS = [
  { id: "dot", title: "Q @ K.T", detail: "两两匹配", shape: "T × T" },
  { id: "scale", title: "÷ √dₖ", detail: "控制得分尺度", shape: "T × T" },
  { id: "mask", title: "因果 mask", detail: "禁止未来位置", shape: "T × T" },
  { id: "softmax", title: "行 softmax", detail: "归一化可见项", shape: "T × T" },
  { id: "value", title: "weights @ V", detail: "加权汇聚内容", shape: "T × dᵥ" },
]
export function gradeGraph(slots: string[], role: string) {
  // A positive finite scale commutes with applying an additive -∞ mask.
  const allowed = ["dot,scale,mask,softmax,value", "dot,mask,scale,softmax,value"]
  return allowed.includes(slots.join(",")) && role === "value"
}
