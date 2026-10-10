"""Version M02/M03 read-only lecture candidates; never deploy or modify assignments."""
import copy
import hashlib
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
COURSE = ROOT.parent / 'systemeduidea/projects_data/molecule-monster-hunter'
OUT = ROOT / 'artifacts/readonly-m02-m03-20260914'
FIXTURES = ROOT / 'course_factory/fixtures/molecule-monster-hunter'
NARRATIONS = {
    'M02': [
        'M01 的立项卡定义研究目标，M02 为它准备工具环境，M03 再用工具读取结构。运行证据需要包含实际 Python 版本、解释器位置和 RDKit 版本。网页能展示浏览器版 RDKit，却不能代替本机环境检查。本页只解释任务衔接，不读取个人完成状态。安装软件请家长协助，基础导入成功不代表后续算法都已经验证。',
        '左右并列展示两种运行位置。Jupyter 的百分号 pip 指令使用当前 kernel 的环境；普通终端用选定 Python 的减号 m pip 安装。导入和打印则是 Python 代码。安装后如有提示就重启 kernel，再导入。不要把终端安装指令粘到 Python 的三个大于号后。本页没有执行安装。',
        '并排观察乙醇、水和未闭合环标记三个固定输入。网页实际调用 RDKit.js：有效结构得到精确结构图和平均摩尔质量，无效写法不进入质量计算。下方 Python 模板先导入 Chem 和 Descriptors，再检查解析结果。库提供可复用功能，不自动完成药效预测；浏览器版本也不是本机 Python 的版本证据。',
        '三张状态快照依次是安装到环境 A、在当前会话导入，以及重启会话。包仍保留在环境里，重启只清空当前名字。在同一个会话里，后续单元格可以继续使用已导入名字。换环境可能找不到包，重启解释器则需要恢复导入。本页是有限状态教学对照，不是在运行 Python。',
        '自动高亮按顺序对照安装、导入、读取版本和重启。下方七行完整轨迹始终可读，不必等到演示结束。导入成功通常没有输出，打印版本才有输出。重启之后包仍保留，重新导入后又能读取版本。版本字符串是固定教学值，不能冒充实际环境；暂停和重播属于外层播放控制。',
        '三种错误放在同一张对照表里。有包但未导入、导入后又重启，读取版本都会遇到名字未定义；只装在 B 却在 A 导入，则是当前环境找不到包。先根据错误核对会话和环境，再决定导入或安装，不要见到红字就反复重装。这些是有限模型的预期结果，不是学生执行日志。',
        '左侧完整检查脚本会读出三个字段：Python 版本、解释器路径和 RDKit 版本。右侧说明每个字段能证明什么。本页只讲解模板，不执行、填写或提交。课后任务在本人环境运行后保留实际输出，不把教学版本或网页版本冒充自己的证据。路径中的用户名可以遮去，不需要提交密码或完整终端历史。',
        '任务链从 M02 的实际运行记录，经过同一环境和导入检查，进入 M03 的结构与计数报告。本页解释前后产物怎样衔接，不读取个人完成状态。换设备、换环境或重启会话后要重新核对环境与导入。版本一致和格式完整也不能证明每个算法或模型已经正确。',
    ],
    'M03': [
        'M02 准备工具环境，M03 用结构与计数形成骨架报告。同一个甲烷，二维图方便读连接，三维计算构象方便看四面体方向。预设视角自动变化，坐标、原子数和内部夹角保持不变。四个氢不是平面十字。公开计算坐标不是实验照片或唯一构象，本页也不读取个人环境记录。',
        '乙醇的三维模型按固定顺序高亮两个碳和一个氧，完整连接表始终显示。碳、氧、氢是不同元素，连杆表示原子间连接。三个重原子加六个氢，共九个原子、八条连接。二维图省略氢只是表示简化，不会改变分子质量。重原子和全部原子必须分别说明口径。',
        '并列比较水和乙醇的质量计算。各元素原子个数乘以平均原子质量，再把贡献相加。水是两个氢和一个氧，乙醇是两个碳、六个氢和一个氧；结构图省略的氢也不能漏算。这里用 Da 表示平均分子质量；相对分子质量本身是无单位比值。平均原子质量考虑常用同位素组成。',
        '乙烷、乙烯和乙炔都有两个相连的碳，但碳碳键级分别是一、二、三。对这些常见中性闭壳层分子，一个碳的键级总和是四。碳碳键级增加时，它还能连接的氢就减少。两条线表示一个双键，不是两条独立连接。不要把碳四价说成适用于所有离子和自由基的绝对规律。',
        '正丁烷和异丁烷的分子式都是 C4H10，但一个不分叉，一个有分支。分子式不能唯一确定骨架。环己烷有六个碳闭合成环，但不是芳香环。二维图画成六边形，也不意味着空间构象必须是平面。',
        '苯模型自动从空间视角转到正面和侧面。正面看闭合环，侧面看共面，同时核对坐标到参考平面的距离和碳碳连接长度。RDKit 识别出一个芳香环。Kekulé 画法的单双线不表示真实长短键交替；离域不是电子小球绕圈运动。几何共面也不是芳香性的全部判据。',
        '自动演示按文件顺序读取乙醇原子记录，当前原子高亮，已读计数同步增加。完整邻接表从开始就全部可读，当前行只表示讲解位置。九个原子包括三个重原子和六个氢。这是读取已有结构文件，不是在制造分子，也不是化学反应。',
        '四份参考观察并排说明水、甲烷、乙醇和苯的计数与结构特点。全部原子和连接都包含氢，重原子另列；双键仍是两个原子间的一条连接。参考卡不是个人提交，也不表示已经运行过 Python。课后任务再整理本人观察和实际运行证据。',
        '左侧完整 Python 示例依次读取四种 SMILES。MolFromSmiles 后统计重原子，AddHs 后再统计全部原子和连接，同时记录环、芳香环和平均分子质量。下方给出独立核验的参考结果。乙醇从三个重原子变为九个显式原子，是计数表示变了，不是生成另一种分子。这份表不是你的运行记录。',
        '结构报告要交代输入写法、计数口径和证据来源，下一节再比较官能团。乙烷与乙醇具有两碳骨架，后者多一个含氧官能团，连接差异可能影响相互作用。这里是结构比较，不是反应，也不能直接得出药效结论。本页只说明成果如何衔接，不读取或保存个人作业。',
    ],
}
TITLES = {
    'M02': {'s6': '三种报错：按环境与会话找到修复依据', 's7': '读懂检查脚本：版本、解释器与来源', 's8': '从工具记录，接到 M03 的结构报告'},
    'M03': {'s8': '四份参考观察：统一原子、连接与环的口径', 's9': '完整代码与参考结果：先定口径，再核对数值', 's10': '从骨架报告，接到官能团比较'},
}

def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

def main():
    assert not OUT.exists(), 'One-shot candidate preparation: preserve original snapshot'
    OUT.mkdir()
    shutil.copy2(COURSE / 'manifest.json', OUT / 'manifest-before.json')
    before_hashes = {str(p.relative_to(COURSE)): hashlib.sha256(p.read_bytes()).hexdigest() for p in COURSE.rglob('*') if p.is_file()}
    registry = {'status': 'local-candidate', 'production_deployed': False, 'numbering_version': 'consecutive-v2', 'modules': {}}
    for module, scripts in NARRATIONS.items():
        node, = (COURSE / 'knodes').glob(module + '-*')
        snapshot = OUT / module
        snapshot.mkdir()
        for name in ['slides.json', 'audio_scripts.json']:
            shutil.copy2(node / name, snapshot / name)
        old = json.loads((node / 'slides.json').read_text())
        new = copy.deepcopy(old)
        assert len(new['slides']) == len(scripts)
        for slide, narration in zip(new['slides'], scripts, strict=True):
            slide['title'] = TITLES[module].get(slide['slide_id'], slide['title'])
            slide['audio_script'] = narration
            slide['audio_path'] = None
            slide['payload']['technical_visual']['aria_label'] = slide['title']
        assert [(s['slide_id'], s['kind'], s.get('lesson_anchor')) for s in old['slides']] == [(s['slide_id'], s['kind'], s.get('lesson_anchor')) for s in new['slides']]
        write(node / 'slides.json', new)
        write(node / 'audio_scripts.json', [{'section_title': s['title'], 'audio_script': s['audio_script']} for s in new['slides']])
        write(FIXTURES / f'{module}-readonly-v1.json', new)
        registry['modules'][module] = {'node': node.name, 'slides': len(new['slides']), 'source_sha256': {name: hashlib.sha256((node / name).read_bytes()).hexdigest() for name in ['slides.json', 'audio_scripts.json']}}
    sys.path.insert(0, str(ROOT / 'tools/content-pipeline/src'))
    from content_pipeline.manifest import regenerate_manifest
    from library.manifest import load_manifest, verify_files
    regenerate_manifest(COURSE)
    assert not verify_files(load_manifest(COURSE / 'manifest.json'), COURSE)
    changed = sorted(p for p, digest in before_hashes.items() if hashlib.sha256((COURSE / p).read_bytes()).hexdigest() != digest)
    expected = sorted(['manifest.json'] + [f"knodes/{r['node']}/{name}" for r in registry['modules'].values() for name in ['slides.json', 'audio_scripts.json']])
    assert changed == expected, changed
    registry['changed_course_files'] = changed
    write(OUT / 'candidate.json', registry)
    print(json.dumps(registry, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
