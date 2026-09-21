import data from './biomed-data.json'

export const BIOMED_DATA = data
export const DATA_VERSION = data.version
export type Molecule = typeof data.molecules[number]
export type MoleculeModel = typeof data.models[number]
export type Method = 'mean' | 'knn3' | 'knn5'
export type Features = 'mass' | 'three'
export type Config = { maxMass: number; maxLogP: number; missing: 'hold' | 'allow'; method: Method; features: Features; budget: number; minPrediction: number; ranking: 'solubility' | 'variety'; join: 'row' | 'id' }
export const DEFAULT_CONFIG: Config = { maxMass: 350, maxLogP: 3, missing: 'hold', method: 'mean', features: 'mass', budget: 12, minPrediction: -4, ranking: 'solubility', join: 'row' }
export const METHODS: Record<Method, string> = { mean: '训练集平均值', knn3: '3 个近邻的平均值', knn5: '5 个近邻的平均值' }
export type ProjectKind = 'filter' | 'prediction' | 'desk' | 'challenge'
export const PROJECT_KINDS: Record<string, ProjectKind> = { 'build-a-candidate-filter': 'filter', 'check-a-prediction': 'prediction', 'assemble-a-discovery-desk': 'desk', 'challenge-an-unseen-library': 'challenge' }
export const LAST_NODE: Record<ProjectKind, string> = { filter: 'M04', prediction: 'M04', desk: 'M06', challenge: 'M05' }
export type Mode = 'filter' | 'validation' | 'pipeline' | 'diagnostic' | 'transfer' | 'blind'
export type ResultRow = { id: string; name: string; mass: number | null; prediction: number | null; measured: number | null; error: number | null; reason: string; selected: boolean; cost: number; sourceId: string }
export type Result = { rows: ResultRow[]; mae: number | null; selected: number; spent: number; coverage: number; budget: number; aligned: boolean }
export type Run = { dataVersion: string; mode: Mode; config: Config; key: string; result: Result }
export type Registration = { schema: 'biomed-registration/1'; config: Config; question: string; criterion: number; rationale: string; predictions: { id: string; value: number }[]; dataVersion: string }
export type Workspace = { schema: 'biomed-workspace/1'; config: Config; runs: Run[]; probes: string[]; hypothesis: string; repairReason: string; sources: { project: string; submissionId: string; config: Config }[]; registration: Registration | null; firstBlind: Run | null; selectedError: string; reason: string; limitation: string; conclusion: string }
export const newWorkspace = (): Workspace => ({ schema: 'biomed-workspace/1', config: { ...DEFAULT_CONFIG }, runs: [], probes: [], hypothesis: '', repairReason: '', sources: [], registration: null, firstBlind: null, selectedError: '', reason: '', limitation: '', conclusion: '' })
export const configKey = (config: Config) => JSON.stringify([DATA_VERSION, config.maxMass, config.maxLogP, config.missing, config.method, config.features, config.budget, config.minPrediction, config.ranking, config.join])
export const methodKey = (config: Config) => JSON.stringify([config.method, config.method === 'mean' ? null : config.features])
const rounded = (n: number) => Math.round(n * 10000) / 10000
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length
export const pool = (split: string) => data.molecules.filter(m => m.split === split)

// 标准化统计量只从训练分组学习，目标值从不作为输入特征。
export function predict(config: Pick<Config, 'method' | 'features'>, molecule: Molecule, training = pool('train')): number {
  if (config.method === 'mean') return rounded(mean(training.map(m => m.measured)))
  const features: ('mw' | 'logp' | 'psa')[] = config.features === 'mass' ? ['mw'] : ['mw', 'logp', 'psa']
  const scales = features.map(f => { const average = mean(training.map(m => m[f])); return Math.sqrt(mean(training.map(m => (m[f] - average) ** 2))) || 1 })
  const neighbors = training.map(m => ({ m, distance: features.reduce((sum, f, i) => sum + ((m[f] - molecule[f]) / scales[i]) ** 2, 0) })).sort((a, b) => a.distance - b.distance || a.m.id.localeCompare(b.m.id)).slice(0, config.method === 'knn3' ? 3 : 5)
  return rounded(mean(neighbors.map(n => n.m.measured)))
}

export function evaluate(config: Config, mode: Mode): Result {
  const molecules = pool(mode === 'blind' ? 'blind' : 'validation')
  const predictions = molecules.map(m => ({ id: m.id, value: predict(config, m) }))
  // 故障练习模拟上游批处理改变返回顺序，修复必须按 ID 关联。
  const returned = mode === 'diagnostic' ? [...predictions.slice(1), predictions[0]] : predictions
  const pipeline = ['pipeline', 'diagnostic', 'transfer'].includes(mode)
  const budget = mode === 'transfer' ? Math.max(4, Math.floor(config.budget * .6)) : config.budget
  const rows: ResultRow[] = molecules.map((m, index) => {
    const source = config.join === 'id' ? returned.find(p => p.id === m.id)! : returned[index]
    const value = source.value
    const reason = mode !== 'filter' && !pipeline ? '纳入完整误差核对' : m.mw > config.maxMass ? '分子量超过上限' : m.logp > config.maxLogP ? '计算 logP 超过上限' : pipeline && value < config.minPrediction ? '预测低于当前门槛' : '进入候选池'
    return { id: m.id, name: m.name, mass: m.mw, prediction: mode === 'filter' ? null : value, measured: mode === 'filter' ? null : m.measured, error: mode === 'filter' ? null : rounded(Math.abs(value - m.measured)), reason, selected: mode === 'filter' ? reason === '进入候选池' : !pipeline, cost: 1 + Math.ceil(m.rings / 2), sourceId: source.id }
  })
  if (mode === 'filter') rows.push({ id: 'QC-MISSING', name: '教学故障卡：分子量缺失（非实验数据）', mass: null, prediction: null, measured: null, error: null, reason: config.missing === 'hold' ? '信息不全，待核查' : '缺失被放行，无法证明合格', selected: config.missing === 'allow', cost: 1, sourceId: 'QC-MISSING' })
  let spent = 0
  if (pipeline) {
    const remaining = rows.filter(r => r.reason === '进入候选池')
    const categories = new Set<number>()
    const rings = (row: ResultRow) => molecules.find(m => m.id === row.id)!.rings
    while (remaining.length) {
      remaining.sort((a, b) => ((b.prediction! + (config.ranking === 'variety' && !categories.has(rings(b)) ? 1 : 0)) - (a.prediction! + (config.ranking === 'variety' && !categories.has(rings(a)) ? 1 : 0))) || a.id.localeCompare(b.id))
      const row = remaining.shift()!
      row.selected = spent + row.cost <= budget
      row.reason = row.selected ? '进入复核清单' : '本次预算不足，保留待办'
      if (row.selected) { spent += row.cost; categories.add(rings(row)) }
    }
  }
  const errors = rows.flatMap(r => r.error === null ? [] : [r.error])
  return { rows, mae: errors.length ? rounded(mean(errors)) : null, selected: rows.filter(r => r.selected).length, spent, budget, coverage: new Set(rows.filter(r => r.selected && r.id !== 'QC-MISSING').map(r => molecules.find(m => m.id === r.id)!.rings)).size, aligned: rows.every(r => r.id === r.sourceId) }
}

export function runWorkspace(a: Workspace, mode: Mode): Workspace {
  const run: Run = { mode, config: { ...a.config }, key: configKey(a.config), dataVersion: DATA_VERSION, result: evaluate(a.config, mode) }
  return { ...a, runs: [...a.runs, run].slice(-16) }
}
export function register(config: Config, question: string, criterion: number, rationale: string): Registration {
  return { schema: 'biomed-registration/1', config: { ...config }, question, criterion, rationale, dataVersion: DATA_VERSION, predictions: pool('blind').map(m => ({ id: m.id, value: predict(config, m) })) }
}
export function reveal(a: Workspace, registration: Registration): Workspace {
  if (!validRegistration(registration) || a.firstBlind) return a
  return { ...a, registration: structuredClone(registration), firstBlind: { mode: 'blind', config: { ...registration.config }, key: configKey(registration.config), dataVersion: DATA_VERSION, result: evaluate(registration.config, 'blind') } }
}
export function validConfig(c: unknown): c is Config {
  const v = c as Config | null
  return !!v && Number.isFinite(v.maxMass) && v.maxMass >= 100 && v.maxMass <= 650 && Number.isFinite(v.maxLogP) && v.maxLogP >= 0 && v.maxLogP <= 7 && ['hold', 'allow'].includes(v.missing) && ['mean', 'knn3', 'knn5'].includes(v.method) && ['mass', 'three'].includes(v.features) && Number.isInteger(v.budget) && v.budget >= 4 && v.budget <= 24 && Number.isFinite(v.minPrediction) && v.minPrediction >= -8 && v.minPrediction <= 0 && ['solubility', 'variety'].includes(v.ranking) && ['row', 'id'].includes(v.join)
}
export function validRun(r: unknown): r is Run {
  const run = r as Run | null
  return !!run && validConfig(run.config) && run.dataVersion === DATA_VERSION && ['filter','validation','pipeline','diagnostic','transfer','blind'].includes(run.mode) && run.key === configKey(run.config) && JSON.stringify(run.result) === JSON.stringify(evaluate(run.config, run.mode))
}
export function validRegistration(r: unknown): r is Registration {
  const v = r as Registration | null
  return !!v && v.schema === 'biomed-registration/1' && validConfig(v.config) && typeof v.question === 'string' && !!v.question.trim() && typeof v.rationale === 'string' && !!v.rationale.trim() && Number.isFinite(v.criterion) && v.criterion >= .1 && v.criterion <= 5 && v.dataVersion === DATA_VERSION && JSON.stringify(v.predictions) === JSON.stringify(pool('blind').map(m => ({ id: m.id, value: predict(v.config, m) })))
}
export function validWorkspace(value: unknown): value is Workspace {
  const a = value as Workspace | null
  return !!a && a.schema === 'biomed-workspace/1' && validConfig(a.config) && Array.isArray(a.runs) && a.runs.length <= 16 && a.runs.every(validRun) && Array.isArray(a.probes) && a.probes.every(p => ['ids','units','missing'].includes(p)) && ['hypothesis','repairReason','selectedError','reason','limitation','conclusion'].every(k => typeof a[k as keyof Workspace] === 'string') && Array.isArray(a.sources) && a.sources.every(s => !!s && typeof s.project === 'string' && typeof s.submissionId === 'string' && validConfig(s.config)) && (!a.registration || validRegistration(a.registration)) && (!a.firstBlind || (validRun(a.firstBlind) && a.firstBlind.mode === 'blind' && !!a.registration && a.firstBlind.key === configKey(a.registration.config)))
}
export const probeEvidence = (probe: string) => {
  const ids = pool('validation').slice(0, 4).map(m => m.id)
  if (probe === 'ids') return `候选表开头：${ids.slice(0,3).join(' → ')}；预测表返回开头：${ids.slice(1,4).join(' → ')}。请逐条核对关联。`
  if (probe === 'units') return '属性表：MW 为 g/mol、logP 无量纲；预测和测量均为 log10(mol/L)。未发现本次接口单位变化。'
  return '本次诊断的 16 条分子记录均有 MW、logP、PSA 和预测值。缺失卡只在筛选课演练，不混入实验测量。'
}
export type Check = { title: string; passed: boolean }
export function deliveryChecks(kind: ProjectKind, a: Workspace): Check[] {
  const current = a.runs.filter(r => r.key === configKey(a.config))
  const ran = (mode: Mode) => current.some(r => r.mode === mode)
  const comparison = (mode: Mode) => new Set(a.runs.filter(r => r.mode === mode).map(r => mode === 'filter' ? JSON.stringify([r.config.maxMass,r.config.maxLogP,r.config.missing]) : methodKey(r.config))).size >= 2
  const checks: Check[] = []
  if (kind === 'filter') checks.push({title:'同一批分子运行过两套筛选条件',passed:comparison('filter')},{title:'当前筛选有保留、有排除，并暂存未知值',passed:ran('filter') && evaluate(a.config,'filter').selected>0 && evaluate(a.config,'filter').selected<16 && a.config.missing==='hold'})
  if (kind === 'prediction') checks.push({title:'同一验证集比较过两种预测方法',passed:comparison('validation')},{title:'当前方法已经复测；选中一个误差案例',passed:ran('validation') && pool('validation').some(m=>m.id===a.selectedError)})
  if (kind === 'desk') checks.push({title:'在本课改变过方案，保留两次系统运行',passed:new Set(a.runs.filter(r=>r.mode==='pipeline').map(r=>r.key)).size>=2},{title:'至少两项检查、自己的假设与修复理由',passed:new Set(a.probes).size>=2 && !!a.hypothesis.trim() && !!a.repairReason.trim()},{title:'当前方案按 ID 关联，诊断与缩减预算均复测',passed:a.config.join==='id' && ran('diagnostic') && ran('transfer') && ran('pipeline') && evaluate(a.config,'pipeline').selected>0 && evaluate(a.config,'transfer').selected>0})
  if (kind === 'challenge') checks.push({title:'保留预先声明的方案和第一次新数据结果',passed:!!a.registration && !!a.firstBlind},{title:'复核一个新数据误差案例',passed:pool('blind').some(m=>m.id===a.selectedError)},{title:'修改方法后复测，并标记为事后探索',passed:!!a.registration && methodKey(a.config)!==methodKey(a.registration.config) && ran('blind')},{title:'写出对原先标准的判断',passed:!!a.conclusion.trim()})
  checks.push({title:'填写自己的选择理由与适用边界（待评阅）',passed:!!a.reason.trim() && !!a.limitation.trim()})
  return checks
}
