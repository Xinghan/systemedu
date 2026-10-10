"use client"

import { useEffect, useState } from "react"
import katex from "katex"
import "katex/dist/katex.min.css"
import type { SlideTechnicalVisual } from "@/lib/types/api"
import { answerMatches, formatRegression as fmt, regressionEvidence, signedRegression as signed, withPrediction, type RegressionRow } from "@/lib/regression-evidence"
import { RegressionScatter } from "./regression-scatter"
import "./regression-evidence.css"

type Spec = Extract<SlideTechnicalVisual, { renderer: "regression-evidence" }>

function Equation({ latex }: { latex: string }) {
  let html: string | null = null
  try {
    html = katex.renderToString(latex, { displayMode: true, output: "htmlAndMathml", throwOnError: true, trust: false, strict: "ignore" })
  } catch {
    html = null
  }
  return html ? <div className="re-equation" role="math" aria-label={latex} dangerouslySetInnerHTML={{ __html: html }} /> : <pre className="re-equation re-formula-error">{latex}</pre>
}

function Scores({ rows }: { rows: RegressionRow[] }) {
  const m = regressionEvidence(rows)
  return <dl className="re-scores" aria-live="polite"><div><dt>MAE · 平均绝对误差</dt><dd>{fmt(m.mae)}</dd><small>{fmt(m.sumAbsolute)} ÷ {m.n}</small></div><div className="re-rmse"><dt>RMSE · 均方根误差</dt><dd>{fmt(m.rmse)}</dd><small>√({fmt(m.sumSquared)} ÷ {m.n})</small></div><div><dt>最大绝对误差</dt><dd>{fmt(m.largest.absolute)}</dd><small>回到样本 {m.largest.id} 检查</small></div></dl>
}

function EvidenceTable({ rows, selected, onSelect, reveal = true, step = 3 }: { rows: RegressionRow[]; selected?: string; onSelect?: (id: string) => void; reveal?: boolean; step?: number }) {
  return <div className="re-table-scroll"><table className="re-table"><thead><tr><th>样本</th><th>真实 y</th><th>预测 ŷ</th>{reveal && <><th>误差 e</th>{step >= 1 && <th>|e|</th>}{step >= 2 && <th>e²</th>}</>}</tr></thead><tbody>{regressionEvidence(rows).rows.map(row => <tr key={row.id} className={row.id === selected ? "re-selected" : ""}><th scope="row">{onSelect ? <button type="button" aria-label={`查看分子 ${row.id}`} onClick={() => onSelect(row.id)}>{row.id}</button> : row.id}</th><td>{fmt(row.actual)}</td><td>{fmt(row.predicted)}</td>{reveal && <><td className={row.error < 0 ? "re-low" : row.error > 0 ? "re-high" : ""}>{signed(row.error)}</td>{step >= 1 && <td>{fmt(row.absolute)}</td>}{step >= 2 && <td>{fmt(row.squared)}</td>}</>}</tr>)}</tbody></table></div>
}

function NumberLine({ row }: { row: RegressionRow }) {
  const error = row.predicted - row.actual
  const x = (value: number) => 42 + value * 44
  return <div className="re-numberline"><svg viewBox="0 0 540 200" role="img" aria-label={`分子 ${row.id}：真实 ${row.actual}，预测 ${row.predicted}，误差 ${signed(error)}`}>
    <path d="M 42 115 H 504" stroke="#8BA2AB" strokeWidth="2" />
    {Array.from({ length: 11 }, (_, i) => <g key={i}><path d={`M ${x(i)} 109 V 122`} stroke="#8BA2AB" /><text x={x(i)} y="148" textAnchor="middle" fontSize="13" fill="#5C737E">{i}</text></g>)}
    <path d={`M ${x(row.actual)} 77 H ${x(row.predicted)}`} stroke="#C75C36" strokeWidth="5" />
    <path d={`M ${x(row.actual)} 62 V 121`} stroke="#3B7D68" strokeWidth="2" />
    <path d={`M ${x(row.predicted)} 76 V 121`} stroke="#C75C36" strokeWidth="2" />
    <circle cx={x(row.actual)} cy="115" r="6" fill="#3B7D68" /><circle cx={x(row.predicted)} cy="115" r="5" fill="#C75C36" />
    <text x={x(row.actual)} y="35" textAnchor="middle" fontSize="16" fill="#347360">真实 {fmt(row.actual)}</text>
    <text x={x(row.predicted)} y="183" textAnchor="middle" fontSize="16" fill="#B54F2C">预测 {fmt(row.predicted)}</text>
  </svg><p>绿线固定真实值；橙线定位预测值。向左偏低，向右偏高。</p></div>
}

function SignedInspector({ v, adjustable = false }: { v: Spec; adjustable?: boolean }) {
  const [id, setId] = useState("A")
  const original = v.rows.find(row => row.id === id) || v.rows[0]
  const [value, setValue] = useState(v.rows[0].predicted)
  const row = adjustable ? { ...original, predicted: value } : original
  const error = row.predicted - row.actual
  return <><div className="re-toolbar"><b>{adjustable ? "同一个真实值，预测可以连续改变" : "逐条检查：符号告诉你偏向哪里"}</b><div className="re-buttons">{v.rows.map(item => <button key={item.id} type="button" className={id === item.id ? "active" : ""} onClick={() => { setId(item.id); setValue(item.predicted) }}>分子 {item.id}</button>)}</div></div><div className="re-two"><div><NumberLine row={row} />{adjustable && <label className="re-slider">调整预测值：{fmt(value)}<input aria-label="当前分子的预测值" type="range" min="0" max="10" step="0.1" value={value} onChange={e => setValue(Number(e.target.value))} /></label>}</div><div className="re-explanation"><span className="re-kicker">先约定符号</span><Equation latex={`e=\\hat y-y=${fmt(row.predicted)}-${fmt(row.actual)}=${fmt(error)}`} /><p className="re-lead">{error === 0 ? "正好命中：误差为 0" : error > 0 ? `预测偏高 ${fmt(error)}` : `预测偏低 ${fmt(-error)}`}</p><p>符号保留方向，绝对值衡量差距。评价连续数值，先量误差；如果要判定是否合格，还需要事先约定容许误差。</p><Equation latex={`|e|=${fmt(Math.abs(error))}`} /></div></div></>
}

function ScatterInspector({ v }: { v: Spec }) {
  const [selected, setSelected] = useState("D")
  const row = v.rows.find(item => item.id === selected) || v.rows[0]
  return <div className="re-two"><RegressionScatter rows={v.rows} onSelect={setSelected} /><div><EvidenceTable rows={v.rows} selected={selected} onSelect={setSelected} step={0} /><div className="re-note"><b>当前检查：样本 {row.id}</b><p>坐标 ({fmt(row.actual)}, {fmt(row.predicted)})，竖直误差为 {signed(row.predicted - row.actual)}。{row.predicted === row.actual ? "它落在预测=真实线上。" : row.predicted < row.actual ? "点在线下方，预测偏低。" : "点在线上方，预测偏高。"}</p></div><Equation latex={`e_${row.id}=${fmt(row.predicted)}-${fmt(row.actual)}=${fmt(row.predicted - row.actual)}`} /><p className="re-muted">贴线表示这批样本的误差较小，不能仅凭这张图保证模型能推广到新数据。</p></div></div>
}

function Cancellation() {
  const [distance, setDistance] = useState(2)
  const pair = [{ id: "高估", actual: 5, predicted: 5 + distance }, { id: "低估", actual: 5, predicted: 5 - distance }]
  return <><div className="re-toolbar"><b>反例实验：一条高估，一条等量低估</b><span>教学构造，不是实测数据</span></div><label className="re-slider">两条误差的大小：{fmt(distance)}<input aria-label="抵消示例的误差大小" type="range" min="0" max="4" step="0.1" value={distance} onChange={e => setDistance(Number(e.target.value))} /></label><div className="re-two"><div className="re-explanation"><h3>直接平均，方向会抵消</h3><Equation latex={`\\bar e=\\frac{${fmt(distance)}+(-${fmt(distance)})}{2}=0`} /><p className="re-lead">平均有符号误差始终为 0</p><p>这只说明高估和低估互相抵消，不能据此说预测准确。</p></div><div className="re-explanation"><h3>先量距离，错误不会消失</h3><Equation latex={`\\mathrm{MAE}=\\frac{|${fmt(distance)}|+|-${fmt(distance)}|}{2}=${fmt(distance)}`} /><p className="re-lead">每一条都偏了 {fmt(distance)}</p><p>先取绝对值或平方，再汇总，才能衡量误差大小。</p></div></div><Scores rows={pair} /></>
}

function FormulaWorkshop({ v }: { v: Spec }) {
  const [step, setStep] = useState(0)
  const m = regressionEvidence(v.rows)
  const states = [
    { title: "① 计算有符号误差", latex: "e_i=\\hat y_i-y_i", note: "保持预测减真实的约定。A=-0.2，D=-3，符号表示偏低。" },
    { title: "② 取绝对值并平均", latex: `\\mathrm{MAE}=\\frac{\\sum |e_i|}{${m.n}}=\\frac{${fmt(m.sumAbsolute)}}{${m.n}}=${fmt(m.mae)}`, note: "每条距离等权相加；没有正负抵消。" },
    { title: "③ 平方、平均、开根", latex: `\\mathrm{RMSE}=\\sqrt{\\frac{\\sum e_i^2}{${m.n}}}=\\sqrt{\\frac{${fmt(m.sumSquared)}}{${m.n}}}\\approx ${fmt(m.rmse)}`, note: "D 的误差 -3 平方后贡献 9；开根后回到目标量的同一数值尺度。" },
  ]
  return <><div className="re-buttons re-steps">{states.map((state, i) => <button key={state.title} type="button" className={step === i ? "active" : ""} onClick={() => setStep(i)}>{state.title}</button>)}</div><EvidenceTable rows={v.rows} selected={step === 2 ? "D" : "A"} step={step} /><Equation latex={states[step].latex} /><p className="re-lead" aria-live="polite">{states[step].note}</p>{step === 2 && <Scores rows={v.rows} />}</>
}

function Counterexample({ v }: { v: Spec }) {
  const [mode, setMode] = useState("source")
  const rows = mode === "source" ? v.rows : v.rows.map(row => ({ ...row, predicted: row.actual + (mode === "small" ? 0.2 : 3) }))
  const m = regressionEvidence(rows)
  return <><div className="re-toolbar"><b>两把尺子接近，能直接断言“误差小”吗？</b><span>切换受控反例</span></div><div className="re-buttons"><button type="button" className={mode === "small" ? "active" : ""} onClick={() => setMode("small")}>每条都偏高 0.2</button><button type="button" className={mode === "large" ? "active" : ""} onClick={() => setMode("large")}>每条都偏高 3</button><button type="button" className={mode === "source" ? "active" : ""} onClick={() => setMode("source")}>原作业五条误差</button></div><div className="re-two"><div className="re-error-bars">{m.rows.map(row => <div key={row.id}><b>{row.id}</b><span><i style={{ width: `${row.absolute / 3 * 100}%` }} /></span><strong>{fmt(row.absolute)}</strong></div>)}<p>每条绝对误差，统一刻度 0—3</p></div><div className="re-explanation"><Equation latex={"\\mathrm{RMSE}\\geq\\mathrm{MAE}"} /><p className="re-lead">{mode === "large" ? "两者都是 3，但每条都错了 3。" : mode === "small" ? "两者都是 0.2，每条都错了 0.2。" : "差距提示误差大小不均，需要回到具体样本。"}</p><p>相等说明每条绝对误差相同，不说明数值小。是否足够准确，还要看单位、任务容许误差和独立测试条件。</p></div></div><Scores rows={rows} /></>
}

function OutlierLab({ v }: { v: Spec }) {
  const original = v.rows.find(row => row.id === "D") || v.rows[0]
  const [prediction, setPrediction] = useState(original.actual)
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    if (!playing) return
    let progress = 0
    const timer = window.setInterval(() => {
      progress = Math.min(1, progress + 0.025)
      setPrediction(Number((original.actual + progress * (original.predicted - original.actual)).toFixed(1)))
      if (progress >= 1 || document.hidden) setPlaying(false)
    }, 100)
    return () => window.clearInterval(timer)
  }, [playing, original.actual, original.predicted])
  const rows = withPrediction(v.rows, original.id, prediction)
  const m = regressionEvidence(rows)
  const d = m.rows.find(row => row.id === original.id)!
  const move = (value: number) => { setPlaying(false); setPrediction(value) }
  return <><div className="re-toolbar"><b>只改变 D 的预测值，其余四条不动</b><div className="re-buttons"><button type="button" onClick={() => { if (playing) setPlaying(false); else { setPrediction(original.actual); setPlaying(true) } }}>{playing ? "暂停演示" : "播放 D 偏离过程"}</button><button type="button" onClick={() => move(original.actual)}>D 回到对角线</button><button type="button" onClick={() => move(original.predicted)}>恢复原作业 D=3</button></div></div><div className="re-two"><RegressionScatter rows={rows} editable onMove={move} /><div><div className="re-explanation"><span className="re-kicker">D 的真值固定为 {fmt(original.actual)}</span><label className="re-slider">D 的预测值：{fmt(prediction)}<input aria-label="D 的预测值" type="range" min="0" max="10" step="0.1" value={prediction} onChange={e => move(Number(e.target.value))} /></label><Equation latex={`e_D=${fmt(prediction)}-${fmt(original.actual)}=${fmt(d.error)}`} /><Equation latex={`|e_D|=${fmt(d.absolute)},\\quad e_D^2=${fmt(d.squared)}`} /><p>当前 D 占绝对误差总和的 <b>{fmt(d.absolute / m.sumAbsolute * 100, 1)}%</b>，占平方误差总和的 <b>{fmt(d.squared / m.sumSquared * 100, 1)}%</b>。</p></div><div className="re-metric-bars"><span>MAE</span><meter min="0" max="3" value={m.mae} /><b>{fmt(m.mae)}</b><span>RMSE</span><meter min="0" max="3" value={m.rmse} /><b>{fmt(m.rmse)}</b></div><p className="re-muted">两条指标条使用同一 0—3 刻度。拖点改变的是教学数据，不是在重新训练溶解度模型。</p></div></div><Scores rows={rows} /></>
}

function downloadEvidence(rows: RegressionRow[], conclusion: string) {
  const m = regressionEvidence(rows)
  const report = { project: "molecule-monster-hunter", node: "M40-w0-module", dataType: "原作业教学数据；未标明物理单位", convention: "prediction - actual", rows: m.rows, mae: m.mae, rmse: m.rmse, conclusion }
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }))
  const link = document.createElement("a")
  link.href = url
  link.download = "M40-regression-evidence.json"
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function StudentWorkshop({ v }: { v: Spec }) {
  const m = regressionEvidence(v.rows)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState(false)
  const [selected, setSelected] = useState("")
  const [mae, setMae] = useState("")
  const [rmse, setRmse] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const correct = m.rows.every(row => answerMatches(answers[row.id] || "", row.error))
  const complete = correct && selected === m.largest.id && answerMatches(mae, m.mae) && answerMatches(rmse, m.rmse)
  const conclusion = "D 的绝对误差最大，平方项使它对 RMSE 的影响更突出；继续核对该样本，不能仅凭一张图判断泛化表现。"
  return <><div className="re-workflow"><span className="active">1 填写误差</span><span className={checked && correct ? "active" : ""}>2 找出大错</span><span className={complete && submitted ? "active" : ""}>3 交付证据</span></div><div className="re-two"><div><h3>先算，再检查</h3><div className="re-table-scroll"><table className="re-table"><thead><tr><th>样本</th><th>预测</th><th>真实</th><th>你算的误差</th></tr></thead><tbody>{m.rows.map(row => <tr key={row.id}><th>{row.id}</th><td>{fmt(row.predicted)}</td><td>{fmt(row.actual)}</td><td><input className="re-answer" aria-label={`分子 ${row.id} 的误差答案`} inputMode="decimal" value={answers[row.id] || ""} placeholder="含正负号" onChange={e => { setAnswers({ ...answers, [row.id]: e.target.value }); setSubmitted(false) }} />{checked && <small className={answerMatches(answers[row.id] || "", row.error) ? "re-ok" : "re-high"}>{answerMatches(answers[row.id] || "", row.error) ? "正确" : "请核对预测减真实"}</small>}</td></tr>)}</tbody></table></div><button type="button" className="re-primary" onClick={() => setChecked(true)}>检查五条误差</button><p className="re-muted">练习状态只保留在当前页；完成后下载证据卡保存。</p></div><div><RegressionScatter rows={v.rows} onSelect={setSelected} /><div className="re-buttons">{v.rows.map(row => <button type="button" key={row.id} className={selected === row.id ? "active" : ""} onClick={() => setSelected(row.id)}>最大误差是 {row.id}</button>)}</div></div></div>{checked && correct && <section className="re-student-result"><h3>五条误差已核对。请计算两项总分。</h3><div className="re-result-inputs"><label>MAE<input aria-label="MAE 答案" inputMode="decimal" value={mae} onChange={e => { setMae(e.target.value); setSubmitted(false) }} /></label><label>RMSE（保留两位小数即可）<input aria-label="RMSE 答案" inputMode="decimal" value={rmse} onChange={e => { setRmse(e.target.value); setSubmitted(false) }} /></label><button type="button" className="re-primary" onClick={() => setSubmitted(true)}>核对并生成成绩单</button></div>{submitted && <div role="status">{complete ? <><p className="re-lead">成绩单已完成：MAE {fmt(m.mae)}，RMSE {fmt(m.rmse)}，重点复核 {m.largest.id}。</p><p>{conclusion}</p><button type="button" className="re-primary" onClick={() => downloadEvidence(v.rows, conclusion)}>下载我的评估证据卡</button></> : <p>还需核对：{selected !== m.largest.id ? "请在图中找到绝对误差最大的样本。" : "MAE 要先取绝对值；RMSE 要平方、平均，再开根。"}</p>}</div>}</section>}</>
}

export function RegressionEvidenceVisual({ visual: v }: { visual: Spec }) {
  const m = regressionEvidence(v.rows)
  return <section className="regression-evidence" aria-label={v.aria_label || "连续预测误差实验台"}>
    {v.scene === "overview" && <><div className="re-two"><div><span className="re-kicker">从 M39 的分类，走向连续值预测</span><h3 className="re-hero">不只问“对不对”，<br />先看“差多远”。</h3><NumberLine row={v.rows[0]} /><Equation latex="8.0-8.2=-0.2" /></div><div><EvidenceTable rows={v.rows} reveal={false} /><div className="re-note"><b>本节一路使用同一张五分子表</b><p>单条误差 → 散点位置 → MAE/RMSE → 可核查的成绩单。数据来自原作业，不另造一套漂亮的分数。</p></div></div></div></>}
    {v.scene === "task" && <SignedInspector v={v} adjustable />}
    {v.scene === "signed" && <SignedInspector v={v} />}
    {v.scene === "scatter" && <ScatterInspector v={v} />}
    {v.scene === "aggregate" && <Cancellation />}
    {v.scene === "formulas" && <FormulaWorkshop v={v} />}
    {v.scene === "counterexample" && <Counterexample v={v} />}
    {v.scene === "outlier" && <OutlierLab v={v} />}
    {v.scene === "workshop" && <StudentWorkshop v={v} />}
    {v.scene === "report" && <><div className="re-toolbar"><b>M40 / 参考评估证据卡</b><span>核对表，不代表你已完成练习</span></div><EvidenceTable rows={v.rows} selected="D" /><Scores rows={v.rows} /><div className="re-two re-report-notes"><div><h3>可以得到的结论</h3><p>这 5 条数据中，{m.largest.id} 的绝对误差最大，为 {fmt(m.largest.absolute)}；它的平方项为 {fmt(m.largest.squared)}，对平方误差总和贡献最大。</p></div><div><h3>还不能保证的事情</h3><p>原表没有标明物理单位、测量来源和测试划分。它能用于学习计算，不能当作真实溶解度模型的评估证据。</p></div></div><div className="re-workflow"><span>M39 分类判断</span><span className="active">M40 连续误差证据</span><span>后续：带入工作台评价</span></div></>}
    <footer className="re-footnote">{v.source_note} 本页约定误差 e = 预测 − 真实；有些文献的残差符号约定相反，不影响 MAE/RMSE。</footer>
  </section>
}
