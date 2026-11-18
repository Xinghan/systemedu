"""Project artwork and descriptions for the native catalog, derived from shared sources."""
import hashlib
import json
import subprocess


def prepare_presentations(repo, source, out, courses):
    public = repo / 'packages/student-web/public'
    library = repo / 'packages/student-web/src/lib/project-lines'
    read = lambda p: json.loads(p.read_text())
    zh = lambda v: v.get('zh', '') if isinstance(v, dict) else v or ''
    metadata = {x['slug']: x for x in read(library / 'course-snapshots.json')}
    for path in sorted(library.glob('*courses.json')):
        metadata.update({x['id']: x for x in read(path)})
    variants = read(library / 'project-cover-variants.json')
    # These courses have no registered project cover. Use existing, relevant artwork;
    # coverSource records the exact origin instead of pretending these are new images.
    artwork = {
        'lightkurve-transit-detective': public / 'mission/space/stations/first-contact-v1-960.webp',
        'teachopencadd-candidate-research': source / 'teachopencadd-candidate-research/images/cover.png',
        'transformer-lab': public / 'mission/computing/stations/model-v1-960.webp',
        'llm-post-training-professional': public / 'mission/computing/stations/evaluation-v1-960.webp',
    }
    summaries = {
        'transformer-lab': '从整体结构进入注意力、张量和前馈网络，通过模型操作、数学推演和 Python 练习理解 Transformer。',
        'llm-post-training-professional': '理解后训练的方法体系，完成 SFT 训练循环，并配置 LoRA 与 QLoRA。',
        'spot-a-world': '移动望远镜，选择月球或火星，拍下自己的星球照片。',
        'land-a-probe': '改变制动时机，观察下降过程，比较两次着陆。',
        'drive-and-frame': '驾驶探测车绕过岩石，调整镜头拍下地形。',
        'write-driving-rules': '编写条件判断规则，在不同路线中检验探测车的驾驶表现。',
    }
    cache = repo / 'packages/ios-app/build/cover-cache'
    cache.mkdir(parents=True, exist_ok=True)
    target = out / 'content/covers'
    target.mkdir(parents=True, exist_ok=True)
    for course in courses:
        slug = course['id'].removesuffix('-legacy-v1')
        item = metadata.get(slug, {})
        manifest_path = source / slug / 'manifest.json'
        manifest = read(manifest_path) if manifest_path.exists() else {}
        course['summary'] = summaries.get(slug) or zh(item.get('action')) or manifest.get('description') or zh(item.get('outcome'))
        course['outcome'] = zh(item.get('outcome'))
        image = artwork.get(slug)
        if image is None and item.get('coverImage'):
            image = public / item['coverImage'].lstrip('/')
        if image is None and slug in variants:
            image = public / variants[slug]['variants'][-1]['src'].lstrip('/')
        if image is None:
            image = public / 'project-lines/space-exploration' / slug / 'cover-ai.png'
        if not image.is_file():
            raise ValueError(f'Catalog cover missing for {slug}: {image}')
        if not course['summary']:
            raise ValueError(f'Catalog summary missing for {slug}')
        # JPEG works consistently in UIImage; downsize before packaging, not on every scroll.
        signature = hashlib.sha256(image.read_bytes()).hexdigest()
        cached = cache / f'{signature}-960-v1.jpg'
        if not cached.exists():
            subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', str(image),
                            '-vf', 'scale=960:640:force_original_aspect_ratio=increase,crop=960:640',
                            '-frames:v', '1', '-q:v', '3', str(cached)], check=True)
        relative = f'content/covers/{course["id"]}.jpg'
        (out / relative).write_bytes(cached.read_bytes())
        course['coverPath'] = '/' + relative
        course['coverSource'] = str(image.relative_to(public)) if image.is_relative_to(public) else 'shared/' + str(image.relative_to(source))
