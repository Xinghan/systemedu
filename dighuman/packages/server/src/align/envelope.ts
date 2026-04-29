import type { Buffer } from "node:buffer";
import type { VisemeFrame } from "@systemdighuman/shared";

const WINDOW_MS = 40;

export function envelopeAlign(
  audioBytes: Buffer,
  codec: "mp3" | "wav",
  durationMsHint: number,
): VisemeFrame[] {
  if (codec !== "wav") {
    return synthesizeCoarse(durationMsHint);
  }
  const samples = extractWavSamples(audioBytes);
  if (!samples) return synthesizeCoarse(durationMsHint);

  const { data, sampleRate } = samples;
  const windowSamples = Math.max(1, Math.round((WINDOW_MS / 1000) * sampleRate));
  const frames: VisemeFrame[] = [];

  let peakRms = 1;
  const rmsValues: number[] = [];
  for (let i = 0; i < data.length; i += windowSamples) {
    let sumSq = 0;
    const end = Math.min(i + windowSamples, data.length);
    for (let j = i; j < end; j++) sumSq += data[j]! * data[j]!;
    const rms = Math.sqrt(sumSq / Math.max(1, end - i));
    rmsValues.push(rms);
    if (rms > peakRms) peakRms = rms;
  }

  for (let k = 0; k < rmsValues.length; k++) {
    const weight = Math.min(1, rmsValues[k]! / peakRms);
    const tMs = Math.round((k * windowSamples * 1000) / sampleRate);
    const viseme = weight < 0.15 ? "SIL" : "AA";
    frames.push({ t_ms: tMs, viseme, weight: viseme === "SIL" ? 0 : weight });
  }
  return frames;
}

function synthesizeCoarse(durationMs: number): VisemeFrame[] {
  const frames: VisemeFrame[] = [];
  for (let t = 0; t < durationMs; t += WINDOW_MS) {
    frames.push({ t_ms: t, viseme: "AA", weight: 0.5 });
  }
  frames.push({ t_ms: durationMs, viseme: "SIL", weight: 0 });
  return frames;
}

function extractWavSamples(buf: Buffer): { data: Int16Array; sampleRate: number } | null {
  if (buf.length < 44) return null;
  if (buf.subarray(0, 4).toString() !== "RIFF" || buf.subarray(8, 12).toString() !== "WAVE")
    return null;
  const sampleRate = buf.readUInt32LE(24);
  const bitsPerSample = buf.readUInt16LE(34);
  if (bitsPerSample !== 16) return null;
  const dataOffset = findChunk(buf, "data");
  if (dataOffset < 0) return null;
  const dataSize = buf.readUInt32LE(dataOffset + 4);
  const start = dataOffset + 8;
  const slice = buf.subarray(start, start + dataSize);
  const data = new Int16Array(slice.buffer, slice.byteOffset, slice.length / 2);
  return { data, sampleRate };
}

function findChunk(buf: Buffer, name: string): number {
  let i = 12;
  while (i + 8 <= buf.length) {
    const tag = buf.subarray(i, i + 4).toString();
    const size = buf.readUInt32LE(i + 4);
    if (tag === name) return i;
    i += 8 + size;
  }
  return -1;
}
