#!/usr/bin/env python3
"""Import a new-format knowledge tree JSON and convert to SystemEdu standard format.

Usage:
    python scripts/import_kt_json.py <input_json> <output_dir>

Example:
    python scripts/import_kt_json.py \
        /path/to/LM-01_研究地图小助手.json \
        projects/research-map-assistant

This generates:
    <output_dir>/project.yaml
    <output_dir>/knowledge_tree.json
"""

import json
import sys
from pathlib import Path

# Add project root to sys.path so we can import systemedu modules
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from systemedu.education.services import convert_uploaded_tree, extract_project_brief, extract_project_meta


def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: python scripts/import_kt_json.py <input_json> <output_dir>")
        print()
        print("Example:")
        print("  python scripts/import_kt_json.py \\")
        print("      /path/to/LM-01.json \\")
        print("      projects/research-map-assistant")
        sys.exit(1)

    input_path = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])

    if not input_path.exists():
        print(f"Error: input file not found: {input_path}")
        sys.exit(1)

    # Read input JSON
    with open(input_path, encoding="utf-8") as f:
        raw_data = json.load(f)

    print(f"Read {input_path.name}")
    nodes = raw_data.get("知识树节点", [])
    stages = raw_data.get("阶段总览", [])
    modules = raw_data.get("模块依赖图", [])
    print(f"  Nodes: {len(nodes)}")
    print(f"  Stages: {len(stages)}")
    print(f"  Modules: {len(modules)}")

    # Convert to internal format using existing converter
    converted = convert_uploaded_tree(raw_data)

    milestones = converted.get("milestones", [])
    sub_projects = converted.get("sub_projects", [])
    total_nodes = sum(len(ms.get("knodes", [])) for ms in milestones)

    print(f"Converted:")
    print(f"  Milestones: {len(milestones)}")
    print(f"  Sub-projects: {len(sub_projects)}")
    print(f"  Total nodes: {total_nodes}")

    # Extract project metadata
    meta = extract_project_meta(raw_data)

    # Build project name from output dir
    project_name = output_dir.name

    # Build project.yaml content
    project_yaml_data = {
        "name": project_name,
        "version": "0.1.0",
        "title": meta.get("title", raw_data.get("项目名称", project_name)),
        "description": raw_data.get("项目完成定义", {}).get("最低完成标准", [""])[0]
            if isinstance(raw_data.get("项目完成定义"), dict)
            else "",
        "category": "other",
        "age_range": meta.get("age_range", [10, 18]),
        "estimated_hours": meta.get("estimated_hours", 40),
        "tags": [],
        "knowledge_tree": "./knowledge_tree.json",
        "agents": {
            "tutor": {"type": "builtin:tutor"},
        },
    }

    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)

    # Write knowledge_tree.json
    kt_path = output_dir / "knowledge_tree.json"
    with open(kt_path, "w", encoding="utf-8") as f:
        json.dump(converted, f, ensure_ascii=False, indent=2)
    print(f"Wrote {kt_path}")

    # Write project_brief.json if available
    brief = extract_project_brief(raw_data)
    if brief:
        brief_path = output_dir / "project_brief.json"
        with open(brief_path, "w", encoding="utf-8") as f:
            json.dump(brief, f, ensure_ascii=False, indent=2)
        print(f"Wrote {brief_path}")
    else:
        print("No project brief found in input data, skipping project_brief.json")

    # Write project.yaml
    import yaml  # noqa: E402 — delayed import

    yaml_path = output_dir / "project.yaml"
    with open(yaml_path, "w", encoding="utf-8") as f:
        yaml.dump(
            project_yaml_data,
            f,
            default_flow_style=False,
            allow_unicode=True,
            sort_keys=False,
        )
    print(f"Wrote {yaml_path}")

    # Summary
    print()
    print("=== Summary ===")
    print(f"  Project: {project_name}")
    print(f"  Title: {project_yaml_data['title']}")
    print(f"  Nodes: {total_nodes}")
    print(f"  Milestones (modules): {len(milestones)}")
    print(f"  Sub-projects (stages): {len(sub_projects)}")
    if sub_projects:
        for sp in sub_projects:
            ms_indices = sp.get("milestone_indices", [])
            ms_node_count = sum(
                len(milestones[i].get("knodes", []))
                for i in ms_indices
                if i < len(milestones)
            )
            print(
                f"    {sp['id']} ({sp['stage_id']}): "
                f"{sp['title']} — {len(ms_indices)} modules, "
                f"{ms_node_count} nodes, "
                f"difficulty {sp.get('difficulty', '?')}, "
                f"{sp.get('estimated_hours', 0)}h"
            )
    print(f"\nOutput: {output_dir.resolve()}")
    print("Done.")


if __name__ == "__main__":
    main()
