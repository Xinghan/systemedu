"""Versioned review-only drafts. Never mutates the course source or production."""
import hashlib
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
COURSE = ROOT.parent / "systemeduidea/projects_data/molecule-monster-hunter"
DOCS = ROOT / "docs/slide-image-prompts"

# scene, title / teaching claim, source-grounded relationship, method, learner action / observable result
BRIEFS = {
    "M78": [
        ("overview", "从 8 条预测分数，画出一份 ROC 证据", "真值与分数 → 阈值 → 计数 → 坐标 → 面积", "JSXGraph + DOM", "点选阈值；样本判定、矩阵和坐标联动"),
        ("threshold", "阈值经过一个分数，谁的判定变了？", "固定真值，仅改变 score ≥ threshold 的判断", "动态分数条 + 混淆矩阵 + 坐标", "拖动滑块 / 选择 0.9、0.63、0.5、0.1；检查谁新进入"),
        ("rates", "一个 ROC 点，需要两个不同的分母", "TP / 全部真阳类与 FP / 全部真阴类 → TPR、FPR", "KaTeX + DOM 精确计数", "改变阈值，公式数字与坐标实时重算"),
        ("sweep", "逐个放宽阈值：向上、向右，连成曲线", "同一批样本在各个唯一分数处产生可达点", "可暂停离散过程 + JSXGraph", "播放 / 单步 / 重置；曲线逐段累计"),
        ("area", "把 AUC 拆成每一段可复算的面积", "相邻坐标的宽度与平均高度 → 梯形面积之和", "KaTeX + 面积图 + 数值证据", "选择曲线条带，核对宽度、高度和面积贡献"),
        ("limits", "分数变了，AUC 为什么可能完全不变？", "原分数、单调平方、全部同分 → 排序与曲线比较", "确定性反例 + JSXGraph", "切换三种明确标注的数据变换，观察 AUC 与判定"),
        ("lab", "你来扫描阈值，积累全部坐标", "逐行判定改变 → 矩阵计数改变 → 新增坐标", "动态坐标实验", "播放或逐步扫描，展开全部坐标复核；非训练过程"),
        ("compare", "用同一批真值，比较三种分数排序", "原课程分数 / 构造完美排序 / 构造反向排序 → AUC", "交互对照 + 排序证据", "切换分数并核对面积与正负配对结果"),
        ("workshop", "亲手计算，交付你的 ROC 证据卡", "原数据 → 三个学生答案 → 检查 → 完整证据", "填写练习 + 可下载 JSON", "填写 TPR、FPR、AUC；通过后下载自己的记录"),
        ("code", "把八行数据交给标准函数，核对每个返回值", "明确输入 → roc_curve / roc_auc_score → 全部阈值表", "Python 执行示意 + DOM 输出", "逐行查看代码；数据可下载，浏览器不执行 Python"),
        ("report", "带走有来源、有坐标、有边界的报告", "数据、正类定义、阈值政策与 AUC → 后续评估证据", "完整报告 + 精确公式", "下载参考报告，对照课堂自己完成的证据卡"),
    ],
    "M85": [
        ("overview", "从分子结构到初筛名单，每一步都留下证据", "公开结构 → 描述符 → 违反数 → 保留名单与比例", "RDKit + DOM 数据表", "选择任一分子，核查结构、数值和判断"),
        ("meaning", "通过初筛，不等于安全、有效或一定能口服", "经验性质筛选与尚未检验的效力、安全、吸收证据相区别", "RDKit 结构 + 证据边界比较", "切换分子和策略，理解结论限定"),
        ("rules", "四道门槛：边界达标，超出才算违反", "四个描述符与明确上限一一比较，求和得到违反数", "KaTeX + RDKit + 精确门槛卡", "切换严格全过 / 允许一条，观察同一分子的结论"),
        ("descriptors", "结构、算法和数值，必须能对得上", "同一 SMILES 用统一 RDKit 字段计算四个值", "RDKit 结构证据 + DOM", "查看 SMILES 和来源；咖啡因 HBA 重算为 6"),
        ("library", "把同一套门槛应用到整库，而不是挑一个分子", "十行规则判断 → 四条单独计数和联合计数", "数据矩阵 + 比例条 + 公式", "比较策略、点击样本核查，不把库比例当单分子概率"),
        ("sets", "允许一条违反，不等于四条必须全过", "四张各违反一条的构造卡 → 交集与允许一条集合比较", "确定性集合反例 + KaTeX", "切换策略，观察 0% / 100% 与各单条 75%"),
        ("sweep", "只收紧 MW：单条与联合通过率会怎样？", "500 → 450 Da 控制变量，其他三条与样本固定", "可暂停参数扫描 + 读数记录", "播放 / 滑块 / 单步；记录并下载各阈值下计数"),
        ("workshop", "你来填写筛选计数，生成自己的证据卡", "完整描述符输入 → 独立计数 → 校验 → 下载", "学生填写练习", "填写单条与两套联合计数，只有正确才能下载"),
        ("protocol", "让计算机逐行检查，并把过程显示出来", "当前样本四次判断 → 违反数 → 保留标志 → 累加", "可暂停离散流程 + 表格", "逐行播放 / 单步 / 重置；未检查行不显示判定"),
        ("limits", "写得出的结论，必须有对应证据", "数值初筛结论与安全、效力、吸收结论分开", "证据对照 + 失败样本明细", "检查未通过行仍保留来源和违反原因"),
        ("report", "交付第一层筛选报告，进入后续候选排序", "原库、规则、名单、比例、限制 → 多层筛选 / 排序", "可核查报告 + JSON 产物", "下载参考报告，沿用到 M86 / M87 的后续任务"),
    ],
}
NARRATIONS = {
"M78": [
"整节课沿用原动画和游戏中的八条教学样本。每条有一个真值和一个预测分数，四条真值为一，四条为零。从一个阈值开始，先判断零或一，再数混淆矩阵，算出误报率和召回率。扫过所有不同分数，得到九个坐标点与 AUC 零点七五。它不是新训练模型的真实成绩。",
"拖动阈值，只改变判定标准，样本真值不变。本页统一约定分数大于或等于阈值判为一。阈值从零点九降低到零点六三时，新增进入的样本里既有真值一，也有真值零。观察谁被正确找回，谁被误报。不能把分数直接解释成已校准的毒性概率。",
"ROC 横轴是误报率 FPR，纵轴是召回率 TPR。TPR 的分母是真值为一的全部四个样本，FPR 的分母是真值为零的全部四个样本。当阈值为零点六三时，TP 为三，FP 为一，因此 TPR 是零点七五，FPR 是零点二五。不要用预测为一的数量去除。",
"点击播放，从正无穷阈值开始，此时全部判为零，点在原点。每经过一个分数就增加一次判断。新进入真值一的样本时向上移动，新进入真值零的样本时向右移动。两种比率都不减，但不会每一步都同时上升。最终全部判为一，到达一和一。",
"AUC 是整条 ROC 下方的面积。选择每一段，用横向宽度乘两端高度的平均，逐段相加。竖直段没有宽度，贡献为零。本样例总和零点七五。存在同分样本时，必须一组一起进入，不能先排正样本再排负样本来人为抬高面积。",
"把所有分数平方，数值改变了，但在零到一这个区间内，大小顺序不变，所以 AUC 仍然是零点七五。同一个零点五阈值的判断却会改变。再把所有分数设为相同，只有全不选和全选两个端点，同分对各计半分，AUC 是零点五。这说明 AUC 评价排序，而不是概率是否校准。",
"现在亲手扫描所有阈值。可以单步、播放、暂停或重置。每一步都看当前阈值、谁被纳入、矩阵四个计数和新坐标。展开坐标表逐条核对。这里是在计算固定教学数据的评价指标，不是在重新训练模型。",
"使用同一批真值，比较原课程分数、专门构造的完美排序和反向排序。三种 AUC 都从显示的分数重新计算，不是预先贴上的标签。完美排序达到一，原样例是零点七五，反向是零点二五。比较成立的前提是同一批样本和同一个正类定义。",
"阈值固定在零点六三，请自己算 TPR 和 FPR，再填写完整 ROC 的 AUC。答案用零到一的比率。全部核对正确后，可下载包含数据、阈值、坐标、你的答案和结论边界的证据卡。需要帮助时再展开混淆矩阵提示。",
"标准函数接收真值和连续分数。roc_curve 返回误报率、召回率与阈值；roc_auc_score 返回总面积。为了逐点教学，关闭删除共线中间点的选项。浏览器只做逐行执行示意，不运行 Python。可把同样输入带到 Python 环境复算，得到零点七五。",
"最终参考报告保留八条输入、正类定义、阈值政策、九个坐标和 AUC。排序核查是十六个正负样本对中，有十二对正样本分数更高。AUC 不会自动选出代价合适的阈值，也不证明安全性。后续继续检查分类成绩单和连续预测误差，两类任务不要混用指标。",
],
"M85": [
"本节仍使用原课程的十个化合物，但从 PubChem 的公开结构重新计算描述符，不沿用来源不清的旧数值。依次经过结构、四个数值、违反条数，得到保留名单和全库通过率。你可以点选任何一行回查结构，最后交付完整的筛选证据卡。",
"Lipinski 是和吸收、渗透风险相关的经验规则，是早期候选筛选的一种参考，不是能不能给人服用的决定。通过只代表满足当前门槛与策略；效力、安全性、实际吸收都需要别的证据。没有通过，也不能直接推出分子一定不能成为药物。",
"本课程检查四个上限：平均分子质量五百道尔顿，计算 LogP 五，氢键供体五，氢键受体十。等于上限仍达标，只有超过才增加一条违反。先数出总违反数，再按本课程允许最多一条违反的策略决定保留。也可以切换四条必须全部达标，比较差别。",
"同一个结构必须用明确算法得到数值。本页统一用 RDKit 的平均分子质量、Crippen 计算 LogP、NumHBD 和 NumHBA。咖啡因从公开结构重算的 HBA 是六，不是旧表中的三。氢键受体也不是简单数所有氮氧原子。二维结构由 RDKit 专业排布，表格保留数值和来源。",
"把完全相同的规则应用到十个结构的每一行。单条通过率分别统计该列达标的数量；联合通过率先逐行数违反，再数保留行。分母都是同一库的十个分子。通过率描述整批样本，不是一个分子的成药概率，也不是实际实验成功率。",
"这里专门构造四张数值卡，每张只违反不同的一条门槛。每条单规则都保留四张里的三张，百分之七十五。四条必须全过时一张也没有；允许违反一条时四张全部保留，百分之百。因此允许一条的联合通过率不一定低于每条单规则，必须先写清策略，再比较结果。",
"固定十个结构和其余三条规则，只把 MW 上限从五百收紧到四百五十。观察阈值线、超标行、单条计数与联合计数同时变化。点击记录保存读数。收紧门槛使保留数不增加，但可能保持不变，因为联合策略还容许一条违反。记录是模型计算，不是吸收实验。",
"现在隐藏判定结果，请从十行数值自己数出 MW 五百的单条通过数、默认联合通过数，以及 MW 四百五十后的联合通过数。其余门槛不变，允许一条违反。核对通过后可下载自己的筛选证据卡，包含来源、数值、规则、逐行原因、保留名单和答案。",
"点击播放，让同一套规则逐行运行。未检查的行暂不显示违反数；经过一行，四个比较结果和保留标志一起出现，累计已保留数增加或保持不变。只有全部十行检查完毕，才能报告全库最终通过率。你可以随时暂停、单步或重置。",
"正确结论应明确这批结构、计算方法、上限和允许违反数。不要把数值初筛改写成安全有效的保证。未通过的行仍保留在报告里，记录究竟哪条违反；后续需要活性、安全性、可合成性或结构多样性等独立证据。页面不提供用药判断。",
"今天的产出是第一层筛选报告，而不是一句通过。它有十个输入结构、四个描述符、明确规则、逐行违反数、保留名单、计数和边界。前序描述符计算在这里汇合，下一步把名单交给 M86 多层筛选和 M87 候选排序。分子猎人整个项目的视觉替换仍在继续。",
]}

def main():
    sources = {"M78": "M78-w0-roc", "M85": "M85-w0-lipinski"}
    descriptor_data = json.loads((HERE / "M85-descriptors-v1.json").read_text())
    data = json.loads((COURSE / "knodes/M78-w0-roc/sections.json").read_text())
    html = data["rendered_sections"]["anim_1782392591084_wqzj"]["html"]
    block = re.search(r"var MOLS\s*=\s*\[([\s\S]*?)\];", html)[1]
    roc_rows = [{"id": id_, "label": int(label), "score": float(score)} for id_, label, score in re.findall(r'\{id:"([^"]+)",\s*tox:([01]),\s*p:([\d.]+)\}', block)]
    assert len(roc_rows) == 8 and len(descriptor_data["rows"]) == 10
    for module, directory in sources.items():
        node = COURSE / "knodes" / directory
        backup = HERE / f"{module}-before-evidence-v2"
        backup.mkdir(exist_ok=True)
        hashes = {}
        for filename in ("slides.json", "lesson.md", "assignment.md", "theories.json", "sections.json", "audio_scripts.json"):
            raw = (node / filename).read_bytes()
            hashes[filename] = hashlib.sha256(raw).hexdigest()
            target = backup / filename
            if not target.exists(): target.write_bytes(raw)
            assert target.read_bytes() == raw, f"Source changed after snapshot: {target}"
        original = json.loads((backup / "slides.json").read_text())
        assert len(original["slides"]) == len(BRIEFS[module]) == len(NARRATIONS[module]) == 11
        source_note = "原 M78 动画 / 游戏的 8 条教学样本；未给出测量来源，不是实际模型测试数据。" if module == "M78" else "原课程 10 个化合物；PubChem SMILES + 本地 RDKit 2025.03.4 重算。数值为计算描述符，不是实验测量。"
        result = {"version": "evidence-v2-local", "project": "molecule-monster-hunter", "node": directory, "slides": []}
        registry = {"project": "molecule-monster-hunter", "node": directory, "status": "implemented-awaiting-browser-QA", "source_sha256": hashes, "source_note": source_note, "slides": []}
        for i, (old, brief, narration) in enumerate(zip(original["slides"], BRIEFS[module], NARRATIONS[module])):
            scene, title, relation, method, behavior = brief
            visual = {"renderer": "roc-evidence" if module == "M78" else "lipinski-evidence", "scene": scene, "rows": roc_rows if module == "M78" else descriptor_data["rows"], "source_note": source_note, "aria_label": title}
            result["slides"].append({"slide_id": old["slide_id"], "kind": old["kind"], "title": title, "audio_script": narration, "audio_path": None, "body_markdown": "", "payload": {"technical_visual": visual}})
            registry["slides"].append({"slide_id": old["slide_id"], "page": i + 1, "old_title": old["title"], "teaching_claim": title, "entities": "原课样本标签、分数、阈值、混淆计数、坐标" if module == "M78" else "原课十个化合物、结构、四个描述符、四个阈值与通过集合", "relationship": relation, "method": method, "scene": scene, "behavior": behavior, "fallback": "DOM 输入、数值表和公式继续可用；结构 / 坐标库失败时明确提示，不显示伪造图。", "nearest_alternative_rejected": "位图无法呈现精确数值与可改变的政策；3D 不增加排序或门槛集合的空间知识。", "audio": "new-script-no-audio"})
        (HERE / f"{module}-evidence-v2.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
        (HERE / f"{module}-evidence-v2.registry.json").write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n")
        print(f"{module}: 11 versioned slides; original mapping unchanged")

if __name__ == "__main__": main()
