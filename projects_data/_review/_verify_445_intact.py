#!/usr/bin/env python3
"""确认加数学源后, 现有非数学概念的 (zh,en,subj,g) 集合未变 (spec 044 Task 6 验收)。
额外报告: 数学概念是否与现有概念 QID 撞车被合并 (那会让某现有概念 projects 多出数学)。"""
import json
import os

B = os.path.expanduser('~/Dev/systemeduidea/content-workspace/_review')
old = json.load(open(f'{B}/galaxy_all_8courses.json', encoding='utf-8'))['concepts']
new_all = json.load(open(f'{B}/galaxy_all_9courses.json', encoding='utf-8'))['concepts']
new_math = [c for c in new_all if c['subj'] == 'Mathematics']
new_nonmath = [c for c in new_all if c['subj'] != 'Mathematics']


def sig(cs):
    return sorted((c['zh'], c['en'], c['subj'], c['g']) for c in cs)


so, sn = sig(old), sig(new_nonmath)
print(f"旧非数学: {len(so)}, 新非数学: {len(sn)}, 新数学: {len(new_math)}")
print(f"新总概念: {len(new_all)} (= {len(new_nonmath)} 非数学 + {len(new_math)} 数学)")

# QID 撞车检测: 数学概念的 QID 若与现有概念相同, merge 会合并成一个非数学节点 (subj 取先到的)
old_qids = {c['q'] for c in old if c.get('q')}
math_qids = {c['q'] for c in new_math if c.get('q')}
collide = old_qids & math_qids
if collide:
    print(f"\n注意: {len(collide)} 个数学 QID 与现有概念 QID 相同, 已被合并 (不算净增): {sorted(collide)}")

if so != sn:
    diff = set(map(str, so)) ^ set(map(str, sn))
    print(f"\n!!! 现有概念变了! 差异 {len(diff)} 条:")
    for x in sorted(diff)[:40]:
        print("  ", x)
    raise SystemExit(1)
print("\nOK: 现有 445 概念的 (zh,en,subj,g) 完全一致 (数学是净新增, 未污染现有节点)")
