import { Buffer } from "node:buffer";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import { startServer } from "../src/index.js";

describe("HTTP routes with stub TTS", () => {
  let server: Awaited<ReturnType<typeof startServer>>;
  let httpUrl: string;
  let wsUrl: string;

  beforeEach(async () => {
    const stubTts = {
      synthesize: vi.fn(async () => ({
        audioBytes: Buffer.from("stub"),
        codec: "mp3" as const,
        sampleRate: 24000,
        durationMs: 500,
      })),
    };
    const stubAlign = vi.fn(async () => ({
      wordSegments: [{ word: "hi", start: 0.05, end: 0.4 }],
    }));

    server = await startServer({
      port: 0,
      tts: stubTts,
      align: stubAlign,
    });
    const addr = server.handle.httpServer.address() as AddressInfo;
    httpUrl = `http://127.0.0.1:${addr.port}`;
    wsUrl = `ws://127.0.0.1:${addr.port}/ws?session_id=s1`;
  });

  afterEach(async () => {
    await server.close();
  });

  it("health endpoint returns 200", async () => {
    const res = await fetch(`${httpUrl}/api/health`);
    expect(res.status).toBe(200);
  });

  it("speak rejects unknown session with 409", async () => {
    const res = await fetch(`${httpUrl}/api/speak`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session_id: "missing", text: "hi", lang: "en" }),
    });
    expect(res.status).toBe(409);
  });

  it("speak sends frames to connected session", async () => {
    const frames: unknown[] = [];
    const client = new WebSocket(wsUrl);
    client.on("message", (d, isBinary) => {
      if (isBinary) frames.push({ type: "binary", size: (d as Buffer).length });
      else frames.push(JSON.parse(d.toString()));
    });
    await new Promise<void>((r) => client.once("open", () => r()));

    const res = await fetch(`${httpUrl}/api/speak`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session_id: "s1", text: "hi", lang: "en" }),
    });
    expect(res.status).toBe(202);

    await new Promise((r) => setTimeout(r, 300));
    const types = frames.map((f) =>
      typeof f === "object" && f !== null && "type" in f ? (f as { type: string }).type : "binary",
    );
    expect(types).toContain("speech_start");
    expect(types).toContain("audio_header");
    expect(types).toContain("viseme_track");
    expect(types).toContain("speech_end");
    client.close();
  });
});
