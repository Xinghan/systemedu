import { useEffect, useState } from 'react'
import { Pager } from './primitives'

const columns = ['CADENCENO', 'TIME_BKJD', 'PDCSAP_FLUX', 'SAP_QUALITY']
type Observation = { id: number; time: number | null; flux: number | null; quality: number | null }

// The course projection uses four numeric fields. Empty FITS measurements stay empty.
export function readQ3Table(text: string): Observation[] {
  const [header, ...lines] = text.trimEnd().split(/\r?\n/)
  if (header !== columns.join(',')) throw new Error('观测表的列名与本课说明不符。')
  return lines.map(line => {
    const values = line.split(',').map(v => v === '' ? null : Number(v))
    const [id, time, flux, quality] = values
    if (values.length !== columns.length || id === null || !Number.isInteger(id) || values.some(v => v !== null && !Number.isFinite(v))) {
      throw new Error('这份观测表含有无法读取的记录。')
    }
    return { id, time, flux, quality }
  })
}

export function Q3Observations({ url, onNote }: { url: string; onNote: () => void }) {
  const [rows, setRows] = useState<Observation[]>()
  const [error, setError] = useState('')
  const [range, setRange] = useState('example')
  const [query, setQuery] = useState('')
  const [finiteOnly, setFiniteOnly] = useState(true)
  const [page, setPage] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    fetch(url, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('这台设备上的 Q3 观测表无法打开。')
      const data = readQ3Table(await response.text())
      if (!controller.signal.aborted) setRows(data)
    }).catch(e => { if (!controller.signal.aborted) setError(e.message) })
    return () => controller.abort()
  }, [url])
  const visible = rows?.filter(row => {
    if (finiteOnly && (row.time === null || row.flux === null)) return false
    if (query && !String(row.id).startsWith(query)) return false
    if (range === 'example') return row.id >= 10400 && row.id <= 10503
    if (range === 'practice') return row.time !== null && row.time >= 280 && row.time <= 282
    return true
  }) ?? []
  const count = Math.ceil(visible.length / 8)
  return <div className="q3-observations">
    <p>Kepler-10 · 第三个观测季度 · 校正通量</p>
    <label>查看范围<select value={range} onChange={e => { setRange(e.target.value); setQuery(''); setPage(0) }}>
      <option value="example">课文示例 · 空白两侧的观测</option><option value="practice">自己核对 · 第 280 至 282 天</option><option value="all">整个季度</option>
    </select></label>
    <label>查找观测编号<input inputMode="numeric" value={query} placeholder="例如 10400" onChange={e => { setRange('all'); setQuery(e.target.value.trim()); setPage(0) }}/></label>
    <label><input type="checkbox" checked={finiteOnly} onChange={e => { setFiniteOnly(e.target.checked); setPage(0) }}/>只显示图上有点的记录</label>
    {error ? <p role="alert">{error}</p> : !rows ? <p role="status">正在读取本机数据…</p> : <>
      <p role="status">共 {rows.length} 条记录，当前显示范围内有 {visible.length} 条。</p>
      {visible.length > 0 && <table><thead><tr><th>观测编号</th><th>时间<br/>BKJD，天</th><th>校正通量<br/>电子／秒</th><th>质量标记</th></tr></thead><tbody>{visible.slice(page * 8, (page + 1) * 8).map(row => <tr key={row.id}><td>{row.id}</td><td>{row.time?.toFixed(4) ?? '缺测'}</td><td>{row.flux?.toFixed(2) ?? '缺测'}</td><td>{row.quality ?? '缺测'}</td></tr>)}</tbody></table>}
      {count > 1 && <Pager index={page} count={count} onChange={setPage}/>}
      <button className="wide-button" onClick={onNote}>写下我的观察</button>
    </>}
    <a href={url} target="_blank" rel="noreferrer">导出完整 CSV 表</a>
  </div>
}
