"use client"

import { useState } from "react"
import type { SlideTechnicalVisual } from "@/lib/types/api"
import { atThreshold, rocArea, rocPoints, rankingAuc, type RocPoint, type RocRow } from "@/lib/roc-evidence"
import { ExactEquation, EvidenceNote, StepControls, downloadEvidence, useTeachingSteps } from "./screening-common"
import { RocPlot } from "./roc-plot"
type Spec = Extract<SlideTechnicalVisual, { renderer: "roc-evidence" }>
const f = (v: number) => Number.isFinite(v) ? v.toFixed(2) : "+∞"

function Matrix({ p }: { p: RocPoint }) {
  return <div className="se-matrix"><div><small>真阳性 TP · 找对了</small><strong>{p.tp}</strong></div><div><small>假阳性 FP · 误报</small><strong>{p.fp}</strong></div><div><small>假阴性 FN · 漏掉了</small><strong>{p.fn}</strong></div><div><small>真阴性 TN · 排对了</small><strong>{p.tn}</strong></div></div>
}
function ScoreRows({ rows, threshold }: { rows: RocRow[]; threshold: number }) {
  return <div className="se-score-list" aria-label="分数排序与当前预测">{[...rows].sort((a, b) => b.score - a.score).map(r => <div className="se-score-row" key={r.id}><strong>{r.id}</strong><div className="se-score-track"><div className={`se-score-bar ${r.label ? "positive" : ""}`} style={{ width: `${r.score * 100}%` }} /><div className="se-score-cut" style={{ left: `${Math.min(1, threshold) * 100}%` }} /></div><output>{f(r.score)}</output><span className={`se-chip ${r.score >= threshold ? "pass" : ""}`}>{r.score >= threshold ? "判为 1" : "判为 0"}</span></div>)}<p className="se-kicker">绿色条：真值 1 · 蓝色条：真值 0 · 橙线：阈值</p></div>
}
function PointTable({ points, onPick, current }: { points: RocPoint[]; onPick?: (i: number) => void; current: number }) {
  return <div className="se-table-wrap"><table><thead><tr><th>阈值</th><th>TP</th><th>FP</th><th>TPR</th><th>FPR</th></tr></thead><tbody>{points.map((p, i) => <tr key={i} data-active={i === current}><td>{onPick ? <button type="button" onClick={() => onPick(i)} aria-label={`选择阈值 ${f(p.threshold)}`}>{f(p.threshold)}</button> : f(p.threshold)}</td><td>{p.tp}</td><td>{p.fp}</td><td>{f(p.tpr)}</td><td>{f(p.fpr)}</td></tr>)}</tbody></table></div>
}
function Metrics({ p, auc }: { p: RocPoint; auc: number }) { return <div className="se-metrics"><div className="se-metric"><span>当前 TPR</span><strong>{f(p.tpr)}</strong></div><div className="se-metric"><span>当前 FPR</span><strong>{f(p.fpr)}</strong></div><div className="se-metric"><span>整条曲线 AUC</span><strong>{f(auc)}</strong></div></div> }

export function RocEvidenceVisual({ visual }: { visual: Spec }) {
  const { scene, rows, source_note } = visual
  const points = rocPoints(rows), auc = rocArea(points)
  const steps = useTeachingSteps(points.length, ["sweep", "lab", "code"].includes(scene) ? 0 : 4)
  const [threshold, setThreshold] = useState(.63), [variant, setVariant] = useState("original"), [answers, setAnswers] = useState(["", "", ""]), [checked, setChecked] = useState(false)
  const [segment, setSegment] = useState(1)
  const p = ["threshold", "rates"].includes(scene) ? atThreshold(rows, threshold) : points[steps.step]
  const choosePoint = (i: number) => { if (["threshold", "rates"].includes(scene)) setThreshold(points[i].threshold); else steps.jump(i) }
  const record = { node: "M38-w0-roc", source: source_note, positive_label: 1, decision: "score >= threshold", rows, points, auc, pairwise_auc: rankingAuc(rows), selected: p, limitation: "教学样例，不是新模型的真实评估，也不证明概率校准。" }
  let content: React.ReactNode

  if (["overview", "threshold", "rates", "sweep", "lab"].includes(scene)) {
    content = <>
      {scene === "overview" && <div className="se-process"><div><strong>① 8 条分数</strong><small>真值 + 预测分数</small></div><div><strong>② 设定阈值</strong><small>逐条判 0 / 1</small></div><div><strong>③ 数 TP / FP</strong><small>变成一对比率</small></div><div><strong>④ ROC → AUC</strong><small>点连成线，再量面积</small></div></div>}
      <div className="se-grid"><div className="se-panel"><p className="se-kicker">同一批样本 · 不改变真值</p><h3>{scene === "rates" ? "先数对分母，才画得对坐标" : "阈值经过一条分数，预测就会改变"}</h3><ScoreRows rows={rows} threshold={p.threshold} />{["threshold", "rates"].includes(scene) ? <><label>当前阈值 <output>{f(threshold)}</output><input aria-label="分类阈值" type="range" min="0" max="1" step=".01" value={Number.isFinite(threshold) ? threshold : 1} onChange={e => setThreshold(Number(e.target.value))} /></label><div className="se-controls">{[.9, .63, .5, .1].map(t => <button className="secondary" key={t} type="button" onClick={() => setThreshold(t)}>{f(t)}</button>)}</div></> : <><StepControls steps={steps} count={points.length} label="阈值扫描" /><p aria-live="polite">阈值 <output>{f(p.threshold)}</output>，分数大于或等于它的样本判为 1。</p></>}<Matrix p={p} /></div><div><RocPlot points={points} current={p} revealed={["sweep", "lab"].includes(scene) ? steps.step + 1 : points.length} onPick={choosePoint} /><Metrics p={p} auc={auc} /></div></div>
      <div className="se-grid"><ExactEquation source={String.raw`\mathrm{TPR}=\frac{\mathrm{TP}}{\mathrm{TP}+\mathrm{FN}}=\frac{${p.tp}}{${p.tp + p.fn}}=${f(p.tpr)}`} /><ExactEquation source={String.raw`\mathrm{FPR}=\frac{\mathrm{FP}}{\mathrm{FP}+\mathrm{TN}}=\frac{${p.fp}}{${p.fp + p.tn}}=${f(p.fpr)}`} /></div>
      <EvidenceNote>{scene === "rates" ? "TPR 的分母是真值为 1 的全部样本；FPR 的分母是真值为 0 的全部样本，不是预测为 1 的样本。" : "只把真值为 1 的样本新纳入：向上移动；只把真值为 0 的样本新纳入：向右移动。比率不减，但不一定同时上升。"}</EvidenceNote>
      <details><summary>展开所有可复核阈值与坐标</summary><PointTable points={points} current={points.findIndex(x => x.threshold === p.threshold)} onPick={choosePoint} /></details>
    </>
  } else if (scene === "area") {
    const a = points[segment], b = points[segment + 1], contribution = (b.fpr - a.fpr) * (a.tpr + b.tpr) / 2
    content = <><div className="se-grid"><RocPlot points={points} current={b} area onPick={i => setSegment(Math.min(i, points.length - 2))} /><div className="se-panel"><h3>把面积拆成可以复算的条带</h3><p>点击一段，查看它的横向宽度和两端高度。</p><div className="se-controls">{points.slice(1).map((_, i) => <button type="button" className="secondary" aria-pressed={segment === i} key={i} onClick={() => setSegment(i)}>段 {i + 1}</button>)}</div><ExactEquation source={String.raw`A_i=(x_{i+1}-x_i)\frac{y_i+y_{i+1}}{2}`} /><dl><dt>宽度 ΔFPR</dt><dd><output>{f(b.fpr)} − {f(a.fpr)} = {f(b.fpr - a.fpr)}</output></dd><dt>平均高度</dt><dd><output>({f(a.tpr)} + {f(b.tpr)}) / 2</output></dd><dt>本段贡献</dt><dd><output>{contribution.toFixed(4)}</output></dd></dl><ExactEquation source={String.raw`\mathrm{AUC}=\sum_i A_i=${auc.toFixed(2)}`} /><p>竖直段宽度为 0，不增加面积；原样例面积为 0.75。</p></div></div><EvidenceNote>同分样本必须一起判入，连接同分组前后的点；不能任意拆分它们来抬高 AUC。下页可以实际检验同分情况。</EvidenceNote></>
  } else if (scene === "limits" || scene === "compare") {
    const chosen = rows.map(r => ({ ...r, score: variant === "square" ? r.score ** 2 : variant === "tie" ? .5 : variant === "perfect" ? r.label ? .9 : .1 : variant === "reverse" ? 1 - r.score : r.score }))
    const curve = rocPoints(chosen), value = rocArea(curve)
    content = <><div className="se-controls">{(scene === "limits" ? [["original", "原分数"], ["square", "每个分数平方"], ["tie", "全部同分"]] : [["original", "原课程模型"], ["perfect", "构造：完美排序"], ["reverse", "构造：反向排序"]]).map(([key, label]) => <button key={key} type="button" className="secondary" aria-pressed={variant === key} onClick={() => setVariant(key)}>{label}</button>)}</div><div className="se-grid"><RocPlot points={curve} current={atThreshold(chosen, .5)} area /><div className="se-panel"><h3>{scene === "limits" ? "分数变了，排序一定变吗？" : "用同一批真值比较三种排序"}</h3><p>显示判定阈值：<output>0.50</output></p><ScoreRows rows={chosen} threshold={.5} /><div className="se-metric"><span>从当前分数重新计算</span><strong>AUC {f(value)}</strong></div><ExactEquation source={String.raw`\mathrm{AUC}=\frac{W+\frac12 T}{N_+N_-}`} /><p>W：正样本得分更高的对数；T：同分对数。4 个正样本 × 4 个负样本，共 16 对。面积与逐对计算一致。</p></div></div><EvidenceNote>{variant === "square" ? "平方后所有分数都改变，但它们在 0–1 内的顺序不变，所以 AUC 仍为 0.75。同样的 0.5 阈值却会给出不同判定。" : variant === "tie" ? "全部分数相同时，只有全不选 / 全选两个端点。每对获得半分，AUC = 0.5；不能按样本排列顺序凭空画出完美阶梯。" : "这里只比较相同样本上的排序；AUC 不替你决定阈值，不证明分数是校准过的概率，也不证明分子安全。"}</EvidenceNote></>
  } else if (scene === "workshop") {
    const task = atThreshold(rows, .63), correct = answers.every((s, i) => s.trim() !== "" && Math.abs(Number(s) - [task.tpr, task.fpr, auc][i]) < .005)
    content = <div className="se-grid"><div className="se-panel"><h3>练习数据：阈值固定在 0.63</h3><ScoreRows rows={rows} threshold={.63} /><p>真值 1：M1、M3、M4、M6；真值 0：M2、M5、M7、M8。</p><details><summary>需要提示？</summary><Matrix p={task} /><p>本页使用比率 0–1，不用百分数。AUC 要综合全部阈值，不能只看本页这一点。</p></details></div><div className="se-panel tint"><h3>交付你的 ROC 证据卡</h3>{["TPR（0–1）", "FPR（0–1）", "完整 ROC 的 AUC"].map((label, i) => <label className="se-check" key={label}>{label}<input aria-label={label} type="number" min="0" max="1" step=".01" value={answers[i]} onChange={e => { setChecked(false); setAnswers(a => a.map((v, j) => j === i ? e.target.value : v)) }} /></label>)}<div className="se-controls"><button type="button" onClick={() => setChecked(true)}>检查我的计算</button></div>{checked && <p className="se-feedback" role="status">{correct ? "三项核对通过！证据卡包含原数据、阈值、全部坐标和你的计算。" : "还需要核对：TPR 数真阳性 / 4，FPR 数假阳性 / 4；AUC 是整条曲线的面积。"}</p>}<button type="button" disabled={!checked || !correct} onClick={() => downloadEvidence("M38-my-roc-evidence.json", { ...record, selected: task, learner_answers: answers.map(Number), checked: true })}>下载我的证据卡</button><EvidenceNote>得到指标 → 回查样本 → 说明边界。后续模型报告会继续用这张可复核的证据卡。</EvidenceNote></div></div>
  } else if (scene === "code") {
    const lines = ["from sklearn.metrics import roc_curve, roc_auc_score", "y_true  = [1, 0, 1, 1, 0, 1, 0, 0]", "y_score = [.92, .81, .74, .63, .55, .42, .34, .18]", "fpr, tpr, thresholds = roc_curve(", "    y_true, y_score, drop_intermediate=False)", "auc = roc_auc_score(y_true, y_score)", "print(f'AUC={auc:.2f}')  # AUC=0.75"]
    content = <><div className="se-grid wide"><div><pre className="se-code">{lines.map((line, i) => <div key={i} data-active={Math.min(steps.step, 6) === i}><span className="se-number">{i + 1}</span>{line}</div>)}</pre><div className="se-controls"><button type="button" onClick={() => steps.jump((steps.step + 1) % 7)}>下一行示意</button><button type="button" className="secondary" onClick={() => downloadEvidence("M38-roc-inputs.json", { y_true: rows.map(r => r.label), y_score: rows.map(r => r.score) })}>下载原始数据</button></div><EvidenceNote>这里是代码执行示意，不在浏览器运行 Python。使用连续分数，不要把已经分好的 0 / 1 标签当作 y_score。</EvidenceNote></div><div className="se-panel"><h3>预期返回值，可以逐行核对</h3><PointTable points={points} current={-1} /><p><output>AUC = 0.75</output></p><p>保留中间阈值，方便教学时逐点对照。</p></div></div></>
  } else {
    content = <><div className="se-report"><p className="se-kicker">可追溯的评估产物 / 参考报告</p><h3>8 行样本 → 9 个阈值点 → AUC 0.75</h3><div className="se-grid"><PointTable points={points} current={-1} /><div><ExactEquation source={String.raw`\mathrm{AUC}=\frac{12}{16}=0.75`} /><p>正类约定：标签 1。分数越高越倾向正类；判定规则是 score ≥ threshold。</p><p>排名判别力：本样例 AUC 0.75。具体阈值要结合误报 / 漏报代价，不能由 AUC 自动决定。</p><p>来源：原动画与游戏相同的 8 条教学样本。不是新训练模型的测试成绩。</p><button type="button" onClick={() => downloadEvidence("M38-reference-roc-report.json", record)}>下载参考报告</button></div></div></div><EvidenceNote>递进关系：本节点画 ROC / AUC → M39 检查分类成绩单 → M40 检查连续预测误差。分类与回归的指标不能混用。</EvidenceNote></>
  }
  return <section className="se" aria-label={visual.aria_label} data-renderer="roc-evidence" data-scene={scene}>{content}<p className="se-source">{source_note} <a href="https://scikit-learn.org/stable/modules/generated/sklearn.metrics.roc_curve.html" target="_blank" rel="noreferrer">ROC 定义</a> · 数值变化是本地教学计算，不是模型训练。</p></section>
}
