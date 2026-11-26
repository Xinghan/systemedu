"""Apply reviewed, additive teaching changes; preserve originals and stable IDs.

Defaults to preflight only. --apply writes the shared source repository.
Does not generate media, change assessments, or claim learner validation.
"""
from pathlib import Path
import argparse
import hashlib
import json
import re
import shutil

HERE = Path(__file__).resolve().parent
SOURCE = Path('/Users/xinghan/Dev/systemeduidea/projects_data/lightkurve-transit-detective')
REVISION = 'beginner-20261126'
AUDIT = SOURCE / 'audit' / REVISION
FILES = ['M01-M05', 'M06-M14', 'M15-M23', 'M24-M32']
DEVICE_NOTE = '**设备与完成条件：**在iPad里可以先阅读观测表、理解文件用途并写下清单草稿；本作业中的终端校验需要配套电脑环境。尚未运行的SHA256检查请明确标为“待核对”，不照抄校验值冒充执行结果。后续整理观察卡时可以带上已完成部分与待核对标记，但完整作业只有在实际执行并记录所要求的核对后才算完成。\n\n'
TREND_NOTE = '**阅读顺序说明：**下面的深入例子还预览了M17的第二次趋势估计：先用Q3得到候选周期、中心时刻和持续时间，再让这些候选事件中的点暂时不参与背景估计，但仍保留它们用于信号分析。当前M12首次调用 `local_median(lc, window_day=1.0)` 时没有提供候选参数 `ephemeris`，因此不会按事件区间排除点。请先理解窗口、中位数和支持点数；以下提到的“已识别候选事件”是后续保护版的使用条件，不表示本节已经确认了凌星的位置。\n\n'

def read(p): return json.loads(p.read_text())
def write(p, data):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def markers(text): return re.findall(r'\[\[(?:IDEA|THEORY|ANIMATION|GAME)[^\]]*\]\]', text)
def han(text): return len(re.findall(r'[\u3400-\u9fff]', text))
def insert(original, blocks, replacements=()):
    value = original
    for block in blocks:
        anchor = block['before']
        assert value.splitlines().count(anchor) == 1, anchor
        assert len(block['markdown'].strip()) > 100
        value = value.replace(anchor, block['markdown'].strip() + '\n\n' + anchor, 1)
    for change in replacements:
        assert value.count(change['old']) == 1
        value = value.replace(change['old'], change['new'], 1)
    restored = value
    for change in reversed(replacements):
        restored = restored.replace(change['new'], change['old'], 1)
    for block in reversed(blocks):
        restored = restored.replace(block['markdown'].strip() + '\n\n', '', 1)
    assert restored == original
    assert markers(value) == markers(original)
    assert value.count('```') % 2 == 0
    return value

def history(directory, version):
    record = read(directory / 'learning-record.json')
    questions = []
    for kind in ['quiz', 'exam']:
        for i, q in enumerate(record.get(kind, [])):
            questions.append({'key': f'{kind}:{q.get("id", i)}', 'question': q.get('question', ''), 'options': q.get('options', [])})
    for theory in read(directory / 'theories.json'):
        for i, q in enumerate(theory.get('exercises', [])):
            questions.append({'key': f'theory:{theory["theory_id"]}:{version}:{q.get("id", i)}', 'question': q.get('question', ''), 'options': q.get('options', [])})
    sections = read(directory / 'sections.json')
    for key, section in sections.get('rendered_sections', {}).items():
        for i, q in enumerate(section.get('exercises') or []):
            questions.append({'key': f'{key}:{q.get("id", i)}', 'question': q.get('question', ''), 'options': q.get('options', [])})
    return {'revision': version, 'title': '补充前置讲解之前的学习记录',
            'notice': '本次增加了背景、示范和理解检查。原笔记、答案和实验作品仍保留；旧版读完状态不代替对新增内容的学习。原讲课和实验仍可使用。', 'questions': questions}

def main(apply=False):
    drafts = [item for name in FILES for item in read(HERE / 'drafts' / (name + '.json'))]
    assert sorted(d['module'] for d in drafts) == [f'M{n:02}' for n in range(1, 33)]
    manifest = read(SOURCE / 'manifest.json')
    assert manifest.get('content_revision') != REVISION, 'Already applied; do not insert twice'
    prepared, coverage = [], []
    for item in drafts:
        mid = item['module']
        directory = SOURCE / f'knodes/{mid}-w0-module'
        original = (directory / 'lesson.md').read_text()
        author_path = SOURCE / f'authoring/nodes/{mid}.json'
        author = read(author_path)
        assert not (directory / 'content-history.json').exists(), 'Preexisting history requires merge'
        revised = insert(original, item['insertions'], item.get('replacements', []))
        revised_author = insert(author['plan_markdown'], item['insertions'], item.get('replacements', []))
        coverage.append({'module': mid, 'destination': f'knodes/{mid}-w0-module/lesson.md',
            'old_han': han(original), 'new_han': han(revised), 'insertions': len(item['insertions']),
            'old_sha256': sha(directory / 'lesson.md'), 'new_sha256': hashlib.sha256(revised.encode()).hexdigest(),
            'original_recoverable': True, 'media_markers_unchanged': True, 'findings_addressed': item['findings']})
        prepared.append((mid, directory, original, author_path, author, revised_author, revised))
    if apply:
        assert not AUDIT.exists(), 'Snapshot folder exists; inspect before retry'
        AUDIT.mkdir(parents=True)
        shutil.copy2(SOURCE / 'manifest.json', AUDIT / 'previous-manifest.json')
        for mid, directory, original, author_path, author, revised_author, revised in prepared:
            old = AUDIT / 'previous' / mid
            old.mkdir(parents=True)
            shutil.copy2(directory / 'lesson.md', old / 'lesson.md')
            shutil.copy2(author_path, old / 'authoring.json')
            (directory / 'lesson.md').write_text(revised)
            author['plan_markdown'] = revised_author
            if mid == 'M02':
                assignment = (directory / 'assignment.md').read_text()
                shutil.copy2(directory / 'assignment.md', old / 'assignment.md')
                title, rest = assignment.split('\n', 1)
                (directory / 'assignment.md').write_text(title + '\n\n' + DEVICE_NOTE + rest.lstrip('\n'))
                title, rest = author['assignment'].split('\n', 1)
                author['assignment'] = title + '\n\n' + DEVICE_NOTE + rest.lstrip('\n')
            if mid == 'M12':
                theories = read(directory / 'theories.json')
                shutil.copy2(directory / 'theories.json', old / 'theories.json')
                for collection in [theories, author['theories']]:
                    theory = next(t for t in collection if t['theory_id'] == 'theory_m12_1')
                    level = next(b for b in theory['level_bodies'] if b['level'] == 'K3')
                    level['body_markdown'] = TREND_NOTE + level['body_markdown']
                write(directory / 'theories.json', theories)
            write(author_path, author)
            write(directory / 'content-history.json', history(directory, str(manifest['version'])))
        for mid, name in [('M01','beginner-observation'),('M01','beginner-transit'),('M03','beginner-points')]:
            for suffix in ['.png', '.svg']:
                shutil.copy2(HERE / 'figures' / (name + suffix), SOURCE / f'knodes/{mid}-w0-module/media' / (name + suffix))
        write(AUDIT / 'node-coverage.json', coverage)
        write(AUDIT / 'insertions.json', drafts)
        (AUDIT / 'README.md').write_text('# 初中零基础教学补写\n\n32节正文加入前置背景、逐步示范、构造例与核对反馈。原文可从 previous 逐字取回，原节点、媒体及学习记录ID不变。原讲课、练习和实验保留；本次不是新一轮完整媒体生成。\n\n未进行真实学生试教；本地iPad没有接入Python执行服务，不能把阅读/笔记当作实际Notebook运行。K3是深入材料，仍需进一步展开高阶统计教学。\n')
        manifest['content_revision'] = REVISION
        manifest['status'] = 'beginner-text-revision-local-review'
        manifest['updated_at'] = '2026-11-26'
        # Existing entries retain all metadata; register new audit/media files too.
        entries = {e['path']: e for e in manifest['files']}
        changed = [p for p in AUDIT.rglob('*') if p.is_file()]
        for _, directory, _, author_path, _, _, _ in prepared:
            changed += [directory / 'lesson.md', directory / 'assignment.md', directory / 'theories.json', directory / 'content-history.json', author_path]
        changed += list(SOURCE.glob('knodes/*/media/beginner-*'))
        for path in changed:
            rel = str(path.relative_to(SOURCE))
            entries[rel] = dict(entries.get(rel, {}), path=rel, sha256=sha(path), size=path.stat().st_size)
        manifest['files'] = [entries[k] for k in sorted(entries)]
        manifest['total_size_bytes'] = sum(e['size'] for e in manifest['files'])
        write(SOURCE / 'manifest.json', manifest)
    write(HERE / 'node-coverage.json', coverage)
    print(json.dumps({'applied': apply, 'nodes': len(coverage), 'old_han': sum(c['old_han'] for c in coverage),
        'new_han': sum(c['new_han'] for c in coverage), 'originals_preserved': True}, ensure_ascii=False))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--apply', action='store_true')
    main(parser.parse_args().apply)
