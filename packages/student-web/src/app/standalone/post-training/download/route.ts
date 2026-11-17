import { isRecord, MODULE_IDS } from "../record"
export async function POST(request: Request) {
  const text = await request.text()
  if (text.length > 1_000_000) return new Response("File too large", { status: 413 })
  const form = new URLSearchParams(text)
  let value: unknown
  try { value = JSON.parse(form.get("record") || "") } catch { return new Response("Invalid JSON", { status: 400 }) }
  if (!isRecord(value)) return new Response("Unsupported course record", { status: 400 })
  const markdown = form.get("format") === "markdown"
  const body = markdown ? `# LLM 后训练工程 · 实验记录\n\n版本：${value.version}\n\n${MODULE_IDS.map(id => `## ${id}\n\n${value.nodes[id].notes || '（暂无笔记）'}\n\n自查：${value.nodes[id].checks.map(x => x ? '✓' : '□').join(' ')}`).join('\n\n')}\n\n实验参数：\n\n\`\`\`json\n${JSON.stringify({ structure: value.lab, algorithms: value.experiments ?? {} }, null, 2)}\n\`\`\`\n\n自查记录不代表 GPU 训练或评分已完成。\n` : JSON.stringify(value, null, 2)
  return new Response(body, { headers: { "Content-Type": markdown ? "text/markdown; charset=utf-8" : "application/json; charset=utf-8",
    "Content-Disposition": `attachment; filename="post-training-lab-record.${markdown ? 'md' : 'json'}"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
}
