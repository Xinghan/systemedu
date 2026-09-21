import { BIOMED_DATA, DATA_VERSION, METHODS, configKey, probeEvidence, type Workspace, type ProjectKind, type Config, type Mode } from '@/lib/project-lines/biomed-model'
import styles from './biomed-workspace.module.css'

const number = (n: number | null) => n === null ? '—' : n.toFixed(3)
const modes: Record<Mode, string> = { filter: '筛选', validation: '验证集比较', pipeline: '普通预算', diagnostic: '异常批次', transfer: '缩减预算', blind: '事后探索' }
function method(config: Config) { return `${METHODS[config.method]}${config.method === 'mean' ? '（不使用结构特征）' : config.features === 'mass' ? ' · 仅分子量' : ' · 分子量、logP、极性表面积'}` }

/** 只读提交时的作品；不读取当前草稿，避免修改后悄悄改变旧报告。 */
export function BiomedArtifactReport({ kind, artifact: a }: { kind: ProjectKind; artifact: Workspace }) {
  const current = a.runs.filter(r => r.key === configKey(a.config))
  const finalMode = kind === 'filter' ? 'filter' : kind === 'prediction' ? 'validation' : kind === 'desk' ? 'pipeline' : 'blind'
  const final = current.findLast(r => r.mode === finalMode)
  const caseRun = kind === 'challenge' ? a.firstBlind : final
  const example = caseRun?.result.rows.find(r => r.id === a.selectedError)
  const transfer = current.findLast(r => r.mode === 'transfer')
  const diagnostic = current.findLast(r => r.mode === 'diagnostic')
  return <article className={styles.artifactReport} data-biomed-report>
    <header><p className={styles.eyebrow}>我的作品 / 提交时的固定版本</p><h4>{kind === 'filter' ? '候选筛选器' : kind === 'prediction' ? '预测检验报告' : kind === 'desk' ? '发现工作台档案' : '新数据研究档案'}</h4><p>数据版本 {DATA_VERSION} · 48 条训练 / 16 条验证 / 16 条新数据。保留最近 {a.runs.length} 次运行{a.firstBlind ? '，首次检验另外固定保留' : ''}。</p></header>
    {kind === 'filter' && <p>筛选表包含 16 条验证记录，以及 1 条用于练习缺失处理的 QC-MISSING 故障卡；故障卡不计入真实分子样本数。</p>}
    <section><h5>我交付的配置</h5><dl className={styles.reportFacts}>
      {(kind === 'filter' || kind === 'desk') && <><div><dt>两道筛选门</dt><dd>MW ≤ {a.config.maxMass} g/mol；计算 logP ≤ {a.config.maxLogP}</dd></div><div><dt>缺失值</dt><dd>{a.config.missing === 'hold' ? '暂存，等待核查' : '先放行（比较实验）'}</dd></div></>}
      {kind !== 'filter' && <div><dt>{kind === 'challenge' ? '事后修订方法' : '预测方法'}</dt><dd>{method(a.config)}</dd></div>}
      {kind === 'desk' && <><div><dt>复核安排</dt><dd>预算 {a.config.budget} 点；预测 logS ≥ {a.config.minPrediction}；{a.config.ranking === 'solubility' ? '较高预测优先' : '兼顾环数类别'}</dd></div><div><dt>关联方式</dt><dd>{a.config.join === 'id' ? '按分子 ID' : '按返回行号'}</dd></div></>}
    </dl></section>
    {a.registration && a.firstBlind && <section className={styles.researchRecord} data-first-result>
      <h5>先定方案，再看结果</h5><p><strong>事前问题：</strong>{a.registration.question}</p><p><strong>原方法：</strong>{method(a.registration.config)}</p><p><strong>原标准：</strong>MAE ≤ {a.registration.criterion}；{a.registration.rationale}</p>
      <div className={styles.twoCols}><div><h6>第一次检验 / 保留原样</h6><strong className={styles.reportValue}>MAE {number(a.firstBlind.result.mae)}</strong><p>{a.firstBlind.result.mae! <= a.registration.criterion ? '本批达到原标准' : '本批未达到原标准'}</p></div><div><h6>看到答案后的修订</h6><strong className={styles.reportValue}>MAE {number(final?.result.mae ?? null)}</strong><p>属于事后探索，不能替代首次检验。</p></div></div>
      <p><strong>我的判断：</strong>{a.conclusion}</p>
      <details className={styles.history}><summary>核对冻结的 16 条预测与第一次测量</summary><div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>ID</th><th>冻结预测</th><th>首次测量</th><th>绝对误差</th></tr></thead><tbody>{a.firstBlind.result.rows.map(r => <tr key={r.id}><td>{r.id}</td><td>{number(r.prediction)}</td><td>{number(r.measured)}</td><td>{number(r.error)}</td></tr>)}</tbody></table></div></details>
    </section>}
    <section><h5>我比较过的版本</h5><div className={styles.tableScroll}><table className={styles.table} data-report-comparison><thead><tr><th>次序 / 情境</th><th>当时的配置</th><th>结果</th></tr></thead><tbody>{a.runs.map((r, i) => <tr key={i}><td>{i + 1} · {modes[r.mode]}</td><td>{kind === 'filter' ? `MW≤${r.config.maxMass}；logP≤${r.config.maxLogP}；${r.config.missing === 'hold' ? '缺失暂存' : '缺失放行'}` : method(r.config)}{kind === 'desk' && <small className={styles.reportDetail}>MW≤{r.config.maxMass}；logP≤{r.config.maxLogP}；预测≥{r.config.minPrediction}；{r.config.missing === 'hold' ? '缺失暂存' : '缺失放行'}；{r.config.ranking === 'solubility' ? '预测优先' : '兼顾环数'}；{r.config.join === 'id' ? '按 ID' : '按行号'}</small>}</td><td>{r.result.mae !== null && <>MAE {number(r.result.mae)}<br /></>}{(kind === 'filter' || kind === 'desk') && <>入选 {r.result.selected} / {r.result.rows.length}</>}{kind === 'desk' && <small className={styles.reportDetail}>用掉 {r.result.spent}/{r.result.budget} 点，覆盖 {r.result.coverage} 类</small>}</td></tr>)}</tbody></table></div></section>
    {example && <section className={styles.errorCase} data-report-case><h5>{kind === 'challenge' ? '第一次检验的误差案例' : '我选定的误差案例'}</h5><p><strong>{example.id} · {example.name}</strong></p><p>预测 {number(example.prediction)}，测量 {number(example.measured)}，绝对误差 {number(example.error)}；{example.prediction === example.measured ? '两值相等' : example.prediction! > example.measured! ? '高估水溶解度' : '低估水溶解度'}。</p></section>}
    {kind === 'desk' && <section><h5>接口诊断与资源变化</h5><p><strong>原假设：</strong>{a.hypothesis}</p><ul>{a.probes.map(p => <li key={p}>{probeEvidence(p)}</li>)}</ul><p><strong>修复理由：</strong>{a.repairReason}</p><p>当前配置的异常复测：{diagnostic?.result.aligned ? '预测来源 ID 对应一致' : '待检查'}。模型误差与接口正确性分别判断。</p>{transfer && <p>普通预算入选 {final?.result.selected} 条，用掉 {final?.result.spent}/{final?.result.budget} 点；缩减后入选 {transfer.result.selected} 条，用掉 {transfer.result.spent}/{transfer.result.budget} 点，覆盖 {transfer.result.coverage} 类环数。</p>}<details className={styles.history}><summary>我接入的部件来源</summary>{a.sources.length ? <ul>{a.sources.map(s => <li key={s.project}>{s.project === 'build-a-candidate-filter' ? '我的筛选器' : '我的预测方法'} · 提交编号 {s.submissionId}</li>)}</ul> : <p>在本课制作，未导入前置正式作品。</p>}</details></section>}
    <section><h5>我的选择与边界</h5><p className={styles.studentText}>{a.reason}</p><p className={styles.studentText}><strong>还不能说明：</strong>{a.limitation}</p><p className={styles.muted}>这份作品保留了配置、计算证据与作者解释。材料完整不代表已经评分或证明了药效。</p></section>
    {final && <details className={styles.history}><summary>{kind === 'challenge' ? '查看事后修订的逐条结果' : '查看最终版本的逐条结果'} · {final.result.rows.length} 条</summary><div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>ID</th>{kind === 'filter' ? <><th>MW</th><th>计算 logP</th></> : <><th>预测</th><th>测量</th><th>绝对误差</th></>}<th>处理原因</th></tr></thead><tbody>{final.result.rows.map(r => <tr key={r.id}><td>{r.id}<small className={styles.reportDetail}>{r.name}</small></td>{kind === 'filter' ? <><td>{number(r.mass)}</td><td>{number(BIOMED_DATA.molecules.find(m => m.id === r.id)?.logp ?? null)}</td></> : <><td>{number(r.prediction)}</td><td>{number(r.measured)}</td><td>{number(r.error)}</td></>}<td>{r.reason}</td></tr>)}</tbody></table></div></details>}
  </article>
}
