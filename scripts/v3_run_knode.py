"""驱动 v3 pipeline 生成单个 knode (写入 lesson_content_v3 表, 多版本)。

用法:
    python scripts/v3_run_knode.py <project> <knode_idx> <version_label> [--no-active]

示例:
    python scripts/v3_run_knode.py rocket-design 0 kimi-fogsight-v1
    python scripts/v3_run_knode.py rocket-design 0 qwen-baseline --no-active

--no-active: 写入后不自动设为 active 版本 (适合后台对照实验)

进度实时输出到 stdout + /tmp/v3_run_<project>_<knode>_<label>.log。
"""

from __future__ import annotations

import asyncio
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT))

from systemedu.course_factory_v3.pipeline import generate_course_v3


def main():
    if len(sys.argv) < 4:
        print("usage: v3_run_knode.py <project> <knode_idx> <version_label> [--no-active]")
        print("       version_label 必填, 用于区分多版本 (例: kimi-fogsight-v1)")
        sys.exit(2)
    project = sys.argv[1]
    knode_idx = int(sys.argv[2])
    version_label = sys.argv[3]
    set_active = "--no-active" not in sys.argv

    safe_label = version_label.replace("/", "_").replace(" ", "_")
    log_path = Path(f"/tmp/v3_run_{project}_{knode_idx}_{safe_label}.log")
    log_f = log_path.open("w", encoding="utf-8")

    def out(msg: str):
        print(msg, flush=True)
        log_f.write(msg + "\n")
        log_f.flush()

    t0 = time.time()

    def progress_cb(event: str, data: dict):
        elapsed = int(time.time() - t0)
        # 精简: 只关心 step_start/step_done/agent_log/error/done
        if event == "step_start":
            out(f"[{elapsed:4d}s] >>> START {data.get('step')}")
        elif event == "step_done":
            extra = " ".join(f"{k}={v}" for k, v in data.items() if k != "step")
            out(f"[{elapsed:4d}s] <<< DONE  {data.get('step')}  {extra}")
        elif event == "agent_log":
            agent = data.get("agent", "?")
            phase = data.get("phase", "?")
            out_str = str(data.get("output", ""))[:120]
            out(f"[{elapsed:4d}s]     · {agent}/{phase}: {out_str}")
        elif event == "error":
            out(f"[{elapsed:4d}s] !!! ERROR {data}")
        elif event == "done":
            out(f"[{elapsed:4d}s] === DONE {data}")
        elif event == "boot":
            out(f"[{elapsed:4d}s] BOOT {json.dumps(data, ensure_ascii=False)[:300]}")
        elif event == "gate_start":
            out(f"[{elapsed:4d}s]   ⚖ GATE start {data.get('step')} idea={data.get('idea_id')} attempt={data.get('attempt')}")
        elif event == "gate_pass":
            out(f"[{elapsed:4d}s]   ⚖ GATE pass  {data.get('step')} idea={data.get('idea_id')} attempt={data.get('attempt')}")
        elif event == "gate_fail":
            issues = data.get('issues') or []
            issues_str = "; ".join(str(i)[:120] for i in issues[:3])
            out(f"[{elapsed:4d}s]   ⚖ GATE FAIL  {data.get('step')} idea={data.get('idea_id')} attempt={data.get('attempt')}: {issues_str}")
        elif event == "idea_complete":
            out(f"[{elapsed:4d}s]   ✓ idea_complete {data.get('idea_id')} mode={data.get('mode')} status={data.get('status')}")

    out(f"=== v3 pipeline: {project} / knode {knode_idx} / version='{version_label}' (set_active={set_active}) ===")
    out(f"log file: {log_path}")

    try:
        result = asyncio.run(generate_course_v3(
            project_name=project,
            knode_id=knode_idx,
            version_label=version_label,
            set_active=set_active,
            progress_cb=progress_cb,
        ))
        out(f"\n=== RESULT status={result.get('status')} version={result.get('version_label')} ===")
        cc = result.get("course_content", {})
        out(f"course_content keys: {list(cc.keys())[:15]}")
        out(f"plan_markdown len: {len(cc.get('plan_markdown', ''))}")
        out(f"theories: {len(cc.get('theories', []))}")
        out(f"ideas: {len(cc.get('ideas', []))}")
        out(f"rendered_sections: {list(cc.get('rendered_sections', {}).keys())[:10]}")
        sys.exit(0)
    except Exception as exc:
        out(f"\n!!! pipeline raised: {type(exc).__name__}: {exc}")
        import traceback
        out(traceback.format_exc())
        sys.exit(1)
    finally:
        log_f.close()


if __name__ == "__main__":
    main()
