export type ProjectLevel = 1 | 2 | 3 | 4 | 5
export const PROJECT_LEVELS = [
  { level: 1, title: { zh: '发现与操作', en: 'Explore and act' }, hint: { zh: '约 3 分钟体验 · 打开就能操作，留下第一件作品', en: 'About 3 minutes · Try something and keep a creation' } },
  { level: 2, title: { zh: '制作一种方法', en: 'Build a method' }, hint: { zh: '多节点引导 · 理解机制、制作方法，再做对照检验', en: 'Guided learning · Build, compare and explain a method' } },
  { level: 3, title: { zh: '组合并验证系统', en: 'Build and verify a system' }, hint: { zh: '协调多个约束 · 定义接口、诊断故障、交付完整系统', en: 'Connect parts · Balance constraints, diagnose and deliver' } },
  { level: 4, title: { zh: '独立面对新挑战', en: 'Investigate a new challenge' }, hint: { zh: '先定方案再验证 · 在新数据或实际现场中检验、修订与解释', en: 'Plan before testing · Investigate new data or field conditions' } },
  { level: 5, title: { zh: '完整工程与研究', en: 'Full engineering and research' }, hint: { zh: '长期项目 · 深入数据、设计、制造或研究，承担完整交付', en: 'Longer projects · Own a complete engineering or research delivery' } },
] as const
export function projectLevel(kind: string, explicit?: number): ProjectLevel {
  if (explicit && Number.isInteger(explicit) && explicit >= 1 && explicit <= 5) return explicit as ProjectLevel
  return kind === 'micro' ? 1 : kind === 'guided' ? 2 : kind === 'integration' ? 3 : 5
}
