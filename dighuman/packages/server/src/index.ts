import type { Lang } from "@systemdighuman/shared";
import { alignWithWhisperX } from "./align/whisperx.js";
import { loadDashscopeKey } from "./config.js";
import { makeHttpHandler } from "./http/routes.js";
import type { TtsAdapter } from "./tts/adapter.js";
import { QwenTtsAdapter } from "./tts/qwen.js";
import { createWsServer } from "./ws/server.js";

export interface StartOptions {
  port: number;
  host?: string;
  tts?: TtsAdapter;
  align?: (args: { audioPath: string; text: string; lang: Lang }) => Promise<{
    wordSegments: { word: string; start: number; end: number }[];
  }>;
}

export async function startServer(opts: StartOptions) {
  const tts = opts.tts ?? new QwenTtsAdapter({ apiKey: loadDashscopeKey() });

  const align =
    opts.align ?? (async (args) => alignWithWhisperX(args).catch(() => ({ wordSegments: [] })));

  const handle = createWsServer({ port: opts.port, host: opts.host });
  const httpHandler = makeHttpHandler({ registry: handle.registry, tts, align });
  handle.httpServer.on("request", httpHandler);

  await new Promise<void>((r) => {
    if (handle.httpServer.listening) r();
    else handle.httpServer.once("listening", () => r());
  });

  return {
    handle,
    close: () =>
      new Promise<void>((r) => {
        handle.wss.close();
        handle.httpServer.close(() => r());
      }),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 8787);
  startServer({ port }).then(() => console.log(`SystemDigHuman server on :${port}`));
}
