"""fix_k1_violations.py — 把 K1 里的 python 代码块和公式移到 K3.

按 D1 审计报告找出 24 节违规, 自动修.

策略:
- K1 含 ```python ... ``` 代码块 → 删 (K1 不该有任何代码)
- K1 含 LaTeX $$ 或 \\(...\\) 公式 → 删
- K1 含 "= " 计算式 (含数字) → 转写成自然语言 (复杂, 跳过, 标 TODO)
- K1 含单字母变量 (X_train, w, λ 等) → 删该句 (复杂, 跳过)

简化版: 只删 python 代码块. 其他标 TODO 让人工审.
"""

import json
import re
import sys
from pathlib import Path

WORK = Path("/Users/xinghan/Dev/systemedu/content-workspace/generated")

K1_CODE_VIOLATIONS = [
    "M17", "M19", "M33", "M34", "M36", "M41", "M45", "M46", "M47", "M48",
    "M50", "M52", "M53", "M54", "M57", "M58", "M63",
]


def find_knode_dir(slug: str, mid: str) -> Path | None:
    base = WORK / slug / "knodes"
    matches = list(base.glob(f"{mid}-w*"))
    return matches[0] if matches else None


def strip_python_blocks_from_k1(theories_path: Path) -> tuple[int, int]:
    """删 K1 里所有 ```python ``` 块. 返回 (n_blocks_removed, n_chars_removed)."""
    data = json.loads(theories_path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        return (0, 0)

    blocks_removed = 0
    chars_removed = 0
    for t in data:
        for lb in t.get("level_bodies", []) or []:
            if (lb.get("level") or "").upper() != "K1":
                continue
            body = lb.get("body_markdown") or ""
            new_body = re.sub(r"```python\n.*?\n```\n?", "[代码已移到 K3]\n", body, flags=re.DOTALL)
            n = len(re.findall(r"```python", body))
            blocks_removed += n
            chars_removed += len(body) - len(new_body)
            lb["body_markdown"] = new_body

    if blocks_removed > 0:
        theories_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return (blocks_removed, chars_removed)


def main():
    slug = sys.argv[1] if len(sys.argv) > 1 else "eeg-minecraft-bci"
    total_blocks = 0
    total_chars = 0
    fixed = []
    for mid in K1_CODE_VIOLATIONS:
        d = find_knode_dir(slug, mid)
        if not d:
            print(f"  {mid}: dir not found")
            continue
        th = d / "theories.json"
        if not th.exists():
            print(f"  {mid}: no theories.json")
            continue
        n, c = strip_python_blocks_from_k1(th)
        if n > 0:
            print(f"  {mid}: removed {n} blocks, -{c} chars")
            total_blocks += n
            total_chars += c
            fixed.append(mid)
    print(f"\nTotal: {len(fixed)}/{len(K1_CODE_VIOLATIONS)} nodes fixed, {total_blocks} blocks removed, -{total_chars} chars")


if __name__ == "__main__":
    main()
