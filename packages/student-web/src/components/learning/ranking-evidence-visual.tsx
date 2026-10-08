"use client"

import { useMemo, useState, type ReactNode } from "react"
import type { SlideTechnicalVisual } from "@/lib/types/api"
import { ACTIVITY_WEIGHTS, DEFAULT_WEIGHTS, RANKING_DATA_NOTE, SCORE_LABELS, makeRankingRows, normalizeWeights, rankCandidates, rankingEvidence, scaleValue, unitComparison, type FourScores, type RankedRow, type RankingResult } from "@/lib/ranking-evidence"
import { DEFAULT_ORDER, GATES, makeCandidates, rejectStage, runFunnel } from "@/lib/funnel-evidence"
import { ExactEquation, EvidenceNote, StepControls, downloadEvidence, useTeachingSteps } from "./screening-common"
import "./ranking-evidence.css"

type Spec = Extract<SlideTechnicalVisual, { renderer: "ranking-evidence" }>
const colors = ["#377966", "#B07B31", "#557E9B", "#938676"]
const fixed = (n: number) => n.toFixed(3)
function Panel({ title, children }: { title: string; children: ReactNode }) { return <section className="se-panel"><h3>{title}</h3>{children}</section> }
function Legend() { return <div className="rk-legend">{SCORE_LABELS.map((label, i) => <span key={label}><i style={{ background: colors[i] }} />{label}</span>)}</div> }
function Contributions({ values, total }: { values: number[]; total: number }) {
  return <div className="rk-track" role="img" aria-label={`贡献依次为 ${values.map(fixed).join("、")}；总分 ${fixed(total)}`}>
    {values.map((v, i) => <span key={i} style={{ width: `${v * 100}%`, background: colors[i] }} />)}
  </div>
}
function RankTable({ result, baseline, onSelect, selected, count = 10 }: { result: RankingResult; baseline?: RankingResult; onSelect?: (id: string) => void; selected?: string; count?: number }) {
  return <div className="se-table-wrap"><table className="rk-ranking"><caption>按未舍入总分降序；同分按 ID 升序。条形轴为 0–1。</caption><thead><tr><th>名次 / ID</th><th>四项贡献</th><th>总分</th>{baseline && <th>较基线</th>}</tr></thead><tbody>{result.ranked.slice(0, count).map(row => {
    const before = baseline?.ranked.find(r => r.id === row.id)?.rank, delta = before ? before - row.rank : 0
    return <tr key={row.id} data-active={selected === row.id}><td>{onSelect ? <button type="button" aria-label={`查看 ${row.id} 的得分明细`} aria-pressed={selected === row.id} onClick={() => onSelect(row.id)}>{row.rank}. {row.id}</button> : `${row.rank}. ${row.id}`}</td><td><Contributions values={row.contributions} total={row.total} /></td><td><output>{fixed(row.total)}</output></td>{baseline && <td>{delta === 0 ? "—" : delta > 0 ? `↑ ${delta}` : `↓ ${-delta}`}</td>}</tr>
  })}</tbody></table></div>
}
function RawTable({ rows, limit = 6 }: { rows: ReturnType<typeof makeRankingRows>; limit?: number }) {
  return <div className="se-table-wrap"><table><thead><tr><th>ID</th><th>风险 ↓</th><th>活性 ↑</th><th>logS ↑</th><th>初筛</th></tr></thead><tbody>{rows.slice(0, limit).map(row => <tr key={row.id}><td>{row.id}</td><td>{row.risk.toFixed(2)}</td><td>{fixed(row.activity)}</td><td>{row.solubility.toFixed(2)}</td><td>{row.lip}</td></tr>)}</tbody></table></div>
}
function StagePath({ active = -1 }: { active?: number }) {
  return <ol className="rk-path" aria-label="排名处理阶段">{["读取幸存行", "统一刻度", "加权求和", "全体排序", "截取 Top10"].map((name, i) => <li key={name} data-active={i === active}><span>{String(i + 1).padStart(2, "0")}</span><strong>{name}</strong></li>)}</ol>
}
function Overview() {
  const [rows] = useState(makeRankingRows)
  const result = useMemo(() => rankCandidates(rows, DEFAULT_WEIGHTS), [rows])
  return <><StagePath /><div className="se-grid"><Panel title={`M43 交来的 ${rows.length} 个幸存 ID`}><p>左边仍按 ID 排列，不是名次。风险与 logS 保持上一节点的值。</p><RawTable rows={rows} /><p className="rk-caption">完整数据参与计算；这里展示前 6 行。新增活性指标仅用于练习排名。</p></Panel><Panel title="M44 新增：总分、贡献与优先次序"><Legend /><RankTable result={result} count={6} /><p>基线权重：低风险 / 活性 / 溶解 / 初筛 = 50% / 20% / 20% / 10%。</p></Panel></div><EvidenceNote>今天的成果不是一张“最好分子”的图片，而是一份能追溯数据、刻度和权重的 Top10 排名记录。</EvidenceNote></>
}
function Eligibility() {
  const { run, rejected } = useMemo(() => {
    const all = makeCandidates()
    return { run: runFunnel(all), rejected: all.filter(r => rejectStage(r, DEFAULT_ORDER, .3) >= 0).slice(0, 3) }
  }, [])
  return <><div className="rk-milestones"><div><small>M43 硬约束</small><strong>5000 → {run.survivors.length}</strong><span>决定谁进入比较集合</span></div><div><small>M44 软排序</small><strong>{run.survivors.length} → 10</strong><span>只在幸存者中排优先级</span></div></div><div className="se-grid"><Panel title="这些被拒绝的 ID 不进入排名"><table><thead><tr><th>ID</th><th>最先未通过</th></tr></thead><tbody>{rejected.map(r => <tr key={r.id}><td>{r.id}</td><td>{GATES[DEFAULT_ORDER[rejectStage(r, DEFAULT_ORDER, .3)]].name}</td></tr>)}</tbody></table><p>即使把一个被拒行的活性分改得很高，它也不在 M44 的输入集合里。</p><ExactEquation source={String.raw`\operatorname{Top10}\subseteq\{x:\operatorname{keep}(x)=1\}`} /></Panel><Panel title="幸存者保留原身份与字段"><RawTable rows={makeRankingRows()} limit={5} /><p>排名可以权衡集合内的指标差异；不能用其他加分抵消已设定的必要硬约束。</p></Panel></div><EvidenceNote>“通过教学规则”不等于证明安全或有效。筛选和排名回答不同问题，不能互相代替。</EvidenceNote></>
}
function Scales() {
  const rows = unitComparison(1).rows
  return <><div className="se-grid"><Panel title="同三行，数值范围和方向不同"><table><thead><tr><th>教学候选</th><th>风险 ↓</th><th>活性 ↑</th><th>溶解量 ↑</th></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td>{r.id}</td><td>{r.risk}</td><td>{r.activity}</td><td>{r.solubility} mg/L</td></tr>)}</tbody></table><p>A 的风险较低、活性较高，C 的溶解量较高。没有一行在每项都占优。</p><p className="rk-caption">A/B/C 是独立构造数例，不是 M43 的分子或实测浓度。</p></Panel><Panel title="在相加之前，先回答这三件事"><ol className="rk-questions"><li><strong>量级</strong><span>10–50 和 0.1–0.9 不能直接当成相同分量。</span></li><li><strong>方向</strong><span>低风险更受偏好；不能给高风险直接加好评分。</span></li><li><strong>目标</strong><span>本例假定活性、溶解指标越大越好；真实任务可能有目标区间。</span></li></ol><ExactEquation source={String.raw`\text{原始量}\rightarrow\text{共同映射规则}\rightarrow\text{偏好得分}`} /></Panel></div><EvidenceNote>统一到 0–1 只是数学尺度一致，不自动意味着“两个 0.8 一样有价值”。映射方向、目标和权重仍需要理由。</EvidenceNote></>
}
function Normalization() {
  const steps = useTeachingSteps(3), [lower, setLower] = useState(false)
  return <><div className="se-controls"><button type="button" className="secondary" aria-pressed={!lower} onClick={() => setLower(false)}>越大越好</button><button type="button" className="secondary" aria-pressed={lower} onClick={() => setLower(true)}>越小越好</button></div><StepControls steps={steps} count={3} label="归一化过程" /><div className="se-grid"><Panel title={["① 找到同一列的范围", "② 减最小值，除以范围", "③ 对照好坏方向"][steps.step]}><ExactEquation source={String.raw`z=\frac{x-x_{\min}}{x_{\max}-x_{\min}}=\frac{x-10}{50-10}`} />{steps.step === 2 && <ExactEquation source={lower ? String.raw`v=1-z` : String.raw`v=z`} />}<p>所有行使用同一个分母 40，不是每个候选各算一把尺子。</p><table><thead><tr><th>x</th><th>x − 10</th><th>z</th><th>偏好 v</th></tr></thead><tbody>{[10, 30, 50].map(x => <tr key={x}><td>{x}</td><td>{steps.step >= 1 ? x - 10 : "待换算"}</td><td>{steps.step >= 1 ? ((x - 10) / 40).toFixed(2) : "—"}</td><td>{steps.step === 2 ? scaleValue(x, { min: 10, max: 50 }, lower).toFixed(2) : "—"}</td></tr>)}</tbody></table></Panel><Panel title="观察位置如何改变"><div className="rk-rulers">{[10, 30, 50].map(x => { const value = steps.step === 2 ? scaleValue(x, { min: 10, max: 50 }, lower) : (x - 10) / 40; return <div key={x}><span>原值 {x}</span><div className="rk-ruler"><i style={{ left: `${value * 100}%` }} /><small className="start">{steps.step ? "0" : "10"}</small><small className="end">{steps.step ? "1" : "50"}</small></div><output>{steps.step ? value.toFixed(2) : x}</output></div> })}</div><p>{steps.step === 2 && lower ? "翻转后，原值 10 的偏好分最高。" : "30 位于中间；归一化并没有让所有值相等。"}</p></Panel></div><EvidenceNote>如果最小值等于最大值，分母为零，不能套用此公式。第 9 页会检查常数列和新数据越界。</EvidenceNote></>
}
function WeightedExample() {
  const steps = useTeachingSteps(5), values: FourScores = [.9, .6, .7, 1], weights = normalizeWeights(DEFAULT_WEIGHTS)
  const contributions = values.map((v, i) => i < steps.step ? v * weights[i] : 0), sum = contributions.reduce((a, b) => a + b, 0)
  return <><StepControls steps={steps} count={5} label="四项贡献" /><div className="se-grid"><Panel title="沿用课文的 0.81 算例"><ExactEquation source={String.raw`S=\sum_{j=1}^{4}w_jv_j,\quad w_j\geq0,\quad\sum_jw_j=1`} /><table><thead><tr><th>指标</th><th>偏好分</th><th>权重</th><th>贡献</th></tr></thead><tbody>{values.map((v, i) => <tr key={i} data-active={i === steps.step - 1}><td>{SCORE_LABELS[i]}</td><td>{v.toFixed(1)}</td><td>{weights[i].toFixed(1)}</td><td>{i < steps.step ? contributions[i].toFixed(2) : "待乘"}</td></tr>)}</tbody></table><p>0.9 是已经翻转过方向的低风险偏好分，不是“毒性 0.9”。</p></Panel><Panel title={`已累计 ${steps.step} / 4 项`}><Legend /><Contributions values={contributions} total={sum} /><div className="rk-total"><small>目前累计</small><output>{sum.toFixed(2)}</output></div>{steps.step === 4 ? <ExactEquation source={String.raw`0.45+0.12+0.14+0.10=\boxed{0.81}`} /> : <p>每按一次“下一步”，增加一项可核查的乘积。播放时表格和贡献条同步变化。</p>}<p>总分由四项共同决定。没有其他候选的同规则得分，还不能宣布它是第一名。</p></Panel></div><EvidenceNote>0.81 是教学规则下的综合分，不是“81% 的成功概率”。</EvidenceNote></>
}
function UnitTrap() {
  const [grams, setGrams] = useState(false), run = unitComparison(grams ? .001 : 1)
  return <><div className="se-controls"><button type="button" className="secondary" aria-pressed={!grams} onClick={() => setGrams(false)}>溶解量用 mg/L</button><button type="button" className="secondary" aria-pressed={grams} onClick={() => setGrams(true)}>换成 g/L</button><span>只换单位，物理量没有变</span></div><div className="se-grid"><Panel title="错误示范：方向已对，但未统一刻度"><table><thead><tr><th>候选</th><th>溶解量 / {grams ? "g/L" : "mg/L"}</th><th>混合总数</th></tr></thead><tbody>{run.naive.map(r => <tr key={r.id}><td>{r.id}</td><td>{run.rows.find(x => x.id === r.id)?.solubility}</td><td>{fixed(r.total)}</td></tr>)}</tbody></table><div className="rk-result fail">只换单位，第一名变成 {run.naive[0].id}</div><p>这里故意把原始浓度数直接乘 0.2，相当于单位偷偷改变了实际分量。</p></Panel><Panel title="同规则归一化，再按同权重求和"><Legend /><RankTable result={run.correct} count={3} /><div className="rk-result pass">第一名仍为 {run.correct.ranked[0].id}</div><ExactEquation source={String.raw`\frac{a x-a x_{\min}}{a x_{\max}-a x_{\min}}=\frac{x-x_{\min}}{x_{\max}-x_{\min}},\ a>0`} /><p>换单位同时换算该列的范围，偏好分与排名保持不变。</p></Panel></div><EvidenceNote>本页 A/B/C 是构造反例。不归一化并非在所有数据上都必然改变榜单；这个反例展示的是“单位可以无意中支配权重”的风险。</EvidenceNote></>
}
function WeightControls({ raw, change }: { raw: FourScores; change: (raw: FourScores) => void }) {
  const sum = raw.reduce((a, b) => a + b, 0)
  return <><div className="rk-weights">{SCORE_LABELS.map((label, i) => <label key={label}><span><i style={{ background: colors[i] }} />{label}<output>{sum ? (raw[i] / sum * 100).toFixed(1) : "—"}%</output></span><input type="range" min="0" max="10" step="1" value={raw[i]} aria-label={`${label}相对权重`} onChange={e => change(raw.map((v, j) => i === j ? Number(e.target.value) : v) as FourScores)} /></label>)}</div><div className="se-controls"><button type="button" className="secondary" onClick={() => change([...DEFAULT_WEIGHTS])}>基线 5:2:2:1</button><button type="button" className="secondary" onClick={() => change([...ACTIVITY_WEIGHTS])}>偏重活性 2:6:1:1</button></div><p className="rk-caption">滑块是相对分量；实际权重 = 本项分量 ÷ 全部分量之和。调整一项会改变其他项的占比。</p></>
}
function Detail({ row }: { row: RankedRow }) {
  return <details className="rk-detail"><summary>查看 {row.id} 的四项计算明细</summary><table><thead><tr><th>项</th><th>偏好分</th><th>贡献</th></tr></thead><tbody>{row.normalized.map((value, i) => <tr key={i}><td>{SCORE_LABELS[i]}</td><td>{fixed(value)}</td><td>{fixed(row.contributions[i])}</td></tr>)}</tbody></table></details>
}
function WeightLab() {
  const [rows] = useState(makeRankingRows)
  const baseline = useMemo(() => rankCandidates(rows, DEFAULT_WEIGHTS), [rows])
  const [raw, setRaw] = useState<FourScores>([...DEFAULT_WEIGHTS]), [selected, setSelected] = useState("")
  const [saved, setSaved] = useState<ReturnType<typeof rankingEvidence> | null>(null), [reason, setReason] = useState("")
  const valid = raw.some(x => x > 0), result = useMemo(() => valid ? rankCandidates(rows, raw) : null, [rows, raw, valid])
  const selectedRow = result?.ranked.find(r => r.id === selected) || result?.ranked[0]
  const changed = !!saved && raw.some((v, i) => v !== saved.rawWeights[i])
  const overlap = result && saved ? result.ranked.slice(0, 10).filter(r => saved.top10.some(s => s.id === r.id)).length : null
  return <><div className="se-grid"><Panel title="只改偏好，不改数据和硬门槛"><WeightControls raw={raw} change={setRaw} />{!valid && <p role="alert" className="rk-result fail">四项都是 0：没有可用权重，暂停排名和导出。</p>}<div className="se-controls"><button type="button" disabled={!valid} onClick={() => setSaved(rankingEvidence([...raw]))}>记录方案 A</button></div><label className="rk-reason">为什么这样调整？<textarea aria-label="我的权重调整理由" rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="例如：先记录基线，再提高活性的相对权重，比较前十名。" /></label><button type="button" disabled={!valid || !saved || !changed || reason.trim().length < 5} onClick={() => downloadEvidence("M44-my-ranking-comparison.json", { schemeA: saved, schemeB: rankingEvidence(raw), learnerReason: reason.trim() })}>下载 A/B 对比成果</button><p className="rk-caption">先记录 A，再改权重并写一句理由，即可导出两次完整排名。</p></Panel><Panel title={`当前 Top10 · 共 ${rows.length} 个候选`}><Legend />{result ? <><RankTable result={result} baseline={baseline} onSelect={setSelected} selected={selectedRow?.id} />{selectedRow && <Detail row={selectedRow} />}</> : <p>请至少给一项设置非零权重。</p>}{overlap !== null && <p role="status">与记录的 A 相比，前十名重合 <strong>{overlap} / 10</strong>；候选总数没有变化。</p>}</Panel></div><EvidenceNote>权重变化不保证每次都换名次，也不保证某一候选的绝对总分上升。观察数值再下结论；不能靠改权重让 M43 已拒绝的候选“复活”。</EvidenceNote></>
}
function Pipeline() {
  const steps = useTeachingSteps(5)
  const [rows] = useState(makeRankingRows)
  const result = useMemo(() => rankCandidates(rows, DEFAULT_WEIGHTS), [rows])
  const show = steps.step >= 3 ? result.ranked.slice(0, 6) : result.scored.slice(0, 6)
  const code = ["rows = M43_survivors", "ranges = fit_columns(rows)\nvalues = orient_and_scale(rows, ranges)", "contributions = values * normalized_weights\ntotals = contributions.sum(axis=1)", "ranked = sort(-unrounded_total, id)", "top10 = ranked[:10]\nexport(rows, ranges, weights, ranked)"]
  return <><StepControls steps={steps} count={5} label="排名流水线" /><StagePath active={steps.step} /><div className="se-grid"><Panel title="当前执行动作"><pre className="rk-code">{code[steps.step]}</pre><p>数据与刻度先固定，再对每行执行同一组运算。只在排序后取前十名，不能先截取前十行再排序。</p><div className="rk-total"><small>{steps.step === 4 ? "最终输出行数" : "当前参与计算行数"}</small><output>{steps.step === 4 ? 10 : rows.length}</output></div><button type="button" disabled={steps.step !== 4} onClick={() => downloadEvidence("M44-pipeline-reference.json", rankingEvidence(DEFAULT_WEIGHTS))}>下载示范执行记录</button></Panel><Panel title={steps.step >= 3 ? "排序后前 6 行" : "原 ID 顺序的前 6 行"}><table><thead><tr><th>ID</th><th>低风险偏好</th><th>总分</th></tr></thead><tbody>{show.map(r => <tr key={r.id}><td>{r.id}</td><td>{steps.step >= 1 ? fixed(r.normalized[0]) : "待换算"}</td><td>{steps.step >= 2 ? fixed(r.total) : "待计算"}</td></tr>)}</tbody></table><p className="rk-caption">页面由 TypeScript 实际计算；左侧 Python 风格代码是对应流程说明，不伪装成正在运行 Python。</p></Panel></div></>
}
function Audit() {
  const [caseId, setCase] = useState("outlier"), [extreme, setExtreme] = useState(50)
  return <><div className="se-controls">{[["outlier", "极端值"], ["constant", "常数列"], ["future", "新数据越界"], ["tie", "同分与缺失"]].map(([id, label]) => <button type="button" className="secondary" aria-pressed={caseId === id} key={id} onClick={() => setCase(id)}>{label}</button>)}</div><div className="se-grid"><Panel title="让边界情况暴露出来">{caseId === "outlier" ? <><label>把同列最大值从 50 调到 150：<output>{extreme}</output><input type="range" min="50" max="150" step="10" aria-label="该列最大值" value={extreme} onChange={e => setExtreme(Number(e.target.value))} /></label><table><thead><tr><th>原始值</th><th>使用同一新范围的 z</th></tr></thead><tbody>{[10, 30, extreme].map((x, i) => <tr key={i}><td>{x}</td><td>{fixed(scaleValue(x, { min: 10, max: extreme }, false))}</td></tr>)}</tbody></table></> : caseId === "constant" ? <><ExactEquation source={String.raw`x_{\min}=x_{\max}\Rightarrow x_{\max}-x_{\min}=0`} /><p>连续常数列：本实现标记“无区分度”，统一贡献为 0，不进行除零。</p><p>已定义的二元初筛字段不同：保留 0/1 语义。M43 幸存者全部为 1，所以只给所有候选加相同分量。</p></> : caseId === "future" ? <><ExactEquation source={String.raw`\frac{70-10}{50-10}=1.5`} /><p>旧范围 [10, 50] 来了 70，得到 1.5。应标记越界并选择新的处理方案，不能悄悄把它称为 0–1 数据。</p><p>本排名器只比较当前固定集合；没有宣称直接支持在线新样本。</p></> : <><table><thead><tr><th>候选</th><th>未舍入总分</th><th>显示值</th></tr></thead><tbody><tr><td>B</td><td>0.8004</td><td>0.800</td></tr><tr><td>A</td><td>0.8001</td><td>0.800</td></tr></tbody></table><p>这两行不是同分：B 在 A 前。只有未舍入总分相等时，才按 ID 升序。</p><p>字段缺失或 NaN：明确拒绝该批计算，不默默填 0。</p></>}</Panel><Panel title="记录你的处理约定"><ol className="rk-questions"><li><strong>数据身份</strong><span>候选名单是否还是同一批？</span></li><li><strong>共同范围</strong><span>刻度是否被极端值改变？</span></li><li><strong>边界策略</strong><span>常数、越界、缺失和同分如何处理？</span></li><li><strong>可重算</strong><span>保存完整数值，不只保存四舍五入后的截图。</span></li></ol></Panel></div><EvidenceNote>数据一变，重新拟合的 min/max 也可能变。对比两套权重时应固定数据和映射，避免把数据变化误认成权重效应。</EvidenceNote></>
}
function Handoff() {
  const result = useMemo(() => rankCandidates(makeRankingRows(), DEFAULT_WEIGHTS), [])
  return <><div className="rk-milestones"><div><small>已完成 · M44</small><strong>可解释的 Top10</strong><span>每项贡献 + 原始数据 + 权重记录</span></div><div><small>下一步 · M45</small><strong>检查是否过于相似</strong><span>需要真实结构、指纹和多样性证据</span></div></div><div className="se-grid"><Panel title="默认权重的示范成果，不冒充你的答案"><Legend /><RankTable result={result} count={5} /><p>第 7 页下载你亲手调整的 A/B 对比；这里下载的是基线示范包。</p><button type="button" onClick={() => downloadEvidence("M44-reference-to-M45.json", rankingEvidence(DEFAULT_WEIGHTS))}>下载基线示范成果包</button></Panel><Panel title="把能复查的证据交给下一节"><ol className="rk-questions"><li><strong>输入</strong><span>M43 幸存 ID 与各项原始分。</span></li><li><strong>规则</strong><span>归一化范围、方向、实际权重及同分约定。</span></li><li><strong>输出</strong><span>完整名次、四项贡献和 Top10。</span></li><li><strong>限制</strong><span>合成 ID 没有真实分子结构，不能直接计算分子多样性。</span></li></ol></Panel></div><EvidenceNote>排名是本次目标与数据下的优先顺序，不是药物结论。下一阶段要接入经验证的结构资料，再谈 Tanimoto 或骨架多样性。</EvidenceNote></>
}

export function RankingEvidenceVisual({ visual }: { visual: Spec }) {
  const scenes: Record<Spec["scene"], ReactNode> = { overview: <Overview />, eligibility: <Eligibility />, scales: <Scales />, normalize: <Normalization />, weighted: <WeightedExample />, units: <UnitTrap />, lab: <WeightLab />, pipeline: <Pipeline />, audit: <Audit />, handoff: <Handoff /> }
  return <section className="se rk" data-renderer="ranking-evidence" data-scene={visual.scene} aria-label={visual.aria_label || "加权排名教学视觉"}>
    {scenes[visual.scene]}<p className="se-source">{RANKING_DATA_NOTE} 独立三行数例与课文 0.81 算例另有标注。公式使用 KaTeX / MathML；排名在浏览器本地重算。</p>
  </section>
}
