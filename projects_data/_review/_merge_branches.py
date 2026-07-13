#!/usr/bin/env python3
"""合并 5 分支产出 -> mathematics_concept_slice.json (spec 044 Task 4)。
跨分支按 norm(name_en) 去重, 记 id 重定向, 边/covers 重写 + 去重。"""
import json
import glob
import os
import re
from collections import Counter

BO = os.path.join(os.path.dirname(__file__), 'branch_out')
SLICE = os.path.expanduser('~/Dev/systemeduidea/content-workspace/_review/mathematics_concept_slice.json')


def norm(s):
    return re.sub(r'[^a-z0-9]+', ' ', (s or '').lower()).strip()


# 跨分支语义重复的显式合并 (name_en 不同但同概念, 精确去重抓不到, 人工审校定):
#   左边 id 合并进右边 id。方向按"保留名字更规范/学段更合基础"选。
ALIAS = {
    'm.ratio_proportion': 'm.ratio',                 # 比例与百分比 -> 比值
    'm.proportion_scaling': 'm.proportional_relationship',  # 成比例缩放 -> 正比例关系
    'm.moving_average_smoothing': 'm.moving_average',       # 滑动平均(离散) -> 滑动/移动平均
    'm.probability_as_proportion': 'm.probability',         # 概率即长期比例 -> 概率
    'm.signed_bias': 'm.statistical_bias',                  # 带符号偏差 -> 偏差(同指 c.bias)
    'm.absolute_error': 'm.error_metric',                   # 绝对误差MAE -> 误差度量(同服务边)
    'm.count_statistics': 'm.counting_and_tally',           # 计数统计 -> 计数与频数(同为小学计数根)
}

skeleton = json.load(open(SLICE, encoding='utf-8'))
seen_key = {}      # norm(name_en) -> 保留的 id
seen_id = {}       # id -> 首个定义 (同 id 冲突时保留先到的)
id_remap = {}      # 被去重掉的 id -> 保留的 id
concepts = []
edges = []
covers = []
src_of = {}        # id -> 来自哪个分支文件 (审校用)

for f in sorted(glob.glob(f'{BO}/*.json')):
    bkey = os.path.basename(f).replace('.json', '')
    d = json.load(open(f, encoding='utf-8'))
    for c in d['concepts']:
        cid = c['id']
        # (a) 显式 alias 合并
        if cid in ALIAS:
            id_remap[cid] = ALIAS[cid]
            continue
        # (b) 同 id 冲突 (两分支用了相同 id): 保留先到的, 后到的丢弃 (id 不变, 无需 remap)
        if cid in seen_id:
            continue
        # (c) name_en 精确去重
        k = norm(c['name_en'])
        if k in seen_key:
            id_remap[cid] = seen_key[k]
            continue
        seen_key[k] = cid
        seen_id[cid] = bkey
        src_of[cid] = bkey
        concepts.append(c)
    edges += d.get('concept_edges', [])
    covers += d.get('covers', [])


def rm(i):
    return id_remap.get(i, i)


edges2 = []
eseen = set()
for e in edges:
    a, b, s = rm(e['from']), rm(e['to']), e.get('strength', 'soft')
    if a == b:
        continue
    key = (a, b)
    if key in eseen:
        # 已有边, 若新的是 hard 则升级
        if s == 'hard':
            for ee in edges2:
                if (ee['from'], ee['to']) == key:
                    ee['strength'] = 'hard'
        continue
    eseen.add(key)
    edges2.append({'from': a, 'to': b, 'strength': s})

cov2 = []
cseen = set()
for cov in covers:
    c = rm(cov['concept'])
    m = cov['module']
    key = (m, c)
    if key in cseen:
        continue
    cseen.add(key)
    cov2.append({'module': m, 'concept': c})

skeleton['concepts'] = concepts
skeleton['concept_edges'] = edges2
skeleton['covers'] = cov2
json.dump(skeleton, open(SLICE, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

print(f"合并: {len(concepts)} 概念 (跨分支去重 {len(id_remap)}), {len(edges2)} 边, {len(cov2)} covers")
print("学段:", dict(Counter(c['grade_band'] for c in concepts)))
hard = sum(1 for e in edges2 if e['strength'] == 'hard')
soft = len(edges2) - hard
print(f"边: hard {hard} (数学内部前置), soft {soft} (服务边)")
if id_remap:
    print("\n去重重定向 (被合并的 id -> 保留 id):")
    for a, b in id_remap.items():
        print(f"  {a} -> {b}")
print("\n各分支保留概念数:", dict(Counter(src_of.values())))
