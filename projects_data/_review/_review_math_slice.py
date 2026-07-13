#!/usr/bin/env python3
"""审校 math 切片: 按学段列出所有概念 + 检查前置链闭合 + 潜在重复 + 孤立点。"""
import json, os, re, glob

IDEA = os.path.expanduser('~/Dev/systemeduidea/content-workspace/_review')
d = json.load(open(f'{IDEA}/mathematics_concept_slice.json', encoding='utf-8'))
cs = d['concepts']
edges = d['concept_edges']

# 现有课全 id 集 (服务边 to 可能指向它们)
valid_ext = set()
for sl in glob.glob(f'{IDEA}/*_concept_slice.json'):
    if 'mathematics' in sl:
        continue
    for c in json.load(open(sl, encoding='utf-8'))['concepts']:
        valid_ext.add(c['id'])

math_ids = {c['id'] for c in cs}

print(f"=== {len(cs)} 数学概念 (按学段) ===\n")
for gb in ['elementary', 'middle', 'high', 'university']:
    group = sorted([c for c in cs if c['grade_band'] == gb], key=lambda c: c['id'])
    print(f"--- {gb} ({len(group)}) ---")
    for c in group:
        desc = (c.get('description') or '')[:72]
        print(f"  {c['id']:30s} {c.get('name_zh','')} / {c.get('name_en','')}")
        print(f"      {desc}")
    print()

print("=== 前置链(hard)闭合检查 ===")
bad_hard = [e for e in edges if e.get('strength') == 'hard'
            and (e['from'] not in math_ids or e['to'] not in math_ids)]
if bad_hard:
    for e in bad_hard:
        print(f"  BAD hard: {e['from']} -> {e['to']}")
else:
    print("  OK: 所有 hard 前置边端点都是数学概念")

print("\n=== 服务边(soft) to 端点检查 ===")
bad_soft = [e for e in edges if e.get('strength') == 'soft'
            and e['to'] not in math_ids and e['to'] not in valid_ext]
if bad_soft:
    for e in bad_soft[:20]:
        print(f"  BAD soft to: {e['from']} -> {e['to']}")
    print(f"  ...共 {len(bad_soft)} 条服务边 to 指向不存在的 id")
else:
    print("  OK: 所有 soft 服务边 to 都指向真实存在的概念")

print("\n=== 潜在重复(name_en 一方是另一方子集) ===")
def stem(s):
    return set(re.sub(r'[^a-z ]', ' ', (s or '').lower()).split())
seen = []
for c in cs:
    st = stem(c.get('name_en'))
    for c2, st2 in seen:
        if st and st2 and st != st2 and (st <= st2 or st2 <= st):
            print(f"  ? {c['id']} ({c.get('name_en')}) ~ {c2['id']} ({c2.get('name_en')})")
    seen.append((c, st))

print("\n=== 孤立概念检查 (无任何出边) ===")
has_out = {e['from'] for e in edges}
iso = [c['id'] for c in cs if c['id'] not in has_out]
if iso:
    print(f"  无出边概念 {len(iso)}: {iso}")
else:
    print("  OK: 每个概念都有出边")
