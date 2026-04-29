import type { Lang } from "@systemdighuman/shared";

export interface TtsRequest {
  text: string;
  lang: Lang;
  voiceId?: string;
}

export interface TtsResult {
  audioBytes: Buffer;
  codec: "mp3" | "wav";
  sampleRate: number;
  durationMs: number;
}

export interface TtsAdapter {
  synthesize(req: TtsRequest): Promise<TtsResult>;
}

export class TtsError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "TtsError";
  }
}
