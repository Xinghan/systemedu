"""Re-inline correct game HTML for the 4 broken mars-risk-map games.

Source files were updated to declare `window.__systemedu_resize_patch_optout=true`
so course_factory's resize patch is skipped (these games manage their own canvas
layout and the patch breaks them).
"""
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
    10: "_test_game_knode10_pixel_artist.html",
    11: "_test_game_knode11_rgb_mixer.html",
    12: "_test_game_knode12_terrain_sorter.html",
    14: "_test_game_knode14_rover_explorer.html",
}


def process_html(src_html: str) -> str:
    html = _fix_nonuniform_scale(src_html)
    html = inject_animation_resize_patch(html)  # 会因 opt-out sentinel 自动跳过
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
            "WHERE project_name='mars-risk-map' AND knode_id=?",
            (knode_id,),
        )
        row = cur.fetchone()
        if row is None:
            skipped.append((knode_id, "no lesson_content row"))
            continue
        lc_id, cc_str = row

        try:
            cc = json.loads(cc_str)
        except json.JSONDecodeError as e:
            skipped.append((knode_id, f"bad JSON: {e}"))
            continue

        rs = cc.get("rendered_sections") or {}
        game_keys = [k for k in rs if k.startswith("game_")]
        if not game_keys:
            skipped.append((knode_id, "no game_ key"))
            continue
        if len(game_keys) > 1:
            skipped.append((knode_id, f"multiple game_ keys: {game_keys}"))
            continue
        key = game_keys[0]

        rs[key]["html"] = processed
        cc["rendered_sections"] = rs

        cur.execute(
            "UPDATE lesson_content SET course_content=? WHERE id=?",
            (json.dumps(cc, ensure_ascii=False), lc_id),
        )
        updated.append(knode_id)
        print(f"[OK]   k{knode_id:>2} <- {fname} (len={len(processed)})")

    conn.commit()
    conn.close()

    print()
    print(f"updated: {len(updated)} knodes: {updated}")
    if skipped:
        print(f"skipped: {len(skipped)}")
        for kid, reason in skipped:
            print(f"  k{kid}: {reason}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
