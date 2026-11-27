"""Export the existing Mars journey without inventing or renumbering lessons."""
import json
import re
import subprocess
from pathlib import Path


def export_ipad_mission(repo: Path, out: Path, catalog):
    lib = repo / 'packages/student-web/src/lib/project-lines'
    source = json.loads((lib / 'space-curriculum.json').read_text())
    courses = {c['id']: c for c in catalog['courses']}
    nodes = {f"{c['id']}:{n['moduleId']}": n for c in catalog['courses'] for n in c['modules']}
    points = [(230,302),(599,245),(952,286),(1321,369),(1321,741),(952,794),(553,753),(215,655)]

    def asset(path):
        file = out / path.lstrip('/')
        if not file.is_file() or not file.stat().st_size:
            raise ValueError(f'Missing iPad mission asset: {path}')
        return path

    destinations = []
    for ref in source['modules']:
        node = nodes.get(ref['ref'])
        if not node or courses[ref['project']]['version'] != ref['version']:
            raise ValueError(f'Missing/version-mismatched Mars node: {ref["ref"]}')
        destinations.append(dict(ref=ref['ref'], activityId=node['id'], station=ref['station'],
                                 mode=ref['mode'], note=ref['note'], title=node['title']))
    if len({x['ref'] for x in destinations}) != len(destinations):
        raise ValueError('Duplicate Mars mission destination')
    by_ref = {x['ref']: x for x in destinations}
    stations = []
    for station, (x,y) in zip(source['stations'], points, strict=True):
        for ref in station['steps']:
            if ref not in by_ref or by_ref[ref]['station'] != station['id']:
                raise ValueError(f'Invalid mission step: {ref}')
        stations.append({**station, 'x':x, 'y':y,
                         'image':asset(f'/mission/space/stations/{station["id"]}-v1-960.webp')})
    micro = [dict(ref=f'{slug}:M01', activityId=nodes[f'{slug}:M01']['id'], station='first-contact',
                  mode='experience', note='', title=nodes[f'{slug}:M01']['title']) for slug in source['micro']]
    side_quest = courses[source['sideQuest']]
    side = [dict(ref=f'{side_quest["id"]}:{n["moduleId"]}', activityId=n['id'], station='research',
                 mode='research', note='行星观测与研究', title=n['title']) for n in side_quest['modules']]
    metadata = re.findall(r'(\d): \{ title: "([^"]+)", description: "([^"]+)"', (lib/'space-stage-films.ts').read_text())
    if len(metadata) != 5: raise ValueError('Could not read all original stage film descriptions')
    films = [dict(id='opening',title='火星探索序章',description='林岚介绍这次探索任务。',
                  path=asset('/mission/rover/video/rover-briefing-v1.mp4'),
                  captions=asset('/mission/rover/video/rover-briefing-zh.vtt')),
             dict(id='welcome',title='任务搭档的欢迎',description='认识任务搭档林岚。',
                  path=asset('/mission/rover/video/lin-lan-welcome-v1.mp4'),
                  captions=asset('/mission/rover/video/lin-lan-welcome-zh.vtt'))]
    films += [dict(id=f'stage-{i}',title=t,description=d,
                   path=asset(f'/mission/space/video/stage-{i}-v1.mp4'),
                   captions=asset(f'/mission/space/video/stage-{i}-zh.vtt')) for i,t,d in metadata]
    # A frame from the same bundled briefing that opens from the task homepage.
    opening = next(f for f in films if f['id'] == source['missionHome']['filmId'])
    poster = 'content/missions/space-program-briefing.jpg'
    (out / poster).parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-ss', '1.3', '-i',
                    str(out / opening['path'].lstrip('/')), '-frames:v', '1', '-vf',
                    'scale=1080:-2', '-q:v', '3', str(out / poster)], check=True)
    opening['poster'] = asset('/' + poster)
    project_ids = list(dict.fromkeys([*source['micro'], *[m['project'] for m in source['modules']],source['sideQuest']]))
    # Legacy editions stay reachable from the original project collection.
    project_ids += [c for c in courses if c.endswith('-legacy-v1') and c.removesuffix('-legacy-v1') in project_ids]
    result = dict(schemaVersion=1,id='space',version=source['version'],title=source['mission'],
                  home=source['missionHome'], commander=source['commander'], homeImage=asset('/mission/space/research-control-room-v1-1536.webp'),
                  mapImage=asset('/mission/rover/campus-map-v1.webp'),
                  stations=stations,nodes=destinations,micro=micro,research=side,
                  courseIds=project_ids,films=films,bridges=source['bridges'])
    target = out/'content/missions/space.json';target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')))
    export_expedition(repo, out, result, asset)
    return result


def export_expedition(repo, out, mission, asset):
    story = json.loads((repo / 'packages/ios-app/content/space-expedition.json').read_text())
    refs = [ref for chapter in story['chapters'] for ref in chapter['refs']]
    expected = {n['ref'] for n in mission['micro'] + mission['nodes'] + mission['research']}
    if len(refs) != len(set(refs)) or set(refs) != expected:
        raise ValueError('Expedition must preserve every original node exactly once')
    asset(story['commanderImage'])
    for role in story['roles']:
        asset(role['artwork'])
    images = set()
    for chapter in story['chapters']:
        asset(chapter['image']); images.add(chapter['image'])
        if not chapter['delivery']['evidence'] or not chapter['delivery']['checks']:
            raise ValueError('Every chapter must produce a checkable work product')
    if len(images) != len(story['chapters']):
        raise ValueError('Chapter artwork must be distinct')
    items = [('welcome', '欢迎加入远航队', story['goal'])] + [(c['id'], c['title'], c['arrival']) for c in story['chapters']]
    story['films'] = [dict(id='expedition-' + ident, title=title, description=description,
                           path=asset(f'/mission/space/expedition-v2/video/{ident}.mp4'),
                           captions=asset(f'/mission/space/expedition-v2/video/{ident}.vtt'),
                           poster=asset(f'/mission/space/expedition-v2/video/{ident}-poster.jpg'))
                      for ident, title, description in items]
    for chapter_id, film in story.get('completionFilms', {}).items():
        if chapter_id not in {chapter['id'] for chapter in story['chapters']}:
            raise ValueError('Completion film must belong to an existing chapter')
        for key in ['path', 'captions', 'poster']:
            film[key] = asset(film[key])
    for ref, film in story.get('lessonCompletionFilms', {}).items():
        if ref not in expected:
            raise ValueError('Lesson completion film must belong to an existing node')
        for key in ['path', 'captions', 'poster']:
            film[key] = asset(film[key])
    (out / 'content/missions/space-expedition.json').write_text(json.dumps(story, ensure_ascii=False, separators=(',', ':')))
    # Presentation context is additive; retain source lessons, media, IDs and versions verbatim.
    catalog = json.loads((out / 'content/catalog.json').read_text())
    by_id = {n['id']: n for c in catalog['courses'] for n in c['modules']}
    by_ref = {n['ref']: n for n in mission['micro'] + mission['nodes'] + mission['research']}
    for chapter_index, chapter in enumerate(story['chapters']):
        for step, ref in enumerate(chapter['refs']):
            node = by_id[by_ref[ref]['activityId']]
            path = out / node['path'].lstrip('/')
            lesson = json.loads(path.read_text())
            lesson['expedition'] = dict(chapterId=chapter['id'], chapterTitle=chapter['title'],
                chapterNumber=chapter_index + 1, act=chapter['act'], image=chapter['image'],
                arrival=chapter['arrival'], actions=chapter.get('actions', []),
                outcome=chapter['delivery']['title'], step=step + 1, total=len(chapter['refs']),
                commanderImage=story['commanderImage'])
            path.write_text(json.dumps(lesson, ensure_ascii=False, separators=(',', ':')))
