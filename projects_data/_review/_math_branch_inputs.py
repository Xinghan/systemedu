"""为 5 个数学分支各生成原料包 md: 相关现有概念 + 可连服务边的现有概念 id 全表。spec 044 Task 1。"""
import json, glob, os

IDEA = os.path.expanduser('~/Dev/systemeduidea/content-workspace/_review')
OUT = os.path.join(os.path.dirname(__file__), 'branch_inputs')
os.makedirs(OUT, exist_ok=True)

# 5 分支的信号词 (决定哪些现有概念作为该分支的提炼原料)
BRANCHES = {
 'quantity': {  # 数与量
   'zh': '数与量', 'kw': ['比例','百分','分数','数量级','单位','计数','换算','科学计数','平均',
     'ratio','proportion','percentage','fraction','order of magnitude','unit','count','average','scale']},
 'algebra': {  # 代数与函数
   'zh': '代数与函数', 'kw': ['方程','函数','斜率','线性','一次','二次','指数','对数','多项式','插值','拟合',
     'equation','function','slope','linear','exponential','logarithm','polynomial','interpolat','regression','fit']},
 'geometry': {  # 几何与空间
   'zh': '几何与空间', 'kw': ['坐标','几何','角','三角','向量','点积','范数','投影','旋转','平移','面积','体积','距离','欧氏','黎曼','维',
     'coordinate','geometr','angle','trigonom','vector','dot product','norm','projection','rotation','area','volume','distance','euclidean','riemann','dimension']},
 'probstat': {  # 概率与统计
   'zh': '概率与统计', 'kw': ['概率','分布','方差','协方差','均值','中位','标准差','统计','相关','回归','采样','贝叶斯','直方图','矩阵','混淆',
     'probability','distribution','variance','covariance','mean','median','deviation','statistic','correlation','regression','sampling','bayes','histogram','matrix','confusion']},
 'calculus': {  # 微积分与变化率
   'zh': '微积分与变化率', 'kw': ['导数','梯度','积分','微分','变化率','卷积','傅里叶','拉普拉斯','频率','幅','相位','变换',
     'derivative','gradient','integral','differential','rate of change','convolution','fourier','laplace','frequency','amplitude','phase','transform']},
}

slices = sorted(glob.glob(f'{IDEA}/*_concept_slice.json'))

# 全部现有概念 (作为服务边目标全表)
all_concepts = []
for sl in slices:
    slug = os.path.basename(sl).replace('_concept_slice.json','')
    if slug == 'stirling': slug = 'stirling-thermal-controller'
    d = json.load(open(sl, encoding='utf-8'))
    for c in d['concepts']:
        all_concepts.append({**c, '_slug': slug})

def relevant(c, kws):
    txt = ((c.get('name_en') or '')+' '+(c.get('name_zh') or '')+' '+(c.get('description') or '')).lower()
    return any(k in txt for k in kws)

for bkey, b in BRANCHES.items():
    kws = [k.lower() for k in b['kw']]
    hits = [c for c in all_concepts if relevant(c, kws)]
    lines = [f"# 分支提炼原料: {b['zh']} ({bkey})\n",
             f"命中现有概念 {len(hits)} 个。这些是该数学分支在 8 课里的**应用点**,",
             f"你的任务是从它们**反向提炼数学母概念** + 补前置链 + 连服务边回这些点。\n",
             "## 该分支相关的现有概念 (可作为服务边目标, 用其 id)\n"]
    for c in sorted(hits, key=lambda c:(c['_slug'], c.get('grade_band',''))):
        q = c.get('wikidata') or '(无QID)'
        lines.append(f"- id=`{c['id']}` [{c['_slug']}/{c.get('grade_band')}/{c.get('subject')}] "
                     f"**{c.get('name_zh')}** / {c.get('name_en')} — {q}")
        lines.append(f"    - {(c.get('description') or '')[:100]}")
    open(f'{OUT}/{bkey}.md','w',encoding='utf-8').write('\n'.join(lines))
    print(f"{bkey}: {len(hits)} 相关现有概念 -> branch_inputs/{bkey}.md")

# 另存一份全概念 id 全表 (agent 连服务边时查证 id 存在)
idmap = [f"{c['id']}\t{c['_slug']}\t{c.get('name_zh')}\t{c.get('name_en')}" for c in all_concepts]
open(f'{OUT}/_all_concept_ids.tsv','w',encoding='utf-8').write('\n'.join(idmap))
print(f"全概念 id 全表: {len(all_concepts)} -> branch_inputs/_all_concept_ids.tsv")
