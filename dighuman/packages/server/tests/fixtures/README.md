# Test fixtures

Audio files (`*.mp3`, `*.wav`) here are generated locally via `pnpm smoke:tts`.
They're gitignored because they require a DashScope API key and are large
binaries. Regenerate them by running:

```bash
pnpm smoke:tts "Hello world from SystemDigHuman." en
cp /tmp/sdh-smoke.wav packages/server/tests/fixtures/en-sample.wav

pnpm smoke:tts "你好,这是测试音频。" zh
cp /tmp/sdh-smoke.wav packages/server/tests/fixtures/zh-sample.wav
```

These fixtures are used only by `align-whisperx.test.ts` when run with
`RUN_WHISPERX=1`. Without them (or without the WhisperX venv installed),
those tests skip cleanly.
