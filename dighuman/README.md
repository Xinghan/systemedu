# Dighuman — 2D Speaking Avatar Service

This directory is a **port of the [systemdighuman](https://github.com/Xinghan/systemdighuman) project**
into the SystemEdu monorepo. The original repo at `~/Dev/systemdighuman` is the source of truth and
is **not modified by SystemEdu**.

## What's here

- `packages/server/` — Node.js + ws server. `POST /api/speak` triggers TTS + viseme alignment, results streamed over WebSocket.
- `packages/shared/` — Zod schemas and viseme types shared between server and frontend.
- `figure/` — Original 2D character art (lizard) source. **Mirror copied to `web/public/dighuman/figure/`** for Next.js to serve.

## What is NOT here (vs upstream)

- 3D avatar (Three.js) — abandoned, SystemEdu only uses 2D.
- `packages/client/` — replaced by Next.js components in `web/src/components/dighuman/` (see Commit B).
- `packages/server/vendor/whisperx/` — Python venv for forced alignment. Optional. Without it,
  the server falls back to RMS-envelope lip-sync (degraded but functional).

## Setup (one-off)

```bash
cd dighuman
pnpm install
```

Requires Node.js 22+ and pnpm 9+.

## Running

`scripts/restart.sh` (in SystemEdu root) starts dighuman automatically on port `8787`
(override with `DIGHUMAN_PORT=...`).

To run standalone for debugging:

```bash
cd dighuman/packages/server
PORT=8787 pnpm dev
```

Health check: `curl http://localhost:8787/api/health` → `{"ok":true}`.

## API

- `POST /api/speak` — body `{session_id, text, lang, voice_id?, utterance_id?}`. Returns `{utterance_id}`. Audio + viseme stream goes to the matching WebSocket session.
- `POST /api/stop` — interrupt current utterance.
- `WS /ws?session=<id>` — client connects with a session id, receives audio bytes + JSON viseme frames.

See original spec: `~/Dev/systemdighuman/docs/superpowers/specs/2026-04-24-systemdighuman-design.md`.

## Config

Reads DashScope (Qwen TTS) API key from `~/.systemedu/config.yaml` field `llm.providers.qwen.api_key` (same as SystemEdu Python backend).

Fallback order: `DASHSCOPE_API_KEY` env var → `~/.systemedu/config.yaml` → error.
