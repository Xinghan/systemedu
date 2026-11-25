import { dot, softmax, type Matrix } from './math'
import { pocketForward, words, type Settings } from './pocket-model'
import { normalize } from './study-model'

export type ExampleId = 'product' | 'query' | 'key' | 'value' | 'scores' | 'context' | 'hidden' | 'back' | 'dense' | 'readout'
export type MatrixExample = {
  left: Matrix; right: Matrix; names: [string, string, string]
  rows: string[]; shared: string[]; cols: string[]
  question: string; bias?: number[]
}
const features = ['特征 1', '特征 2', '特征 3']
const coords = ['坐标 1', '坐标 2']
const positions = ['位置 1', '位置 2']
const inputs = [[1, 2, -1], [0, 3, 2]]
const qWeights = [[1, 0], [0, 1], [0, 0]]
const kWeights = [[0, 1], [1, 0], [0, 0]]
const vWeights = [[1, 0], [0, 0], [0, 1]]

export function transpose(matrix: Matrix): Matrix {
  return matrix[0].map((_, col) => matrix.map(row => row[col]))
}

export function matrixExample(id: ExampleId, settings: Settings, extraWeight = false): MatrixExample {
  if (id === 'product') {
    return { left: inputs, right: [[2, 0], [extraWeight ? 0 : -1, 4], [3, 1]],
      names: ['X', 'W', 'XW'], rows: positions, shared: features, cols: ['规则 1', '规则 2'],
      question: '选一个输出格。左表给出这个位置的三项读数，右表给出同一条规则的三个系数。' }
  }
  if (id === 'dense') {
    return { left: [[2, 1, -1], [1, 0, 2]], right: [[1, -1, 1], [0, 2, -1], [1, 0, 2]],
      names: ['H', 'U', 'HU'], rows: positions, shared: features, cols: words, bias: [0, 0, 1],
      question: '这两行是为手算选的整数。先点第一行的「鱼」，再点同一行的「追」。同一段前文怎样给两个候选词打出不同的分数？' }
  }
  const result = pocketForward(settings)
  const rows = settings.tokens.map((token, i) => words[token] + ' · ' + i)
  if (id === 'scores') {
    return { left: result.q, right: transpose(result.k), names: ['Q', 'Kᵀ', 'QKᵀ'], rows, shared: coords, cols: rows,
      question: '先选提问的位置，再选它要比较的位置。右表每一列就是一个位置的键。点到未来的位置，也可以看见遮罩生效前的点积。' }
  }
  if (id === 'context') {
    return { left: result.weights, right: result.v, names: ['A', 'V', 'AV'], rows, shared: rows, cols: coords,
      question: '在同一行切换两个输出坐标。左边用到的三个比例相同，右边取出的三个值有何变化？' }
  }
  if (id === 'readout') {
    return { left: result.final, right: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], names: ['H', 'U', 'HU'],
      rows, shared: features, cols: words, bias: [0, 0, settings.fishBias],
      question: '这里读的是本节计算台当前的输入、最终表示和偏置。点「鱼」一列，找出三个乘积中哪一项被保留下来。' }
  }
  if (id === 'hidden') {
    return { left: result.u.map(row => normalize(row).output), right: [[1, 0], [0, 1], [-1, 0]],
      names: ['N', 'W₁', 'NW₁'], rows, shared: features, cols: ['中间量 1', '中间量 2'],
      question: '第一列在求哪两个特征的差？第二列又保留了什么？把得数和计算台的「前馈变换」对照。' }
  }
  if (id === 'back') {
    return { left: result.active, right: [[0.5, 0, 0], [0, 0, 0.5]],
      names: ['F', 'W₂', 'FW₂'], rows, shared: ['中间量 1', '中间量 2'], cols: features,
      question: '左表是经过激活的中间量。点输出的第二列看看，前馈支路会给原来的第二个特征增加多少？' }
  }
  const projections: Record<'query' | 'key' | 'value', [string, Matrix]> = {
    query: ['Q', qWeights], key: ['K', kWeights], value: ['V', vWeights],
  }
  const [name, weights] = projections[id]
  return { left: result.n, right: weights, names: ['N', 'W' + name, name], rows, shared: features, cols: coords,
    question: '固定一个位置和一个输出坐标，在查询、键、值之间切换。左边读的是同一行，哪一个系数改变了它的去向？' }
}

export function productGrid(example: MatrixExample): Matrix {
  const columns = transpose(example.right)
  return example.left.map(row => columns.map(col => dot(row, col)))
}

export function sliceGrid(example: MatrixExample, term: number): Matrix {
  return example.left.map(row => example.right[term].map(weight => row[term] * weight))
}

export function cellSteps(example: MatrixExample, row: number, col: number) {
  let total = 0
  return example.left[row].map((input, i) => {
    const weight = example.right[i][col]
    const prior = total
    total += input * weight
    return { input, weight, term: input * weight, prior, total }
  })
}

export function scoreRow(raw: number[], row: number, settings: Settings, keyWidth: number) {
  return raw.map((score, j) => settings.causal && j > row ? -Infinity : score / (settings.scaled ? Math.sqrt(keyWidth) : 1))
}

export function vocabRow(raw: number[], bias: number[]) {
  const logits = raw.map((v, j) => v + bias[j])
  return { logits, prob: softmax(logits) }
}
