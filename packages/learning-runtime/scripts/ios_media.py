"""Select separately authored iOS variants; never rewrite desktop source media."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import re

CHECKS = {'layout', 'behavior', 'science', 'restoration', 'offline', 'ios'}
ASSET_SUFFIXES = {'.html', '.js', '.css', '.json', '.png', '.jpg', '.jpeg', '.webp', '.svg',
                  '.glb', '.gltf', '.bin', '.wasm', '.woff', '.woff2', '.ttf', '.mp3',
                  '.m4a', '.wav', '.mp4', '.vtt', '.csv', '.txt'}


def local_file(root, value):
    if not isinstance(value, str) or not value or '\\' in value:
        raise ValueError(f'Invalid iOS file path: {value!r}')
    relative = PurePosixPath(value)
    if relative.is_absolute() or any(p in {'..', '.'} or p.startswith('.') for p in value.split('/')):
        raise ValueError(f'Unsafe iOS file path: {value!r}')
    p = root
    for part in relative.parts:
        p = p / part
        if p.is_symlink():
            raise ValueError(f'Symlink in iOS file path: {value!r}')
    if not p.resolve().is_relative_to(root.resolve()) or not p.is_file():
        raise ValueError(f'Missing iOS file: {value!r}')
    return p


def read_variants(knode, sections, course_id, module_id, *, preview=False):
    """Return selected entries, tracked sources, and per-resource adaptation status."""
    knode = Path(knode)
    manifest = knode / 'mobile/ios/manifest.json'
    source = sections.get('rendered_sections', {})
    coverage = {key: 'legacy' for key, item in source.items() if item.get('mode') in {'animation', 'game'}}
    if not manifest.exists():
        return {}, [], coverage
    local_file(knode, 'mobile/ios/manifest.json')
    data = json.loads(manifest.read_text())
    if data.get('schema_version') != 1 or data.get('target') != 'ios' or not isinstance(data.get('variants'), dict):
        raise ValueError(f'Invalid iOS manifest: {manifest}')
    selected, tracked = {}, [manifest]
    for key, variant in data['variants'].items():
        if key not in coverage or not isinstance(variant, dict) or variant.get('kind') != source[key].get('mode'):
            raise ValueError(f'iOS variant must retain an existing animation/game ID and kind: {key}')
        status = variant.get('status')
        if status not in {'draft', 'verified'}:
            raise ValueError(f'Invalid iOS variant status: {key}')
        coverage[key] = status
        if status == 'draft' and not preview:
            continue
        revision = variant.get('revision', '')
        if not isinstance(revision, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,63}', revision):
            raise ValueError(f'Invalid iOS revision: {key}')
        state_key = f'ios:{course_id}:{module_id}:{key}:{revision}'
        if variant.get('state_key') != state_key:
            raise ValueError(f'iOS state key must be versioned and scoped: {key}')
        entry, files = variant.get('entry'), variant.get('files')
        if not isinstance(entry, str) or not entry.startswith(f'{key}/{revision}/') or not entry.endswith('.html'):
            raise ValueError(f'iOS entry must be HTML inside its resource/version directory: {key}')
        if not isinstance(files, dict) or not files or entry not in files:
            raise ValueError(f'Missing iOS file inventory: {key}')
        for relative, expected in files.items():
            p = local_file(manifest.parent, relative)
            excluded = {'authoring', 'archive', 'archives', 'node_modules', '__pycache__', 'build', 'dist', 'verification', '_review'}
            if excluded.intersection(PurePosixPath(relative).parts) or p.suffix.lower() not in ASSET_SUFFIXES or hashlib.sha256(p.read_bytes()).hexdigest() != expected:
                raise ValueError(f'iOS file type or hash mismatch: {key}/{relative}')
            tracked.append(p)
        if status == 'verified':
            review_path = variant.get('review', '')
            if not isinstance(review_path, str) or not review_path.startswith('authoring/ios/'):
                raise ValueError(f'Missing iOS review path: {key}')
            review_file = local_file(knode, review_path)
            review = json.loads(review_file.read_text())
            checks = review.get('checks', {})
            if review.get('status') != 'pass' or not isinstance(checks, dict) or any(checks.get(c) != 'pass' for c in CHECKS) or review.get('files') != files:
                raise ValueError(f'Incomplete or stale iOS review: {key}')
            evidence = review.get('evidence')
            if not isinstance(evidence, list) or not evidence:
                raise ValueError(f'Missing iOS evidence: {key}')
            for relative in evidence:
                if not isinstance(relative, str) or not relative.startswith('authoring/ios/'):
                    raise ValueError(f'Invalid iOS evidence path: {key}')
                tracked.append(local_file(knode, relative))
            tracked.append(review_file)
        else:
            coverage[key] = 'preview'
        selected[key] = dict(path='mobile/ios/' + entry, revision=revision, state_key=state_key, files=list(files))
    return selected, tracked, coverage
