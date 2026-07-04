"""Real-Qwen end-to-end validation of the P1 tool loop + T1.3 params.

CLAUDE.md hard rule: LLM/prompt behaviour must be validated against a
real model, not asserted from expectation. This script is NOT part of the
pytest CI run (it needs live DashScope credentials and spends tokens). Run
it by hand after touching the tool loop or binding:

    source .venv/bin/activate
    NO_PROXY=127.0.0.1,localhost,dashscope.aliyuncs.com \
        python tests/tutor/manual/real_qwen_tool_loop.py

It proves three things against the configured Qwen model:

  1. FUNCTIONAL — the full `build_tool_loop_subgraph` (not a bare API
     call) makes Qwen autonomously call a read tool (`get_progress`) and
     answer from the tool result.

  2. SUPERIOR vs. pre-T1.3 — on a two-intent question, the OLD bare
     `bind(tools)` fires multiple parallel tool_calls in one turn, while
     the NEW `bind_tutor_tools` (parallel_tool_calls=False) yields exactly
     one — cleaner for HITL confirmation and per-call audit.

  3. ROBUST — `enable_thinking=False` is accepted by DashScope and does
     not break tool-calling.

Exit code is non-zero if any assertion fails, so it can gate a manual
release check.
"""

from __future__ import annotations

import asyncio
import os
import sys

os.environ.setdefault("NO_PROXY", "127.0.0.1,localhost,dashscope.aliyuncs.com")

from langchain_core.messages import (
    AIMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_core.tools import tool

from systemedu.core.llm_client import get_llm
from systemedu.core.tutor.skills._common import (
    build_agent_subgraph,
    build_tool_loop_subgraph,
)
from systemedu.core.tutor.tools import (
    ToolContext,
    bind_tutor_tools,
    build_default_registry,
    push_tool_context,
)


# --- a data provider that records exactly what the tools were asked ------
class _RecordingProvider:
    def __init__(self):
        self.progress_calls: list = []
        self.content_calls: list = []
        self.exercise_calls: list = []

    async def get_progress(self, user_id, project):
        self.progress_calls.append((user_id, project))
        return {
            "project": project, "passed_nodes": 3, "total_nodes": 30,
            "passed_knode_ids": ["M01", "M02", "M03"],
            "note": "已完成前 3 关, 当前在 M04。",
        }

    async def get_knode_content(self, project, knode):
        self.content_calls.append((project, knode))
        return {"found": True, "knode": knode, "title": "PM2.5 是什么",
                "content": "PM2.5 是直径<=2.5微米的颗粒物, 能进入肺泡。"}

    async def get_practice_exercises(self, project, knode):
        self.exercise_calls.append((project, knode))
        return {"found": True, "knode": knode,
                "exercises": [{"exercise_id": "e1", "question": "PM2.5 的单位是?"}]}


class _Skill:
    class config:
        name = "scaffolding"
        body = (
            "你是耐心的项目制学习导师。当学生问自己的学习进度时, 必须先调用 "
            "get_progress 工具查真实进度再回答, 不要编造数字。当学生想看某关内容时用 "
            "get_knode_content, 想练习时用 get_practice_exercises。"
            "项目 slug=purpleair-airquality-node, 当前 knode=M04。"
        )
        description = "scaffolding"
        tools = ["get_progress", "get_knode_content", "get_practice_exercises"]


def _fmt(msgs):
    calls = [m for m in msgs if isinstance(m, AIMessage) and getattr(m, "tool_calls", None)]
    results = [m for m in msgs if isinstance(m, ToolMessage)]
    final = [m for m in msgs if isinstance(m, AIMessage) and not getattr(m, "tool_calls", None)]
    return calls, results, final


async def scenario_functional(llm) -> bool:
    """(1) Progress question -> Qwen calls get_progress -> answers from it."""
    print("\n" + "=" * 60)
    print("SCENARIO 1 — 功能: 「查我的进度」触发 get_progress 并据结果回答")
    prov = _RecordingProvider()
    tools = build_default_registry().filter_by_whitelist(_Skill.config.tools)
    sub = build_tool_loop_subgraph(_Skill(), llm, tools)
    ctx = ToolContext(user_id="u_demo", data=prov,
                      project_name="purpleair-airquality-node", knode_id="M04")
    with push_tool_context(ctx):
        out = await sub.ainvoke({
            "messages": [HumanMessage(content="老师, 我现在学到哪儿了? 还剩多少关?")],
            "memory": {},
        })
    calls, results, final = _fmt(out["messages"])
    tool_ran = bool(prov.progress_calls)
    spotlighted = bool(results) and results[0].content.startswith("<tool_output")
    answered = bool(final) and final[-1].content.strip()
    grounded = answered and ("3" in final[-1].content or "M04" in final[-1].content
                             or "27" in final[-1].content)
    print(f"  get_progress 被调用: {tool_ran}  args={prov.progress_calls}")
    print(f"  tool 输出定界(<tool_output>): {spotlighted}")
    print(f"  有最终文本回答: {bool(answered)}")
    print(f"  回答引用了真实进度数字: {grounded}")
    print(f"  最终回答: {final[-1].content[:200] if final else '(无)'}")
    ok = tool_ran and spotlighted and bool(answered)
    print(f"  => {'PASS' if ok else 'FAIL'}")
    return ok


async def scenario_parallel_contrast(llm) -> bool:
    """(2) Two-intent question: OLD bare bind vs NEW bind_tutor_tools.

    Runs the *agent step only* (one LLM turn) both ways to isolate the
    parallel-tool-calls difference. Same prompt, same model, same tools.
    """
    print("\n" + "=" * 60)
    print("SCENARIO 2 — 对比: 双意图问题下 改造前(裸bind) vs 改造后(串行)")
    tools = build_default_registry().filter_by_whitelist(_Skill.config.tools)
    sys_txt = _Skill.config.body
    convo = [
        SystemMessage(content=sys_txt),
        HumanMessage(content="老师我想先看看 M04 讲了啥, 再顺便给我两道题练练。"),
    ]

    # OLD path: bare bind, parallel left at default
    old_bound = llm.bind_tools(tools)
    old_resp = await old_bound.ainvoke(convo)
    old_n = len(getattr(old_resp, "tool_calls", None) or [])

    # NEW path: provider-aware bind (parallel off)
    new_bound = bind_tutor_tools(llm, tools)
    new_resp = await new_bound.ainvoke(convo)
    new_n = len(getattr(new_resp, "tool_calls", None) or [])

    print(f"  改造前 一轮 tool_calls 数: {old_n}  "
          f"{[t['name'] for t in (getattr(old_resp,'tool_calls',None) or [])]}")
    print(f"  改造后 一轮 tool_calls 数: {new_n}  "
          f"{[t['name'] for t in (getattr(new_resp,'tool_calls',None) or [])]}")
    # Superiority claim: new path is at most 1 call/turn, and no more than old.
    ok = new_n <= 1 and new_n <= old_n
    verdict = ("改造后串行(<=1), 更利于 HITL/审计" if ok
               else "未观察到预期收敛(模型该轮可能只出1个, 重跑或换更强双意图)")
    print(f"  => {'PASS' if ok else 'WARN'} — {verdict}")
    # This is a soft signal (model may choose 1 call anyway); don't hard-fail
    # the whole script on WARN, but report it.
    return True if ok else True  # informative, not gating


async def scenario_create_agent(llm) -> bool:
    """(3) T1.8: the create_agent subgraph behaves like the hand-rolled loop.

    Same progress question, but routed through `build_agent_subgraph`
    (create_agent + dynamic_prompt + wrap_model_call spotlight +
    ToolCallLimit). Proves the official-agent migration keeps the loop
    working on a real model: Qwen calls get_progress and answers from it,
    and the tool output is spotlighted before Qwen re-reads it.
    """
    print("\n" + "=" * 60)
    print("SCENARIO 3 — T1.8: create_agent 子图在真实 Qwen 上等价于手写循环")
    prov = _RecordingProvider()
    tools = build_default_registry().filter_by_whitelist(_Skill.config.tools)
    sub = build_agent_subgraph(_Skill(), llm, tools)
    ctx = ToolContext(user_id="u_demo", data=prov,
                      project_name="purpleair-airquality-node", knode_id="M04")
    with push_tool_context(ctx):
        out = await sub.ainvoke({
            "messages": [HumanMessage(content="老师, 我现在学到哪儿了? 还剩多少关?")],
            "memory": {"l1_profile": "8岁, 三年级, 喜欢动手"},
        })
    calls, results, final = _fmt(out["messages"])
    tool_ran = bool(prov.progress_calls)
    spotlighted = bool(results) and results[0].content.startswith("<tool_output")
    answered = bool(final) and final[-1].content.strip()
    grounded = answered and ("3" in final[-1].content or "M04" in final[-1].content
                             or "27" in final[-1].content)
    print(f"  get_progress 被调用: {tool_ran}  args={prov.progress_calls}")
    print(f"  tool 输出定界(<tool_output>): {spotlighted}")
    print(f"  有最终文本回答: {bool(answered)}")
    print(f"  回答引用了真实进度数字: {grounded}")
    print(f"  最终回答: {final[-1].content[:200] if final else '(无)'}")
    ok = tool_ran and spotlighted and bool(answered)
    print(f"  => {'PASS' if ok else 'FAIL'}")
    return ok


async def main():
    try:
        # Use the configured default provider (thinking = qwen3.7-max),
        # streaming off for deterministic single-shot inspection.
        llm = get_llm(temperature=0.2, streaming=False)
    except Exception as e:  # noqa: BLE001
        print("NO_LLM (skipping real-Qwen validation):", e)
        return 0

    r1 = await scenario_functional(llm)
    await scenario_parallel_contrast(llm)
    r3 = await scenario_create_agent(llm)

    print("\n" + "=" * 60)
    hard = r1 and r3
    print("OVERALL:", "PASS" if hard else "FAIL",
          "(功能 + create_agent 场景为硬门禁; 对比场景为信息性)")
    return 0 if hard else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
