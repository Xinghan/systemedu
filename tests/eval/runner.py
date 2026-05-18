"""spec 031 P7: eval runner.

1. 加载 dataset.yaml
2. 对每条:
   - reset 用户 (清 facts)
   - 跑 setup_facts → upsert_fact
   - HTTP POST /api/chat 拿 answer
   - judge (qwen-plus) 打分
3. 输出 markdown 报告到 tests/eval/reports/eval_<ts>.md

Usage:
    export DASHSCOPE_API_KEY=sk-xxx
    ./scripts/restart-student.sh
    python -m tests.eval.runner
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

import httpx
import yaml

log = logging.getLogger("eval_runner")

EVAL_DIR = Path(__file__).resolve().parent
REPORTS_DIR = EVAL_DIR / "reports"
DATASET_FILE = EVAL_DIR / "dataset.yaml"

STUDENT_BASE = os.environ.get("STUDENT_BASE_URL", "http://127.0.0.1:18820")


def _load_dataset() -> list[dict]:
    with DATASET_FILE.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f)["cases"]


async def _register_user(client: httpx.AsyncClient) -> tuple[str, str]:
    """注册临时用户, 返回 (user_id, token)."""
    username = f"eval_{uuid.uuid4().hex[:8]}"
    password = "evalpass123"
    r = await client.post(
        f"{STUDENT_BASE}/api/auth/register",
        json={"username": username, "password": password},
    )
    r.raise_for_status()
    token = r.json()["token"]
    r2 = await client.get(
        f"{STUDENT_BASE}/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    uid = r2.json()["id"]
    return uid, token


async def _setup_facts(user_id: str, facts: list[dict]) -> None:
    """直接走 DAO 不经 LLM."""
    from systemedu.student import db as _db
    for f in facts:
        _db.upsert_fact(
            user_id,
            f["scope"], f["category"], f["key"], f["value"],
            library_slug=f.get("library_slug"),
            module_id=f.get("module_id"),
            confidence=float(f.get("confidence", 0.9)),
        )


async def _ask_tutor(
    client: httpx.AsyncClient, token: str, case: dict,
) -> tuple[str, float]:
    body = {
        "message": case["question"],
        "page_kind": case["page_kind"],
    }
    if case.get("library_slug"):
        body["library_slug"] = case["library_slug"]
    if case.get("module_id"):
        body["module_id"] = case["module_id"]
    t0 = time.perf_counter()
    r = await client.post(
        f"{STUDENT_BASE}/api/chat",
        json=body,
        headers={"Authorization": f"Bearer {token}"},
        timeout=120,
    )
    elapsed = time.perf_counter() - t0
    r.raise_for_status()
    return r.json().get("response", ""), elapsed


async def _run_case(
    client: httpx.AsyncClient, judge_llm: Any, case: dict,
) -> dict:
    uid, token = await _register_user(client)
    if case.get("setup_facts"):
        await _setup_facts(uid, case["setup_facts"])
    try:
        answer, elapsed = await _ask_tutor(client, token, case)
    except Exception as e:
        log.exception("case %s ask failed", case["id"])
        return {"case": case, "answer": "", "elapsed": 0, "error": str(e),
                "judge": None, "user_id": uid}
    from tests.eval.judge import judge
    j = await judge(
        judge_llm,
        question=case["question"],
        answer=answer,
        expected_facets=case.get("expected_facets") or [],
        bad_facets=case.get("bad_facets") or [],
    )
    return {"case": case, "answer": answer, "elapsed": elapsed,
            "judge": j, "user_id": uid, "error": None}


def _render_report(results: list[dict]) -> str:
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines = [f"# spec 031 tutor eval — {ts}", ""]
    lines.append(f"- dataset: {DATASET_FILE.name}, {len(results)} cases")
    lines.append(f"- student backend: {STUDENT_BASE}")
    lines.append("")

    scored = [r for r in results if r["judge"] is not None]
    if scored:
        avg_rel = sum(r["judge"].score_relevance for r in scored) / len(scored)
        avg_fac = sum(r["judge"].score_factual for r in scored) / len(scored)
        avg_per = sum(r["judge"].score_personalization for r in scored) / len(scored)
        avg_overall = sum(r["judge"].overall for r in scored) / len(scored)
        lines.append(f"## 平均分 (满分 100)")
        lines.append(f"- relevance:       **{avg_rel:.1f}**")
        lines.append(f"- factual:         **{avg_fac:.1f}**")
        lines.append(f"- personalization: **{avg_per:.1f}**")
        lines.append(f"- **overall:       {avg_overall:.1f}**")
        lines.append("")

    lines.append("## 详情")
    lines.append("")
    for r in results:
        c = r["case"]
        lines.append(f"### {c['id']} [{c['page_kind']}]")
        lines.append(f"- Q: {c['question']}")
        if r["error"]:
            lines.append(f"- **ERROR**: {r['error']}")
            lines.append("")
            continue
        a = (r["answer"] or "").replace("\n", " ")[:400]
        lines.append(f"- A ({r['elapsed']:.1f}s): {a}")
        j = r["judge"]
        if j is None:
            continue
        lines.append(f"- 分数: rel={j.score_relevance} fac={j.score_factual} "
                     f"per={j.score_personalization} **overall={j.overall}**")
        if j.miss_facets:
            ef = c.get("expected_facets") or []
            missed = [ef[i] for i in j.miss_facets if i < len(ef)]
            lines.append(f"- 漏点: {', '.join(missed)}")
        if j.hit_bad_facets:
            bf = c.get("bad_facets") or []
            bad = [bf[i] for i in j.hit_bad_facets if i < len(bf)]
            lines.append(f"- 出错: {', '.join(bad)}")
        lines.append(f"- 评语: {j.reason}")
        lines.append("")
    return "\n".join(lines)


async def main() -> None:
    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
    )
    REPORTS_DIR.mkdir(exist_ok=True)
    cases = _load_dataset()
    log.info("eval: %d cases against %s", len(cases), STUDENT_BASE)

    from systemedu.core.llm_client import get_llm
    judge_llm = get_llm("qwen", model="qwen-plus", temperature=0.0, streaming=False)

    async with httpx.AsyncClient() as client:
        # 串行跑 — 避免互相干扰 & API 限流
        results = []
        for i, case in enumerate(cases, 1):
            log.info("case %d/%d: %s", i, len(cases), case["id"])
            try:
                results.append(await _run_case(client, judge_llm, case))
            except Exception as e:
                log.exception("case %s crashed", case["id"])
                results.append({"case": case, "answer": "", "elapsed": 0,
                                "error": str(e), "judge": None, "user_id": ""})

    report = _render_report(results)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out = REPORTS_DIR / f"eval_{ts}.md"
    out.write_text(report, encoding="utf-8")
    log.info("report written: %s", out)
    print(report)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(0)
