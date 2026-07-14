"""spec 046: 生成邀请码写入 DB 并打印清单。

用法 (需 STUDENT_DB_URL 指向目标库):
    python -m systemedu.student.tools.gen_invite_codes 200 --batch first-batch

码格式: 8 位纯数字 (10^8 空间, 200 量级碰撞可忽略; 纯数字便于口头传达与手机输入)。
"""

from __future__ import annotations

import argparse
import secrets

ALPHABET = "0123456789"  # 纯数字 (2026-07-14 用户要求, 替代初版大写字母数字)


def gen_code() -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(8))


def main() -> None:
    parser = argparse.ArgumentParser(description="生成邀请码")
    parser.add_argument("count", type=int, help="生成数量")
    parser.add_argument("--batch", default=None, help="批次名 (可选)")
    args = parser.parse_args()

    from ..db import create_invite_codes

    codes: set[str] = set()
    while len(codes) < args.count:
        codes.add(gen_code())
    code_list = sorted(codes)
    inserted = create_invite_codes(code_list, batch=args.batch)
    print(f"已生成 {inserted}/{args.count} 个邀请码 (batch={args.batch or '-'}):")
    for c in code_list:
        print(c)


if __name__ == "__main__":
    main()
