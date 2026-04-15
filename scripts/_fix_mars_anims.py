"""Re-inline correct animation HTML for all black-screen mars-risk-map knodes.

Takes the correct source HTML from scripts/test_anim_*.html, runs it through
course_factory's standard pipeline (_fix_nonuniform_scale + inject resize patch
+ _inline_runtime), and overwrites course_content.rendered_sections[anim_*].html
in the DB.
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

# Mapping: knode_id -> source HTML filename (under scripts/)
SOURCES: dict[int, str] = {
    0:  "test_anim_knode0_terrain.html",
    1:  "test_anim_knode1_traversability.html",
    2:  "test_anim_knode2_mars_surface.html",
    3:  "test_anim_knode3_what_is_map.html",
    4:  "test_anim_knode4_coordinates.html",
    5:  "test_anim_knode5_distance_direction.html",
    6:  "test_anim_knode6_spa_loop.html",
    7:  "test_anim_knode7_comm_delay.html",
    9:  "test_anim_knode9_light_journey.html",
    10: "test_anim_knode10_pixel_grid.html",
    11: "test_anim_knode11_rgb_mixing.html",
    12: "test_anim_knode12_atlas_guide.html",
    14: "test_anim_knode14_terrain_catalog.html",
}


def process_html(src_html: str) -> str:
    """Apply the same pipeline make_course_content uses before storing."""
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
            skipped.append((knode_id, f"bad course_content JSON: {e}"))
            continue

        rs = cc.get("rendered_sections") or {}
        anim_keys = [k for k in rs if k.startswith("anim_")]
        if not anim_keys:
            skipped.append((knode_id, "no anim_* key in rendered_sections"))
            continue
        if len(anim_keys) > 1:
            skipped.append((knode_id, f"multiple anim_* keys: {anim_keys}"))
            continue
        key = anim_keys[0]

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
