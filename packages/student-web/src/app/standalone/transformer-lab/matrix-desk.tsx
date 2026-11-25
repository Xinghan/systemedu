'use client'

import { useEffect, useState } from 'react'
import { softmax, type Matrix } from './math'
import { type Settings } from './pocket-model'
import { cellSteps, matrixExample, productGrid, scoreRow, sliceGrid, vocabRow, type ExampleId, type MatrixExample } from './matrix-walkthrough'
import css from './matrix-desk.module.css'

const desks = {
  matrix: { title: '亲手算出一个格子', modes: [['product', '矩阵乘法']] },
  qkv: { title: '追踪同一个特征的去向', modes: [['query', '查询 Q'], ['key', '键 K'], ['value', '值 V']] },
  'score-matrix': { title: '从两个坐标算到一个注意力权重', modes: [['scores', '匹配分数']] },
  'weighted-sum': { title: '追踪一个位置读回的数值', modes: [['context', '读取内容']] },
  ffn: { title: '拆开前馈网络的两次乘法', modes: [['hidden', '进入隐藏层'], ['back', '回到原宽度']] },
  logits: { title: '追踪一个候选词的分数', modes: [['dense', '用整数手算'], ['readout', '用当前模型核对']] },
} as const
type Desk = keyof typeof desks
export function hasMatrixDesk(concept?: string): concept is Desk {
  return concept !== undefined && Object.prototype.hasOwnProperty.call(desks, concept)
}

function fmt(x: number) {
  if (x === -Infinity) return '−∞'
  return String(Number(x.toFixed(3))).replace('-', '−')
}
function factor(x: number) {
  return x < 0 ? '(' + fmt(x) + ')' : fmt(x)
}

type GridProps = {
  name: string; matrix: Matrix; rows: string[]; cols: string[]
  tone?: 'left' | 'right' | 'output'; row?: number; col?: number
  onPick?: (i: number, j: number) => void
}
function Grid({ name, matrix, rows, cols, tone, row, col, onPick }: GridProps) {
  return <table className={css.grid} data-tone={tone}>
    <caption>{name} <small>{matrix.length} 行 × {cols.length} 列</small></caption>
    <thead><tr><td/>{cols.map((label, j) => <th scope="col" key={j}>{label}</th>)}</tr></thead>
    <tbody>{matrix.map((values, i) => <tr key={i}><th scope="row">{rows[i]}</th>{values.map((value, j) => {
      const selected = i === row && j === col
      return <td key={j} data-current={selected || undefined} data-track={((tone === 'left' && i === row) || (tone === 'right' && j === col)) || undefined}>
        {onPick ? <button type="button" aria-label={rows[i] + '，' + cols[j] + '，' + fmt(value)} aria-pressed={selected} onClick={() => onPick(i, j)}>{fmt(value)}</button> : fmt(value)}
      </td>
    })}</tr>)}</tbody>
  </table>
}

function SliceView({ example, term }: { example: MatrixExample; term: number }) {
  const slice = sliceGrid(example, term)
  return <div className={css.slice}>
    <p>从 X 竖着取第 {term + 1} 列 ({example.left.map(row => fmt(row[term])).join('，')})，从 W 横着取第 {term + 1} 行 ({example.right[term].map(fmt).join('，')})。左边的每个数都乘右边的每个数，得到这个特征对四个格子的贡献。</p>
    <Grid name={example.shared[term] + '的贡献'} matrix={slice} rows={example.rows} cols={example.cols}/>
    <p>按上面的步数轮流查看三张表。把三张表中同一位置的数加起来，就得到 XW 在那个位置的数。</p>
  </div>
}

function Calculation({ initial, settings }: { initial: Desk; settings: Settings }) {
  const desk = desks[initial]
  const [mode, setMode] = useState<ExampleId>(desk.modes[0][0])
  const [row, setRow] = useState(initial === 'matrix' || initial === 'logits' ? 0 : 1)
  const [col, setCol] = useState(initial === 'logits' ? 2 : 0)
  const [term, setTerm] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [changed, setChanged] = useState(false)
  const example = matrixExample(mode, settings, changed)
  const grid = productGrid(example)
  const steps = cellSteps(example, row, col)
  const step = steps[term]
  const last = steps.length - 1
  useEffect(() => {
    if (!playing) return
    const timer = window.setTimeout(() => {
      if (term < last) setTerm(term + 1)
      else setPlaying(false)
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [playing, term, last])

  function selectCell(i: number, j: number) {
    setRow(i); setCol(j); setTerm(0); setPlaying(false)
  }
  function selectMode(next: ExampleId) {
    const nextExample = matrixExample(next, settings, changed)
    selectCell(Math.min(row, nextExample.left.length - 1), Math.min(col, nextExample.cols.length - 1))
    setMode(next)
  }
  function selectTerm(i: number) {
    setPlaying(false); setTerm(i)
  }
  const equals = mode === 'dense' || mode === 'product' ? '=' : '≈'
  const raw = grid[row][col]
  const scored = mode === 'scores' ? scoreRow(grid[row], row, settings, steps.length) : null
  const vocab = example.bias ? vocabRow(grid[row], example.bias) : null
  return <div className={css.desk} role="group" aria-label={desk.title}>
    <h3>{desk.title}</h3>
    {desk.modes.length > 1 && <div className={css.modes}>{desk.modes.map(([id, label]) =>
      <button type="button" key={id} aria-pressed={mode === id} onClick={() => selectMode(id)}>{label}</button>)}</div>}
    <p>{example.question}</p>
    <div className={css.board}><Grid name={'点选结果表 ' + example.names[2] + ' 中的一格'} matrix={grid} rows={example.rows} cols={example.cols} row={row} col={col} tone="output" onPick={selectCell}/></div>
    <div className={css.operands}>
      <Grid name={example.names[0] + ' · 取一行'} matrix={example.left} rows={example.rows} cols={example.shared} row={row} col={term} tone="left"/>
      <Grid name={example.names[1] + ' · 取一列'} matrix={example.right} rows={example.shared} cols={example.cols} row={term} col={col} tone="right"/>
    </div>
    <div className={css.ledger}>
      <div className={css.controls}><span>逐项计算</span>{steps.map((_, i) =>
        <button type="button" key={i} aria-label={'第 ' + (i + 1) + ' 项'} aria-pressed={term === i} onClick={() => selectTerm(i)}>{i + 1}</button>)}
        <button type="button" className={css.play} onClick={() => { if (!playing && term === last) setTerm(0); setPlaying(!playing) }}>{playing ? '暂停' : term === last ? '重播' : '播放'}</button></div>
      <div className={css.arithmetic} aria-live={playing ? 'off' : 'polite'}>
        <span>{example.shared[term]}贡献了</span>
        <strong><i>{fmt(step.input)}</i> × <b>{factor(step.weight)}</b> {equals} {fmt(step.term)}</strong>
        <span>{term === last ? '加完各项，得到这个格子的值' : '截至这一项的和'}</span>
        <strong>{fmt(step.prior)} + {factor(step.term)} {equals} {fmt(step.total)}</strong>
      </div>
    </div>
    {term === last && <p className={css.follow}><b>把各项连起来。</b> {steps.map(s => fmt(s.input) + ' × ' + factor(s.weight)).join(' ＋ ')} {equals} {fmt(raw)}。</p>}
    {example.bias && vocab && <p className={css.follow}><b>接下来加偏置，再算词表概率。</b>「{example.cols[col]}」的分数为 {fmt(raw)} + {factor(example.bias[col])} {equals} {fmt(vocab.logits[col])}。这一行的全部分数是 ({vocab.logits.map(fmt).join('，')})，一起做 softmax 后，「{example.cols[col]}」的概率约为 {(vocab.prob[col] * 100).toFixed(1)}%。</p>}
    {scored && <p className={css.follow}><b>从点积到读取比例。</b>{settings.scaled ? '点积除以 √' + steps.length + '，得到 ' + fmt(raw / Math.sqrt(steps.length)) + '。' : '计算台已关闭缩放，保留原点积。'}{scored[col] === -Infinity ? '这一列属于未来位置，遮罩将分数置为 −∞。' : '这个位置可以读取。'}整行送入 softmax 的数是 ({scored.map(fmt).join('，')})，所选位置的读取比例为 {(softmax(scored)[col] * 100).toFixed(1)}%。</p>}
    {mode === 'product' && <>
      <details className={css.extension}><summary>换个角度看：一个特征影响了哪些格子？</summary><SliceView example={example} term={term}/></details>
      <label className={css.edit}><input type="checkbox" checked={changed} onChange={e => {setChanged(e.target.checked); selectTerm(1)}}/>把 W 第二行第一列的 −1 改成 0</label>
      {changed && <p className={css.follow}>规则 1 给特征 2 的权重增加了 1，两个位置的分数就分别增加 2 和 3。看结果表的第一列，从 (−3，3) 变成了 (−1，6)。规则 2 仍然使用原来的系数。</p>}
    </>}
    {(mode === 'product' || vocab) && <details className={css.extension}>
      <summary>{mode === 'product' ? '自己算：如果只把第一个位置的第三个特征增加 1 呢？' : '自己算：如果只给「鱼」的偏置加 2 呢？'}</summary>
      <p>{mode === 'product'
        ? 'X 第一行第三列从 −1 变成 0，相差 1。W 第三行的两个系数是 3 和 1，因此第一行的两个结果分别增加 3 和 1。第二个位置的输入没有变化。对照上面改动权重的试验，改一个输入特征会影响一个位置，改共用的权重则可能影响多个位置。'
        : '每个位置的「鱼」分数都增加 2，因为偏置是在三个乘积相加后才加一次。其他候选词的分数仍然一样。重新做 softmax 时，分母也增大，「鱼」的概率上升，其余词的概率下降。'}</p>
    </details>}
    {mode !== 'product' && <small className={css.note}>{mode === 'dense' ? '这是独立的手算例子。切到「用当前模型核对」可读取本节计算台的数值。' : '模型沿用计算台的编号，第一个词的位置编号是 0。表中最多显示三位小数，计算时保留完整精度。'}</small>}
    {initial === 'matrix' ? <a className={css.readLink} href="#lesson/scale/score-matrix">把行乘列用在注意力分数上 →</a>
      : <a className={css.readLink} href="#lesson/algebra/matrix">回到整数例子，重算一行乘一列 →</a>}
  </div>
}

export function MatrixDesk({ concept, settings }: { concept?: string; settings: Settings }) {
  if (!hasMatrixDesk(concept)) return null
  return <Calculation key={concept} initial={concept} settings={settings}/>
}
