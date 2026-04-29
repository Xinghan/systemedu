import { Buffer } from "node:buffer";
import type { TtsAdapter, TtsRequest, TtsResult } from "./adapter.js";
import { TtsError } from "./adapter.js";

const ENDPOINT =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";

interface DashScopeResponse {
  output?: {
    audio?: {
      data?: string;
      url?: string;
      expires_at?: number;
    };
    finish_reason?: string;
  };
  request_id?: string;
  code?: string;
  message?: string;
}

export interface QwenTtsOptions {
  apiKey: string;
  model?: string;
  defaultVoice?: string;
  fetchImpl?: typeof fetch;
}

export class QwenTtsAdapter implements TtsAdapter {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly defaultVoice: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: QwenTtsOptions) {
    if (!opts.apiKey) throw new TtsError("QwenTtsAdapter requires apiKey");
    this.apiKey = opts.apiKey;
    this.model = opts.model ?? "qwen3-tts-flash";
    this.defaultVoice = opts.defaultVoice ?? "Cherry";
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async synthesize(req: TtsRequest): Promise<TtsResult> {
    const voice = req.voiceId ?? this.defaultVoice;
    const body = {
      model: this.model,
      input: { text: req.text, voice },
      parameters: {},
    };

    const res = await this.fetchImpl(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new TtsError(`DashScope HTTP ${res.status}: ${text.slice(0, 400)}`);
    }

    const json = (await res.json()) as DashScopeResponse;
    const audio = json.output?.audio;
    if (!audio) throw new TtsError("DashScope response missing output.audio");

    let audioBytes: Buffer;
    if (audio.data) {
      audioBytes = Buffer.from(audio.data, "base64");
    } else if (audio.url) {
      const audioRes = await this.fetchImpl(audio.url);
      if (!audioRes.ok) throw new TtsError(`Audio URL fetch failed: ${audioRes.status}`);
      audioBytes = Buffer.from(await audioRes.arrayBuffer());
    } else {
      throw new TtsError("DashScope audio had neither data nor url");
    }

    const codec = detectCodec(audioBytes);
    const durationMs = estimateDurationMs(audioBytes, codec);
    const sampleRate = codec === "wav" ? readWavSampleRate(audioBytes) : 24_000;

    return { audioBytes, codec, sampleRate, durationMs };
  }
}

function detectCodec(buf: Buffer): "mp3" | "wav" {
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString() === "RIFF" &&
    buf.subarray(8, 12).toString() === "WAVE"
  ) {
    return "wav";
  }
  return "mp3";
}

function readWavSampleRate(buf: Buffer): number {
  if (buf.length < 28) return 24_000;
  return buf.readUInt32LE(24);
}

function estimateDurationMs(buf: Buffer, codec: "mp3" | "wav"): number {
  if (codec === "wav" && buf.length >= 44) {
    const sampleRate = buf.readUInt32LE(24);
    const byteRate = buf.readUInt32LE(28);
    if (byteRate > 0) return Math.round(((buf.length - 44) / byteRate) * 1000);
    const bitsPerSample = buf.readUInt16LE(34);
    const channels = buf.readUInt16LE(22);
    const bytesPerSample = (bitsPerSample / 8) * channels;
    if (bytesPerSample > 0 && sampleRate > 0) {
      return Math.round(((buf.length - 44) / (sampleRate * bytesPerSample)) * 1000);
    }
  }
  return Math.round((buf.length / 4000) * 1000);
}
