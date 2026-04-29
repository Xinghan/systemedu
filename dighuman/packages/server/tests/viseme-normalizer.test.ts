import { describe, expect, it } from "vitest";
import { wordsToVisemeTrack } from "../src/viseme/normalizer.js";

describe("wordsToVisemeTrack", () => {
  it("returns a single SIL frame for empty input", () => {
    const track = wordsToVisemeTrack([], 0, "en");
    expect(track).toEqual([{ t_ms: 0, viseme: "SIL", weight: 0 }]);
  });

  it("emits open-vowel visemes for English words", () => {
    const track = wordsToVisemeTrack([{ word: "hello", start: 0.1, end: 0.5 }], 1000, "en");
    expect(track.some((f) => f.viseme !== "SIL" && f.weight > 0)).toBe(true);
    expect(track[0]!.viseme).toBe("SIL");
    expect(track[track.length - 1]!.viseme).toBe("SIL");
  });

  it("picks OH for o-final words", () => {
    const track = wordsToVisemeTrack([{ word: "go", start: 0, end: 0.3 }], 500, "en");
    expect(track.some((f) => f.viseme === "OH")).toBe(true);
  });

  it("handles Chinese characters with default AA", () => {
    const track = wordsToVisemeTrack([{ word: "你好", start: 0, end: 0.4 }], 500, "zh");
    expect(track.some((f) => f.viseme === "AA")).toBe(true);
  });

  it("keeps frames sorted by t_ms", () => {
    const track = wordsToVisemeTrack(
      [
        { word: "hi", start: 0, end: 0.2 },
        { word: "world", start: 0.3, end: 0.8 },
      ],
      1000,
      "en",
    );
    for (let i = 1; i < track.length; i++) {
      expect(track[i]!.t_ms).toBeGreaterThanOrEqual(track[i - 1]!.t_ms);
    }
  });

  it("bounds weights between 0 and 1", () => {
    const track = wordsToVisemeTrack([{ word: "check", start: 0, end: 0.3 }], 500, "en");
    for (const f of track) {
      expect(f.weight).toBeGreaterThanOrEqual(0);
      expect(f.weight).toBeLessThanOrEqual(1);
    }
  });
});
