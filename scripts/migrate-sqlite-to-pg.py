"""一次性: 把老 SQLite (~/.systemedu/student.db) 全表搬到 docker PG.

跳过 spec 031 新表 (PG 上是空的, 新数据从今天起).
保留所有 ID / 密码 hash / 时间戳, 用户可以拿原密码登录.

用法:
    source .venv/bin/activate
    python scripts/migrate-sqlite-to-pg.py
"""

from __future__ import annotations

import os
import sqlite3
import sys
from pathlib import Path

import psycopg2
import psycopg2.extras

SQLITE_PATH = Path.home() / ".systemedu" / "student.db"
PG_URL = os.environ.get(
    "STUDENT_DB_URL",
    "postgresql://systemedu:systemedu@127.0.0.1:5432/student",
)

# 顺序: parent → child (FK 依赖)
TABLES = [
    "users",
    "user_projects",
    "last_visited",
    "chat_sessions",
    "chat_messages",
    "notes",
    "assignment_submissions",
]


def main() -> None:
    if not SQLITE_PATH.exists():
        print(f"SQLite db not found: {SQLITE_PATH}")
        sys.exit(1)

    sl = sqlite3.connect(SQLITE_PATH)
    sl.row_factory = sqlite3.Row

    print(f"PG: {PG_URL}")
    print(f"SQLite: {SQLITE_PATH}")

    # 解析 URL
    from urllib.parse import urlparse
    u = urlparse(PG_URL)
    pg = psycopg2.connect(
        host=u.hostname, port=u.port or 5432,
        user=u.username, password=u.password,
        dbname=u.path.lstrip("/"),
    )
    pg.autocommit = False
    cur = pg.cursor()

    total = 0
    for t in TABLES:
        rows = sl.execute(f"SELECT * FROM {t}").fetchall()
        if not rows:
            print(f"  {t}: empty, skip")
            continue
        cols = list(rows[0].keys())
        col_list = ",".join(cols)
        placeholders = ",".join(["%s"] * len(cols))
        sql = f"INSERT INTO {t} ({col_list}) VALUES ({placeholders}) ON CONFLICT DO NOTHING"
        before = 0
        cur.execute(f"SELECT COUNT(*) FROM {t}")
        before = cur.fetchone()[0]

        for r in rows:
            cur.execute(sql, tuple(r[c] for c in cols))

        cur.execute(f"SELECT COUNT(*) FROM {t}")
        after = cur.fetchone()[0]
        inserted = after - before
        total += inserted
        print(f"  {t}: {len(rows)} read, {inserted} inserted (was {before}, now {after})")

    pg.commit()
    cur.close()
    pg.close()
    sl.close()
    print(f"\ndone. {total} rows migrated.")


if __name__ == "__main__":
    main()
