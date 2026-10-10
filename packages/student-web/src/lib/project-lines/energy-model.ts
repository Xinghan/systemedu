import { generatorCAD } from './energy-geometry'
/** 手摇发电教学模型。参数用于比较，不是 FA-130 等具体电机的标定结果。 */
export const ENERGY_VERSION = 'printed-generator/1'
export const ENERGY_IDS = ['spin-a-flywheel', 'turn-motion-into-electricity', 'compare-energy-settings', 'design-a-printed-transmission', 'build-a-printed-generator'] as const
export type EnergyId = typeof ENERGY_IDS[number]
export type EnergyConfig = { teeth: 60 | 72 | 90; rpm: number; load: number; clearance: number; meshGap: number; wiring: 'raw' | 'converted' }
export const DEFAULT_ENERGY: EnergyConfig = { teeth: 72, rpm: 60, load: 220, clearance: .3, meshGap: .15, wiring: 'raw' }
export type EnergyScene = 'steady' | 'load-change' | 'coast' | 'interface' | 'tight-fit'
export const SCENE_NAMES: Record<EnergyScene, string> = { steady: '同条件运行', 'load-change': '负载改变', coast: '停止摇动后', interface: '接口检查', 'tight-fit': '装配偏紧' }
export type EnergyPoint = { t: number; crank: number; shaft: number; voltage: number; power: number; torque: number; input: number }
export type EnergyResult = { points: EnergyPoint[]; energy: number; inputEnergy: number; lossEnergy: number; storedEnergy: number; meanPower: number; peakPower: number; meanVoltage: number; meanTorque: number; unitAligned: boolean; ratio: number }
export type EnergyRun = { model: string; config: EnergyConfig; scene: EnergyScene; result: EnergyResult }
export type PrintPhoto = { id: string; data: string; caption: string }
export type BenchTest = { id: string; revision: string; turns: string; seconds: string; resistance: string; voltage: string; observation: string }
export type PrintEvidence = { frozenKey: string; material: string; measuredBore: string; before: string; after: string; change: string; motor: string; wiring: string; source: string; photos: PrintPhoto[]; tests: BenchTest[]; inspected: boolean }
export type EnergyWorkspace = { schema: 'energy-workspace/1'; config: EnergyConfig; cadSource: string; runs: EnergyRun[]; fitVersions: EnergyConfig[]; sources: { project: string; submission: string }[]; probes: string[]; hypothesis: string; repair: string; reason: string; limitation: string; physical: PrintEvidence }
export const newEnergy = (): EnergyWorkspace => ({ schema: 'energy-workspace/1', config: { ...DEFAULT_ENERGY }, cadSource: generatorCAD(DEFAULT_ENERGY), runs: [], fitVersions: [], sources: [], probes: [], hypothesis: '', repair: '', reason: '', limitation: '', physical: { frozenKey: '', material: '', measuredBore: '', before: '', after: '', change: '', motor: '', wiring: '', source: '', photos: [], tests: [], inspected: false } })
const round = (v: number) => Math.round(v * 1e6) / 1e6
export const gearRatio = (c: EnergyConfig) => (c.teeth / 18) ** 2
export const energyKey = (c: EnergyConfig) => JSON.stringify([ENERGY_VERSION, c.teeth, c.rpm, c.load, c.clearance, c.meshGap, c.wiring])
export const printKey = (c: EnergyConfig) => JSON.stringify([ENERGY_VERSION, c.teeth, c.clearance, c.meshGap])
export function validEnergyConfig(v: unknown): v is EnergyConfig {
  if (!v || typeof v !== 'object') return false
  const c = v as EnergyConfig
  return [60, 72, 90].includes(c.teeth) && Number.isFinite(c.rpm) && c.rpm >= 20 && c.rpm <= 100 && [47, 100, 220, 470, 1000].includes(c.load) && Number.isFinite(c.clearance) && c.clearance >= 0 && c.clearance <= .8 && Number.isFinite(c.meshGap) && c.meshGap >= 0 && c.meshGap <= .5 && ['raw', 'converted'].includes(c.wiring)
}

export function simulateEnergy(c: EnergyConfig, scene: EnergyScene): EnergyResult {
  const ratio = gearRatio(c), dt = .1, inertia = .000008, motorK = .002, internalR = 8
  const points: EnergyPoint[] = []
  let omega = 0, energy = 0, inputEnergy = 0, lossEnergy = 0, voltageTotal = 0, torqueTotal = 0, peakPower = 0
  for (let i = 0; i <= 600; i++) {
    const t = i * dt, driving = !(scene === 'coast' && t >= 30)
    const resistance = scene === 'load-change' && t >= 30 ? 47 : c.load
    const requested = c.rpm * Math.PI / 30 * ratio
    // 固定扭矩上限与转速反馈代表人的驱动；过紧增加阻力，不凭 UI 标签改变结果。
    const assemblyFriction = scene === 'tight-fit' ? .000012 : .000003
    const fitPenalty = c.clearance < .15 || c.meshGap < .1 ? 2.5 : 1
    const friction = assemblyFriction * fitPenalty
    const current = motorK * omega / (resistance + internalR)
    const generatorTorque = motorK * current
    const driveTorque = driving ? Math.min(.15 / ratio, Math.max(0, (requested - omega) * .0002)) : 0
    const motorVoltage = current * resistance
    const power = current ** 2 * resistance
    const dragPower = friction * omega ** 2 + current ** 2 * internalR
    const input = driveTorque * omega
    const presentedVoltage = scene === 'interface' && c.wiring === 'raw' ? motorVoltage * 1000 : motorVoltage
    if (i % 10 === 0) points.push({ t: round(t), crank: round(omega / ratio * 30 / Math.PI), shaft: round(omega * 30 / Math.PI), voltage: round(presentedVoltage), power: round(power * 1000), torque: round(driveTorque * ratio * 1000), input: round(input * 1000) })
    if (i < 600) { voltageTotal += motorVoltage; torqueTotal += driveTorque * ratio; peakPower = Math.max(peakPower, power) }
    // 每步保持驱动扭矩不变，解析积分线性阻尼；输入功、负载能量、损耗独立累计。
    if (i < 600) {
      const damping = friction + motorK ** 2 / (resistance + internalR)
      const rate = damping / inertia, equilibrium = driveTorque / damping, delta = omega - equilibrium
      const decay = Math.exp(-rate * dt)
      const integral = equilibrium * dt + delta * (1 - decay) / rate
      const squareIntegral = equilibrium ** 2 * dt + 2 * equilibrium * delta * (1 - decay) / rate + delta ** 2 * (1 - decay ** 2) / (2 * rate)
      inputEnergy += driveTorque * integral
      energy += motorK ** 2 * resistance / (resistance + internalR) ** 2 * squareIntegral
      lossEnergy += (friction + motorK ** 2 * internalR / (resistance + internalR) ** 2) * squareIntegral
      omega = equilibrium + delta * decay
    }
  }
  return { points, energy: round(energy), inputEnergy: round(inputEnergy), lossEnergy: round(lossEnergy), storedEnergy: round(.5 * inertia * omega ** 2), meanPower: round(energy / 60 * 1000), peakPower: round(peakPower * 1000), meanVoltage: round(voltageTotal / 600), meanTorque: round(torqueTotal / 600 * 1000), unitAligned: scene !== 'interface' || c.wiring === 'converted', ratio: round(ratio) }
}
export const runEnergy = (a: EnergyWorkspace, scene: EnergyScene): EnergyWorkspace => ({ ...a, runs: [...a.runs, { model: ENERGY_VERSION, config: { ...a.config }, scene, result: simulateEnergy(a.config, scene) }].slice(-10) })
export const rememberFit = (a: EnergyWorkspace): EnergyWorkspace => ({ ...a, fitVersions: [...a.fitVersions, { ...a.config }].slice(-8) })
export const FIT_PROBES: Record<string, string> = {
  source: '输入模块原始字段名是 voltage_mV，单位为 mV；接收侧显示栏约定为 V。',
  identity: '两侧使用同一次运行编号与同一秒时间戳，没有发现记录错配。',
  circuit: '负载电阻与电机参数一致，机械转速没有跳变；查看单位转换能进一步缩小排查范围。',
}
export function energyChecks(id: string, a: EnergyWorkspace) {
  const current = a.runs.filter(r => energyKey(r.config) === energyKey(a.config))
  const common = [
    { title: '说明自己的设计选择与仍未验证的边界', passed: !!a.reason.trim() && !!a.limitation.trim() },
  ]
  if (id === 'design-a-printed-transmission') return [
    { title: '保留至少两版打印配合参数', passed: new Set(a.fitVersions.map(printKey)).size >= 2 },
    { title: '当前打印版本已记录，孔径与啮合间隙明确', passed: a.fitVersions.some(c => printKey(c) === printKey(a.config)) && a.config.clearance >= .15 && a.config.meshGap >= .1 }, ...common,
  ]
  const compare = [
    { title: '相同摇速、负载与装配条件下比较两种齿数', passed: a.runs.some(x => x.scene === 'steady' && a.runs.some(y => y.scene === 'steady' && x.config.teeth !== y.config.teeth && x.config.rpm === y.config.rpm && x.config.load === y.config.load && x.config.clearance === y.config.clearance && x.config.meshGap === y.config.meshGap)) },
    { title: '当前配置完成正常与负载改变复测', passed: ['steady', 'load-change'].every(s => current.some(r => r.scene === s && r.result.unitAligned)) },
  ]
  if (id === 'compare-energy-settings') return [...compare, ...common]
  return [...compare,
    { title: '打印件经过两版设计，当前版本已留档', passed: new Set(a.fitVersions.map(printKey)).size >= 2 && a.fitVersions.some(c => printKey(c) === printKey(a.config)) },
    { title: '有假设、两项检查、同一机械配置的接口修复前后记录', passed: !!a.hypothesis.trim() && !!a.repair.trim() && new Set(a.probes).size >= 2 && a.runs.some(r => r.scene === 'interface' && !r.result.unitAligned && energyKey({...r.config,wiring:'converted'}) === energyKey(a.config)) && current.some(r => r.scene === 'interface' && r.result.unitAligned) },
    { title: '当前配置在装配偏紧情境重新运行', passed: current.some(r => r.scene === 'tight-fit') }, ...common,
  ]
}
export function physicalEnergyChecks(a: EnergyWorkspace) {
  const p = a.physical
  const n = (s: string) => s.trim() !== '' && Number.isFinite(Number(s))
  return [
    { title: '实物记录对应已冻结的当前设计', passed: p.frozenKey === printKey(a.config) },
    { title: '打印材料、结构修改、前后试配与实测孔径齐全', passed: [p.material, p.before, p.after, p.change].every(s => s.trim()) && n(p.measuredBore) && Number(p.measuredBore) > 0 },
    { title: '自己的 CAD 源、实际电机与接线记录齐全', passed: [p.source, p.motor, p.wiring].every(s => s.trim()) && p.inspected },
    { title: '至少两次同负载不同摇速的原始测量', passed: p.tests.some(x => p.tests.some(y => x.id !== y.id && [x, y].every(t => t.revision === p.frozenKey && [t.turns, t.seconds, t.resistance, t.voltage].every(n) && Number(t.turns) > 0 && Number(t.seconds) > 0 && Number(t.resistance) > 0 && t.observation.trim()) && Number(x.resistance) === Number(y.resistance) && Math.abs(Number(x.turns) / Number(x.seconds) - Number(y.turns) / Number(y.seconds)) > .05)) },
    { title: '两张本人打印装配和测量现场照片及说明', passed: p.photos.length === 2 && p.photos.every(p => p.caption.trim()) },
  ]
}
export function validEnergyWorkspace(v: unknown): v is EnergyWorkspace {
  try {
    if (!v || typeof v !== 'object') return false
    const a = v as EnergyWorkspace, text = (s: unknown, max = 900) => typeof s === 'string' && s.length <= max
    if (a.schema !== 'energy-workspace/1' || !validEnergyConfig(a.config) || !['reason', 'limitation', 'hypothesis', 'repair'].every(k => text(a[k as keyof EnergyWorkspace]))) return false
    if (a.cadSource !== generatorCAD(a.config)) return false
    if (!Array.isArray(a.runs) || a.runs.length > 10 || !a.runs.every(r => r.model === ENERGY_VERSION && validEnergyConfig(r.config) && Object.hasOwn(SCENE_NAMES, r.scene) && JSON.stringify(r.result) === JSON.stringify(simulateEnergy(r.config, r.scene)))) return false
    if (!Array.isArray(a.fitVersions) || a.fitVersions.length > 8 || !a.fitVersions.every(validEnergyConfig) || !Array.isArray(a.probes) || a.probes.length > 3 || !a.probes.every(p => Object.hasOwn(FIT_PROBES, p))) return false
    if (!Array.isArray(a.sources) || a.sources.length > 2 || !a.sources.every(s => ENERGY_IDS.includes(s.project as EnergyId) && text(s.submission, 100))) return false
    const p = a.physical
    return !!p && ['frozenKey', 'material', 'measuredBore', 'before', 'after', 'change', 'motor', 'wiring'].every(k => text(p[k as keyof PrintEvidence])) && text(p.source, 16000) && typeof p.inspected === 'boolean' && Array.isArray(p.photos) && p.photos.length <= 2 && p.photos.every(f => text(f.id, 80) && text(f.caption, 300) && text(f.data, 60000) && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(f.data)) && Array.isArray(p.tests) && p.tests.length <= 8 && p.tests.every(t => ['id', 'revision', 'turns', 'seconds', 'resistance', 'voltage', 'observation'].every(k => text(t[k as keyof BenchTest])))
  } catch { return false }
}
