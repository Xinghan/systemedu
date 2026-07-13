#!/usr/bin/env python3
"""校验 5 分支产出结构 (spec 044 Task 3)。
检查: 字段完整 + id 前缀 m. + subject 恒 Mathematics + 学段/type 合法
     + 边端点存在 (math 点或现有 c. 点) + 每个数学点是否有服务边(反悬空)。"""
import json
import glob
import os

IDEA = os.path.expanduser('~/Dev/systemeduidea/content-workspace/_review')
BO = os.path.join(os.path.dirname(__file__), 'branch_out')

# 现有全 id 集 (服务边 to 的合法目标)
valid_ids = set()
for sl in glob.glob(f'{IDEA}/*_concept_slice.json'):
    for c in json.load(open(sl, encoding='utf-8'))['concepts']:
        valid_ids.add(c['id'])

GB = {'elementary', 'middle', 'high', 'university'}
TY = {'CONCEPTUAL', 'PROCEDURAL', 'REPRESENTATIONAL', 'LANGUAGE', 'META'}
REQ = ['id', 'name_zh', 'name_en', 'type', 'grade_band', 'subject', 'description', 'wikidata_search']

files = sorted(glob.glob(f'{BO}/*.json'))
if not files:
    print("!! branch_out 下没有 json, agent 还没产出")
    raise SystemExit(1)

math_ids = set()
allc = []
errors = []
for f in files:
    d = json.load(open(f, encoding='utf-8'))
    for c in d['concepts']:
        for k in REQ:
            if not c.get(k):
                errors.append(f"{os.path.basename(f)}: {c.get('id','?')} 缺字段 {k}")
        if not str(c.get('id', '')).startswith('m.'):
            errors.append(f"{os.path.basename(f)}: id 不以 m. 开头 {c.get('id')}")
        if c.get('subject') != 'Mathematics':
            errors.append(f"{os.path.basename(f)}: subject 非 Mathematics {c.get('id')}")
        if c.get('grade_band') not in GB:
            errors.append(f"{os.path.basename(f)}: 学段非法 {c.get('id')}={c.get('grade_band')}")
        if c.get('type') not in TY:
            errors.append(f"{os.path.basename(f)}: type 非法 {c.get('id')}={c.get('type')}")
        math_ids.add(c['id'])
        allc.append(c)

# 边端点 + 悬空检测
served_from = set()   # 有 soft 服务边出去的数学点
has_hard_out = set()  # 前置到别的数学点 (间接可达服务)
edge_warn = []
for f in files:
    d = json.load(open(f, encoding='utf-8'))
    for e in d.get('concept_edges', []):
        fr, to, st = e.get('from'), e.get('to'), e.get('strength', 'soft')
        fr_ok = fr in math_ids or fr in valid_ids
        to_ok = to in math_ids or to in valid_ids
        if not (fr_ok and to_ok):
            edge_warn.append(f"{os.path.basename(f)}: 边端点未知 {fr}->{to} ({st})")
        if st == 'soft' and fr in math_ids and to in valid_ids:
            served_from.add(fr)
        if st == 'hard' and fr in math_ids and to in math_ids:
            has_hard_out.add(fr)

print("=== 分支概况 ===")
for f in files:
    d = json.load(open(f, encoding='utf-8'))
    ne = len(d.get('concept_edges', []))
    nsoft = sum(1 for e in d.get('concept_edges', []) if e.get('strength') == 'soft')
    print(f"{os.path.basename(f):16} {len(d['concepts']):3} 概念  {ne:3} 边 (soft {nsoft})  {len(d.get('covers', [])):3} covers")

# 悬空: 既没有 soft 服务边, 也没 hard 前置到别的点
dangling = [c['id'] for c in allc if c['id'] not in served_from and c['id'] not in has_hard_out]
from collections import Counter
print(f"\n合计 math 概念: {len(allc)} (去重前)")
print("学段分布:", dict(Counter(c['grade_band'] for c in allc)))
print("type分布:", dict(Counter(c['type'] for c in allc)))
print(f"有直接服务边的数学点: {len(served_from)}/{len(math_ids)}")

if edge_warn:
    print(f"\n--- 边端点未知 ({len(edge_warn)}) ---")
    for w in edge_warn[:30]:
        print(" ", w)
if dangling:
    print(f"\n--- 悬空数学点 (无服务边且无hard后继, {len(dangling)}) ---")
    for i in dangling:
        print("  ", i)

if errors:
    print(f"\n!!! 结构错误 {len(errors)} 条 !!!")
    for e in errors[:40]:
        print("  ", e)
    raise SystemExit(1)
print("\nOK: 结构校验通过 (字段/前缀/subject/学段/type 全绿)")
