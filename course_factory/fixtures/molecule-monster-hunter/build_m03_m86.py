"""Local review drafts only: preserves lesson source, stable slide mapping and evidence."""
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
COURSE = ROOT.parent / "systemeduidea/projects_data/molecule-monster-hunter"
BRIEFS = {
    "M03": [
        ("overview", "同一个分子：二维读连接，三维看空间", "PubChem 计算坐标 + RDKit 二维 + KaTeX", "旋转甲烷；四面体方向解释平面十字画法的局限", "今天要分清两种图回答的问题。二维结构式告诉我们谁和谁相连，三维坐标模型让我们观察一个构象里的空间位置。先拖动甲烷，看看四个氢并不都在一张平面上。切换水、乙醇和苯，再观察各自的结构特点。模型来自公开计算坐标，不是分子的照片。"),
        ("vocabulary", "原子、键与骨架：在同一个模型上逐项定位", "Three.js 点选 + RDKit + DOM 计数", "点选原子查看相邻原子；隐藏氢后区分显示数量与总数", "以乙醇为例，碳、氧、氢是不同元素，连杆表示原子间的连接。点选一个原子，可以看到它与谁相连及坐标。隐藏氢只是简化画面，乙醇仍然有九个原子，平均分子质量也没有改变。重原子数和全部原子数必须标明口径。"),
        ("mass", "分子质量：把结构里的每个原子都算进去", "RDKit + 元素贡献表 + KaTeX", "切换四个分子；原子个数、质量贡献和总和同步重算", "分子质量可以按各元素的原子个数，乘以平均原子质量，再加起来。水是两个氢加一个氧。即使结构图省略了氢，计算也不能漏掉它。这里用 Da 表示平均分子质量；相对分子质量本身是无单位的比值。平均原子质量考虑常用同位素组成，并不是每种元素的所有原子都一样重。"),
        ("bonds", "同样两个碳：单键、双键、三键怎样改变结构", "RDKit 三结构对照 + mhchem + 键级算式", "对照乙烷、乙烯、乙炔；检验每个碳的氢数与键级和", "乙烷、乙烯和乙炔都有两个相连的碳，但碳碳键级分别是一、二、三。对这些常见中性闭壳层分子，一个碳的键级总和是四。碳碳键级增加时，它还能连接的氢就减少。两条线表示一个双键，不是两条独立连接。不要把碳四价说成适用于所有离子和自由基的绝对规律。"),
        ("skeleton", "同分子式也能有不同连接：链、支链与环", "RDKit 结构比较 + 精确分子式", "比较正丁烷和异丁烷同式不同连接，再识别环己烷闭环", "正丁烷和异丁烷的分子式都是 C4H10，但一个不分叉，一个有分支。可见分子式不能唯一确定骨架。环己烷有六个碳闭合成环，但它不是芳香环。二维图画成六边形，也不意味着这个分子在空间里必须是平面的。"),
        ("aromatic", "苯：检查共面关系，再读懂芳香性的标记", "坐标平面测量 + Three.js + RDKit 芳香结构", "正面与侧面切换；读取偏离平面距离和六条 C–C 键长范围", "苯的六个碳构成平面环。先正面观察，再沿侧面观察，核对坐标到平面的距离。RDKit 给这个结构识别出一个芳香环。二维 Kekulé 画法里的单双线不是三根长键和三根短键交替存在的意思。离域描述跨越环的电子分布，不是电子小球沿着圆圈跑。几何共面也不是芳香性的全部判据。"),
        ("scan", "跟着结构文件逐个读取：模型高亮与计数同步", "可暂停逐原子读取 + 三维定位 + 累计表格", "播放/暂停/单步；当前原子、已读重原子与氢计数同时变化", "播放时，我们逐个读取已经存在的结构记录。当前原子在三维模型中高亮，同时累计表增加一行。你可以暂停核对它连接了谁，再继续。这个过程是文件读取和计数，不是在制造分子，也不是把甲烷变成苯的化学反应。"),
        ("lab", "亲手检查一个分子，完成你的骨架小报告", "可交互三维 + RDKit + 校验练习 + JSON 产物", "选择分子、填写重原子/全部原子/全部连接/环数；正确后下载", "选择一个分子，利用二维结构和三维模型，填写重原子数、包含氢的全部原子数、全部连接数和环数。每对相连的原子算一条连接，不把双键算成两条连接。检查通过后，可以下载你自己的报告。切换分子时需要重新完成观察和填写。"),
        ("report", "四份结构证据：统一口径，结果才能比较", "完整比较表 + RDKit 代码说明 + 可下载报告", "核查四分子含氢计数与质量；下载带来源参考表", "把四个分子的报告放在同一张表里，先统一计数口径。RDKit 默认的乙醇分子图通常只有三个重原子；显式加入氢后是九个原子、八条连接。我们同时记录环数、芳香环数和平均质量，附上结构来源。参考表帮助核对，不代替你上一页独立完成的报告。"),
        ("handoff", "从读懂骨架，到 M04 比较官能团", "RDKit 乙烷/乙醇结构对照 + mhchem + 阶段产物", "定位乙醇中高亮的氧；从结构报告递进到官能团性质比较", "现在你已经能找到原子、连接和骨架。下一节比较官能团时，就能准确说出结构改了哪里。这里把乙烷与乙醇并列，寻找氧和 O–H 的位置。这是两个分子的结构比较，不是在展示一个没有试剂和条件的转化反应。带上骨架报告，继续研究结构和性质的关系。"),
    ],
    "M86": [
        ("overview", "把 5000 行候选串进漏斗，留下每一层的证据", "实际逐行筛选 + 剩余数量图 + 计数表", "核对输入 → 四层幸存 → M87 排序的不同职责", "多层漏斗把上一层的幸存者交给下一层。这一节用固定的五千行合成教学数据，真正逐行应用四个规则，并保留每层数量和名单。它检验的是程序和集合逻辑，不是药物发现结果。最后的幸存者还没有排名，要留到下一节比较。"),
        ("rules", "“每一层都通过”是 AND，不是任意一关点头", "KaTeX 布尔公式 + 构造真值表 + 具体规则", "四行反例同时比较 AND 与 OR；识别必要条件", "候选要活到末尾，必须每一条规则都通过。看构造的真值表：某一行只有一个条件失败，AND 仍然拒绝，而 OR 可能保留。四道关卡都有具体字段和阈值，但满足它们不等于安全或有效。这里的风险分数、相似度和其他字段都是为程序教学构造的。"),
        ("pipeline", "上一层输出，就是下一层输入", "可暂停状态流程 + 代码执行说明 + 行级调用轨迹", "逐层运行；失败行后续显示未调用，累计成本更新", "让我们逐层执行漏斗。每一步记录输入多少，拒绝多少，剩余多少。被拒绝的行已经退出，后面的规则不再调用它。页面右侧用前十二行展示这个轨迹，但计数来自全部五千行。暂停后，代码对应阶段、数量和轨迹都停在同一步。"),
        ("order", "换顺序：同一组硬规则，为什么成本不同", "24 种排列实际重算 + 成本公式 + 可重排关卡", "对照正序/倒序；上移下移关卡，比较中间计数和最终 ID", "在固定、独立、无副作用的逐行规则下，重排顺序不改变最终幸存集合，却会改变后续每层要处理多少行。总成本是各层输入行数乘以该层每行成本再求和。便宜先做通常值得考虑，但不保证最优，还要看筛除能力与依赖。页面把全部二十四种排列重算给你核对。"),
        ("run", "看得见的执行过程：谁退出，谁继续", "逐层动态计数图 + 可暂停行级证据", "播放/暂停/单步；图、关卡状态和前 12 行判定同步", "播放完整筛选过程。每一层结束后，数量图新增一个结果，记录表也更新。失败行不再进入后续计算。这里不是把旧动画的几个数字抄成柱子，而是按固定数据和当前规则重算。调整门槛的实验会放在后面的操作页。"),
        ("counts", "三个数量与两个分母：别把保留率算混", "KaTeX 数量守恒 + 单层/累计比例 + ID 证据", "选择任一关；读取输入、拒绝、幸存 ID 与两种比率", "每一层必须满足输入减去拒绝等于剩余。单层保留率的分母是这一层的输入，累计保留率的分母是最开始的五千行。它们回答不同问题。点选关卡，除了看数字，也检查具体拒绝和幸存的 ID，确保统计有记录可追溯。"),
        ("waterfall", "剩余柱状图与减量瀑布图：同一数据，不同读法", "可切换零基线柱状图 / 浮动减量瀑布图", "切换两种图，检查每层剩余与拒绝数的区别", "从零开始的柱子表示每层剩余数量，浮动的橙色柱子则表示这一层从输入中减去的数量。两张图使用同一组计数，但读法不同。下降最多只能说明这一步拒绝人数多，不能证明阈值正确；下降很少也不能证明一个安全相关规则没有用。"),
        ("lab", "你来换顺序、收紧门槛，并导出执行记录", "控制变量交互 + 完整数据重算 + 可下载审计", "改变风险分数阈值或层序；重新播放到末尾后下载", "保持五千行数据不变，先试着只交换关卡顺序，再试着只改变风险分数上限。每次变更会重新开始播放，跑完后才能导出这次记录。降低分数上限是收紧条件，幸存集合不应该增加。我们观察的是构造分数的筛选逻辑，不是真实毒性变化。"),
        ("report", "完成计数练习，交付可核查的漏斗成果包", "原作业独立数例 + 输入校验 + JSON 证据输出", "填写 5000→1800→600→550 的三段拒绝数，正确后下载", "先独立完成原作业的数例：五千到一千八，再到六百，再到五百五十。每层拒绝数就是相邻两项的差。注意，这个作业数例不是右侧合成数据的运行结果。完成后，成果包要包含数据身份、阈值、顺序、各层名单、计数、成本假设和适用范围。"),
        ("handoff", "把候选与筛选来路交给 M87，而不是提前宣布 Top10", "幸存记录表 + 跨节点产物流 + JSON 导出", "检查前 8 个幸存记录；导出完整名单与拒绝原因", "漏斗回答谁满足必要的硬规则。下一节排序才比较幸存者的多个指标和权重。这里的名单仍按 ID 展示，没有计算 Top10，更不能把通过规则当成药物有效的证明。把候选记录与完整筛选来路一起交给下一阶段，结果才可以复查。"),
    ],
}

def main():
    for module, briefs in BRIEFS.items():
        node = f"{module}-w0-module"
        src = COURSE / "knodes" / node
        original = json.loads((src / "slides.json").read_text())
        assert len(original["slides"]) == len(briefs) == 10
        suffix = "spatial-v1" if module == "M03" else "funnel-v1"
        snapshot = HERE / f"{module}-before-{suffix}"
        snapshot.mkdir(exist_ok=True)
        hashes = {}
        for name in ("slides.json", "lesson.md", "assignment.md", "theories.json", "sections.json", "audio_scripts.json"):
            if not (src / name).exists(): continue
            data = (src / name).read_bytes()
            target = snapshot / name
            if target.exists() and target.read_bytes() != data:
                raise RuntimeError(f"Existing snapshot differs: {target}")
            target.write_bytes(data)
            hashes[name] = hashlib.sha256(data).hexdigest()
        result = {"project": "molecule-monster-hunter", "node": node, "version": suffix, "slides": []}
        registry = {"project": "molecule-monster-hunter", "node": node, "version": suffix, "status": "implemented-awaiting-browser-QA", "source_sha256": hashes, "source_snapshot": str(snapshot.relative_to(ROOT)), "source_links": ["https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest", "https://www.rdkit.org/docs/RDKit_Book.html", "https://www.rdkit.org/docs/GettingStartedInPython.html"], "slides": []}
        for i, (old, brief) in enumerate(zip(original["slides"], briefs)):
            scene, title, method, behavior, narration = brief
            sid = old.get("slide_id") or f"{module}-slide-{i+1}"
            visual = {"renderer": "molecule-skeleton" if module == "M03" else "funnel-evidence", "scene": scene, "aria_label": title}
            source_payload = old.get("payload", {})
            anchor = ({"kind": "theory", "id": source_payload["theory_id"]} if source_payload.get("theory_id") else
                      {"kind": "idea", "id": source_payload["idea_id"]} if source_payload.get("idea_id") else None)
            result["slides"].append({"slide_id": sid, "kind": old["kind"], "title": title, "body_markdown": "", "audio_script": narration, "audio_path": None, "payload": {"technical_visual": visual}, **({"lesson_anchor": anchor} if anchor else {})})
            registry["slides"].append({"page": i+1, "slide_id": sid, "source_slide_id": old.get("slide_id"), "source_index": i, "source_title": old["title"], "teaching_claim": title, "method": method, "entities": "源课分子/原子/键/骨架与坐标、计数" if module=="M03" else "候选行、四道关卡、集合、阈值、计数、成本、逐层名单", "relationship_and_behavior": behavior, "scene": scene, "fallback": "3D 不可用时明确显示 RDKit 二维备用图与数值；计数表和精确公式始终独立。" if module=="M03" else "静态全表与逐步按钮保留；所有状态由本地数据重算。", "nearest_alternative_rejected": "空间观察用 3D，精确符号用 RDKit/KaTeX；位图不能提供旋转或可靠计数。非空间页不强制 3D。" if module=="M03" else "规则执行与集合数量没有空间主张；图片或 3D 不如可重算的流程证据。", "epistemic_status": "公开计算构象 + 本地 RDKit 计算；不是实验结构/化学反应/分子动力学。" if module=="M03" else "固定种子的合成教学数据；非真实分子、预测或实验。", "audio": "updated-narration-no-audio", "mapping_note": "保留原 slide_id" if old.get("slide_id") else "原文无 slide_id；采用 normalizeSlides 相同的 M86-slide-N 稳定回退标识"})
        for ending, data in ((".json", result), (".registry.json", registry)):
            (HERE / f"{module}-{suffix}{ending}").write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n")
        print(module, "10 new slides; source unchanged")

if __name__ == "__main__": main()
