"""Record current-standard evidence separately from heuristic renderer coverage."""
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
COURSE = ROOT.parent / "systemeduidea/projects_data/molecule-monster-hunter"
DOCS = ROOT / "docs/slide-image-prompts"
previous_path = DOCS / "molecule-monster-hunter-progress.json"
previous_entries = {e["module"]: e for e in json.loads(previous_path.read_text()).get("entries", [])} if previous_path.exists() else {}
entries = []
for node in sorted((COURSE / "knodes").glob("M*")):
    source = node / "slides.json"
    if not source.exists(): continue
    data = json.loads(source.read_text())
    module = node.name.split("-")[0]
    entry = {"module": module, "node": node.name, "slides": len(data["slides"]), "status": "prior-content-needs-current-standard-audit", "note": "存在历史内容/替换工作；未在本轮重新验收，不将工具映射计为整节完成。"}
    if module in previous_entries:
        entry.update(previous_entries[module])
        entry.update(node=node.name, slides=len(data["slides"]))
    if module == "M80":
        entry.update(status="local-verified-not-latest-deployed", note="10 页 evidence-v1 完整重做的既有记录；不是本轮部署。", evidence="docs/slide-image-prompts/molecule-monster-hunter-M80-evidence-v1.md")
    if module == "M81":
        entry.update(status="deployed", note="2026-09-08 上一轮已部署；本轮未改变。", evidence="docs/deployments/2026-09-08-m81-evidence.md")
    if module in ("M78", "M85"):
        draft = HERE / f"{module}-evidence-v2.json"
        entry.update(status="local-user-reviewed-not-deployed", note="用户已审阅上一批并同意继续；11 页整节本地版本，生产与课程原映射未改。部署前需对齐关联课文/练习；新讲稿无音频。", draft=str(draft.relative_to(ROOT)), draft_sha256=hashlib.sha256(draft.read_bytes()).hexdigest(), evidence="docs/slide-image-prompts/molecule-monster-hunter-M78-M85-evidence-v2.md")
        registry_path = HERE / f"{module}-evidence-v2.registry.json"
        registry = json.loads(registry_path.read_text())
        registry.update(status=entry["status"], verified_draft_sha256=entry["draft_sha256"], qa_record=entry["evidence"])
        registry_path.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n")
    if module in ("M03", "M86"):
        version = "spatial-v1" if module == "M03" else "funnel-v1"
        draft = HERE / f"{module}-{version}.json"
        entry.update(status="local-verified-awaiting-user-review", note="本轮 10 页版本化重做；M03 包含 5 页交互 3D，M86 为可复算教学流程。未部署，未替换源课程；新讲稿无音频。", draft=str(draft.relative_to(ROOT)), draft_sha256=hashlib.sha256(draft.read_bytes()).hexdigest(), evidence="docs/slide-image-prompts/molecule-monster-hunter-M03-M86-multimodal-v1.md")
        registry_path = HERE / f"{module}-{version}.registry.json"
        registry = json.loads(registry_path.read_text())
        registry.update(status=entry["status"], verified_draft_sha256=entry["draft_sha256"], qa_record=entry["evidence"], production_deployed=False)
        registry_path.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n")
    entries.append(entry)
result = {"project": "molecule-monster-hunter", "updated": "2026-09-08", "project_complete": False, "modules": len(entries), "slides": sum(e["slides"] for e in entries), "current_batch": {"modules": ["M03", "M86"], "slides": 20, "production_deployed": False, "interactive_3d_pages": 5, "generated_raster_images": 0}, "counting_policy": "此账本区分当前整节验收和历史工具/图片覆盖；未复核不表示历史工作被否定，也不能算当前标准完成。", "next_recommended_nodes": ["M87"], "entries": entries}
(DOCS / "molecule-monster-hunter-progress.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({"modules": result["modules"], "slides": result["slides"], "batch": result["current_batch"]}, ensure_ascii=False))
