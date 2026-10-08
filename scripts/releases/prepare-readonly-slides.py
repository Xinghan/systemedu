"""Create a versioned local read-only candidate; never deploy or change learner work."""
import copy
import hashlib
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
COURSE = ROOT.parent / 'systemeduidea/projects_data/molecule-monster-hunter'
OUT = ROOT / 'artifacts/readonly-slides-20260914'
FIXTURES = ROOT / 'course_factory/fixtures/molecule-monster-hunter'
NARRATIONS = {
    's2': '研究问题、候选和模型有不同职责。左侧依次列出它们定义什么、交出什么，右侧用乙醇展示结构记录。候选的结构不等于药效结论；模型只在指定数据和任务上给出预测，仍需评估与验证。本页没有调用训练模型。',
    's3': '从立项卡出发，五件成果依次是干净分子库、特征表、带评估记录的模型、诚实的候选报告和可运行工作台。表格同时列出每一步接收什么、交出什么。后一步必须拿得到前一步的证据。Top10 是最多十个，候选不足时保留实际数量，不为了凑数加入不合格项。',
    's5': '观察十二条构造教学记录的预设筛选过程。先按溶解字段保留八条，再按风险字段保留五条，按分数取前三条，最后揭晓三条构造结果。完整轨迹列在下方，灰色记录仍能追查。最后两条通过、一条失败，只是本例测试，不是找到两颗药。',
    's6': '这份示例账本预先规定依次测试 A、B、C、D、E。每获得一条新记录，五次预算就减少一次；完整账本同时列出排序分、构造结果和剩余预算。F 到 L 共七条没有测试，仍是未知。重复查看旧记录不会带来新证据。这里没有开展真实实验。',
    's7': '左边是一张已经填写的示例立项卡，不是你的提交。四个字段分别说明研究问题、最终交付物、预测或检查任务，以及诚实边界。右边解释每个字段为什么必要。幻灯片只讲解写法；完成课后任务时，再按自己的项目目标填写。这里不保存、不提交，也不读取个人草稿。',
    's8': 'M01 的立项卡定义目标，M02 验证工具能否使用，再留下本人实际运行的版本号和日志。这一页展示任务如何衔接，不读取个人完成状态，不把示例当作你的成果，也不会替你执行安装。以后每次画结构、算特征、训练模型，都要核对是否仍在回答同一个研究问题。',
}

def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

def main():
    assert not OUT.exists(), 'Candidate already prepared; do not overwrite before snapshot'
    OUT.mkdir()
    shutil.copy2(COURSE / 'manifest.json', OUT / 'manifest-before.json')
    registry = {'status': 'local-candidate', 'production_deployed': False, 'numbering_version': 'consecutive-v2', 'modules': {}}
    for module in ['M01', 'M08']:
        node, = (COURSE / 'knodes').glob(module + '-*')
        before = OUT / module
        before.mkdir()
        for name in ['slides.json', 'audio_scripts.json']:
            shutil.copy2(node / name, before / name)
        old = json.loads((node / 'slides.json').read_text())
        new = copy.deepcopy(old)
        for slide in new['slides']:
            if module == 'M01':
                slide['audio_script'] = NARRATIONS.get(slide['slide_id'], slide['audio_script'])
                if slide['slide_id'] == 's7': slide['title'] = '看懂示例立项卡：四项信息，各有职责'
                if slide['slide_id'] == 's8': slide['title'] = '从 M01 的目标，接到 M02 的工具证据'
                slide['payload']['technical_visual']['aria_label'] = slide['title']
            else:
                for step in slide['payload']['technical_visual']['steps']:
                    step['detail'] = step['detail'].replace('点击播放，跟踪', '观察预设执行轨迹，区分')
                    step['title'] = step['title'].replace('下载或抄写两行脚本', '示例输入：两行 Python 脚本')
                slide['audio_script'] = slide['audio_script'].replace('下载本页代码并在自己的 Python 环境运行', '课后任务需要在自己的 Python 环境运行示例代码')
                slide['payload']['bullets'] = [slide['audio_script']]
            slide['audio_path'] = None
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
    write(OUT / 'candidate.json', registry)
    print(json.dumps(registry, ensure_ascii=False, indent=2))

if __name__ == '__main__': main()
