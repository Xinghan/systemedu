export const meta = {
  name: 'kg-expand-subjects',
  description: 'spec041里程碑3: 并行对9学科跑pipeline(候选→闸门→关系→prereq), 主线串行汇总待合并节点',
  phases: [
    { title: 'Expand', detail: '每学科一个worktree agent跑pipeline 4步' },
  ],
}

const SUBJECTS = ['chem', 'bio', 'cs', 'elec', 'env', 'astro', 'med', 'eng', 'geo']

const PY = '/Users/xinghan/Dev/systemedu/.venv/bin/python'

const NODE_SCHEMA = {
  type: 'object',
  properties: {
    subject: { type: 'string' },
    ok: { type: 'boolean', description: '4步是否全部成功' },
    new_node_count: { type: 'number' },
    internal_edges: { type: 'number' },
    dangling_edges: { type: 'number' },
    prereq_filled: { type: 'number' },
    suspicious_qids: {
      type: 'array',
      description: 'QID可能配错的节点(label与概念语义不符), 供主人事后复核',
      items: {
        type: 'object',
        properties: {
          node_id: { type: 'string' },
          name_zh: { type: 'string' },
          qid: { type: 'string' },
          qid_label: { type: 'string' },
          why: { type: 'string' },
        },
        required: ['node_id', 'qid', 'qid_label', 'why'],
      },
    },
    nodes_json_path: { type: 'string', description: 'worktree内导出的该学科kg-builder-v1新节点JSON绝对路径' },
    notes: { type: 'string' },
  },
  required: ['subject', 'ok', 'new_node_count', 'suspicious_qids', 'nodes_json_path'],
}

function agentPrompt(subject) {
  return `你在一个独立的 git worktree 里, 任务是为知识图谱的 **${subject}** 学科扩建新节点并补两类关系 (spec 041 里程碑3)。

## 环境
- 你的工作目录就是这个 worktree (一份完整仓库副本)。
- 用这个绝对路径的 python (主仓 venv, 依赖齐全): \`${PY}\`
- 跑任何 kg_builder 命令前缀: \`cd <worktree根> && NO_PROXY='*' PYTHONPATH="tools/kg-builder:." ${PY} -m kg_builder ...\`
  (先用 \`pwd\` 确认 worktree 根目录绝对路径)

## 严格按顺序执行4步 (每步可能跑几分钟, 耐心等待命令返回)

1. **列候选+闸门**: \`${PY} -m kg_builder ${subject}\` (前缀同上)
   - 这会 LLM 列该学科缺失概念 → search_qid 配真QID → 三道闸门 → 产待审清单 CSV (路径在输出里, 形如 tools/kg-builder/_review/${subject}_review.csv)。

2. **人工审核 (你来做)**: 读那个 CSV。逐行核对 gate_status=PASS 的节点:
   - **重点抓歧义QID错配**: qid_label 与 name_zh/name_en 概念语义是否一致? 例 (math实测教训): "行列式 determinant" 被错配成 "risk factor"、"角 angle" 被错配成姓氏。这类必须揪出。
   - 用 \`${PY} -c "...; from kg_builder.wikidata import search_qid; print(search_qid('正确英文名'))"\` 搜正确QID核对。
   - 若发现错配, 直接编辑 CSV 那一行的 qid/qid_label/mapping_type 为正确值 (verified保持True因为是真QID)。
   - 把所有你修正过的、以及仍存疑的, 记进最终输出的 suspicious_qids。

3. **合入**: \`${PY} -m kg_builder ${subject} --merge tools/kg-builder/_review/${subject}_review.csv\` (前缀同上)
   - 这会把审核后的新节点合入 worktree 的 platform_tree.json。

4. **关系二**: \`${PY} -m kg_builder ${subject} --relations\` (拉Wikidata本体论关系, 较慢, 等它返回 stats)
5. **关系一**: \`${PY} -m kg_builder ${subject} --prereq\` (LLM补学习顺序前置)

## 导出产物 (关键, 主线要合并)
全部完成后, 把该学科所有 provenance="kg-builder-v1" 的节点导出为 JSON 到 worktree 内:
\`\`\`
${PY} -c "import sys,json; sys.path.insert(0,'tools/kg-builder'); from course_factory.knowledge_tree.schema import load_platform_tree as L; t=L(); m=t.get_subject('${subject}'); ns=[n.model_dump() for n in m.nodes if n.provenance=='kg-builder-v1']; open('/tmp/kg_${subject}_nodes.json','w').write(json.dumps(ns,ensure_ascii=False,indent=2)); print(len(ns),'nodes ->','/tmp/kg_${subject}_nodes.json')"
\`\`\`
(用 NO_PROXY='*' 前缀避免代理干扰)

## 返回 (StructuredOutput)
- subject="${subject}", ok=4步是否全成功
- new_node_count / internal_edges / dangling_edges / prereq_filled (从各步输出读)
- suspicious_qids: 你修正过或存疑的QID节点 (没有就空数组)
- nodes_json_path="/tmp/kg_${subject}_nodes.json"
- notes: 任何异常 (限流/某步失败/某概念无QID等)

只有4步真跑成功才 ok=true。遇命令报错先重试一次, 仍失败则 ok=false 并在 notes 说明。`
}

phase('Expand')
log(`并行扩建 ${SUBJECTS.length} 学科 (worktree隔离): ${SUBJECTS.join(', ')}`)

const results = await parallel(
  SUBJECTS.map((subj) => () =>
    agent(agentPrompt(subj), {
      label: `expand:${subj}`,
      phase: 'Expand',
      isolation: 'worktree',
      schema: NODE_SCHEMA,
    })
  )
)

const ok = results.filter(Boolean)
const failed = SUBJECTS.filter((s, i) => !results[i] || !results[i].ok)
const allSuspicious = ok.flatMap((r) => (r.suspicious_qids || []).map((s) => ({ ...s, subject: r.subject })))

log(`完成: ${ok.filter((r) => r.ok).length}/${SUBJECTS.length} 学科成功`)
log(`可疑QID待复核: ${allSuspicious.length} 条`)
if (failed.length) log(`失败学科: ${failed.join(', ')}`)

return {
  subjects_done: ok.filter((r) => r.ok).map((r) => r.subject),
  failed,
  per_subject: ok.map((r) => ({
    subject: r.subject, ok: r.ok, new_nodes: r.new_node_count,
    internal: r.internal_edges, dangling: r.dangling_edges,
    prereq: r.prereq_filled, nodes_json: r.nodes_json_path, notes: r.notes,
  })),
  suspicious_qids: allSuspicious,
}
