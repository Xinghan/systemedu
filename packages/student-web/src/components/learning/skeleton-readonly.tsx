"use client"

import type { ReactNode } from 'react'
import type { SlideTechnicalVisual } from '@/lib/types/api'
import { MOLECULES, GEOMETRY_SOURCE, moleculeCounts, elementCounts, centerBondAngle, planeDeviation, distance, type MolecularGeometry } from '@/lib/molecule-skeleton'
import { MolecularObject3D, MoleculeDiagram } from './molecular-object-3d'
import { MoleculeSkeletonVisual } from './molecule-skeleton-visual'
import { ExactEquation, EvidenceNote } from './screening-common'
import { useReadonlySteps } from './readonly-presentation'
import './molecular-funnel.css'
import './science-readonly.css'

type Spec = Extract<SlideTechnicalVisual, { renderer: 'molecule-skeleton-evidence' }>
const weights: Record<string, number> = { H: 1.008, C: 12.011, O: 15.999 }
const byId = (id: string) => MOLECULES.find(m => m.id === id)!
const neighbors = (m: MolecularGeometry, id: number) => m.bonds.filter(b => b.a === id || b.b === id).map(b => { const a = m.atoms[b.a === id ? b.b : b.a]; return `${a.element}${a.id + 1}` }).join('、')
function Counts({ m }: { m: MolecularGeometry }) { const c = moleculeCounts(m); return <dl className="sr-fields"><dt>重原子 + 氢</dt><dd>{c.heavy} + {c.hydrogens} = {c.atoms} 个原子</dd><dt>全部连接（含氢）</dt><dd>{c.bonds} 条</dd><dt>环 / 芳香环</dt><dd>{c.rings} / {c.aromaticRings}</dd><dt>平均分子质量</dt><dd>{m.mw.toFixed(3)} Da</dd></dl> }
function Source({ m }: { m: MolecularGeometry }) { return <p className="se-source">{m.name}：<a href={m.sourceUrl} target="_blank" rel="noreferrer">PubChem CID {m.cid}</a> 计算构象，坐标单位 Å；经 RDKit {GEOMETRY_SOURCE.rdkitVersion} 核验。不是实验照片、唯一构象或分子动力学。球棍大小、颜色用于辨识。</p> }
function Spatial({ scene }: { scene: 'overview' | 'vocabulary' | 'aromatic' | 'scan' }) {
  const m = byId(scene === 'aromatic' ? 'benzene' : scene === 'overview' ? 'methane' : 'ethanol')
  const scan = scene === 'scan', vocabulary = scene === 'vocabulary', aromatic = scene === 'aromatic'
  const { root, step } = useReadonlySteps(scan ? m.atoms.length + 1 : 3, scan ? 2100 : 3600)
  const views = ['reset', 'face', 'edge'] as const, view = scan || vocabulary ? 'reset' : views[step]
  const vocabularyOrder = m.atoms.filter(a => a.element !== 'H').toSorted((a, b) => a.element.localeCompare(b.element))
  const selected = scan ? step ? step - 1 : null : vocabulary ? vocabularyOrder[step].id : null
  const angle = centerBondAngle(m), c = moleculeCounts(m)
  const viewNames = { reset: '空间视角', face: '相对参考平面的正面', edge: '沿参考平面的侧面' }
  const cc = m.bonds.filter(b => m.atoms[b.a].element === 'C' && m.atoms[b.b].element === 'C').map(b => distance(m.atoms[b.a].position, m.atoms[b.b].position))
  return <section ref={root} data-demo-step={step}>
    <p className="sr-view-label">{scan ? `按文件顺序读取：${step} / ${m.atoms.length} 个原子` : vocabulary ? `定位 ${vocabularyOrder[step].element}${vocabularyOrder[step].id + 1}：连接关系见完整表格` : `预设视角 ${step + 1} / 3 · ${viewNames[view]}`} · 自动演示，不需要操作模型</p>
    <div className="sr-spatial"><section><MolecularObject3D molecule={m} showH selected={selected} readOnly presetView={view} /><Source m={m} /></section><section className="se-panel"><p className="se-kicker">{scan ? '结构文件 → 计数证据' : '二维读连接 · 三维看空间'}</p><h3>{m.name}</h3><MoleculeDiagram smiles={m.smiles} explicitHydrogens /><ExactEquation source={`\\ce{${m.formula}}`} />
      {scan ? <><p>当前已读：重原子 {m.atoms.slice(0, step).filter(a => a.element !== 'H').length} + 氢 {m.atoms.slice(0, step).filter(a => a.element === 'H').length} = {step}。</p><p>文件总计：重原子 {c.heavy} + 氢 {c.hydrogens} = {c.atoms}；全部连接 {c.bonds}。</p></> : <Counts m={m} />}
      {aromatic ? <><p>所有原子到参考平面的最大偏离：<strong>{planeDeviation(m).toFixed(4)} Å</strong>。</p><p>六个 C–C 连接的计算长度：<strong>{Math.min(...cc).toFixed(3)}–{Math.max(...cc).toFixed(3)} Å</strong>；RDKit 芳香环数为 1。</p><p>正面检查闭合环，侧面检查共面；数值证据在暂停时仍可读。</p></> : scene === 'overview' ? <><p>甲烷的四个 H 位于四面体方向，不是平面十字；本坐标模型的一个 H–C–H 角为 <strong>{angle?.toFixed(2)}°</strong>。</p><p>预设视角展示同一组坐标。视角变化不改变原子数、键或内部夹角。</p></> : null}
    </section></div>
    {(scan || vocabulary) && <table className="sr-compact"><caption>完整原子记录 · 高亮只表示当前讲解位置</caption><thead><tr><th>顺序 / 原子</th><th>元素类别</th><th>相连原子（始终可读）</th><th>{scan ? '读取状态' : '连接数'}</th></tr></thead><tbody>{m.atoms.filter(a => scan || a.element !== 'H').map(a => <tr key={a.id} data-atom-row={a.id} className={selected === a.id ? 'sr-active' : ''}><th>{a.id + 1} / {a.element}{a.id + 1}</th><td>{a.element === 'H' ? '氢' : '重原子'}</td><td>{neighbors(m, a.id)}</td><td>{scan ? a.id < step ? '已读取' : '待读取' : m.bonds.filter(b => b.a === a.id || b.b === a.id).length}</td></tr>)}</tbody></table>}
    <EvidenceNote>{aromatic ? '几何共面本身不证明芳香性。离域描述跨越芳香体系的电子分布，不是小球沿圆圈运动；Kekulé 画法不表示真实 C–C 键长交替。' : scan ? '这里读取已经存在的结构文件，计数和高亮同步；不是原子凭空出现，也不是化学反应。完整邻接记录无需等待演示结束。' : '二维图回答“谁和谁相连”；计算构象补充空间关系。显示全部氢便于核对口径，不读取或保存你的个人观察。'}</EvidenceNote>
  </section>
}
function Mass() {
  return <><div className="se-grid">{['water', 'ethanol'].map(id => { const m = byId(id), counts = elementCounts(m), sum = Object.entries(counts).reduce((n, [e, c]) => n + weights[e] * c, 0); return <section key={id} className="se-panel"><h3>{m.name} · <code>{m.smiles}</code></h3><MoleculeDiagram smiles={m.smiles} explicitHydrogens /><ExactEquation source={`\\ce{${m.formula}}`} /><table><thead><tr><th>元素</th><th>个数</th><th>平均原子质量 / Da</th><th>贡献 / Da</th></tr></thead><tbody>{Object.entries(counts).map(([e, n]) => <tr key={e}><th>{e}</th><td>{n}</td><td>{weights[e].toFixed(3)}</td><td>{(weights[e] * n).toFixed(3)}</td></tr>)}</tbody></table><ExactEquation source={`\\begin{aligned}m&=${Object.entries(counts).map(([e, n]) => `${n}\\times${weights[e]}`).join('\\\\&\\quad+')}\\\\&=${sum.toFixed(3)}\\,\\mathrm{Da}\\end{aligned}`} /></section> })}</div><EvidenceNote>骨架图省略 H 不代表质量计算可以漏掉 H。这里是平均分子质量（Da）；相对分子质量是无单位比值，平均原子质量考虑常用同位素组成。</EvidenceNote></>
}
const OBSERVATIONS: Record<string, string> = { water: 'O 连接两个 H；计算构象呈弯曲形，不是直线。', methane: '一个 C 连接四个 H；四个方向不在同一平面。', ethanol: 'C–C–O 是重原子连接路径；加上六个 H 才是完整分子。', benzene: '六碳闭合并有六个 H；本结构含一个芳香环。' }
function ReferenceCards() {
  return <><p className="sr-view-label">四份参考观察 · 不是你的作业，也不表示个人任务已经完成</p><div className="sr-observations">{MOLECULES.map(m => <section key={m.id} className="sr-reference"><h3>{m.name} · <code>{m.smiles}</code></h3><MoleculeDiagram smiles={m.smiles} explicitHydrogens /><Counts m={m} /><p>{OBSERVATIONS[m.id]}</p></section>)}</div><EvidenceNote>“全部原子 / 连接”均包含显式氢；重原子另列。双键是两原子间的一条连接，不能把绘制线数当作连接数。课后再整理本人观察与运行证据。</EvidenceNote></>
}
const REPORT_CODE = `from rdkit import Chem
from rdkit.Chem import Descriptors, rdMolDescriptors

for smiles in ["O", "C", "CCO", "C1=CC=CC=C1"]:
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        continue
    full = Chem.AddHs(mol)
    print(smiles, mol.GetNumAtoms(), full.GetNumAtoms(),
          full.GetNumBonds(), rdMolDescriptors.CalcNumRings(mol),
          rdMolDescriptors.CalcNumAromaticRings(mol),
          Descriptors.MolWt(mol))`
function Report() {
  return <><div className="se-grid"><section className="se-panel"><h3>代码中的计数口径</h3><pre className="mf-code">{REPORT_CODE}</pre><p className="ms-caption">精简完整示例；不在网页执行本机 Python。AddHs 后再统计全部原子与连接。</p></section><section className="se-panel"><h3>同一份报告要说明什么？</h3><dl className="sr-fields"><dt>输入</dt><dd>分子名称、SMILES、来源。</dd><dt>计数口径</dt><dd>重原子单列；全部原子 / 连接包含氢。</dd><dt>运行环境</dt><dd>实际 Python/RDKit 版本及解释器位置。</dd><dt>来源边界</dt><dd>右下表为参考结果，不是你的运行记录。</dd></dl><EvidenceNote>乙醇：MolFromSmiles 的 3 个重原子 → AddHs 后 9 个原子、8 条连接。差值来自表示口径，不是生成了另一种分子。</EvidenceNote></section></div><table className="sr-compact"><caption>四个固定输入的参考结果 · 数值独立核验</caption><thead><tr><th>SMILES</th><th>重原子</th><th>含氢原子</th><th>含氢连接</th><th>环</th><th>芳香环</th><th>平均质量 / Da</th></tr></thead><tbody>{MOLECULES.map(m => { const c = moleculeCounts(m); return <tr key={m.id}><th><code>{m.smiles}</code></th><td>{c.heavy}</td><td>{c.atoms}</td><td>{c.bonds}</td><td>{c.rings}</td><td>{c.aromaticRings}</td><td>{m.mw.toFixed(3)}</td></tr> })}</tbody></table></>
}
export function SkeletonReadonly({ visual }: { visual: Spec }) {
  let body: ReactNode
  switch (visual.scene) {
    case 'overview': case 'vocabulary': case 'aromatic': case 'scan': body = <Spatial scene={visual.scene} />; break
    case 'mass': body = <Mass />; break
    case 'lab': body = <ReferenceCards />; break
    case 'report': body = <Report />; break
    case 'bonds': case 'skeleton': case 'handoff': body = <MoleculeSkeletonVisual visual={{ ...visual, renderer: 'molecule-skeleton' }} />; break
  }
  return <section className="se sr-readonly" data-renderer="molecule-skeleton-evidence" data-scene={visual.scene} data-presentation="readonly" aria-label={visual.aria_label}>{body}<footer>只读讲解 · 精确结构来自 RDKit，空间对象来自已有计算坐标；不读取、保存或判定个人成果。</footer></section>
}
