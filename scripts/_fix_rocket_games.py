"""Re-inline rocket-design game HTML for knodes where resize-patch breaks layout."""
from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from course_factory import (
    _fix_nonuniform_scale,
    _inline_runtime,
    inject_animation_resize_patch,
)

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = Path.home() / ".systemedu" / "systemedu.db"

SOURCES: dict[int, str] = {
    5: "_test_game_rocket_k5_rocket_builder.html",
}


def process_html(src_html: str) -> str:
    html = _fix_nonuniform_scale(src_html)
    html = inject_animation_resize_patch(html)
    html = _inline_runtime(html)
    return html


def main() -> int:
    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()
    updated: list[int] = []
    skipped: list[tuple[int, str]] = []
    for knode_id, fname in SOURCES.items():
        src = ROOT / "scripts" / fname
        if not src.exists():
            skipped.append((knode_id, f"source missing: {src}"))
            continue
        raw = src.read_text(encoding="utf-8")
        processed = process_html(raw)
        cur.execute(
            "SELECT id, course_content FROM lesson_content "
            "WHERE project_name='rocket-design' AND knode_id=?",
            (knode_id,),
        )
        row = cur.fetchone()
        if row is None:
            skipped.append((knode_id, "no row"))
            continue
        lc_id, cc_str = row
        cc = json.loads(cc_str)
        rs = cc.get("rendered_sections") or {}
        game_keys = [k for k in rs if k.startswith("game_")]
        if not game_keys:
            skipped.append((knode_id, "no game_ key"))
            continue
        if len(game_keys) > 1:
            skipped.append((knode_id, f"multiple game keys: {game_keys}"))
            continue
        key = game_keys[0]
        rs[key]["html"] = processed
        cc["rendered_sections"] = rs
        cur.execute(
            "UPDATE lesson_content SET course_content=? WHERE id=?",
            (json.dumps(cc, ensure_ascii=False), lc_id),
        )
        updated.append(knode_id)
        print(f"[OK]   k{knode_id} <- {fname} (len={len(processed)})")
    conn.commit()
    conn.close()
    print(f"\nupdated: {updated}")
    if skipped:
        for kid, r in skipped:
            print(f"  k{kid}: {r}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
