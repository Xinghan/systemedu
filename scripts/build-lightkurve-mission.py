"""Import existing Lightkurve teaching requirements; never rewrite source lessons."""
import argparse
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("source", type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
source = args.source
tree = json.loads((source / "tree/knowledge_tree.json").read_text())
manifest = json.loads((source / "manifest.json").read_text())
slug = manifest["slug"]
lib = root / "packages/student-web/src/lib/project-lines"
curriculum = json.loads((lib / "space-curriculum.json").read_text())
tasks = json.loads((lib / "space-mission-tasks.json").read_text())
curriculum["stations"] = [s for s in curriculum["stations"] if not s["id"].startswith("transit-")]
curriculum["modules"] = [m for m in curriculum["modules"] if m["project"] != slug]
tasks = [t for t in tasks if not t["id"].startswith(slug + ":")]
curriculum.pop("sideQuest", None)
places = ["观测问题站", "光变数据实验室", "周期搜索站", "反例检查站", "独立观测验证站", "研究复现交付站"]
records = {n["module_id"]: n for n in manifest["knodes"]}
source_hashes = {}
def digest(relative):
    source_hashes[relative] = hashlib.sha256((source / relative).read_bytes()).hexdigest()
    return source_hashes[relative]
digest("tree/knowledge_tree.json")
rows = []
for i, stage in enumerate(tree["stages"]):
    station = "transit-" + stage["stage_id"].lower()
    steps = [f"{slug}:{mid}" for mid in stage["module_ids"]]
    curriculum["stations"].append({
        "id": station, "code": f"L{i+1:02}", "level": min(i+1, 5), "film": None,
        "place": places[i], "message": stage["title"], "handoff": stage["stage_output"],
        "input": "一台电脑与一个可检验的问题；无需先完成火星车，也无需购买望远镜。" if i == 0 else tree["stages"][i-1]["stage_output"],
        "gate": stage["stage_goal"], "dependsOn": [] if i == 0 else ["transit-" + tree["stages"][i-1]["stage_id"].lower()],
        "projects": [slug], "steps": steps,
    })
    for mid in stage["module_ids"]:
        m = next(m for m in tree["modules"] if m["module_id"] == mid)
        directory = records[mid]["knode_dir"]
        record = json.loads((source / directory / "learning-record.json").read_text())
        assignment = (source / directory / "assignment.md").read_text()
        # Preserve the existing instructions verbatim, stripping only Markdown list prefixes.
        import re
        body = assignment.split("## 制作步骤", 1)[-1].split("## 交付与验收", 1)[0].split("## 提交记录", 1)[0]
        actions = [re.sub(r"^\d+\.\s*", "", p.strip()) for p in body.split("\n\n") if p.strip() and not p.strip().startswith("#")]
        checks = m["acceptance_standard"]
        if "## 交付与验收" in assignment:
            section = assignment.split("## 交付与验收", 1)[1].split("##", 1)[0]
            checks = [p[2:].strip() for p in section.splitlines() if p.startswith("- ")] or checks
        ref = f"{slug}:{mid}"
        curriculum["modules"].append({"ref": ref, "project": slug, "module": mid, "title": m["title"], "version": manifest["version"], "station": station, "kind": "full", "mode": "lesson", "anchor": None, "note": "沿用同一份原始数据与证据册；课堂保存和个人自检不代表科学结论已经通过评阅。", "action": "reuse-with-context"})
        tasks.append({"id": ref, "code": f"L{i+1:02}-{stage['module_ids'].index(mid)+1:02}", "title": m["title"], "station": station, "role": "lesson", "category": "凌星调查", "goal": m["core_question"], "actions": actions, "outputs": [record["output"]], "checks": checks, "minutes": None, "resources": [{k: r.get(k, "") for k in ["url", "title", "purpose", "kind"]} for r in record.get("resources", [])], "preparation": curriculum["stations"][-1]["input"], "note": "操作与产物要求来自本节原作业；用自己的运行结果填写证据摘要。"})
        rows.append({"ref": ref, "title": m["title"], "station": station, "stage": stage["title"], "version": manifest["version"], "depends_on": m["depends_on"], "source": directory})
        for file in ["assignment.md", "learning-record.json", "lesson.md", "sections.json", "slides.json"]:
            digest(f"{directory}/{file}")

def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
save(lib / "space-curriculum.json", curriculum)
save(lib / "space-mission-tasks.json", tasks)
save(root / "artifacts/lightkurve-integration-20261029/source-map.json", {"source_slug": slug, "source_version": manifest["version"], "nodes": rows, "source_sha256": source_hashes})
lines = ["# Lightkurve 逐节点去向", "", "32 节全部按原六阶段进入星际远航的凌星调查路线；保留原 ID、正文、媒体、作业和记录。前置关系是学习建议，不锁课。", "", "| 原节点 | 原标题 | 任务站 | 任务中心 | 正式课堂 |", "| --- | --- | --- | --- | --- |"]
for row in rows:
    mid = row["ref"].split(":")[1]
    lines.append(f"| {mid} | {row['title']} | {row['station']} | `/mission/space/control?task={row['ref']}` | `/learn/{slug}/{mid}?mission=space` |")
(root / "docs/plans/2026-10-29-lightkurve-node-map.md").write_text("\n".join(lines) + "\n")
print(f"Mapped {len(rows)} nodes in {len(tree['stages'])} stages; source files untouched.")
