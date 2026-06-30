"""Step1-2 (spec 041): LLM 列候选概念 + 教育阶段筛选/补洞.

关键分工 (实测铁律):
- LLM 只负责"列出该学科 K-12到本科入门应有、但现有树缺的核心概念"
  (概念名/英文名/depth/子领域), 不让 LLM 给 QID 号 — 实测 LLM 给号几乎全错。
- QID 由 search_qid 按英文名搜 (wikidata.py), 保证可验证。
这样"完整性"(LLM想全) 与 "可验证锚点"(搜索得) 彻底分离。
"""
from __future__ import annotations

import json
import re

from systemedu.core.llm_client import get_llm

SYSTEM_PROMPT = """你是 K-12 到本科入门的学科课程专家。任务: 给定一个学科、它现有的知识节点清单, 找出该学科在 K-12 到本科入门阶段**应该有、但现有清单里缺失**的核心概念。

## 完整性参照
对照该学科的权威教育标准与教材大纲:
- 数学: CCSS Math (K-12) + 本科入门 (微积分/线性代数/概率统计/离散数学)
- 科学(物理/化学/生物/地球): NGSS DCI + 本科普通课程
- CS/工程/电子: 高中信息科技 + 本科导论
列出"一个学完整基础教育到本科入门的学生应当掌握、而现有清单遗漏"的概念。

## 严格规则
1. **只列现有清单里没有的** — 给你的 existing 清单要逐一比对, 已有的概念不要重复列。
2. **概念粒度, 不是练习粒度** — "二次方程求根公式"是一个概念节点; 不要拆成"配方法/因式分解法/求根公式"三条练习。避免退化成习题表。
3. **每个概念必须能对应一个真实的学科概念** (有英文学名), 不要列教学动作/项目任务。
4. **depth_level 七档**: K1(小1-2)/K3(小3-4)/K5(小5-6)/K7(初1-2)/K9(初3-高1)/K11(高2-高3)/K13(本科基础)。超出本科入门的(研究生级)不要列。
5. **不要给 QID** — 你只给概念名和英文名, QID 由系统按英文名去 Wikidata 搜 (你给的号会被忽略)。
6. proposed_id 形如 `<subject>.<subsector>.<snake_name>`, subsector 尽量复用 existing 里已有的子领域名。

## 输出 (严格 JSON, 不要 markdown 包裹)
{"candidates": [
  {"proposed_id": "math.geom.angle", "name_zh": "角与角度", "name_en": "angle",
   "depth_level": "K5", "subsector": "geom",
   "std_code": "CCSS.Math.4.MD.C.5", "reason": "现有geom缺角度概念, CCSS四年级要求"},
  ...
]}
std_code 没把握就填空字符串。name_en 要准确(用于搜 Wikidata)。"""


def build_user_msg(subject_id: str, subject_zh: str, existing_nodes: list) -> str:
    existing = [{"id": n.id, "name_zh": n.name_zh, "depth": n.depth_level} for n in existing_nodes]
    return (
        f"学科: {subject_id} ({subject_zh})\n"
        f"现有 {len(existing)} 个节点 (不要重复这些):\n"
        f"{json.dumps(existing, ensure_ascii=False)}\n\n"
        f"现在列出该学科 K-12到本科入门应有、但上面缺失的核心概念, 输出严格 JSON。"
    )


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


def list_candidates(subject_id: str, subject_zh: str, existing_nodes: list,
                    provider: str = "thinking") -> list[dict]:
    """LLM 列出该学科缺失的候选概念 (不含 QID, QID 后续搜)."""
    llm = get_llm(provider=provider, streaming=False, temperature=0.2)
    resp = llm.invoke([
        ("system", SYSTEM_PROMPT),
        ("user", build_user_msg(subject_id, subject_zh, existing_nodes)),
    ])
    text = resp.content if hasattr(resp, "content") else str(resp)
    return parse_json(text).get("candidates", [])
