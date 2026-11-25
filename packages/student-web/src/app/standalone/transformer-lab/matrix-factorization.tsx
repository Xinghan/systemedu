'use client'

import { useState } from 'react'
import css from './matrix-desk.module.css'

export function MatrixFactorization() {
  const [last, setLast] = useState(6)
  const [multiplier, setMultiplier] = useState(1)
  const [second, setSecond] = useState(false)
  const target = [2, 4, last]
  const output = [multiplier, 2 * multiplier, 3 * multiplier + Number(second)]
  const correct = output.every((x, i) => x === target[i])
  return <div className={css.desk} role="group" aria-label="还原矩阵">
    <h3>一条规则够不够还原整张表？</h3>
    <p>第一行固定为 (1，2，3)。试着只调一个倍数，让第二行同时符合三个目标。算对以后，把目标的最后一格改为 7，再试一次。</p>
    <div className={css.modes}>{[6, 7].map(goal => <button type="button" key={goal} aria-pressed={goal === last} onClick={() => setLast(goal)}>最后一格取 {goal}</button>)}</div>
    <label className={css.multiplier}>第二行的倍数 <b>{multiplier}</b><input aria-label="第二行的倍数" type="range" min={0} max={4} value={multiplier} onChange={e => setMultiplier(Number(e.target.value))}/></label>
    <label className={css.edit}><input type="checkbox" checked={second} onChange={e => setSecond(e.target.checked)}/>加入第二项，只给右下角加 1</label>
    <table className={css.grid}><caption>核对第二行</caption><thead><tr><td/>{[1, 2, 3].map(n => <th scope="col" key={n}>第 {n} 列</th>)}</tr></thead>
      <tbody><tr><th scope="row">目标</th>{target.map((x, i) => <td key={i}>{x}</td>)}</tr>
      <tr><th scope="row">算出的值</th>{output.map((x, i) => <td key={i} className={x === target[i] ? css.match : css.mismatch}>{x}{x === target[i] ? ' ✓' : ' ≠'}</td>)}</tr></tbody></table>
    <p role="status">{correct ? '两行六个格子都已还原。' : '第二行还差一些。'}{second
      ? '第一项先把 (1，2，3) 乘以 ' + multiplier + '。第二项用列 (0，1) 乘行 (0，0，1)，只在第二行第三列补上 1。'
      : '现在只用一个外积，列 (1，' + multiplier + ') 乘以行 (1，2，3)。三个输出共用同一个倍数。'}</p>
    <details className={css.extension}><summary>为什么把倍数调得更细，也不能同时得到 2、4、7？</summary>
      <p>第一列已经把倍数定为 2÷1＝2。沿用它，第三列必然是 3×2＝6。若为了得到 7 把倍数改成 7÷3，第一列也会跟着改变。第二个外积允许我们单独补上这个差额。</p></details>
  </div>
}
