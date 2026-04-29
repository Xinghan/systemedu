import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { alignWithWhisperX } from "../src/align/whisperx.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const enFixture = join(__dirname, "fixtures", "en-sample.wav");
const zhFixture = join(__dirname, "fixtures", "zh-sample.wav");

const itIfFixtureAndEnv = (fixturePath: string) =>
  existsSync(fixturePath) && process.env.RUN_WHISPERX ? it : it.skip;

describe("alignWithWhisperX", () => {
  it("throws a helpful error when venv is missing", async () => {
    await expect(
      alignWithWhisperX({
        audioPath: "/does/not/exist.wav",
        text: "hello",
        lang: "en",
        venvPath: "/does/not/exist",
      }),
    ).rejects.toThrow(/venv|python/i);
  });

  itIfFixtureAndEnv(enFixture)(
    "aligns English audio",
    async () => {
      const result = await alignWithWhisperX({
        audioPath: enFixture,
        text: "Hello world from SystemDigHuman.",
        lang: "en",
      });
      expect(result.wordSegments.length).toBeGreaterThan(0);
      expect(result.wordSegments[0]!.start).toBeGreaterThanOrEqual(0);
    },
    180_000,
  );

  itIfFixtureAndEnv(zhFixture)(
    "aligns Chinese audio",
    async () => {
      const result = await alignWithWhisperX({
        audioPath: zhFixture,
        text: "你好,这是测试音频。",
        lang: "zh",
      });
      expect(result.wordSegments.length).toBeGreaterThan(0);
    },
    180_000,
  );
});
