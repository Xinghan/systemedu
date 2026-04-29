import { describe, expect, it } from "vitest";
import { loadDashscopeKey } from "../src/config.js";
import { QwenTtsAdapter } from "../src/tts/qwen.js";

const itIntegration = process.env.RUN_TTS_INTEGRATION ? it : it.skip;

describe("QwenTtsAdapter", () => {
  it("constructs without error given a key", () => {
    const adapter = new QwenTtsAdapter({ apiKey: "sk-dummy" });
    expect(adapter).toBeInstanceOf(QwenTtsAdapter);
  });

  it("throws when constructed without apiKey", () => {
    expect(() => new QwenTtsAdapter({ apiKey: "" })).toThrow();
  });

  itIntegration(
    "synthesizes real English audio",
    async () => {
      const adapter = new QwenTtsAdapter({ apiKey: loadDashscopeKey() });
      const result = await adapter.synthesize({ text: "Hello world.", lang: "en" });
      expect(result.audioBytes.length).toBeGreaterThan(1000);
      expect(["mp3", "wav"]).toContain(result.codec);
      expect(result.durationMs).toBeGreaterThan(0);
    },
    60_000,
  );

  itIntegration(
    "synthesizes real Chinese audio",
    async () => {
      const adapter = new QwenTtsAdapter({ apiKey: loadDashscopeKey() });
      const result = await adapter.synthesize({ text: "你好,世界。", lang: "zh" });
      expect(result.audioBytes.length).toBeGreaterThan(1000);
    },
    60_000,
  );
});
