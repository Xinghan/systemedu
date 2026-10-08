"""Keep M81's reading surfaces consistent with the reviewed slide evidence."""
import json
from pathlib import Path

NODE = Path('/Users/xinghan/Dev/systemeduidea/projects_data/molecule-monster-hunter/knodes/M81-w0-module')
BACKUP = Path(__file__).parent / 'M81-before-publish'

ERROR = r'''## 单条误差与散点图

本节沿用原作业 A–E 五条教学数据。原表没有标明物理单位、测量来源和测试集划分，因此只用于学习计算，不代表真实溶解度模型的成绩。

约定 $e_i=\hat y_i-y_i$，即预测减真实。正值表示偏高，负值表示偏低，零表示这一条命中。例如 A：$8.0-8.2=-0.2$，预测偏低 0.2。有些文献将残差定义为真实减预测，符号相反，但绝对值和平方不变。

散点图横轴放真实值，纵轴放预测值，参考线为预测等于真实。误差是点与该参考线之间的**竖直差**，不是到斜线的垂线距离。D 的坐标为 (6,3)，误差为 -3；C 位于 (7,7)，误差为零。

连续预测应先量差距。如果需要判断是否合格，还应事先约定允许误差。点贴线只说明这批数据的误差较小，不能仅凭一张图保证模型在新数据上也准确。'''

METRICS = r'''## 从误差到 MAE 和 RMSE

直接平均有符号误差会抵消。例如两条分别偏高 2、偏低 2，平均为零，但每条都差了 2。

$$\mathrm{MAE}=\frac{1}{n}\sum_{i=1}^{n}|e_i|$$

$$\mathrm{RMSE}=\sqrt{\frac{1}{n}\sum_{i=1}^{n}e_i^2}$$

原表的绝对误差为 0.2、0.5、0、3、0.2，总和 3.9；平方误差为 0.04、0.25、0、9、0.04，总和 9.33。因此 MAE=3.9/5=0.78，RMSE=√(9.33/5)≈1.366。

两者的单位均与目标量相同。原表没有提供单位，因此这里不添加虚构单位。在同一批样本、同一目标量和同一种处理方式下，较小的值表示较小的误差；不能直接比较不同单位或不同测试条件的分数。

RMSE≥MAE。两者相等，说明所有绝对误差相同，不说明误差小。受控反例：每条偏高 0.2 时，两项均为 0.2；每条偏高 3 时，两项均为 3。差距提示误差大小不均，需要回到具体样本检查，不能直接断言模型“平时都很好”。

D 的平方项为 9，占本表平方误差总和的约 96.5%。可以优先核对 D 的数据来源、单位和预测过程，但不能仅因它误差大就删除它。'''

TABLE = '''| 分子 | 模型预测 | 真实值 |
|---|---|---|
| A | 8.0 | 8.2 |
| B | 5.5 | 5.0 |
| C | 7.0 | 7.0 |
| D | 3.0 | 6.0 |
| E | 4.2 | 4.0 |'''

TASK = '''## 亲手完成评估证据卡

1. 填写 A–E 的五条误差，保留符号。
2. 画预测 vs 真实散点图，标出预测=真实线和 D 的竖直误差线。
3. 逐项计算绝对值与平方，再求 MAE 和 RMSE。RMSE 可保留两位小数。
4. 找出绝对误差最大的样本，说明它对两项汇总指标的影响。
5. 写出数据来源与限制：这是一张无单位、无测量来源的教学表，不是实测模型成绩。

成果是一张含原数据、误差、图、两项指标和结论边界的证据卡。老师讲课第 9 页可以填写、核验并下载 JSON；也可以在纸上完成。练习不会自动计为真实课程作业提交。

对照结果：五条误差为 -0.2、+0.5、0、-3、+0.2；MAE=0.78，RMSE≈1.37，D 的绝对误差最大。'''

def main():
    slides = json.loads((NODE / 'slides.json').read_text())['slides']
    lesson = '# 给连续数值预测量误差\n\n> Module: M81 · hands_on\n\n这一节把单条预测、散点图、误差指标连接成可核查的评估证据，为后续分子工作台的属性评价做准备。\n\n## 一张表贯穿整节课\n\n' + TABLE + '\n\n' + ERROR + '\n\n[[THEORY:regression_error_and_scatter]]\n\n' + METRICS + '\n\n[[THEORY:mae_and_rmse]]\n\n' + TASK + '\n\n## 下一步\n\n把这套核查流程用于有明确单位、来源与独立测试划分的模型数据。先说明评估证据，再将属性预测接入后续打分，不把一张教学表当成模型有效性的证明。\n\n## 指标定义参考\n\n[scikit-learn：回归指标](https://scikit-learn.org/stable/modules/model_evaluation.html#regression-metrics)\n'
    (NODE / 'lesson.md').write_text(lesson)
    assignment = '# M81 作业 · 连续预测误差证据\n\n## 一、理解与判断\n\n1. 预测 7.5、真实 8.0，按本节约定误差是多少？答案：-0.5，预测偏低。\n2. 点在预测=真实线上表示什么？答案：这条预测误差为零，不保证新数据表现。\n3. MAE 和 RMSE 都为 3，能说误差很小吗？答案：不能；所有绝对误差都为 3 时，两者也相等，是否可接受还需单位和容许误差。\n\n## 二、解释\n\n解释为什么 +2 和 -2 的平均为零，却不能说明两条预测准确；再说明 MAE 与 RMSE 分别如何避免正负抵消。\n\n## 三、动手项目\n\n[HANDS_ON] 用原作业五行教学数据，完成一张评估证据卡。未注明单位、来源，不能称为真实溶解度测量。\n\n' + TABLE + '\n\n' + TASK + '\n'
    (NODE / 'assignment.md').write_text(assignment)
    theories = json.loads((BACKUP / 'theories.json').read_text())
    for theory, body in zip(theories, [ERROR, METRICS]):
        theory['body_markdown'] = body
        theory['related_paragraph'] = body.splitlines()[0][3:]
        for level in theory['level_bodies']:
            level['body_markdown'] = body
        for exercise in theory.get('exercises', []):
            exercise['explanation'] = '按本节约定核对预测减真实、误差大小与指标定义。' + ('误差符号表示偏向；散点贴线不能保证泛化表现。' if theory['theory_id'] == 'regression_error_and_scatter' else 'RMSE 对较大误差更敏感；两者接近或相等不代表误差小，还要核查单位与任务容许误差。')
            if '意味着什么' in exercise.get('question', ''):
                exercise['options'][1] = '平方让较大的误差贡献更突出；差距提示误差大小不均，需要回样本检查'
    (NODE / 'theories.json').write_text(json.dumps(theories, ensure_ascii=False, indent=2) + '\n')
    sections = json.loads((BACKUP / 'sections.json').read_text())
    # Obsolete standalone activities used another unverified dataset. The
    # reviewed replacement activities now live in the actual teacher slides.
    sections['ideas'] = []
    sections['rendered_sections'] = {}
    sections['story_paragraphs'] = []
    sections['animation_topic'] = sections['game_topic'] = sections['exercise_topic'] = ''
    (NODE / 'sections.json').write_text(json.dumps(sections, ensure_ascii=False, indent=2) + '\n')
    audio_scripts = [{'section_title':s['title'], 'audio_script':s['audio_script']} for s in slides]
    (NODE / 'audio_scripts.json').write_text(json.dumps(audio_scripts, ensure_ascii=False, indent=2) + '\n')
    print('M81 reading/assignment/theories aligned; obsolete standalone activities archived, not exposed.')

if __name__ == '__main__':
    main()
