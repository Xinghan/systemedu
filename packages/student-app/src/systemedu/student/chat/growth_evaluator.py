"""spec 039: 动态知识树生长评估器.

输入: 一个 pending_growth.id (学完/提问/下钻的触发内容)
流程:
  1. 取触发内容 + 该学科平台树节点 (合法 parent 候选) + 该用户已生长节点 (去重对齐)
  2. LLM 评估: 内容里是否有比平台树第三层更深的知识点? 若有, 挂在哪个已有节点下,
     缺失中间层逐级路径是什么, 是否真学到 (点亮)
  3. 逐级 upsert GrownNode: 中间层 lit=false (灰), 目标 lit=true (亮); 已有则跳过 (去重)

约束: 新节点 parent 必须是已有节点 (平台树节点 id 或已生长 node_id), 防凭空挂。
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol

from langchain_core.messages import HumanMessage

from .. import db as _db
from ..library_proxy.client import get_library_client

log = logging.getLogger("growth_evaluator")


class _LLM(Protocol):
    async def ainvoke(self, messages: list[Any]) -> Any: ...


@dataclass
class GrowthStats:
    grown: int          # 新增生长节点数 (含补出的灰中间层)
    reused: int         # 复用已有数
    skipped: bool       # 无可生长 / 解析失败


GROWTH_PROMPT = """你是知识树生长评估器。学生在学习时触及了一些知识点。判断其中是否有
**比"概念叶"更细、更深**的知识点 (第四层及更深), 若有则生长进个人知识树。

## 触发内容
{content}

## 该学科平台知识树 (前三层, 这些是合法的挂载父节点)
{platform_nodes}

## 该用户已生长的深层节点 (去重用 — 已有同/近义的请复用, 不要新建)
{grown_nodes}

## 输出规则
返回严格 JSON 数组 (无 markdown 包裹)。每个元素:
{{
  "concept": "知识点中文名 (如 卷积核)",
  "parent": "挂载父节点 id (必须是上面平台树节点 或 已生长节点 之一)",
  "path": ["从 parent 往下逐级的新节点 id, 用点分, 含缺失中间层"],
  "lit": true/false,   // 学生真学到/掌握=true; 仅作为中间层补出=false
  "reuse_id": null     // 若复用某个已生长节点, 填它的 node_id, 此时 path 可为空
}}

要点:
- 平台树第三层是较宏观的"概念叶", **大多数都能再细分出 2-4 个真实可学的子知识点**,
  请积极生长 (但必须是该概念下真实存在的子知识点, 不要强凑/编造)。
- 例: cs.ai.cnn (卷积神经网络) 可生长子点: 卷积核 cs.ai.cnn.kernel、池化层 cs.ai.cnn.pooling、
  感受野 cs.ai.cnn.receptive_field、反向传播 cs.ai.cnn.backprop。
- path 逐级列出: 若目标是第五层而第四层不存在, path 含第四层和第五层两级。
- path 最后一级按 lit 字段 (学生这次确实深入学到的=true); 仅为铺路补出的中间层=false (灰)。
- 已有同义节点 → reuse_id 填已有 id, 不新建。
- 触发内容里的每个第三层概念, 尽量生长出它最核心的 2-3 个子知识点 (lit=true)。
- 实在没有更细的才返回 [] (少见)。

只输出 JSON 数组, 无 markdown。"""


def _text(resp: Any) -> str:
    c = getattr(resp, "content", resp)
    return c if isinstance(c, str) else str(c)


def _parse(raw: str) -> list[dict]:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\n", "", raw)
        raw = re.sub(r"\n```\s*$", "", raw)
    try:
        d = json.loads(raw)
        return d if isinstance(d, list) else []
    except json.JSONDecodeError:
        m = re.search(r"\[.*\]", raw, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                return []
        return []


class GrowthEvaluator:
    def __init__(self, llm: _LLM):
        self.llm = llm

    async def evaluate(self, pending_id: str) -> GrowthStats:
        with _db.get_session() as sess:
            p = sess.get(_db.PendingGrowth, pending_id)
            if p is None:
                raise ValueError(f"pending_growth {pending_id} not found")
            user_id = p.user_id
            content = p.content
            subject_hint = p.subject_hint
            # 该用户已生长节点
            grown = sess.query(_db.GrownNode).filter_by(user_id=user_id).all()
            grown_lines = [f"{g.node_id} = {g.name_zh}" for g in grown]
            grown_ids = {g.node_id for g in grown}

        lib = get_library_client()

        # source=complete_knode 时 content 是轻量标识 knode:<slug>:<knode_id> —
        # 反查 library 取该 knode 点亮的平台节点名 (= 它真教的概念), 作为评估材料。
        if content.startswith("knode:"):
            try:
                _, slug, knode_id = content.split(":", 2)
                proj = await lib.get_project_knowledge_tree(slug)
                taught = []
                for ln in proj.get("lit_nodes", []):
                    if knode_id in (ln.get("lit_by") or []):
                        taught.append(ln.get("node_id"))
                if taught:
                    # 学科提示 = 第一个点亮节点的学科
                    subject_hint = subject_hint or taught[0].split(".")[0]
                    content = f"学生学完了一节课, 它覆盖这些平台知识点: {', '.join(taught)}。" \
                              f"判断这些概念下是否有更深的子知识点值得生长。"
                else:
                    return GrowthStats(0, 0, True)  # 该 knode 无平台映射, 跳过
            except Exception as e:
                log.warning("resolve knode content failed: %s", e)
                return GrowthStats(0, 0, True)

        # ---- 取平台树 (合法 parent 候选 + 上下文) ----
        try:
            platform = await lib.get_platform_knowledge_tree()
        except Exception as e:
            log.warning("get_platform_knowledge_tree failed: %s", e)
            return GrowthStats(0, 0, True)

        # 平台节点 id 集 (合法 parent) + 文本上下文 (优先 subject_hint 学科)
        platform_ids: set[str] = set()
        ctx_lines: list[str] = []
        for s in platform.get("subjects", []):
            in_hint = subject_hint and s.get("id") == subject_hint
            for n in s.get("nodes", []):
                platform_ids.add(n["id"])
                if in_hint or not subject_hint:
                    ctx_lines.append(f"{n['id']} = {n.get('name_zh', '')}")
        if not ctx_lines:  # subject_hint 没匹配到 → 给全部
            ctx_lines = [f"{n['id']} = {n.get('name_zh','')}"
                         for s in platform.get("subjects", []) for n in s.get("nodes", [])]

        legal_parents = platform_ids | grown_ids

        prompt = GROWTH_PROMPT.format(
            content=content[:3000],
            platform_nodes="\n".join(ctx_lines[:200]),
            grown_nodes="\n".join(grown_lines[:100]) or "(无)",
        )
        resp = await self.llm.ainvoke([HumanMessage(content=prompt)])
        items = _parse(_text(resp))
        if not items:
            return GrowthStats(0, 0, True)

        grown_cnt = 0
        reused_cnt = 0
        now = datetime.utcnow()
        with _db.get_session() as sess:
            for it in items:
                if not isinstance(it, dict):
                    continue
                if it.get("reuse_id"):
                    reused_cnt += 1
                    continue
                parent = it.get("parent", "")
                path = it.get("path") or []
                lit_target = bool(it.get("lit", True))
                if parent not in legal_parents or not path:
                    log.info("growth skip: parent %s not legal or empty path", parent)
                    continue
                # 逐级 upsert: parent → path[0] → path[1] → ...
                cur_parent = parent
                cur_depth = _depth_of(parent, platform_ids)
                for i, nid in enumerate(path):
                    cur_depth += 1
                    is_last = i == len(path) - 1
                    node_lit = lit_target if is_last else False  # 中间层灰
                    exists = sess.query(_db.GrownNode).filter_by(user_id=user_id, node_id=nid).first()
                    if exists:
                        # 已存在: 若本次点亮且原来没亮, 升级为亮
                        if node_lit and not exists.lit:
                            exists.lit = True
                            grown_cnt += 1
                        cur_parent = nid
                        legal_parents.add(nid)
                        continue
                    name = it.get("concept", nid.split(".")[-1]) if is_last else nid.split(".")[-1]
                    sess.add(_db.GrownNode(
                        user_id=user_id, node_id=nid, parent_id=cur_parent,
                        name_zh=name, depth=cur_depth, lit=node_lit,
                        source=None, created_at=now,
                    ))
                    grown_cnt += 1
                    legal_parents.add(nid)
                    cur_parent = nid
            sess.commit()

        return GrowthStats(grown_cnt, reused_cnt, False)


def _depth_of(node_id: str, platform_ids: set[str]) -> int:
    """平台树节点固定深度 3 (学科.子域.概念); 生长节点深度 = 段数。"""
    if node_id in platform_ids:
        return 3
    return len(node_id.split("."))
