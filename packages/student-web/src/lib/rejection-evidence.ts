export const RULES = [
  { key: "mw", label: "分子量", limit: 500, unit: "g/mol" },
  { key: "logp", label: "logP", limit: 5, unit: "" },
  { key: "hbd", label: "氢键供体 HBD", limit: 5, unit: "" },
  { key: "hba", label: "氢键受体 HBA", limit: 10, unit: "" },
] as const
export type RuleKey = typeof RULES[number]["key"]
export type RejectRow = { id: string; mw: number | null; logp: number | null; hbd: number | null; hba: number | null }
export const REJECT_ROWS: RejectRow[] = [
  { id: "A", mw: 612, logp: 5.2, hbd: 7, hba: 12 },
  { id: "B", mw: 320, logp: 5.2, hbd: 4, hba: 8 },
  { id: "C", mw: 280, logp: 2.1, hbd: 7, hba: 8 },
  { id: "D", mw: 410, logp: 3.0, hbd: 4, hba: 12 },
  { id: "E", mw: 500, logp: 5, hbd: 5, hba: 10 },
  { id: "F", mw: 300, logp: null, hbd: 3, hba: 8 },
]
export const DEFAULT_RULE_ORDER: RuleKey[] = ["mw", "logp", "hbd", "hba"]
export function rejectionTrace(row: RejectRow, order: RuleKey[] = DEFAULT_RULE_ORDER, auditAll = false) {
  if (order.length !== 4 || new Set(order).size !== 4 || order.some(k => !RULES.some(r => r.key === k))) throw new Error("Invalid rule order")
  let stopped = false
  const checks = order.map(key => {
    const rule = RULES.find(r => r.key === key)!, value = row[key]
    const status = stopped && !auditAll ? "not-evaluated" : value === null || !Number.isFinite(value) ? "missing" : value > rule.limit ? "fail" : "pass"
    if (status === "fail" || status === "missing") stopped = true
    return { ...rule, value, status, excess: status === "fail" ? value! - rule.limit : null }
  })
  const first = checks.find(c => c.status === "fail" || c.status === "missing")
  const decision = first?.status === "missing" ? "needs-data" : first ? "reject" : "pass"
  const reason = !first ? "本教学规则全部通过；不代表安全、有效或可成药。" : first.status === "missing" ? `${first.label} 缺失或无效：暂缓判断，先补数据。` : `${first.label} ${first.value} ${first.unit} > ${first.limit} ${first.unit}，超出 ${Number(first.excess?.toFixed(6))} ${first.unit}；未通过本次规则。`
  return { id: row.id, order, auditAll, checks, firstRule: first?.key ?? null, decision, reason }
}
export function rejectionEvidence(order: RuleKey[], note: string) {
  return { module: "M46", version: "rejection-v1", data: "原文数值扩展的六行教学示例，非实验分子或 M43 实际数据。四项零违反为本例筛选政策，不代表完整 Lipinski 判据或药物结论。", rules: RULES, order, rows: REJECT_ROWS, results: REJECT_ROWS.map(r => rejectionTrace(r,order)), learnerExplanation: note }
}
