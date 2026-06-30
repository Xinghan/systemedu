# 知识图谱构建工具 (kg-builder) 实现计划

> **For agentic workers:** 用 superpowers:subagent-driven-development 或 executing-plans 逐任务实现。步骤用 `- [ ]` 勾选。

**Goal:** 建 `tools/kg-builder/` 工具,先扩 TreeNode schema 加锚点字段 + 修复 19 个 NOTFOUND 种子,建好三道准入闸门,为逐学科扩建图谱铺好可测地基。

**Architecture:** 在现有 `course_factory/knowledge_tree/schema.py` 的 TreeNode 增量加可选字段 (Pydantic 向后兼容);新工具 `tools/kg-builder/` 实现"LLM列候选→三道闸门→产清单→合入"管线,复用 `systemedu.core.llm_client` 和 Wikidata API。

**Tech Stack:** Python 3.12 + Pydantic + pytest + urllib (Wikidata API) + systemedu.core.llm_client (qwen3.7-max/thinking)。

**范围说明:** 本计划覆盖 spec 里程碑 1 (工具骨架+闸门+测试) 和里程碑 2 (修种子)。里程碑 3-4 (逐学科跑→审→合) 是重复性执行,待里程碑 1-2 验收后另起执行计划。

---

## File Structure

- `course_factory/knowledge_tree/schema.py` (Modify) — TreeNode 加 5 个可选字段
- `tools/kg-builder/kg_builder/__init__.py` (Create) — 包入口
- `tools/kg-builder/kg_builder/wikidata.py` (Create) — QID 回查 (urllib + 缓存)
- `tools/kg-builder/kg_builder/gate.py` (Create) — 三道准入闸 (回查/有锚点/去重)
- `tools/kg-builder/kg_builder/merge.py` (Create) — 审批清单合入 platform_tree.json
- `tools/kg-builder/kg_builder/fix_seeds.py` (Create) — 里程碑2: 修 19 个 NOTFOUND + 回填 verified
- `tests/test_kg_schema_anchors.py` (Create) — schema 新字段测试
- `tests/test_kg_gate.py` (Create) — 闸门测试 (mock Wikidata)
- `tests/test_kg_merge.py` (Create) — 合入测试

---

## Task 1: TreeNode 加锚点字段

**Files:**
- Modify: `course_factory/knowledge_tree/schema.py`
- Test: `tests/test_kg_schema_anchors.py`

- [ ] **Step 1: 写失败测试**

```python
# tests/test_kg_schema_anchors.py
"""TreeNode 锚点字段测试 (spec 041)."""
from course_factory.knowledge_tree.schema import TreeNode, load_platform_tree


def test_treenode_accepts_anchor_fields():
    n = TreeNode(
        id="math.algebra.linear_eq", name_zh="一次方程", name_en="Linear Equation",
        depth_level="K7", description="解一元一次方程",
        wikidata_qid="Q11348", std_codes=["CCSS.Math.8.EE.C.7"],
        mapping_type="exact", provenance="kg-builder-v1", verified=True,
    )
    assert n.wikidata_qid == "Q11348"
    assert n.std_codes == ["CCSS.Math.8.EE.C.7"]
    assert n.verified is True


def test_treenode_anchor_fields_optional():
    # 旧节点不带锚点字段仍能构造 (向后兼容)
    n = TreeNode(id="math.arith.add", name_zh="加法", name_en="Addition",
                 depth_level="K1", description="加法")
    assert n.wikidata_qid is None
    assert n.std_codes == []
    assert n.verified is False


def test_existing_platform_tree_still_loads():
    # 现有 425 节点 platform_tree.json 不带新字段, 必须仍能 load
    tree = load_platform_tree()
    assert tree.total_node_count() == 425
```

- [ ] **Step 2: 跑测试确认失败**

Run: `source .venv/bin/activate && python -m pytest tests/test_kg_schema_anchors.py -v`
Expected: FAIL — `TreeNode` 不接受 `wikidata_qid` 等字段 (Pydantic ValidationError 或 unexpected keyword)

- [ ] **Step 3: 改 schema.py 加字段**

在 `course_factory/knowledge_tree/schema.py` 的 `TreeNode` 类,`description` 字段后加:

```python
class TreeNode(BaseModel):
    id: str = Field(..., description="<subject>.<category>.<name>, snake_case")
    name_zh: str
    name_en: str
    depth_level: DepthLevel
    prerequisites: list[str] = Field(default_factory=list)
    description: str
    # spec 041: 外部体系锚点字段 (全部可选, 向后兼容旧 JSON)
    wikidata_qid: str | None = None
    std_codes: list[str] = Field(default_factory=list)
    mapping_type: Literal["exact", "broader", "composite", "none"] | None = None
    provenance: Literal["seed", "kg-builder-v1"] | None = None
    verified: bool = False
```

- [ ] **Step 4: 跑测试确认通过**

Run: `source .venv/bin/activate && python -m pytest tests/test_kg_schema_anchors.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: 提交**

```bash
git add course_factory/knowledge_tree/schema.py tests/test_kg_schema_anchors.py
git commit -m "feat(spec-041): TreeNode 加可验证锚点字段 (qid/std_codes/verified)"
```

---

## Task 2: Wikidata QID 回查模块

**Files:**
- Create: `tools/kg-builder/kg_builder/__init__.py` (空文件, 包标记)
- Create: `tools/kg-builder/kg_builder/wikidata.py`
- Test: `tests/test_kg_gate.py` (本任务先建 wikidata 部分测试)

- [ ] **Step 1: 写失败测试**

```python
# tests/test_kg_gate.py
"""kg-builder 闸门测试 (spec 041)."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools" / "kg-builder"))
from kg_builder.wikidata import qid_exists


def test_qid_exists_true(monkeypatch):
    # mock urllib 返回有效实体
    def fake_fetch(qid):
        return {"entities": {qid: {"id": qid, "labels": {"en": {"value": "linear algebra"}}}}}
    monkeypatch.setattr("kg_builder.wikidata._fetch_entity", fake_fetch)
    ok, label = qid_exists("Q190524")
    assert ok is True
    assert label == "linear algebra"


def test_qid_exists_false(monkeypatch):
    # mock urllib 返回空 (不存在的 QID)
    def fake_fetch(qid):
        return {"entities": {qid: {"missing": ""}}}
    monkeypatch.setattr("kg_builder.wikidata._fetch_entity", fake_fetch)
    ok, label = qid_exists("Q999999999")
    assert ok is False
    assert label is None
```

- [ ] **Step 2: 跑测试确认失败**

Run: `source .venv/bin/activate && python -m pytest tests/test_kg_gate.py -v`
Expected: FAIL — `ModuleNotFoundError: kg_builder.wikidata`

- [ ] **Step 3: 写 wikidata.py**

```python
# tools/kg-builder/kg_builder/wikidata.py
"""Wikidata QID 回查 (spec 041 准入闸门第一道)."""
from __future__ import annotations

import json
import time
import urllib.request

UA = "SystemEdu-kg-builder/1.0 (educational knowledge graph)"
_cache: dict[str, tuple[bool, str | None]] = {}


def _fetch_entity(qid: str) -> dict:
    url = f"https://www.wikidata.org/wiki/Special:EntityData/{qid}.json"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode("utf-8"))


def qid_exists(qid: str) -> tuple[bool, str | None]:
    """回查 QID 是否真实存在于 Wikidata, 返回 (存在?, 英文label)."""
    if not qid or not qid.startswith("Q"):
        return False, None
    if qid in _cache:
        return _cache[qid]
    try:
        data = _fetch_entity(qid)
        ent = data.get("entities", {}).get(qid, {})
        if "missing" in ent:
            result = (False, None)
        else:
            label = ent.get("labels", {}).get("en", {}).get("value")
            result = (True, label)
    except Exception:
        result = (False, None)
    _cache[qid] = result
    time.sleep(0.2)  # 礼貌限速
    return result
```

- [ ] **Step 4: 跑测试确认通过**

Run: `source .venv/bin/activate && python -m pytest tests/test_kg_gate.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: 提交**

```bash
git add tools/kg-builder/kg_builder/__init__.py tools/kg-builder/kg_builder/wikidata.py tests/test_kg_gate.py
git commit -m "feat(spec-041): Wikidata QID 回查模块 (闸门第一道)"
```

---

## Task 3: 三道准入闸门

**Files:**
- Create: `tools/kg-builder/kg_builder/gate.py`
- Test: `tests/test_kg_gate.py` (追加)

- [ ] **Step 1: 追加失败测试**

在 `tests/test_kg_gate.py` 末尾追加:

```python
from kg_builder.gate import gate_candidate, GateResult


def _ok_qid(monkeypatch):
    monkeypatch.setattr("kg_builder.gate.qid_exists", lambda q: (True, "linear algebra"))


def test_gate_passes_valid_candidate(monkeypatch):
    _ok_qid(monkeypatch)
    cand = {"node_id": "math.algebra.new_concept", "qid": "Q190524", "std_codes": []}
    res = gate_candidate(cand, existing_ids={"math.arith.add"})
    assert res.passed is True
    assert res.verified is True


def test_gate_rejects_fake_qid_no_stdcode(monkeypatch):
    # QID 回查失败 + 无标准码 -> 拒
    monkeypatch.setattr("kg_builder.gate.qid_exists", lambda q: (False, None))
    cand = {"node_id": "math.algebra.fake", "qid": "Q999999999", "std_codes": []}
    res = gate_candidate(cand, existing_ids=set())
    assert res.passed is False
    assert "no_anchor" in res.reason


def test_gate_rejects_duplicate(monkeypatch):
    _ok_qid(monkeypatch)
    cand = {"node_id": "math.arith.add", "qid": "Q190524", "std_codes": []}
    res = gate_candidate(cand, existing_ids={"math.arith.add"})
    assert res.passed is False
    assert "duplicate" in res.reason


def test_gate_passes_stdcode_only_when_qid_fails(monkeypatch):
    # QID 回查失败但有标准码 -> 仍过 (锚点=标准码), verified=False
    monkeypatch.setattr("kg_builder.gate.qid_exists", lambda q: (False, None))
    cand = {"node_id": "math.algebra.x", "qid": "", "std_codes": ["CCSS.Math.8.EE.C.7"]}
    res = gate_candidate(cand, existing_ids=set())
    assert res.passed is True
    assert res.verified is False
```

- [ ] **Step 2: 跑测试确认失败**

Run: `source .venv/bin/activate && python -m pytest tests/test_kg_gate.py -v`
Expected: FAIL — `ImportError: cannot import name 'gate_candidate'`

- [ ] **Step 3: 写 gate.py**

```python
# tools/kg-builder/kg_builder/gate.py
"""三道准入闸 (spec 041): Wikidata回查 / 有锚点 / 去重."""
from __future__ import annotations

from dataclasses import dataclass

from kg_builder.wikidata import qid_exists


@dataclass
class GateResult:
    passed: bool
    verified: bool          # QID 经回查确认存在
    reason: str             # 通过="ok"; 拒绝原因 "duplicate"/"no_anchor"
    qid_label: str | None = None


def gate_candidate(cand: dict, existing_ids: set[str]) -> GateResult:
    """对一个候选节点跑三道闸. cand 需含 node_id / qid / std_codes."""
    nid = cand["node_id"]
    # 闸3: 去重 (放最前, 省掉对重复节点的网络回查)
    if nid in existing_ids:
        return GateResult(False, False, "duplicate")

    qid = (cand.get("qid") or "").strip()
    std_codes = cand.get("std_codes") or []

    # 闸1: QID 回查
    verified, label = (False, None)
    if qid:
        verified, label = qid_exists(qid)

    # 闸2: 有锚点 (verified QID 或 标准码 至少其一)
    if not verified and not std_codes:
        return GateResult(False, False, "no_anchor")

    return GateResult(True, verified, "ok", label)
```

- [ ] **Step 4: 跑测试确认通过**

Run: `source .venv/bin/activate && python -m pytest tests/test_kg_gate.py -v`
Expected: PASS (6 passed — 含 Task2 的 2 个)

- [ ] **Step 5: 提交**

```bash
git add tools/kg-builder/kg_builder/gate.py tests/test_kg_gate.py
git commit -m "feat(spec-041): 三道准入闸门 (回查/有锚点/去重)"
```

---

## Task 4: 审批清单合入 platform_tree.json

**Files:**
- Create: `tools/kg-builder/kg_builder/merge.py`
- Test: `tests/test_kg_merge.py`

- [ ] **Step 1: 写失败测试**

```python
# tests/test_kg_merge.py
"""kg-builder 合入测试 (spec 041)."""
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools" / "kg-builder"))
from kg_builder.merge import merge_nodes
from course_factory.knowledge_tree.schema import PlatformTree


def _minimal_tree() -> dict:
    return {
        "schema_version": "1.0",
        "subjects": [{
            "id": "math", "name_zh": "数学", "name_en": "Mathematics", "color": "#527B95",
            "nodes": [{
                "id": "math.arith.add", "name_zh": "加法", "name_en": "Addition",
                "depth_level": "K1", "prerequisites": [], "description": "加法",
            }],
        }],
    }


def test_merge_adds_new_node(tmp_path):
    p = tmp_path / "tree.json"
    p.write_text(json.dumps(_minimal_tree()), encoding="utf-8")
    new = [{
        "id": "math.algebra.linear_eq", "name_zh": "一次方程", "name_en": "Linear Equation",
        "depth_level": "K7", "prerequisites": [], "description": "解一元一次方程",
        "wikidata_qid": "Q11348", "std_codes": ["CCSS.Math.8.EE.C.7"],
        "mapping_type": "exact", "provenance": "kg-builder-v1", "verified": True,
    }]
    merge_nodes(p, "math", new)
    tree = PlatformTree(**json.loads(p.read_text(encoding="utf-8")))
    assert tree.total_node_count() == 2
    node = tree.find_node("math.algebra.linear_eq")
    assert node.wikidata_qid == "Q11348"
    assert node.verified is True


def test_merge_backfills_existing_node(tmp_path):
    # 对已存在节点: 不新增, 只回填锚点字段
    p = tmp_path / "tree.json"
    p.write_text(json.dumps(_minimal_tree()), encoding="utf-8")
    backfill = [{
        "id": "math.arith.add", "name_zh": "加法", "name_en": "Addition",
        "depth_level": "K1", "prerequisites": [], "description": "加法",
        "wikidata_qid": "Q32043", "mapping_type": "exact", "provenance": "seed", "verified": True,
    }]
    merge_nodes(p, "math", backfill)
    tree = PlatformTree(**json.loads(p.read_text(encoding="utf-8")))
    assert tree.total_node_count() == 1  # 没新增
    assert tree.find_node("math.arith.add").wikidata_qid == "Q32043"


def test_merge_result_passes_schema_validation(tmp_path):
    # 合入后整树必须仍过 schema 全部校验 (环检测/prereq同学科)
    p = tmp_path / "tree.json"
    p.write_text(json.dumps(_minimal_tree()), encoding="utf-8")
    new = [{
        "id": "math.algebra.linear_eq", "name_zh": "一次方程", "name_en": "Linear Equation",
        "depth_level": "K7", "prerequisites": ["math.arith.add"], "description": "解方程",
        "wikidata_qid": "Q11348", "mapping_type": "exact", "provenance": "kg-builder-v1", "verified": True,
    }]
    merge_nodes(p, "math", new)
    # 不抛 = 过校验
    PlatformTree(**json.loads(p.read_text(encoding="utf-8")))
```

- [ ] **Step 2: 跑测试确认失败**

Run: `source .venv/bin/activate && python -m pytest tests/test_kg_merge.py -v`
Expected: FAIL — `ModuleNotFoundError: kg_builder.merge`

- [ ] **Step 3: 写 merge.py**

```python
# tools/kg-builder/kg_builder/merge.py
"""审批后清单合入 platform_tree.json (spec 041 Step5)."""
from __future__ import annotations

import json
from pathlib import Path

from course_factory.knowledge_tree.schema import PlatformTree

ANCHOR_FIELDS = ("wikidata_qid", "std_codes", "mapping_type", "provenance", "verified")


def merge_nodes(tree_path: Path, subject_id: str, nodes: list[dict]) -> None:
    """把审批过的 nodes 合入 subject_id 学科:
    - id 已存在 -> 只回填锚点字段 (不改 name/depth/prereq)
    - id 不存在 -> 追加为新节点
    合入后用 PlatformTree 校验 (不过则抛, 不落盘)。
    """
    data = json.loads(tree_path.read_text(encoding="utf-8"))
    subj = next((s for s in data["subjects"] if s["id"] == subject_id), None)
    if subj is None:
        raise ValueError(f"subject {subject_id} 不存在")

    existing = {n["id"]: n for n in subj["nodes"]}
    for nd in nodes:
        nid = nd["id"]
        if nid in existing:
            for f in ANCHOR_FIELDS:
                if f in nd:
                    existing[nid][f] = nd[f]
        else:
            subj["nodes"].append(nd)

    # 校验 (不过抛异常, 不落盘)
    PlatformTree(**data)
    tree_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
```

- [ ] **Step 4: 跑测试确认通过**

Run: `source .venv/bin/activate && python -m pytest tests/test_kg_merge.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: 提交**

```bash
git add tools/kg-builder/kg_builder/merge.py tests/test_kg_merge.py
git commit -m "feat(spec-041): 审批清单合入 platform_tree (新增+回填+校验)"
```

---

## Task 5: 里程碑2 — 回填 425 种子锚点 + 修 19 个 NOTFOUND

**Files:**
- Create: `tools/kg-builder/kg_builder/fix_seeds.py`
- 数据源: `projects_data/_review/qid_verify.csv` (已生成)
- 修改: `course_factory/knowledge_tree/platform_tree.json` (回填)

- [ ] **Step 1: 写 fix_seeds.py (回填脚本)**

```python
# tools/kg-builder/kg_builder/fix_seeds.py
"""里程碑2 (spec 041): 把 qid_verify.csv 的种子映射回填进 platform_tree.json.

- OK/SUSPECT 行: 回填 wikidata_qid + mapping_type + verified(OK=True/SUSPECT=False)
- NOTFOUND 行: 跳过回填 (QID 是编造的), 输出到 _notfound_todo.csv 待人工重映射
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
VERIFY_CSV = REPO / "projects_data" / "_review" / "qid_verify.csv"
TREE = REPO / "course_factory" / "knowledge_tree" / "platform_tree.json"
TODO = REPO / "projects_data" / "_review" / "_notfound_todo.csv"


def run() -> dict:
    rows = list(csv.DictReader(open(VERIFY_CSV, encoding="utf-8")))
    by_id = {r["node_id"]: r for r in rows}
    data = json.loads(TREE.read_text(encoding="utf-8"))

    filled = notfound = 0
    notfound_rows = []
    for subj in data["subjects"]:
        for n in subj["nodes"]:
            r = by_id.get(n["id"])
            if not r:
                continue
            flag = r["verify_flag"]
            if flag == "NOTFOUND":
                notfound += 1
                notfound_rows.append(r)
                continue
            if flag == "SKIP":
                continue
            n["wikidata_qid"] = r["qid"]
            n["mapping_type"] = r["mapping_type"]
            n["provenance"] = "seed"
            n["verified"] = (flag == "OK")
            filled += 1

    # 校验后落盘
    from course_factory.knowledge_tree.schema import PlatformTree
    PlatformTree(**data)
    TREE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    if notfound_rows:
        with open(TODO, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=notfound_rows[0].keys())
            w.writeheader(); w.writerows(notfound_rows)

    return {"filled": filled, "notfound": notfound, "todo_csv": str(TODO)}


if __name__ == "__main__":
    print(run())
```

- [ ] **Step 2: 跑回填**

Run: `source .venv/bin/activate && python tools/kg-builder/kg_builder/fix_seeds.py`
Expected: 输出 `{'filled': ~405, 'notfound': 19, 'todo_csv': '...'}`,且不抛 schema 异常。

- [ ] **Step 3: 验证回填结果**

Run: `source .venv/bin/activate && python -c "from course_factory.knowledge_tree.schema import load_platform_tree as L; t=L(); v=[n for s in t.subjects for n in s.nodes if n.wikidata_qid]; print('有QID节点:', len(v), '/ verified:', sum(1 for s in t.subjects for n in s.nodes if n.verified))"`
Expected: 有QID节点 ~405, verified ~123 (OK 数), 总数仍 425

- [ ] **Step 4: 提交**

```bash
git add tools/kg-builder/kg_builder/fix_seeds.py course_factory/knowledge_tree/platform_tree.json
git commit -m "feat(spec-041): 回填425种子节点QID锚点, 19个NOTFOUND输出待重映射"
```

---

## Task 6: 19 个 NOTFOUND 节点重映射 (人工辅助)

**Files:**
- 数据: `projects_data/_review/_notfound_todo.csv` (Task5 产出)
- 修改: `course_factory/knowledge_tree/platform_tree.json`

- [ ] **Step 1: 对 19 个节点逐个查正确 QID**

这 19 个都是真实概念 (马尔可夫链/SSH/PWM/运算放大器等), LLM 配错了 QID 号。逐个在 Wikidata 搜正确实体。已知正确值 (需逐个核对 wikidata.org 确认):

```
math.prob.markov           -> 马尔可夫链 (查 "Markov chain")
cs.net.ssh                 -> Secure Shell (查 "Secure Shell")
elec.signal.pwm            -> 脉宽调制 (查 "pulse-width modulation")
elec.comp.op_amp           -> 运算放大器 (查 "operational amplifier")
phys.energy.momentum_conservation -> 动量守恒 (查 "conservation of momentum")
... (其余 14 个同法, 见 _notfound_todo.csv)
```

逐个用 `python -c "from kg_builder.wikidata import qid_exists; print(qid_exists('Qxxxx'))"` 验证候选 QID 真实存在再填。

- [ ] **Step 2: 用 merge_nodes 回填正确 QID**

写一个一次性 `_apply_notfound_fixes.py` (放 projects_data/_review/),用 Task4 的 `merge_nodes` 把 19 个正确 QID 回填 (provenance="seed", verified=True)。

- [ ] **Step 3: 验证无 NOTFOUND 残留**

Run: 重跑 `kg_builder.wikidata.qid_exists` 校验这 19 个,全部 True。

- [ ] **Step 4: 提交**

```bash
git add course_factory/knowledge_tree/platform_tree.json
git commit -m "fix(spec-041): 修正19个NOTFOUND种子节点的正确Wikidata QID"
```

---

## 验收 (里程碑 1-2)

- [ ] 全部测试通过: `python -m pytest tests/test_kg_schema_anchors.py tests/test_kg_gate.py tests/test_kg_merge.py -v`
- [ ] platform_tree.json 仍 425 节点, 仍过 schema 校验
- [ ] ~405 种子节点有 wikidata_qid, ~123 verified=True
- [ ] 19 个 NOTFOUND 已修正为真实 QID
- [ ] 工具骨架 (wikidata/gate/merge) 就位, 为里程碑3逐学科扩建铺好地基

> 里程碑 3-4 (逐学科 LLM 列候选 → 闸门 → 产清单 → 审 → 合) 待本计划验收后另起执行计划。
