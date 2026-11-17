// Algorithm-neutral contract. Neither the scene nor a renderer knows a Transformer.
export type Matrix = number[][]
export type Cell = { node: string; row: number; col: number }
export type Operation = 'input' | 'lookup' | 'add' | 'linear' | 'norm' | 'slice' | 'scores' | 'mask' | 'softmax' | 'matmul' | 'concat' | 'gelu' | 'correlation'
export type TensorNode = {
  id: string; label: string; data: Matrix; color: string; category: string
  position: [number, number, number]; cellAspect?: number; op: Operation; inputs: string[]; displayInputs?: string[]
  meta?: { offset?: number; scale?: number; gamma?: number[]; beta?: number[]; bias?: number[]; ids?: number[]; eps?: number }
}
export type Explanation = { cell: Cell; value: number; formula: string; inputs: Cell[]; terms: string[]; note: string }
export type AlgorithmGraph = { id: string; title: string; description: string; nodes: TensorNode[]; sequence: string[] }
export const shape = (node: TensorNode): [number, number] => [node.data.length, node.data[0]?.length ?? 0]
const n = (v: number) => Number.isFinite(v) ? v.toFixed(5) : v === -Infinity ? '−∞' : String(v)

export function explainCell(graph: AlgorithmGraph, cell: Cell): Explanation {
  const node = graph.nodes.find(t => t.id === cell.node)
  if (!node || !Number.isInteger(cell.row) || !Number.isInteger(cell.col) || cell.row < 0 || cell.col < 0 || cell.row >= node.data.length || cell.col >= node.data[0].length) throw new Error('张量索引越界')
  const { row: r, col: c } = cell, value = node.data[r][c], inputs: Cell[] = [], terms: string[] = []
  const source = (i: number) => graph.nodes.find(t => t.id === node.inputs[i])!
  const ref = (i: number, row: number, col: number) => { const t = source(i); inputs.push({ node: t.id, row, col }); return t.data[row][col] }
  let formula = '', note = ''
  switch (node.op) {
    case 'input': formula = `${node.label}[${r},${c}] = ${n(value)}`; note = '这是输入或固定参数，没有前驱运算。'; break
    case 'lookup': {
      const row = node.meta?.ids?.[r] ?? r, x = ref(0, row, c)
      formula = `table[${row},${c}] = ${n(x)}`; note = '索引选择一行，不对编号做数值插值。'; break
    }
    case 'add': { const a = ref(0, r, c), b = ref(1, r, c); formula = `${n(a)} + ${n(b)} = ${n(value)}`; break }
    case 'slice': { const offset = node.meta?.offset ?? 0; ref(0, r, c + offset); formula = `source[${r},${c}+${offset}] = ${n(value)}`; break }
    case 'linear': {
      for (let k = 0; k < source(0).data[0].length; k++) terms.push(`${n(ref(0, r, k))} × ${n(ref(1, c, k))}`)
      formula = `Σₖ x[${r},k] W[${c},k] + b[${c}] = ${n(value)}`
      note = `权重按 PyTorch [输出特征,输入特征] 存储；偏置 = ${n(node.meta?.bias?.[c] ?? 0)}。`; break
    }
    case 'norm': {
      const row = source(0).data[r], mean = row.reduce((a,b)=>a+b,0)/row.length, variance = row.reduce((a,b)=>a+(b-mean)**2,0)/row.length
      row.forEach((_,i)=>ref(0,r,i))
      const gamma=node.meta?.gamma?.[c]??1, beta=node.meta?.beta?.[c]??0, eps=node.meta?.eps??1e-5
      formula=`(${n(row[c])} − ${n(mean)}) / √(${n(variance)} + ${eps}) × ${n(gamma)} + ${n(beta)} = ${n(value)}`
      note='高亮该位置的整行：均值和总体方差沿特征轴计算，γ/β 为当前特征的训练参数。'; break
    }
    case 'scores': {
      const d=source(0).data[0].length
      for(let k=0;k<d;k++)terms.push(`${n(ref(0,r,k))} × ${n(ref(1,c,k))}`)
      formula=`Σₖ Q[${r},k] K[${c},k] / √${d} = ${n(value)}`; note='一条 query 与一条 key 的点积；这一格是分数，不是概率。'; break
    }
    case 'mask': ref(0,r,c); formula=c>r?`${c} > ${r}：未来位置 → −∞`:`${c} ≤ ${r}：保留 ${n(value)}`; break
    case 'softmax': {
      const row=source(0).data[r], max=Math.max(...row), sum=row.reduce((a,b)=>a+Math.exp(b-max),0)
      row.forEach((_,i)=>ref(0,r,i)); formula=`exp(${n(row[c])} − ${n(max)}) / ${n(sum)} = ${n(value)}`
      note='分母由同一行所有可见项的指数求和；减最大值保持结果不变。'; break
    }
    case 'matmul': {
      for(let k=0;k<source(0).data[0].length;k++)terms.push(`${n(ref(0,r,k))} × ${n(ref(1,k,c))}`)
      formula=`Σⱼ A[${r},j] V[j,${c}] = ${n(value)}`; note='逐项乘加；零权重对应的信息不贡献到输出。'; break
    }
    case 'concat': {
      let offset=c, i=0
      while(offset>=source(i).data[0].length){offset-=source(i).data[0].length;i++}
      ref(i,r,offset); formula=`head ${i+1}[${r},${offset}] → concat[${r},${c}] = ${n(value)}`; note='沿特征轴拼接，不把头相加。'; break
    }
    case 'gelu': { const x=ref(0,r,c); formula=`½ × ${n(x)} × [1 + tanh(√(2/π) × (x + 0.044715x³))] = ${n(value)}`; note='这里 x 取上方输入值；tanh 近似 GELU，逐元素计算。'; break }
    case 'correlation': {
      const kernel=source(1).data
      kernel.forEach((row,i)=>row.forEach((_,j)=>terms.push(`${n(ref(0,r+i,c+j))} × ${n(ref(1,i,j))}`)))
      formula=`Σᵢⱼ image[${r}+i,${c}+j] × kernel[i,j] = ${n(value)}`
      note='二维互相关（CNN 中通常称卷积），stride=1，padding=0，不翻转核。'; break
    }
  }
  return {cell,value,formula,inputs,terms,note}
}

export function validateGraph(graph: AlgorithmGraph) {
  const ids=new Set<string>()
  for(const node of graph.nodes){
    if(ids.has(node.id))throw new Error('重复节点 '+node.id)
    if(!node.data.length||!node.data[0].length||node.data.some(row=>row.length!==node.data[0].length||row.some(x=>Number.isNaN(x)||x===Infinity)))throw new Error('非法张量 '+node.id)
    if(node.inputs.some(id=>!ids.has(id)))throw new Error('前驱节点缺失或存在环：'+node.id)
    ids.add(node.id)
  }
  if(graph.sequence.some(id=>!ids.has(id)))throw new Error('时间线节点缺失')
}
