import type { Lang, VisemeFrame } from "@systemdighuman/shared";
import type { WordSegment } from "../align/whisperx.js";
import { chineseWordToViseme, englishWordToViseme } from "./phoneme-map.js";

export function wordsToVisemeTrack(
  words: WordSegment[],
  totalDurationMs: number,
  lang: Lang,
): VisemeFrame[] {
  if (words.length === 0) {
    return [{ t_ms: 0, viseme: "SIL", weight: 0 }];
  }

  const frames: VisemeFrame[] = [];
  frames.push({ t_ms: 0, viseme: "SIL", weight: 0 });

  for (const w of words) {
    const startMs = Math.max(0, Math.round(w.start * 1000));
    const endMs = Math.max(startMs + 20, Math.round(w.end * 1000));
    const peakMs = startMs + Math.round((endMs - startMs) * 0.4);
    const viseme = lang === "en" ? englishWordToViseme(w.word) : chineseWordToViseme(w.word);

    frames.push({ t_ms: startMs, viseme, weight: 0.8 });
    frames.push({ t_ms: peakMs, viseme, weight: 0.6 });
    frames.push({ t_ms: endMs, viseme: "SIL", weight: 0 });
  }

  const end = Math.max(totalDurationMs, frames[frames.length - 1]!.t_ms);
  frames.push({ t_ms: end, viseme: "SIL", weight: 0 });

  frames.sort((a, b) => a.t_ms - b.t_ms);
  return frames;
}
