"""LLM 补 prerequisites 学习顺序 (spec 041 里程碑3, 关系一).

给新节点推断本学科内的前置依赖。与 related(本体论) 不同: prerequisites 是
"学X前要先会Y"的学习路径, 必须同学科 + 无环 (schema 强制)。

防环策略: 要求 LLM 只选 depth 严格更低(或相等且更基础)的节点做前置, 配合
depth 递增天然减少环; 写入后用 PlatformTree 校验, 不过则丢弃该节点的 prereq。
"""
from __future__ import annotations

import json
import re

from systemedu.core.llm_client import get_llm

_DEPTH_ORDER = {"K1": 1, "K3": 2, "K5": 3, "K7": 4, "K9": 5, "K11": 6, "K13": 7}

SYSTEM_PROMPT = """你是课程设计专家。任务: 给定一个学科里若干"新节点", 以及该学科全部节点清单, 为每个新节点推断它的前置依赖 (prerequisites) —— 学这个概念之前, 学生必须先掌握哪些本学科的其他概念。

## 规则
1. 前置必须从给定的"全部节点清单"里选 (用 node id), 不能凭空造。
2. 前置的 depth_level 应**不高于**目标节点 (学在前的更基础)。优先选 depth 更低的。
3. 每个新节点选 1-4 个最直接的前置 (不要列远祖, 只列紧邻的直接前置)。
   例: "圆锥曲线"的直接前置是"圆""二次函数", 不是"加减法"。
4. 若某新节点确实没有合适的本学科前置 (很基础), 给空数组。
5. 只为给定的"新节点"输出, 不要动其他节点。

## 输出 (严格 JSON, 不要 markdown)
{"prerequisites": {
  "math.geom.conic_sections": ["math.geom.circle", "math.algebra.quadratic_func"],
  "math.arith.integer": ["math.arith.add_sub"],
  ...
}}"""


def _node_brief(n) -> dict:
    return {"id": n.id, "name_zh": n.name_zh, "depth": n.depth_level}


def parse_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\n", "", text)
        text = re.sub(r"\n```\s*$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            return json.loads(m.group(0))
        raise


def suggest_prerequisites(subject_id: str, target_nodes: list, all_nodes: list,
                          provider: str = "thinking") -> dict:
    """LLM 为 target_nodes 推断前置, 返回 {node_id: [prereq_ids]} (已过基本过滤)."""
    all_ids = {n.id for n in all_nodes}
    depth = {n.id: _DEPTH_ORDER.get(n.depth_level, 9) for n in all_nodes}

    llm = get_llm(provider=provider, streaming=False, temperature=0.2)
    user = (
        f"学科: {subject_id}\n"
        f"新节点 ({len(target_nodes)} 个, 为这些推断前置):\n"
        f"{json.dumps([_node_brief(n) for n in target_nodes], ensure_ascii=False)}\n\n"
        f"全部节点清单 (前置从这里选):\n"
        f"{json.dumps([_node_brief(n) for n in all_nodes], ensure_ascii=False)}\n\n"
        f"输出严格 JSON。"
    )
    resp = llm.invoke([("system", SYSTEM_PROMPT), ("user", user)])
    text = resp.content if hasattr(resp, "content") else str(resp)
    raw = parse_json(text).get("prerequisites", {})

    # 过滤: 前置必须存在、同学科、depth 不高于目标、非自身
    target_ids = {n.id for n in target_nodes}
    cleaned = {}
    for nid, prereqs in raw.items():
        if nid not in target_ids:
            continue
        valid = []
        for p in prereqs:
            if (p in all_ids and p.startswith(f"{subject_id}.") and p != nid
                    and depth.get(p, 9) <= depth.get(nid, 0)):
                valid.append(p)
        cleaned[nid] = valid
    return cleaned
