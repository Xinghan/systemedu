'use client'

import { useState } from 'react'
import css from './matrix-desk.module.css'

const layouts = ['投影表', '按头分组', '按位置拼回']
export function HeadSplit() {
  const [layout, setLayout] = useState(0)
  const [selected, setSelected] = useState(5)
  const position = Math.floor(selected / 4)
  const head = Math.floor(selected % 4 / 2)
  const coord = selected % 2
  const split = layout === 1
  return <div className={css.desk} role="group" aria-label="拆头与拼接">
    <h3>跟着一个数拆头，再拼回去</h3>
    <p>点选一个数，再切换排列方式。蓝色属于头 1，橙色属于头 2。观察选中数字的坐标如何变化。</p>
    <div className={css.modes}>{layouts.map((name, i) => <button type="button" key={name} aria-pressed={i === layout} onClick={() => setLayout(i)}>{name}</button>)}</div>
    <div className={css.tiles} data-split={split}>{split && ['头 1 · 位置 1', '头 1 · 位置 2', '头 2 · 位置 1', '头 2 · 位置 2'].map((label, i) =>
      <small key={label} style={{top: i * 47}}>{label}</small>)}{Array.from({length: 8}, (_, i) => {
      const p = Math.floor(i / 4), h = Math.floor(i % 4 / 2), k = i % 2
      const x = split ? 1 + k : i % 4
      const y = split ? 2 * h + p : p
      return <button type="button" key={i} aria-label={'追踪数字 ' + (i + 1)} aria-pressed={selected === i}
        data-head={h} style={{ transform: 'translate(' + 100 * x + '%, ' + 100 * y + '%)' }}
        onClick={() => setSelected(i)}><span>{i + 1}</span></button>
    })}</div>
    <p className={css.note}>{split ? '每种颜色是一张小表。每张表的两行仍然对应位置 1、2，两列对应这个头的两个坐标。' : '每行对应一个位置，从左到右是投影后的四个坐标。'}</p>
    <p aria-live="polite">数字 <b>{selected + 1}</b> {split ? '在头 ' + (head + 1) + '，属于位置 ' + (position + 1) + ' 的第 ' + (coord + 1) + ' 个头内坐标。' : '在位置 ' + (position + 1) + ' 的第 ' + (selected % 4 + 1) + ' 列。'}{layout === 2 && '这里专门演示拼接的次序，所以用原数拼回。实际模型拼接的是每个头经过注意力计算后读回的值。'}</p>
    <a className={css.readLink} href="/standalone/transformer-lab?view=model&part=attention&from=heads">在 3D 模型里找出每个头的 16 个坐标 →</a>
  </div>
}
