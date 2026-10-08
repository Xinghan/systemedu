"use client"

import { useEffect, useState, type ReactNode } from 'react'
import Image from 'next/image'
import type { SlideTechnicalVisual } from '@/lib/types/api'
import { drawSmilesSvg } from '@/lib/rdkit'
import { DISCOVERY_MILESTONES, DISCOVERY_NOTE, DISCOVERY_ROWS, discoveryEvidence, discoveryStages, type DiscoveryId } from '@/lib/discovery-brief'
import { useReadonlySteps } from './readonly-presentation'
import './discovery-brief.css'
import './discovery-readonly.css'

type Spec = Extract<SlideTechnicalVisual, { renderer: 'discovery-brief' }>
const IMAGE = '/slide-assets/molecule-monster-hunter/M01/virtual-to-experiment-v1.webp'
const TEST_ORDER: DiscoveryId[] = ['A', 'B', 'C', 'D', 'E']
const BRIEF = [
  ['研究问题', '在给定数据集里，怎样优先找到值得继续研究的候选？'],
  ['最终交付物', '输入 SMILES 的软件工作台，以及带理由和局限的候选报告。'],
  ['预测 / 检查任务', '比较溶解度相关指标；检查指定标签或类药性规则。不同任务分别验证。'],
  ['诚实边界', '预测不替代实验；不把规则通过、模型高分写成药物安全有效。'],
]
function Structure() {
  const [svg, setSvg] = useState('')
  useEffect(() => { let active = true; drawSmilesSvg('CCO', { width: 440, height: 160 }).then(s => { if (active) setSvg(s) }).catch(() => {}); return () => { active = false } }, [])
  return <figure className="db-structure">{svg ? <div dangerouslySetInnerHTML={{ __html: svg }} /> : <code>乙醇结构写法：CCO</code>}<figcaption>乙醇 · RDKit 二维结构<code>SMILES: CCO；这里只说明表示方法，没有药效或毒性预测。</code></figcaption></figure>
}
function Brief() {
  return <dl className="db-fields">{BRIEF.map(([label, value]) => <div className="db-field-row" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
}
function Funnel() {
  const states = discoveryStages(), { root, step } = useReadonlySteps(states.length), current = states[step]
  return <section ref={root} data-demo-step={step}>
    <ol className="db-ro-counts">{states.map((s, i) => <li key={s.title} aria-current={i === step ? 'step' : undefined}><b>{s.rows.length}</b><span>{s.title}</span></li>)}</ol>
    <div className="db-two"><ol className="db-grid" aria-label="12 条候选的演示状态">{DISCOVERY_ROWS.map(r => <li key={r.id} data-kept={current.rows.some(v => v.id === r.id)}><b>{r.id}</b><span>排序分 {r.score}</span><small>{!current.rows.some(v => v.id === r.id) ? '本步未保留' : step === 4 ? r.hit ? '通过本例测试' : '未通过本例测试' : '候选 · 未验证'}</small></li>)}</ol>
      <section className="db-card"><p className="db-eyebrow">预设过程 · {step + 1} / 5</p><h3>{current.title}</h3><p>{current.note}</p><p className="db-note">灰色 ID 仍可追查；没有优先测，不等于已证明无效。</p></section></div>
    <table className="db-ro-trace"><caption>完整筛选轨迹 · 暂停时也可直接阅读</caption><thead><tr><th>步骤</th><th>保留 ID / 数量</th><th>证据含义</th></tr></thead><tbody>{states.map(s => <tr key={s.title}><th>{s.title}</th><td>{s.rows.map(r => r.id).join('、')} / {s.rows.length}</td><td>{s.note}</td></tr>)}</tbody></table>
  </section>
}
function Budget() {
  const { root, step } = useReadonlySteps(6), evidence = discoveryEvidence(TEST_ORDER.slice(0, step), 8)
  return <section ref={root} data-demo-step={step}>
    <p className="db-note">预设示范顺序：A → B → C → D → E。每取得一条新记录，消耗一次预算；不需要在 slide 上选择。</p>
    <div className="db-ro-counts db-ro-three"><div><b>5</b><span>总预算</span></div><div><b>{evidence.spent}</b><span>当前已使用</span></div><div><b>{evidence.remaining}</b><span>当前剩余</span></div></div>
    <table><caption>五次验证的完整账本 · 构造示例，不是真实实验</caption><thead><tr><th>次序 / 候选</th><th>排序分</th><th>构造结果</th><th>之后剩余预算</th></tr></thead><tbody>{TEST_ORDER.map((id, i) => { const r = DISCOVERY_ROWS.find(r => r.id === id)!; return <tr key={id} className={i === step - 1 ? 'db-ro-active' : ''}><th>{i + 1} / {id}</th><td>{r.score}</td><td>{r.hit ? '通过本例测试' : '未通过本例测试'}</td><td>{4 - i} / 5</td></tr> })}</tbody></table>
    <p className="db-note">F–L 共 7 条没有测试，结果仍然未知。重复查看旧记录不增加新证据，也不再消耗预算。最高分 A 仍可能失败。</p>
  </section>
}
function Honesty() {
  const { root, step } = useReadonlySteps(2, 3800)
  return <section ref={root} data-demo-step={step}>
    <p className="db-note">{step === 0 ? '先看“只有分数”：可以安排优先级，不能断言验证结果。' : '再对照验证记录：高分也会失败，较低分也可能通过本例测试。'}</p>
    <table><thead><tr><th>候选 / 原排序分</th><th>只有分数时</th><th>取得构造记录后</th></tr></thead><tbody>{[DISCOVERY_ROWS[0], DISCOVERY_ROWS[2], DISCOVERY_ROWS[8]].map(r => <tr key={r.id}><th>{r.id} / {r.score}</th><td className={step === 0 ? 'db-ro-active' : ''}>验证结果未知；分数不是概率</td><td className={step === 1 ? 'db-ro-active' : ''}>{r.hit ? '通过本例测试' : '未通过本例测试'}，仍不是成药结论</td></tr>)}</tbody></table>
    <p>A 得 92 分却失败，I 得 51 分却通过构造测试。缩小范围可以少测，也可能漏掉候选。</p>
  </section>
}
export function DiscoveryBriefReadonly({ visual }: { visual: Spec }) {
  let body: ReactNode
  switch (visual.scene) {
    case 'overview': body = <><figure className="db-overview" data-medium="generated-raster"><Image src={IMAGE} alt="电脑中的结构记录缩成候选短名单，再交给实验设备验证的教学示意" width={1600} height={900} unoptimized /><figcaption>生成教学插图 · 设备与数量为示意，不代表已经完成实验。</figcaption></figure><div className="db-three">{[['电脑筛选', '结构记录 → 优先候选'], ['候选报告', '保留理由、局限和待查问题'], ['后续验证', '研究人员收集新的真实证据']].map(([t, d]) => <section key={t}><h3>{t}</h3><p>{d}</p></section>)}</div><p className="db-note">最终成品是软件工作台和可追溯报告，不是一颗药。本节任务是定义项目目标，不合成、不服用、不验证药物。</p></>; break
    case 'roles': body = <div className="db-two"><ol className="db-ro-roles">{[['研究问题 / 靶点', '定义要研究的对象、过程和适用范围。', '交出：明确任务；不靠外形判断蛋白好坏。'], ['候选 / 输入', '为每个候选保留 ID 和结构写法。', '交出：可追查记录；结构本身不是药效结论。'], ['模型 / 预测', '在指定数据和任务上输出预测。', '交出：预测及适用范围；另需评估与验证。']].map(([t, d, result], i) => <li key={t}><span>0{i + 1}</span><section><h3>{t}</h3><p>{d}</p><small>{result}</small></section></li>)}</ol><section><Structure /><dl className="db-fields"><dt>示例 ID</dt><dd>example-ethanol</dd><dt>结构输入</dt><dd>CCO</dd><dt>预测状态</dt><dd>本页没有调用训练模型</dd></dl></section></div>; break
    case 'roadmap': body = <><table><caption>前一步的输出，是后一步的输入</caption><thead><tr><th>阶段产物</th><th>接收什么</th><th>交出什么 / 示例文件</th></tr></thead><tbody>{DISCOVERY_MILESTONES.map((m, i) => <tr key={m.name}><th>{i + 1} · {m.name}</th><td>{m.input}</td><td>{m.output}<code className="db-ro-file">{m.file}</code></td></tr>)}</tbody></table><p className="db-note">不是完成五次打勾，而是逐步积累证据。Top10 最多十个；不足时保留实际数量，不塞入不合格项凑数。</p></>; break
    case 'honesty': body = <Honesty />; break
    case 'funnel': body = <Funnel />; break
    case 'budget': body = <Budget />; break
    case 'brief': body = <div className="db-two"><section className="db-card"><p className="db-eyebrow">已填写的讲解示例 · 不是你的提交</p><h3>示例立项卡</h3><Brief /></section><section><h3>为什么要写清这四项？</h3><ol className="db-route"><li><b>研究问题</b><span>限制要回答的问题，避免“预测一切”。</span></li><li><b>交付物</b><span>把目标落到能运行的软件和能复查的报告。</span></li><li><b>具体任务</b><span>确定需要哪些数据、标签和评价方法。</span></li><li><b>诚实边界</b><span>区分预测、规则检查和实验事实。</span></li></ol><p className="db-note">slide 只负责讲解。完成课后任务时，再用自己的项目目标填写立项卡；这里不保存、不提交、不读取你的个人草稿。</p></section></div>; break
    case 'handoff': body = <><ol className="db-ro-handoff"><li><b>M01 / 目标</b><h3>项目立项卡</h3><p>写清研究问题、交付物、预测任务和诚实边界。</p></li><li><b>M02 / 工具</b><h3>验证 RDKit 可用</h3><p>在自己的环境按模板安装或导入，不把示范当成已经运行。</p></li><li><b>下一件证据</b><h3>版本号与运行日志</h3><p>记录实际结果，为后续画结构、算特征提供工具基础。</p></li></ol><p className="db-note">这是一条任务衔接说明，不检查你的完成状态，也不会读取本机草稿或伪造安装结果。</p></>; break
  }
  return <div className="db db-readonly" data-renderer="discovery-brief" data-scene={visual.scene} data-presentation="readonly">{body}<footer>{DISCOVERY_NOTE}</footer></div>
}
