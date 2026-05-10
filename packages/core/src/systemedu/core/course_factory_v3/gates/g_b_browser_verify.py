"""5.5b Browser Verify — 子进程跑 course_factory/validate/verify/{animation,game}.mjs。

把 HTML 写到临时文件,用 node 跑 Playwright 验证,捕 exit code + stdout。
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import tempfile
from pathlib import Path

from .base import Gate, GateResult
from ..progress import STEP_GATE_B

logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parents[6]
VERIFY_DIR = ROOT / "course_factory" / "validate" / "verify"


class BrowserVerifyGate(Gate):
    name = STEP_GATE_B
    max_revise = 3

    async def run(self, *, html: str | None, idea, ctx, attempt: int = 1) -> GateResult:
        if not html:
            return GateResult("fail", ["empty html"], attempt=attempt)

        mode = (idea or {}).get("mode", "animation")
        verifier = "animation.mjs" if mode == "animation" else "game.mjs"
        verifier_path = VERIFY_DIR / verifier
        if not verifier_path.exists():
            return GateResult("fail", [f"verifier missing: {verifier_path}"], attempt=attempt)

        # 写临时 HTML — 命名要符合 verifier 的 kname 提取(test_xxx_anim 或 test_xxx_game)
        suffix = "_anim_v3.html" if mode == "animation" else "_game_v3.html"
        idea_id = (idea or {}).get("idea_id", "tmp")
        knode_id = ctx.get("knode_id", 0) if ctx else 0
        prefix = f"test_v3_k{knode_id}_{idea_id}_"

        # 写到 course_factory/tests/anim 或 game (以便 verifier 找 runtime 等相对资源)
        target_dir = ROOT / "course_factory" / "tests" / ("anim" if mode == "animation" else "game")
        target_dir.mkdir(parents=True, exist_ok=True)
        f = tempfile.NamedTemporaryFile(
            mode="w", suffix=suffix, prefix=prefix,
            dir=str(target_dir), delete=False, encoding="utf-8",
        )
        f.write(html)
        f.close()
        html_path = f.name

        out_dir = tempfile.mkdtemp(prefix=f"verify_{mode}_")

        # 跑 node verifier
        cmd = ["node", str(verifier_path), html_path, "--out", out_dir]
        logger.info(f"[5.5b] running: {' '.join(cmd)}")

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(ROOT),
            )
            stdout_b, stderr_b = await asyncio.wait_for(proc.communicate(), timeout=120)
            stdout_s = stdout_b.decode("utf-8", errors="replace")
            stderr_s = stderr_b.decode("utf-8", errors="replace")
            rc = proc.returncode
        except asyncio.TimeoutError:
            try:
                proc.kill()
            except Exception:
                pass
            return GateResult("fail", [f"5.5b timeout (>120s) for {mode}"], attempt=attempt,
                              raw={"html_path": html_path})
        except FileNotFoundError:
            return GateResult("fail", ["node not found in PATH"], attempt=attempt)
        except Exception as exc:
            return GateResult("fail", [f"subprocess error: {exc}"], attempt=attempt)

        if rc == 0:
            # 试图解析 stdout 中的 JSON 报告(verifier 会在 stdout 末尾打印)
            report = _try_parse_json(stdout_s)
            return GateResult(
                "pass", [], attempt=attempt,
                raw={"rc": 0, "stdout": stdout_s[-2000:], "out_dir": out_dir,
                     "html_path": html_path, "report": report},
            )

        # 失败: 把 stdout / stderr 关键内容拍成 issues
        issues = _extract_issues(stdout_s, stderr_s, mode)
        return GateResult(
            "fail", issues, attempt=attempt,
            raw={"rc": rc, "stdout": stdout_s[-3000:], "stderr": stderr_s[-1500:],
                 "out_dir": out_dir, "html_path": html_path},
        )


def _try_parse_json(s: str) -> dict | None:
    """verifier 末尾通常打 JSON。"""
    s = s.strip()
    if s.startswith("{") and s.endswith("}"):
        try:
            return json.loads(s)
        except Exception:
            pass
    # 找最后一个 {...} 块
    for line in reversed(s.splitlines()):
        line = line.strip()
        if line.startswith("{") and line.endswith("}"):
            try:
                return json.loads(line)
            except Exception:
                pass
    return None


def _extract_issues(stdout: str, stderr: str, mode: str) -> list[str]:
    """从 stdout/stderr 中拍出可读的 issues 列表。"""
    issues = []
    rep = _try_parse_json(stdout)
    if rep:
        # 报告中的 checks 字段
        checks = rep.get("checks") or {}
        for k, v in checks.items():
            if isinstance(v, dict) and v.get("pass") is False:
                issues.append(f"5.5b {mode}: check '{k}' fail — {v.get('reason', '')}")
            elif v is False:
                issues.append(f"5.5b {mode}: check '{k}' fail")

    # 从 stdout/stderr 中抓 ERROR / pageerror / Traceback 行
    for src_name, src in (("stdout", stdout), ("stderr", stderr)):
        for line in src.splitlines():
            if any(kw in line for kw in ["pageerror:", "ERROR", "Error:", "FAIL"]):
                issues.append(f"5.5b {src_name}: {line.strip()[:300]}")

    # 去重 + 上限
    seen = set()
    out = []
    for it in issues:
        if it not in seen:
            seen.add(it)
            out.append(it)
        if len(out) >= 15:
            break
    if not out:
        out.append(f"5.5b {mode}: verifier exited non-zero (no parseable issues)")
    return out
