"use client"

import { useEffect, useState, type ReactNode } from 'react'
import Image from 'next/image'
import type { SlideTechnicalVisual } from '@/lib/types/api'
import { getRDKitModule } from '@/lib/rdkit'
import { GROUP_SCRIPT } from '@/lib/functional-group'
import { GROUP_REFERENCES, GROUP_TRACE, groupReferenceMatches, type GroupValue } from '@/lib/functional-group-readonly'
import { MOLECULES, GEOMETRY_SOURCE, angleDegrees, distance } from '@/lib/molecule-skeleton'
import { MolecularObject3D, MoleculeDiagram } from './molecular-object-3d'
import { ExactEquation } from './screening-common'
import { useReadonlySteps } from './readonly-presentation'
import './molecular-funnel.css'
import './skeleton-evidence.css'
import './functional-group-readonly.css'

type Spec = Extract<SlideTechnicalVisual, { renderer: 'functional-group' }>
type Calculation = { rows: GroupValue[]; version: string; checked: boolean; message: string }
function useFixedCalculation(): Calculation {
  const [value, setValue] = useState<Calculation>({ rows: [...GROUP_REFERENCES], version: '2025.03.4', checked: false, message: '独立核验参考值 · 正在核对本页浏览器 RDKit' })
  useEffect(() => {
    let live = true
    getRDKitModule().then(rdkit => {
      const rows = GROUP_REFERENCES.map(r => {
        const mol = rdkit.get_mol(r.smiles)
        if (!mol) throw Error('结构解析失败')
        try { const d = JSON.parse(mol.get_descriptors()); return { smiles: r.smiles, logP: d.CrippenClogP as number, mw: d.amw as number } }
        finally { mol.delete() }
      })
      if (!groupReferenceMatches(rows)) throw Error('描述符与固定参考口径不符')
      if (live) setValue({ rows, version: rdkit.version(), checked: true, message: `浏览器 RDKit ${rdkit.version()} 实际计算，已与参考值核对` })
    }).catch(() => { if (live) setValue({ rows: [...GROUP_REFERENCES], version: '2025.03.4', checked: false, message: '本页浏览器计算暂不可用；以下保留独立核验参考值，不表示当前计算成功' }) })
    return () => { live = false }
  }, [])
  return value
}
function Note({ children }: { children: ReactNode }) { return <aside className="fgr-note">{children}</aside> }
function Status({ calculation }: { calculation: Calculation }) { return <p className="fgr-source" data-rdkit-check={calculation.checked ? 'verified' : 'reference'}>{calculation.message}</p> }
function Structure({ smiles, explicit = false }: { smiles: string; explicit?: boolean }) {
  const row = GROUP_REFERENCES.find(r => r.smiles === smiles)!
  return <section className="fgr-structure"><header><h3>{row.name}</h3><code>{smiles}</code></header><MoleculeDiagram smiles={smiles} explicitHydrogens={explicit} highlight={smiles === 'CC' ? [] : [smiles.length - 1]} /><ExactEquation source={`\\ce{${row.formula}}`} /></section>
}
function Values({ rows, all = false }: { rows: GroupValue[]; all?: boolean }) {
  return <table><caption>{all ? '同一算法 · 四个固定中性结构' : '乙烷与乙醇的固定计算对照'}</caption><thead><tr><th>结构输入</th><th>cLogP<br />无量纲</th><th>平均摩尔质量<br />g/mol</th>{all && <th>与 CC 的比较范围</th>}</tr></thead><tbody>{(all ? rows : rows.slice(0, 2)).map(r => <tr key={r.smiles} data-comparison-row={r.smiles}><th><code>{r.smiles}</code></th><td>{r.logP.toFixed(4)}</td><td>{r.mw.toFixed(3)}</td>{all && <td>{r.smiles === 'CC' ? '基线' : r.smiles === 'CCCO' ? '碳链与官能团都变了' : '保留两碳连接，改变局部原子组'}</td>}</tr>)}</tbody></table>
}
function Delta({ rows }: { rows: GroupValue[] }) {
  return <div className="fgr-delta"><span>Δ cLogP = CCO − CC</span><strong>{(rows[1].logP - rows[0].logP).toFixed(4)}</strong><span>差值不带 g/L 单位</span></div>
}
function Overview() {
  return <><p className="fgr-kicker">接续 M03：从“谁与谁相连”到“可复算的结构对照”</p><div className="fgr-two"><Structure smiles="CC" explicit /><Structure smiles="CCO" explicit /></div><table><caption>保留与改变：逐项核对，不把两个结构画成反应过程</caption><thead><tr><th>比较项</th><th>乙烷 CC</th><th>乙醇 CCO</th><th>结论</th></tr></thead><tbody><tr><th>碳骨架</th><td>C–C</td><td>C–C</td><td>两碳连接保留</td></tr><tr><th>局部连接</th><td>一个 C–H 位点</td><td>C–O–H</td><td>多一个 O；H 总数仍为 6</td></tr><tr><th>分子式</th><td>C₂H₆</td><td>C₂H₆O</td><td>不是同一种分子</td></tr></tbody></table><Note>这是两种给定结构的比较，不是把乙烷现场合成为乙醇。先保留输入，再比较同一算法的输出。</Note></>
}
function Route() {
  const calculation = useFixedCalculation()
  return <><ol className="fgr-route">{[['01 输入','CC / CCO','明确结构与局部变化'],['02 方法','Crippen cLogP','同一描述符、同一库版本'],['03 输出','前值 / 后值 / 差值','保留可复算的数字'],['04 边界','计算 ≠ 实测','只说模型支持的结论']].map(([n,v,t]) => <li key={n}><span>{n}</span><h3>{v}</h3><p>{t}</p></li>)}</ol><div className="fgr-two"><section className="fgr-panel"><Values rows={calculation.rows} /><Delta rows={calculation.rows} /></section><section className="fgr-panel"><h3>这份证据能回答什么？</h3><dl className="fgr-fields"><dt>可以说</dt><dd>在同一方法下，CCO 的计算 cLogP 低于 CC。</dd><dt>不能直接说</dt><dd>水中溶解度是多少、在某个 pH 下如何分布，或是否有毒、有效。</dd><dt>还缺什么</dt><dd>具体条件、适用模型及独立实验数据。</dd></dl></section></div><Status calculation={calculation} /></>
}
function Groups() {
  const molecule = MOLECULES.find(m => m.id === 'ethanol')!
  const oxygen = molecule.atoms.find(a => a.element === 'O')!
  const adjacent = molecule.bonds.filter(b => b.a === oxygen.id || b.b === oxygen.id).map(b => molecule.atoms[b.a === oxygen.id ? b.b : b.a])
  const carbon = adjacent.find(a => a.element === 'C')!, hydrogen = adjacent.find(a => a.element === 'H')!
  const { root, step } = useReadonlySteps(3, 3800)
  const selected = [null, oxygen.id, hydrogen.id][step], view = (['reset','face','oblique'] as const)[step]
  const labels = ['整体：两碳骨架连着羟基','沿局部平面观察 O：它连接一个 C 和一个 H','斜向检查：C–O–H 不是笔直的一条线']
  return <section ref={root} data-demo-step={step}><p className="fgr-state">{step + 1} / 3 · {labels[step]} · 自动预设观察</p><div className="fgr-two fgr-spatial"><section><MolecularObject3D molecule={molecule} showH selected={selected} readOnly presetView={view} observationPlane={[carbon.id,oxygen.id,hydrogen.id]} /><p className="fgr-source">PubChem CID 702 计算构象，RDKit {GEOMETRY_SOURCE.rdkitVersion} 核验；不是实验照片、唯一构象或分子动力学。</p><table><caption>坐标中的局部证据 · 视角变化不改变这些值</caption><tbody><tr><th>O{oxygen.id+1} 的相邻原子</th><td>C{carbon.id+1}、H{hydrogen.id+1}</td></tr><tr><th>C–O–H 夹角</th><td>{angleDegrees(carbon.position, oxygen.position, hydrogen.position).toFixed(2)}°</td></tr><tr><th>C–O / O–H 距离</th><td>{distance(carbon.position,oxygen.position).toFixed(3)} / {distance(oxygen.position,hydrogen.position).toFixed(3)} Å</td></tr></tbody></table></section><section><Structure smiles="CCO" explicit /><Structure smiles="CCN" /><ExactEquation source={String.raw`\ce{R-OH}\qquad\ce{R-NH2}`} /><p>R 代表相连的分子部分，不是元素。OH 与 NH₂ 是不同原子组，不能因为都含 H 就混为一谈。</p></section></div><Note>二维图精确说明连接，三维视角补充空间折角和遮挡。几何本身不证明氢键强度、溶解度或药效；完整连接与坐标证据一直可读。</Note></section>
}
function Controls() {
  return <><div className="fgr-three"><Structure smiles="CC" /><Structure smiles="CCO" /><Structure smiles="CCCO" /></div><table><caption>同一基线，两种比较：碳链变化有没有混入？</caption><thead><tr><th>核对变量</th><th>CC 与 CCO</th><th>CC 与 CCCO</th></tr></thead><tbody><tr><th>碳原子数</th><td>2 与 2 · 不变</td><td>2 与 3 · 改变</td></tr><tr><th>羟基</th><td>无 → 有</td><td>无 → 有</td></tr><tr><th>计算方法</th><td>同一 Crippen cLogP</td><td>同一 Crippen cLogP</td></tr><tr><th>可解释范围</th><td>指定两碳骨架上的局部替换</td><td>链长也变，不能只归因于 OH</td></tr></tbody></table><Note>“固定算法与比较结构”不是已经控制了真实溶液的一切条件。温度、物态、电离状态等并没有被这个计算自动模拟。</Note></>
}
function Phases() {
  return <><div className="fgr-two fgr-phase-head"><section><h3>乙烷：常温常压为气体</h3><p>示意气相在水面上方，不是水上的油珠。</p></section><section><h3>乙醇 + 水：可形成均一液体</h3><p>互溶不意味着所有含 OH 分子都无限溶于水。</p></section></div><figure className="fgr-figure"><Image unoptimized src="/slide-assets/molecule-monster-hunter/M04/phase-comparison-v1.webp" width={1440} height={810} alt="相态示意对照：左侧水面上方稀疏气相，右侧液体内部均一混合；不是乙烷油珠" /><figcaption>已有 AI 生成相态示意，非实验照片。放大圆中的点只表示稀疏或混合，不是精确分子、数量或浓度。</figcaption></figure><table><thead><tr><th>证据层</th><th>图或数字表达什么</th><th>不能替代什么</th></tr></thead><tbody><tr><th>相态示意</th><td>气相 / 均一混合液体</td><td>实际实验装置、扩散速率</td></tr><tr><th>计算 cLogP</th><td>结构算法的分配倾向估计</td><td>指定条件的实测溶解度</td></tr></tbody></table><Note>物态与互溶性参考 NIST / NIOSH。不要照图自行进行化学实验。</Note></>
}
function Trace() {
  const calculation = useFixedCalculation(), {root, step} = useReadonlySteps(4, 3400)
  return <section ref={root} data-demo-step={step}><div className="fgr-two"><section className="fgr-panel"><p className="fgr-kicker">自动讲解 · {step+1} / 4</p><h3>{GROUP_TRACE[step].title}</h3><pre className="fgr-code"><code>{GROUP_TRACE[step].code}</code></pre><p className="fgr-state">{GROUP_TRACE[step].result}</p></section><section className="fgr-panel"><Values rows={calculation.rows} /><Delta rows={calculation.rows} /></section></div><table><caption>完整计算轨迹 · 暂停或未播放时也能核对全部步骤</caption><thead><tr><th>步骤</th><th>输入 / 运算</th><th>结果或含义</th></tr></thead><tbody>{GROUP_TRACE.map((r,i) => <tr key={r.title} data-comparison-step={i} className={i===step?'fgr-active':''}><th>{i+1} · {r.title}</th><td><code>{r.code}</code></td><td>{r.result}</td></tr>)}</tbody></table><Status calculation={calculation} /><Note>浏览器预先计算固定输入，自动高亮只讲解运算顺序，不模拟 Python 执行速度、化学反应或溶解动力学。</Note></section>
}
function Lab() {
  const calculation = useFixedCalculation()
  return <><div className="fgr-four">{GROUP_REFERENCES.map(r=><Structure key={r.smiles} smiles={r.smiles} />)}</div><Values rows={calculation.rows} all /><Status calculation={calculation} /><Note>乙胺采用中性结构 CCN。酸碱、电离和 pH 下的分布需要另行讨论；cLogP 不是 g/L，不能任意设“溶解度通过线”。</Note></>
}
function Record() {
  const calculation = useFixedCalculation()
  return <><div className="fgr-two"><section><h3>同样输入的完整 Python 示例</h3><pre className="fgr-code"><code>{GROUP_SCRIPT}</code></pre><p className="fgr-source">代码可复算；本页不执行本机 Python。以下参考不是你的运行记录。</p></section><section className="fgr-panel"><h3>参考对照报告 · 明确证据来源</h3><dl className="fgr-fields"><dt>结构输入</dt><dd><code>CC</code> 与 <code>CCO</code></dd><dt>方法</dt><dd>RDKit / Crippen MolLogP</dd><dt>数值来源</dt><dd>{calculation.checked ? `浏览器实际计算 · ${calculation.version}` : '独立核验参考值 · RDKit 2025.03.4'}</dd></dl><Values rows={calculation.rows} /><Delta rows={calculation.rows} /><blockquote>在这一方法与给定结构下，CCO 的 cLogP 比 CC 低 1.0276。尚不能据此给出实测溶解度、毒性或药效。</blockquote></section></div><Note>这是报告结构示例，不读取或保存个人记录。课后任务再用自己的环境、实际输出和自己的表述形成证据。</Note></>
}
function Handoff() {
  return <><table className="fgr-handoff"><caption>三节课的证据递进 · 不是自动判定作业完成</caption><thead><tr><th>阶段</th><th>留下什么</th><th>下一步如何使用</th></tr></thead><tbody><tr><th>M03 骨架识读</th><td>原子、连接、计数口径与来源</td><td>判断两种结构到底改了哪里</td></tr><tr className="fgr-active"><th>M04 计算比较</th><td><code>CC / CCO</code>、同一方法、两值与 Δ = -1.0276</td><td>把变化与方法分开，保留结论边界</td></tr><tr><th>M05 结构写法</th><td>明确 SMILES 中原子、键、分支和环的写法</td><td>让后续输入可解析、比较可复查</td></tr></tbody></table><div className="fgr-two"><section className="fgr-panel"><h3>现在应能解释</h3><p>为什么先保留两碳骨架？为什么 CCCO 是另一类比较？为什么 cLogP 不能当实测溶解度？</p></section><section className="fgr-panel"><h3>仍需独立证据</h3><p>真实条件下的溶解度、pH 相关行为、模型适用性、毒性与药效，都不能从这份结构比较自动推出。</p></section></div><Note>参考内容帮助理解报告应包含什么，不表示你已经运行代码或提交成果。</Note></>
}
export function FunctionalGroupReadonly({visual}:{visual:Spec}) {
  const scenes = { overview: Overview, route: Route, groups: Groups, controls: Controls, phases: Phases, trace: Trace, lab: Lab, record: Record, handoff: Handoff }
  const Scene = scenes[visual.scene]
  return <section className="fgr" data-renderer="functional-group" data-scene={visual.scene} data-presentation="readonly" aria-label={visual.aria_label}><Scene /><footer>只读讲解 · <a href="https://www.rdkit.org/docs/source/rdkit.Chem.Crippen.html">RDKit 方法</a> · <a href="https://webbook.nist.gov/cgi/cbook.cgi?ID=C74840&Mask=4">NIST 乙烷</a> · <a href="https://www.cdc.gov/niosh/npg/npgd0262.html">NIOSH 乙醇</a> · 无个人记录读写。</footer></section>
}
