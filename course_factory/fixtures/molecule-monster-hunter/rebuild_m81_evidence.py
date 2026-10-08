"""Rebuild M81 from its five-row assignment, with inspectable exact evidence."""
import copy
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
COURSE = ROOT.parent / "systemeduidea/projects_data/molecule-monster-hunter"
NODE = COURSE / "knodes/M81-w0-module"
BACKUP = HERE / "M81-before-evidence-v1.json"
SOURCE_NOTE = "原作业 A–E 五条教学数据；未注明物理单位和测量来源，不代表真实溶解度模型成绩。"

CONTENT = [
    ("overview", "预测 8.0、真值 8.2：先量出差多少", "从分类的对错计数，走向连续数值的误差证据。", "这一节我们沿用作业里的五分子小表。A 的预测值是八点零，真实值是八点二，先量出误差负零点二。整节课都用这张表，依次看单条误差、散点图、MAE 和 RMSE，最后做出可以核查的成绩单。原表没有标明物理单位和测量来源，所以它是一份计算练习，不是真实溶解度模型的测量成绩。"),
    ("task", "连续的预测，先回答差多少", "改变预测值，观察方向与差距连续变化。", "点选一个分子，再拖动预测值滑块。真实值保持不动，预测可以高一点、低一点，也可以正好命中。我们先用距离评价连续预测。如果项目想判断是否合格，还需要提前约定容许误差，不能凭感觉把它分成对错。"),
    ("signed", "预测减真实：符号和距离一起读", "本节约定 e = 预测 − 真实，负数偏低，正数偏高。", "依次检查 A 到 E。A 是负零点二，B 是正零点五，C 是零，D 是负三，E 是正零点二。正负保留偏向，绝对值表示相差多少。有些文献把残差定义为真实减预测，符号相反，但绝对值和平方不受影响。读公式前先看符号约定。"),
    ("scatter", "五个分子，一张可以逐点检查的散点图", "横轴真实值、纵轴预测值；竖直误差线把图和表连起来。", "横坐标是真实值，纵坐标是预测值。绿色虚线表示预测等于真实。点击样本点或者表格的样本编号，看它的坐标和误差。点上方偏高，下方偏低。我们量的是竖直差，不是到对角线的垂线长度。贴线只说明这批样本误差较小，不能单凭这张图保证模型能推广到新数据。"),
    ("aggregate", "平均误差为零，为什么仍然可能都错了？", "高估和低估会抵消；先取绝对值或平方再汇总。", "试着让一条预测偏高二，另一条偏低二。直接平均，得到零；可每一条都错了二。拖动滑块，让两边一起变大，有符号平均仍然为零，实际差距却在增加。所以 MAE 先取绝对值，RMSE 先平方，避免把相反方向的误差互相抵消。这里是专门构造的数学反例。"),
    ("formulas", "从五条误差，逐步算出 MAE 和 RMSE", "一张表同步展开 e、|e|、e²，所有分数都能复算。", "第一步按预测减真实算出五条误差。第二步取绝对值，得到零点二、零点五、零、三和零点二，总和三点九，除以五，MAE 是零点七八。第三步平方后总和是九点三三，除以五，再开根，RMSE 约为一点三六六。注意 D 的平方项是九，它对平方误差总和的影响最大。"),
    ("counterexample", "MAE 和 RMSE 接近，不一定说明误差小", "比较每条偏高 0.2、每条偏高 3，以及原作业数据。", "先看每条都偏高零点二，MAE 和 RMSE 都是零点二。再看每条都偏高三，两项分数仍然相等，却都变成三。相等只说明所有绝对误差一样大，不说明它们很小。RMSE 和 MAE 的差距提示误差大小不均，应该回具体样本检查。是否足够准确，还要联系目标量单位和任务容许的误差。"),
    ("outlier", "拖动 D 点：看一个大误差怎样影响两把尺子", "保持其他四条不变；点、竖直误差线、公式和指标实时联动。", "开始让 D 的预测等于真实值六，观察它落在对角线上。点击播放，让它慢慢移到原作业的预测值三。也可以竖直拖动橙色 D 点，或使用滑块。每次改变，绝对误差、平方误差、MAE 和 RMSE 都重新计算。当 D 偏离三时，平方项是九，远大于其他样本的平方项。动画是在调整教学数据，不是在训练模型。"),
    ("workshop", "你来计算、核查并交付评估证据", "填写五条误差，定位大错，算出两项总分并下载成绩单。", "轮到你亲手做。先把五条预测减真实的结果填入表格，保留符号，点击检查。再在散点图或样本按钮里找出绝对误差最大的分子。五条误差核对通过后，填写 MAE 和 RMSE，RMSE 保留两位小数即可。全部正确后，你会得到一张可以下载的评估证据卡。这里没有替你完成练习，必须用自己的计算通过核验。"),
    ("code", "把这套计算变成一段可复核的代码", "代码逐行示意；原数据、误差列表和最终输出一一对应。", "这段标准 Python 代码不依赖额外的科学计算包。先录入作业里的真实值和预测值，再逐项相减，最后计算绝对值的平均与平方均值的平方根。页面是逐行执行示意，不是在浏览器运行 Python。你可以在合适的 Python 环境中复算，结果应是 MAE 零点七八，RMSE 约一点三六六。"),
    ("report", "带走一份有数据、有公式、有边界的成绩单", "从单条误差到总分，同时交代数据来源和结论边界。", "这张参考成绩单列出五条原始数据、每条误差、绝对值与平方，以及 MAE 零点七八和 RMSE 约一点三六六。D 的绝对误差最大，应该优先复核。别忘记写出边界：原表没有单位、测量来源和测试划分，不能当作真实模型评估。把同样的核查流程带入后面的工作台，才能让分数有证据支撑。"),
]

CODE = """from math import sqrt

y_true = [8.2, 5.0, 7.0, 6.0, 4.0]
y_pred = [8.0, 5.5, 7.0, 3.0, 4.2]
errors = [p - y for p, y in zip(y_pred, y_true)]
mae = sum(abs(e) for e in errors) / len(errors)
rmse = sqrt(sum(e * e for e in errors) / len(errors))
print([round(e, 1) for e in errors])
print(f'MAE={mae:.3f}, RMSE={rmse:.3f}')"""

def main():
    target = NODE / "slides.json"
    if not BACKUP.exists():
        BACKUP.write_bytes(target.read_bytes())
    original = json.loads(BACKUP.read_text())
    rows = [{"id": m[0], "predicted": float(m[1]), "actual": float(m[2])} for m in re.findall(r"^\| ([A-E]) \| ([\d.]+) \| ([\d.]+) \|$", (NODE / "assignment.md").read_text(), re.M)]
    assert [row["id"] for row in rows] == list("ABCDE")
    assert len(original["slides"]) == len(CONTENT) == 11
    rebuilt = copy.deepcopy(original)
    for slide, (scene, title, subtitle, narration) in zip(rebuilt["slides"], CONTENT):
        previous = slide.get("payload", {})
        payload = {key: previous[key] for key in ("theory_id", "idea_id") if key in previous}
        visual = {"renderer": "regression-evidence", "scene": scene, "rows": rows, "source_note": SOURCE_NOTE, "aria_label": title}
        if scene == "code":
            visual = {"renderer": "code-trace", "language": "python", "code": CODE, "aria_label": title, "steps": [
                {"title": "1 / 读取同一张表", "detail": "两列位置一一对应，都是 A 到 E 的顺序。", "active_lines": [3, 4], "variables": [{"name": "样本数", "value": "5"}], "output": "尚未计算指标"},
                {"title": "2 / 一行得到全部误差", "detail": "zip 配对，预测减真实；变量展示时四舍五入，尚未执行 print。", "active_lines": [5], "variables": [{"name": "errors（显示为一位小数）", "value": "[-0.2, 0.5, 0.0, -3.0, 0.2]"}], "output": "尚未输出"},
                {"title": "3 / 分别汇总", "detail": "不要先把误差相加；平方求平均后还要开根。", "active_lines": [6, 7], "variables": [{"name": "sum(abs(e))", "value": "3.9"}, {"name": "sum(e*e)", "value": "9.33"}, {"name": "mae", "value": "0.78"}, {"name": "rmse（近似）", "value": "1.366"}], "output": "尚未输出"},
                {"title": "4 / 打印计算证据", "detail": "先输出误差列表，再输出两项指标。这里是执行示意，不在浏览器运行 Python。", "active_lines": [8, 9], "variables": [{"name": "输出小数位数", "value": "误差 1 位；指标 3 位"}], "output": "[-0.2, 0.5, 0.0, -3.0, 0.2]\nMAE=0.780, RMSE=1.366"},
            ]}
        payload["technical_visual"] = visual
        payload["bullets"] = [subtitle]
        if slide["kind"] == "intro":
            payload["hero_subtitle"] = subtitle
        if slide["kind"] == "outro":
            payload["key_takeaway"] = subtitle
            payload.pop("bullets")
        slide.update(title=title, payload=payload, audio_script=narration, audio_path=None)
    target.write_text(json.dumps(rebuilt, ensure_ascii=False, indent=2) + "\n")
    print("M81: 11 slides rebuilt from assignment A–E; original retained; old audio unmapped.")

if __name__ == "__main__":
    main()
