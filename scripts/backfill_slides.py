"""一次性回填: 给 library DB 的 lessons 表加 slides 列并从 media 读 slides.json。

用法: python scripts/backfill_slides.py
读 LIBRARY_HOME (默认 ~/.systemedu-library)。

背景: library 走 create_all 无 alembic, 加列后已存在的表不会自动有该列;
本脚本 ALTER TABLE 加列 + 从 media/projects/<slug>/knodes/*/slides.json 回填,
用于把改 importer 前已 import 的项目 (eeg/purpleair) 补上 slides。
新 import 的项目走改后的 importer, 自动有 slides, 无需回填。
"""
from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path

LIBRARY_HOME = Path(os.environ.get("LIBRARY_HOME", str(Path.home() / ".systemedu-library")))
DB_PATH = LIBRARY_HOME / "db.sqlite"
MEDIA = LIBRARY_HOME / "media" / "projects"


def main() -> None:
    if not DB_PATH.exists():
        raise SystemExit(f"DB not found: {DB_PATH}")
    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()
    # 1. 加列 (若不存在)
    cols = [r[1] for r in cur.execute("PRAGMA table_info(lessons)").fetchall()]
    if "slides" not in cols:
        cur.execute("ALTER TABLE lessons ADD COLUMN slides JSON DEFAULT '[]'")
        print("added slides column")
    else:
        print("slides column already exists")
    # 2. 回填: 遍历 media/projects/<slug>/knodes/*/slides.json
    n = 0
    for row in cur.execute("SELECT id, project_slug, knode_dir FROM lessons").fetchall():
        lid, slug, knode_dir = row
        if not knode_dir:
            continue
        sj = MEDIA / slug / knode_dir / "slides.json"
        if not sj.exists():
            continue
        try:
            doc = json.loads(sj.read_text(encoding="utf-8"))
            slides = (
                doc.get("slides", [])
                if isinstance(doc, dict)
                else (doc if isinstance(doc, list) else [])
            )
        except Exception:
            continue
        cur.execute(
            "UPDATE lessons SET slides = ? WHERE id = ?",
            (json.dumps(slides, ensure_ascii=False), lid),
        )
        n += 1
    conn.commit()
    conn.close()
    print(f"backfilled {n} lessons")


if __name__ == "__main__":
    main()
