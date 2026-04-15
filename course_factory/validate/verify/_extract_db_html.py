"""Extract animation/game HTML from lesson_content DB to tmp files + manifest.

Usage:
    python scripts/verify/_extract_db_html.py [--project NAME] [--out DIR]
                                              [--manifest PATH]

Writes one HTML file per (project, knode_id, section_key) under --out, and a
JSON manifest listing them. The manifest is the input for
`scripts/verify/db_regression.mjs`.
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
import tempfile
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", default=None, help="Filter by project_name")
    parser.add_argument(
        "--out",
        default=None,
        help="Output directory for HTML files (default: tmp)",
    )
    parser.add_argument(
        "--manifest",
        default=None,
        help="Output manifest JSON path (default: <out>/manifest.json)",
    )
    parser.add_argument(
        "--db",
        default=str(Path.home() / ".systemedu" / "systemedu.db"),
        help="Path to systemedu.db",
    )
    args = parser.parse_args()

    db_path = Path(args.db)
    if not db_path.exists():
        print(f"ERROR: DB not found at {db_path}", file=sys.stderr)
        return 2

    out_dir = Path(args.out) if args.out else Path(tempfile.mkdtemp(prefix="db_reg_"))
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = Path(args.manifest) if args.manifest else out_dir / "manifest.json"

    conn = sqlite3.connect(str(db_path))
    cur = conn.cursor()
    query = (
        "SELECT project_name, knode_id, course_content FROM lesson_content "
        "WHERE course_content IS NOT NULL AND course_content != ''"
    )
    params: tuple = ()
    if args.project:
        query += " AND project_name = ?"
        params = (args.project,)
    query += " ORDER BY project_name, knode_id"
    cur.execute(query, params)

    items: list[dict] = []
    for project_name, knode_id, cc_str in cur.fetchall():
        try:
            cc = json.loads(cc_str)
        except (TypeError, json.JSONDecodeError):
            continue
        rs = cc.get("rendered_sections") or {}
        for key, sec in rs.items():
            if not isinstance(sec, dict):
                continue
            html = sec.get("html")
            if not html or not isinstance(html, str):
                continue
            if key.startswith("anim_"):
                kind = "animation"
            elif key.startswith("game_"):
                kind = "game"
            else:
                continue
            safe_key = key.replace("/", "_")
            fname = f"{project_name}_k{knode_id}_{safe_key}.html"
            fpath = out_dir / fname
            fpath.write_text(html, encoding="utf-8")
            items.append(
                {
                    "project": project_name,
                    "knode_id": knode_id,
                    "key": key,
                    "kind": kind,
                    "htmlFile": str(fpath),
                    "htmlLen": len(html),
                }
            )

    conn.close()
    manifest = {"items": items, "out_dir": str(out_dir)}
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"extracted {len(items)} items to {out_dir}")
    print(f"manifest: {manifest_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
