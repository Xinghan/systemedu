import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  type Lang,
  type ServerFrame,
  SpeakRequestSchema,
  StopRequestSchema,
  type VisemeFrame,
} from "@systemdighuman/shared";
import { envelopeAlign } from "../align/envelope.js";
import type { TtsAdapter } from "../tts/adapter.js";
import { wordsToVisemeTrack } from "../viseme/normalizer.js";
import type { SessionRegistry } from "../ws/session.js";

export interface RoutesDeps {
  registry: SessionRegistry;
  tts: TtsAdapter;
  align: (args: { audioPath: string; text: string; lang: Lang }) => Promise<{
    wordSegments: { word: string; start: number; end: number }[];
  }>;
}

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

export function makeHttpHandler(deps: RoutesDeps) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (req.method === "OPTIONS") {
        res.writeHead(204, CORS_HEADERS).end();
        return;
      }
      if (req.method === "GET" && req.url === "/api/health") {
        res.writeHead(200, { ...CORS_HEADERS, "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      if (req.method === "POST" && req.url === "/api/speak") {
        await handleSpeak(req, res, deps);
        return;
      }
      if (req.method === "POST" && req.url === "/api/stop") {
        await handleStop(req, res, deps);
        return;
      }
      res.writeHead(404, CORS_HEADERS).end("not found");
    } catch (err) {
      res.writeHead(500, { ...CORS_HEADERS, "content-type": "application/json" });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
  };
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = Buffer.concat(chunks).toString("utf-8");
  return body ? JSON.parse(body) : {};
}

async function handleSpeak(
  req: IncomingMessage,
  res: ServerResponse,
  deps: RoutesDeps,
): Promise<void> {
  const body = await readJson(req);
  const parsed = SpeakRequestSchema.safeParse(body);
  if (!parsed.success) {
    res.writeHead(400, { ...CORS_HEADERS, "content-type": "application/json" });
    res.end(JSON.stringify({ error: parsed.error.message }));
    return;
  }
  const { session_id, text, lang, voice_id } = parsed.data;
  const session = deps.registry.get(session_id);
  if (!session) {
    res.writeHead(409, { ...CORS_HEADERS, "content-type": "application/json" });
    res.end(JSON.stringify({ error: "no connected session" }));
    return;
  }

  const utteranceId = parsed.data.utterance_id ?? randomUUID();
  res.writeHead(202, { ...CORS_HEADERS, "content-type": "application/json" });
  res.end(JSON.stringify({ utterance_id: utteranceId }));

  const tts = await deps.tts.synthesize({ text, lang, voiceId: voice_id });

  let track: VisemeFrame[];
  try {
    const tempPath = await writeTemp(tts.audioBytes, tts.codec);
    const alignRes = await deps.align({ audioPath: tempPath, text, lang });
    if (alignRes.wordSegments.length === 0) {
      track = envelopeAlign(tts.audioBytes, tts.codec, tts.durationMs);
    } else {
      track = wordsToVisemeTrack(alignRes.wordSegments, tts.durationMs, lang);
    }
  } catch {
    track = envelopeAlign(tts.audioBytes, tts.codec, tts.durationMs);
  }

  const send = (f: ServerFrame) => session.send(JSON.stringify(f));
  send({ type: "speech_start", utterance_id: utteranceId, duration_ms: tts.durationMs, lang });
  send({
    type: "audio_header",
    utterance_id: utteranceId,
    codec: tts.codec,
    byte_length: tts.audioBytes.length,
  });
  session.send(tts.audioBytes);
  send({ type: "viseme_track", utterance_id: utteranceId, frames: track });
  send({ type: "speech_end", utterance_id: utteranceId });
}

async function handleStop(
  req: IncomingMessage,
  res: ServerResponse,
  _deps: RoutesDeps,
): Promise<void> {
  const body = await readJson(req);
  const parsed = StopRequestSchema.safeParse(body);
  if (!parsed.success) {
    res.writeHead(400, { ...CORS_HEADERS, "content-type": "application/json" });
    res.end(JSON.stringify({ error: parsed.error.message }));
    return;
  }
  const session = _deps.registry.get(parsed.data.session_id);
  if (session) {
    session.send(
      JSON.stringify({
        type: "speech_interrupt",
        utterance_id: parsed.data.utterance_id ?? "",
      }),
    );
  }
  res.writeHead(200, CORS_HEADERS).end("{}");
}

async function writeTemp(buf: Buffer, codec: "mp3" | "wav" | "opus"): Promise<string> {
  const { writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const path = join(tmpdir(), `sdh-${Date.now()}-${Math.random().toString(36).slice(2)}.${codec}`);
  await writeFile(path, buf);
  return path;
}
