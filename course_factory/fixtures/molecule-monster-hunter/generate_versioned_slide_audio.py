"""Generate source-hashed M81 narration via the existing configured TTS adapter."""
import hashlib
import importlib.util
import json
import wave
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from systemedu.core.config import get_config
from systemedu.core.education.tts import _without_proxy_env

COURSE = Path('/Users/xinghan/Dev/systemeduidea/projects_data/molecule-monster-hunter')
NODE = COURSE / 'knodes/M81-w0-module'
spec = importlib.util.spec_from_file_location('existing_audio_generator', '/Users/xinghan/Dev/systemeduidea/scripts/gen_lesson_audio.py')
adapter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(adapter)

def main():
    cfg = get_config().tts
    if not cfg.api_key:
        raise RuntimeError('TTS configuration missing')
    data = json.loads((NODE / 'slides.json').read_text())
    tasks = []
    for i, slide in enumerate(data['slides']):
        narration = slide['audio_script']
        digest = hashlib.sha256((cfg.model + cfg.voice + narration).encode()).hexdigest()[:12]
        path = NODE / 'audio' / f'evidence-v1-{i + 1:02}-{digest}.wav'
        tasks.append((slide, narration, path))

    def generate(task):
        slide, narration, path = task
        if not adapter._is_valid_wav(path):
            adapter._synthesize_one(narration, path, cfg.api_key, cfg.model, cfg.voice)
        with wave.open(str(path), 'rb') as audio:
            duration = audio.getnframes() / audio.getframerate()
        if not 3 < duration < 180:
            raise RuntimeError(f'Invalid duration for {path.name}: {duration}')
        return slide, path, duration

    results = []
    with _without_proxy_env(), ThreadPoolExecutor(max_workers=2) as pool:
        for future in as_completed([pool.submit(generate, task) for task in tasks]):
            slide, path, duration = future.result()
            results.append((slide, path))
            print(f'{path.name}: {duration:.1f}s, {path.stat().st_size} bytes', flush=True)
    for slide, path in results:
        slide['audio_path'] = path.relative_to(COURSE).as_posix()
    (NODE / 'slides.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print(f'Mapped {len(results)} new narration files; previous audio preserved.', flush=True)

if __name__ == '__main__':
    main()
