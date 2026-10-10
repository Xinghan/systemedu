"""Generate the reviewed M80 v1 slide repair; keep the original for comparison.

No model measurements are invented. Original TP=2, FP=1 implies accuracy 98%.
The old voice recordings are retained on disk but unmapped until regenerated.
"""
import copy
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
COURSE = ROOT.parent / "systemeduidea/projects_data/molecule-monster-hunter"
TARGET = COURSE / "knodes/M80-w0-module/slides.json"
BACKUP = HERE / "M80-before-evidence-v1.json"

CONTENT = [
    ("overview", "97% 准确率，为什么一个目标也没找到？", "先核查判断结果，再相信一个漂亮的分数。", "这节用一份固定教学数据检查分类评估：一百个分子里，三个是要找的正类，九十七个是负类。全部判负的基线，准确率能达到百分之九十七，但三个目标一个也找不到。我们要把真实标签、模型判断和评价指标放到一起，看看这个高分究竟从哪里来。"),
    ("chain", "从样本计数，走到有证据的模型评价", "M34 的类别计数、M74 的混淆矩阵、M78 的排序评价，在这里连起来。", "先数清楚正类和负类，再把每个判断放进混淆矩阵，最后计算指标。顺序不能反过来。全判负的基线虽然有百分之九十七准确率，但它的召回率为零。只有把这两件事同时写出来，评价才没有漏掉任务本身。"),
    ("population", "100 个分子，先把 3 个正类保留下来", "正类与负类是已有真实标签，不是模型刚刚给出的判断。", "这是一份固定的教学示例，不是真实筛选成绩。三个正类是我们要找的目标，九十七个负类不是目标。每一格代表一个分子，可以点开核查。比较不同判断方法时，这一百个样本和真实标签保持不变。"),
    ("compare", "同一测试集：先把四格和算术算对", "沿用原稿“抓到 2 个、误报 1 个”的判断，正确准确率是 98%。", "先看基线：真正例零，假负例三，假正例零，真负例九十七。再看原稿的判断示例：抓到三个正类中的两个，漏掉一个，误报一个负类，因此还剩九十六个真负例。准确率是二加九十六除以一百，等于百分之九十八，不是旧稿写的百分之九十五。这个例子不支持真模型准确率更低，但基线百分之九十七却零召回的反差仍然成立。"),
    ("ranking", "ROC-AUC 看排序，不能从一张四格表反推", "正类分数更高记 1，并列记 0.5，更低记 0；要检查所有正负配对。", "准确率检查一个工作点的判断对错。排序意义上的 ROC-AUC 则需要每个样本的预测分数。任选一个正类和一个负类，正类分数较高计一，相同计零点五，更低计零，汇总所有正负配对。全体分数都相同的常数基线，每一对并列，所以 AUC 是零点五。本节没有提供真实模型的完整分数，因此不能把它的 AUC 编写成零点八。"),
    ("walkthrough", "动态过程：标签 → 判断 → 准确率 → 召回率", "点击“播放完整过程”，观察同一组样本在四个证据状态中如何变化。", "先显示真实类别，再让基线把所有分子判为负类。三个目标全部进入漏报格，九十七个负类正确排除。接着计算准确率，得到百分之九十七。最后只看三个真实正类，找回零个，召回率为零。同一个基线，这两个数字可以同时成立。"),
    ("lab", "实验台：调整找回和误报，观察三项指标", "这是判断结果的教学模拟，不是重新训练模型；每一格和每个数同步更新。", "现在自己调整结果。先选择全判负类，再选择抓到两个、误报一个，最后选择抓到两个、误报四个。你会看到准确率依次是百分之九十七、九十八和九十五。后两个状态都找回了三分之二的目标，但误报更多时，精确率下降。你也可以拖动滑块，观察找回和误报分别改变了什么。不要只看一个总分。"),
    ("checklist", "修订原则：不只看准确率，也不只看 AUC", "类别比例、排序能力、实际漏报与误报，应一起出现在模型成绩单上。", "我们要记住的原则，不是用 AUC 替代所有指标，而是不要只凭准确率选模型。检查一个工作点时，看召回率、精确率和混淆矩阵。检查排序能力时，需要预测分数，再计算 ROC-AUC。面对严重不平衡数据，也要结合精确率和召回率的表现。最后还要联系项目目标：漏掉目标和多做一次实验，各自付出什么代价。"),
    ("prevalence", "只改变类别比例，基线分数就会变", "基线始终全部判负，找目标的本事始终是零。", "这页只改变真实正类的数量。三个正类时，全部判负的准确率是百分之九十七。十个正类时降到百分之九十。五十个正类时降到百分之五十。可这三个状态的召回率全是零。分数在变，方法并没有学会找目标。类别平衡不等于一个指标就能讲清全部问题。"),
    ("report", "本节产出：一张可以复核的评估证据卡", "写清算出的数，也写清还缺少的证据，再进入 M81 的连续数值误差评估。", "本节带走一张评估证据卡：交代样本比例，写出基线，核对混淆矩阵，计算准确率、召回率和精确率。真实模型的排序 AUC 还缺完整预测分数，就明确标成待补充，而不是填一个漂亮数字。最后解释为什么不能只凭准确率选模型。下一节转向连续数值预测，检查每次预测偏离真实值多远。"),
]

def main():
    if not BACKUP.exists():
        BACKUP.write_bytes(TARGET.read_bytes())
    original = json.loads(BACKUP.read_text())
    assert len(original["slides"]) == len(CONTENT) == 10
    rebuilt = copy.deepcopy(original)
    for slide, (scene, title, subtitle, narration) in zip(rebuilt["slides"], CONTENT):
        previous = slide.get("payload", {})
        payload = {key: previous[key] for key in ("theory_id", "idea_id") if key in previous}
        payload["technical_visual"] = {
            "renderer": "classification-evidence", "scene": scene,
            "total": 100, "positives": 3, "true_positives": 2, "false_positives": 1,
            "aria_label": title,
        }
        payload["bullets"] = [subtitle]
        if slide["kind"] == "intro":
            payload["hero_subtitle"] = subtitle
        if slide["kind"] == "outro":
            payload["key_takeaway"] = subtitle
            payload.pop("bullets")
        slide["title"] = title
        slide["payload"] = payload
        slide["audio_script"] = narration
        slide["audio_path"] = None
    TARGET.write_text(json.dumps(rebuilt, ensure_ascii=False, indent=2) + "\n")
    print("M80: 10 source-mapped slides rebuilt; old recordings unmapped (not deleted).")

if __name__ == "__main__":
    main()
