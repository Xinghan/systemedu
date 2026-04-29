import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Lang } from "@systemdighuman/shared";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_VENV = resolve(__dirname, "..", "..", "vendor", "whisperx", ".venv");
const ALIGN_SCRIPT = resolve(__dirname, "..", "..", "vendor", "whisperx", "align.py");

export interface AlignOptions {
  audioPath: string;
  text: string;
  lang: Lang;
  venvPath?: string;
}

export interface WordSegment {
  word: string;
  start: number;
  end: number;
}

export interface AlignResult {
  wordSegments: WordSegment[];
}

export async function alignWithWhisperX(opts: AlignOptions): Promise<AlignResult> {
  const venv = opts.venvPath ?? DEFAULT_VENV;
  const pythonBin = join(venv, "bin", "python");
  if (!existsSync(pythonBin)) {
    throw new Error(`WhisperX venv/python not found at ${pythonBin}`);
  }
  if (!existsSync(ALIGN_SCRIPT)) {
    throw new Error(`align.py not found at ${ALIGN_SCRIPT}`);
  }

  return new Promise((resolveP, rejectP) => {
    const proc = spawn(pythonBin, [ALIGN_SCRIPT, opts.audioPath, opts.lang, opts.text], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (b) => {
      stdout += b.toString();
    });
    proc.stderr.on("data", (b) => {
      stderr += b.toString();
    });
    proc.on("error", rejectP);
    proc.on("close", (code) => {
      if (code !== 0) {
        rejectP(new Error(`WhisperX exited ${code}: ${stderr.slice(0, 500)}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as {
          word_segments?: Array<{ word: string; start: number; end: number }>;
        };
        const wordSegments = (parsed.word_segments ?? []).map((w) => ({
          word: w.word,
          start: Number(w.start),
          end: Number(w.end),
        }));
        resolveP({ wordSegments });
      } catch (err) {
        rejectP(new Error(`WhisperX stdout parse failed: ${(err as Error).message}`));
      }
    });
  });
}
