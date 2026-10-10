"use client"

import { useEffect, useState } from "react"
import katex from "katex"
import type { SlideTechnicalVisual } from "@/lib/types/api"
import { classificationCounts, percent } from "@/lib/classification-evidence"
import "./classification-evidence.css"

type Spec = Extract<SlideTechnicalVisual, { renderer: "classification-evidence" }>
type Counts = ReturnType<typeof classificationCounts>

function MathBlock({ latex }: { latex: string }) {
  const html = katex.renderToString(latex, { displayMode: true, throwOnError: false, trust: false, output: "htmlAndMathml", strict: "ignore" })
  return <div className="ce-math" role="math" aria-label={latex} dangerouslySetInnerHTML={{ __html: html }} />
}

function SampleGrid({ counts, predicted = false }: { counts: Counts; predicted?: boolean }) {
  const [focus, setFocus] = useState<number | null>(null)
  function category(index: number) {
    return index < counts.positives ? index < counts.tp ? "tp" : "fn" : index < counts.positives + counts.fp ? "fp" : "tn"
  }
  const descriptions = { tp: "真正例：正类，被找到了", fn: "假负例：正类，被漏掉了", fp: "假正例：负类，被误报了", tn: "真负例：负类，正确排除" }
  return <div className="ce-samples">
    <div className="ce-caption"><span>每一格 = 1 个分子</span><span>{counts.total} 个固定样本</span></div>
    <div className="ce-grid" role="group" aria-label="分子样本逐格检查">
      {Array.from({ length: counts.total }, (_, index) => {
        const status = category(index)
        const positive = index < counts.positives
        return <button key={index} type="button" className={`ce-dot ${predicted ? status : positive ? "positive" : "negative"} ${focus === index ? "focused" : ""}`} aria-label={`分子 ${index + 1}：${predicted ? descriptions[status] : positive ? "真实正类" : "真实负类"}`} onClick={() => setFocus(index)}>{predicted ? status === "fn" ? "−" : status === "fp" ? "+" : "·" : positive ? "+" : ""}</button>
      })}
    </div>
    <div className="ce-legend">{predicted ? <><span><i className="tp" />找对 TP {counts.tp}</span><span><i className="fn" />漏掉 FN {counts.fn}</span><span><i className="fp" />误报 FP {counts.fp}</span><span><i className="tn" />排除 TN {counts.tn}</span></> : <><span><i className="positive" />真实正类 {counts.positives}</span><span><i className="negative" />真实负类 {counts.total - counts.positives}</span></>}</div>
    <p className="ce-inspect" aria-live="polite">{focus === null ? "点击任意分子格，核查它的真实类别和判断结果。" : `分子 ${focus + 1} · ${predicted ? descriptions[category(focus)] : focus < counts.positives ? "真实正类（要找的分子）" : "真实负类（非目标分子）"}`}</p>
  </div>
}

function Matrix({ c }: { c: Counts }) {
  return <table className="ce-matrix"><caption>真实类别 × 模型判断</caption><thead><tr><th scope="col">真实 ↓ / 预测 →</th><th scope="col">判为正类</th><th scope="col">判为负类</th></tr></thead><tbody><tr><th scope="row">真实正类 <b>{c.positives}</b></th><td className="tp"><small>TP 找到了</small><strong>{c.tp}</strong></td><td className="fn"><small>FN 漏掉了</small><strong>{c.fn}</strong></td></tr><tr><th scope="row">真实负类 <b>{c.total - c.positives}</b></th><td className="fp"><small>FP 误报了</small><strong>{c.fp}</strong></td><td className="tn"><small>TN 排除了</small><strong>{c.tn}</strong></td></tr></tbody></table>
}

function Metrics({ c }: { c: Counts }) {
  return <dl className="ce-metrics"><div><dt>准确率 · 全部判断</dt><dd>{percent(c.accuracy)}</dd><small>({c.tp} + {c.tn}) / {c.total}</small></div><div className="ce-important"><dt>召回率 · 正类找回</dt><dd>{percent(c.recall)}</dd><small>{c.tp} / {c.positives}</small></div><div><dt>精确率 · 报出的可信度</dt><dd>{c.precision === null ? "—" : percent(c.precision)}</dd><small>{c.precision === null ? "没有报出正类，分母为 0" : `${c.tp} / ${c.tp + c.fp}`}</small></div></dl>
}

function Compare({ v }: { v: Spec }) {
  const baseline = classificationCounts(v.total, v.positives, 0, 0)
  const example = classificationCounts(v.total, v.positives, v.true_positives, v.false_positives)
  return <><div className="ce-columns"><div><h3>全判负类的基线</h3><Matrix c={baseline} /><Metrics c={baseline} /></div><div><h3>固定判断示例</h3><Matrix c={example} /><Metrics c={example} /></div></div><div className="ce-callout"><b>先把算术核对清楚</b><p>抓到 2 个、漏掉 1 个、误报 1 个 ⇒ TN = 96 ⇒ 准确率是 98%。再看基线：尽管它的准确率有 97%，却一个正类都没有找到。先检查每种错误，再解释总分。</p></div></>
}

function Ranking() {
  const [state, setState] = useState(0)
  const states = [
    { positive: "s⁺", negative: "s⁻", relation: "s^+ > s^-", credit: "1", label: "正类排在前面", detail: "任取一个正类和一个负类，比较预测分数；正类分数较高，这一对计 1。" },
    { positive: "相同分数", negative: "相同分数", relation: "s^+ = s^-", credit: "0.5", label: "两者并列", detail: "若所有分子都得到同一个常数分数，每一对都并列。因此基线 AUC 为 0.5。" },
    { positive: "s⁺", negative: "s⁻", relation: "s^+ < s^-", credit: "0", label: "负类排在前面", detail: "正类分数较低，这一对计 0。汇总全部正负配对，才能计算排序意义上的 ROC-AUC。" },
  ]
  const current = states[state]
  return <><div className="ce-caption"><b>ROC-AUC 检查的是排序</b><button className="ce-button" type="button" onClick={() => setState((state + 1) % 3)}>下一种排序 · {state + 1}/3</button></div><div className="ce-rank"><div className="ce-rank-item positive"><small>真实正类</small><strong>{current.positive}</strong></div><div><MathBlock latex={current.relation} /><p>这一对计 <b>{current.credit}</b></p></div><div className="ce-rank-item negative"><small>真实负类</small><strong>{current.negative}</strong></div></div><p className="ce-text" aria-live="polite"><b>{current.label}：</b>{current.detail}</p><MathBlock latex="\mathrm{AUC}=\frac{N_{\mathrm{win}}+\tfrac12N_{\mathrm{tie}}}{N_+N_-}" /><div className="ce-callout"><b>一张混淆矩阵 ≠ 一组完整的预测分数</b><p>本节尚未提供连续预测分数，因此这里不填写模型的排序 AUC。也不能只凭“抓到 2 个、误报 1 个”反推出排序 AUC。</p></div></>
}

function Walkthrough({ v }: { v: Spec }) {
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    if (!playing || step >= 3) return
    const timer = window.setTimeout(() => {
      setStep(step + 1)
      if (step === 2) setPlaying(false)
    }, 1800)
    return () => window.clearTimeout(timer)
  }, [playing, step])
  const c = classificationCounts(v.total, v.positives, 0, 0)
  const labels = ["① 看真实类别", "② 基线全部判负", "③ 计算准确率", "④ 再检查召回率"]
  return <><div className="ce-caption"><b>{labels[step]}</b><div className="ce-controls"><button className="ce-button" type="button" onClick={() => { setStep(0); setPlaying(true) }}>{playing ? "重新播放" : "播放完整过程"}</button><button className="ce-button secondary" type="button" onClick={() => { setPlaying(false); setStep((step + 1) % 4) }}>下一状态</button></div></div><ol className="ce-steps">{labels.map((label, i) => <li key={label} className={i === step ? "active" : i < step ? "done" : ""}>{label}</li>)}</ol><div className="ce-columns"><SampleGrid counts={c} predicted={step >= 1} /><div className="ce-working" aria-live="polite">{step === 0 ? <><h3>测试集没有变化</h3><strong className="ce-big">3 : 97</strong><p>真实标签保留下来，才能检查每一个判断。</p></> : <><Matrix c={c} />{step >= 2 && <MathBlock latex="\mathrm{Accuracy}=\frac{0+97}{100}=97\%" />}{step >= 3 && <MathBlock latex="\mathrm{Recall}=\frac{0}{0+3}=0\%" />}</>}</div></div><p className="ce-text">{step === 3 ? "关键反差：97% 准确率与 0% 召回率同时成立。高准确率不等于能找到正类。" : "同一批样本、同一个基线；变化的只是你正在检查的证据。"}</p></>
}

function PredictionLab({ v }: { v: Spec }) {
  const [tp, setTp] = useState(v.true_positives)
  const [fp, setFp] = useState(v.false_positives)
  const c = classificationCounts(v.total, v.positives, tp, fp)
  return <><div className="ce-caption"><b>调整判断结果，看证据同步更新</b><span>教学模拟 · 不是重训模型</span></div><div className="ce-controls ce-presets"><button className="ce-button secondary" type="button" onClick={() => { setTp(0); setFp(0) }}>全判负类</button><button className="ce-button secondary" type="button" onClick={() => { setTp(2); setFp(1) }}>抓到 2 · 误报 1</button><button className="ce-button secondary" type="button" onClick={() => { setTp(2); setFp(4) }}>抓到 2 · 误报 4</button></div><div className="ce-sliders"><label>找回的正类 TP <b>{tp} / {v.positives}</b><input aria-label="找回的正类数量" type="range" min={0} max={v.positives} value={tp} onChange={e => setTp(Number(e.target.value))} /></label><label>误报的负类 FP <b>{fp}</b><input aria-label="误报的负类数量" type="range" min={0} max={10} value={fp} onChange={e => setFp(Number(e.target.value))} /></label></div><div className="ce-columns"><SampleGrid counts={c} predicted /><Matrix c={c} /></div><div aria-live="polite"><Metrics c={c} /></div><p className="ce-text">保持找回数量不变、增加误报：召回率不变，精确率下降。不要让一个总分盖住两种不同的错误。</p></>
}

function Prevalence({ v }: { v: Spec }) {
  const [positives, setPositives] = useState(v.positives)
  const c = classificationCounts(v.total, positives, 0, 0)
  const accuracyFormula = `\\mathrm{Accuracy}=1-\\frac{${positives}}{100}=${100 - positives}\\%`
  return <><div className="ce-caption"><b>只改变真实类别比例</b><span>基线始终全部判负</span></div><div className="ce-controls ce-presets">{[3, 10, 50].map(n => <button key={n} className={`ce-button ${positives === n ? "" : "secondary"}`} type="button" onClick={() => setPositives(n)}>正类 {n} / 100</button>)}</div><div className="ce-columns"><SampleGrid counts={c} /><div><MathBlock latex={accuracyFormula} /><Metrics c={c} /><div className="ce-callout"><b>分数变了，找正类的本事没有变</b><p>类别平衡只让这个基线的准确率下降到 50%；它的召回率仍为 0。类别平衡并不自动保证某个指标就足够。</p></div></div></div></>
}

const reportRows = [
  ["测试集", "100 个分子：正类 3，负类 97", "交代类别占比与测试方式"],
  ["基线", "Accuracy 97% · Recall 0%", "解释高分从哪里来"],
  ["判断示例", "TP 2 · FN 1 · FP 1 · TN 96", "计数可逐项复核"],
  ["示例指标", "Accuracy 98% · Recall 66.7% · Precision 66.7%", "三把尺子分别看"],
  ["排序 AUC", "缺少真实模型连续分数，暂不填写", "先补齐评分证据"],
  ["结论", "不能只凭准确率选模型", "结合漏报、误报与实验成本"],
]

export function ClassificationEvidenceVisual({ visual: v }: { visual: Spec }) {
  const baseline = classificationCounts(v.total, v.positives, 0, 0)
  const example = classificationCounts(v.total, v.positives, v.true_positives, v.false_positives)
  return <section className="classification-evidence" aria-label={v.aria_label || "不平衡分类的证据实验台"}>
    {v.scene === "overview" && <><div className="ce-columns"><div><p className="ce-eyebrow">同一批 100 个分子</p><SampleGrid counts={baseline} predicted /></div><div className="ce-working"><p className="ce-eyebrow">全部判为负类的基线</p><div className="ce-number-pair"><div><strong>97<span>%</span></strong><p>准确率</p></div><div><strong>0<span>/3</span></strong><p>找回的正类</p></div></div><MathBlock latex="\frac{97}{100}=97\%\quad\text{但}\quad\frac{0}{3}=0\%" /><p className="ce-text">“判对了很多”与“找到目标”是两件不同的事。</p></div></div></>}
    {v.scene === "chain" && <><div className="ce-evidence-chain"><article><span>01 / 标签计数</span><h3>先知道在找什么</h3><div className="ce-ratio"><b>3 正类</b><span>97 负类</span></div><p>真实类别是核验的依据。</p></article><article><span>02 / 判断核查</span><h3>每个错误分开数</h3><Matrix c={baseline} /></article><article><span>03 / 指标解释</span><h3>再解释分数的意义</h3><p className="ce-emphasis">Accuracy 97%</p><p className="ce-emphasis warm">Recall 0%</p><p>前者高，不代表后者也高。</p></article></div></>}
    {v.scene === "population" && <><div className="ce-columns"><SampleGrid counts={baseline} /><div className="ce-working"><h3>把分母讲清楚</h3><MathBlock latex="N=N_++N_-=3+97=100" /><dl className="ce-definition"><div><dt>正类（+）</dt><dd>本节要找的目标分子，共 3 个。</dd></div><div><dt>负类（−）</dt><dd>非目标分子，共 97 个。</dd></div><div><dt>同一测试集</dt><dd>比较判断方法时，真实标签和样本保持不变。</dd></div></dl></div></div></>}
    {v.scene === "compare" && <Compare v={v} />}
    {v.scene === "ranking" && <Ranking />}
    {v.scene === "walkthrough" && <Walkthrough v={v} />}
    {v.scene === "lab" && <PredictionLab v={v} />}
    {v.scene === "prevalence" && <Prevalence v={v} />}
    {v.scene === "checklist" && <><div className="ce-evidence-chain"><article><span>判断结果</span><h3>在这个工作点漏了多少？</h3><MathBlock latex="\mathrm{Recall}=\frac{TP}{TP+FN}" /><p>关注漏掉的目标；同时看误报数量与精确率。</p></article><article><span>连续分数</span><h3>目标有没有排在前面？</h3><MathBlock latex="\mathrm{AUC}=P(s^+>s^-)+\frac12P(s^+=s^-)" /><p>要有完整预测分数，不能用单张混淆矩阵替代。</p></article><article><span>项目目标</span><h3>下一步实验负担多大？</h3><p className="ce-emphasis">漏报 × 机会成本</p><p className="ce-emphasis warm">误报 × 实验成本</p><p>严重不平衡时，也应结合精确率—召回率表现。</p></article></div><div className="ce-callout"><b>评价原则：不能只凭准确率选模型，也不能只认 AUC。</b><p>相同测试条件下，把类别比例、排序能力、具体漏报和误报一起报告。</p></div></>}
    {v.scene === "report" && <><div className="ce-caption"><b>M39 阶段产出 / 评估证据卡</b><span>可复核 · 可带入下一阶段</span></div><table className="ce-report"><thead><tr><th>要交的证据</th><th>本节已经核对</th><th>解释责任</th></tr></thead><tbody>{reportRows.map(([label, value, why]) => <tr key={label}><th scope="row">{label}</th><td>{value}</td><td>{why}</td></tr>)}</tbody></table><div className="ce-next"><span>M15<br /><b>数清正负样本</b></span><span>M37 / M38<br /><b>学会矩阵与排序</b></span><span className="active">M39<br /><b>给出有证据的评价</b></span><span>M40<br /><b>检查连续数值的误差</b></span></div></>}
    <footer className="ce-footer">固定教学数据，不代表真实药物筛选成绩。所有计数和比例均由同一组样本推导。{v.scene === "compare" ? ` 核验：${example.tp}+${example.fn}+${example.fp}+${example.tn}=${example.total}。` : ""}</footer>
  </section>
}
